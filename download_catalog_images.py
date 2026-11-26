#!/usr/bin/env python3
"""Baysöz Yazılım — NAZTECH catalog image downloader and forensic verifier.

This module uses only the Python standard library. Every candidate image is
fetched from Wikimedia Commons over HTTPS and must survive structural JPEG
validation, a complete libjpeg decode via ``djpeg``, and a deterministic
photographic-content analysis before it is installed atomically.

Publisher: Baysöz Yazılım (baysozlabs@proton.me)
"""

from __future__ import annotations

import argparse
import hashlib
import html
import http.client
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final, Iterable, Sequence

PUBLISHER: Final[str] = "Baysöz Yazılım (baysozlabs@proton.me)"
BANNER: Final[str] = (
    "Baysöz Yazılım — NAZTECH Catalog Image Verifier / "
    "Contact: baysozlabs@proton.me"
)
USER_AGENT: Final[str] = (
    "NAZTECH-Catalog-Fetcher/1.0 (mailto:baysozlabs@proton.me)"
)
API_URL: Final[str] = "https://commons.wikimedia.org/w/api.php"
COMMONS_BASE: Final[str] = "https://commons.wikimedia.org"
REQUIRED_DJPEG: Final[Path] = Path(shutil.which("djpeg") or "djpeg")
ALLOWED_HOSTS: Final[frozenset[str]] = frozenset(
    {"upload.wikimedia.org", "commons.wikimedia.org"}
)
THUMB_HOST: Final[str] = "thumb.wikimedia.org"
CONNECT_TIMEOUT_SECONDS: Final[float] = 5.0
READ_TIMEOUT_SECONDS: Final[float] = 25.0
DECODE_TIMEOUT_SECONDS: Final[float] = 30.0
MIN_BYTES: Final[int] = 15_000
MAX_BYTES: Final[int] = 25_000_000
MIN_LONG_EDGE_PX: Final[int] = 1920
GRID_SIZE: Final[int] = 128
MIN_UNIQUE_RGB: Final[int] = 4096
MIN_LUMINANCE_VARIANCE: Final[float] = 120.0
API_ATTEMPTS: Final[int] = 3
API_BACKOFF_SECONDS: Final[float] = 0.8

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent
IMG_DIR: Final[Path] = PROJECT_ROOT / "img"
ARTIFACTS_DIR: Final[Path] = PROJECT_ROOT / "artifacts"
CREDITS_PATH: Final[Path] = IMG_DIR / "CREDITS.json"
VERIFICATION_PATH: Final[Path] = ARTIFACTS_DIR / "image-verification.json"

IMAGE_INFO_PROPS: Final[str] = "url|size|mime|extmetadata"


class VerificationError(Exception):
    """A candidate or installed file failed one or more verification gates."""


class FatalError(Exception):
    """An unrecoverable condition that prevents the verifier from operating."""


@dataclass(frozen=True, slots=True)
class TargetSpec:
    """One catalog image target, with prioritized exact Commons file titles."""

    name: str
    curated_titles: tuple[str, ...]
    search_terms: tuple[str, ...]

    @property
    def filename(self) -> str:
        return f"{self.name}.jpg"

    @property
    def relative_path(self) -> str:
        return f"img/{self.filename}"

    @property
    def absolute_path(self) -> Path:
        return IMG_DIR / self.filename


TARGETS: Final[tuple[TargetSpec, ...]] = (
    TargetSpec(
        name="hikvision_bullet",
        curated_titles=(
            "File:CCTV Camera Philippines at Gigaworkz Technologies Inc.JPG",
            "File:CCTV in tree.JPG",
            "File:CCTV.jpg",
            "File:Cámara CCTV.jpg",
            "File:BlueSkyCCTV3.jpg",
            "File:BoschCCTV.jpg",
            "File:AxisCCTV.jpg",
            "File:Hall CCTV Array.jpg",
        ),
        search_terms=(
            "CCTV bullet camera",
            "security bullet camera outdoor",
        ),
    ),
    TargetSpec(
        name="hikvision_dome",
        curated_titles=(
            "File:Security Camera-04-Vandal Dome.jpg",
            "File:Omotesando Hills dome camera.jpg",
            "File:YI DomeX Camera .jpg",
            "File:Security Camera-03-Vandal Dome.jpg",
            "File:Security Camera-02-Vandal Dome.jpg",
            "File:Vandal dome-style security camera next to signage on exterior of Target store.jpg",
            "File:Security Camera currambine railway station.jpg",
            "File:CCTV camera on the top of the Trenchard Street car park - June 2026.jpg",
        ),
        search_terms=(
            "dome security camera",
            "vandal dome CCTV camera",
        ),
    ),
    TargetSpec(
        name="hikvision_nvr",
        curated_titles=(
            "File:Annke PoE Network Video Recorder (NVR).jpg",
            "File:Annke PoE Network Video Recorder (NVR) 2.jpg",
            "File:Annke PoE Network Video Recorder (NVR), back.jpg",
            "File:Panasonic HDD and DVD video recorder DMR-EH56.jpg",
            "File:Dvr college Panorama1.jpg",
            "File:Dvr college Panorama2.jpg",
        ),
        search_terms=(
            "network video recorder",
            "CCTV recorder rack",
            "video surveillance control room",
        ),
    ),
    TargetSpec(
        name="alarm",
        curated_titles=(
            "File:Menvier TS690 Security Alarm Panel.jpg",
            "File:Day 308 - West Midlands Police - Awards Evening - PC OSullivan and Mr Hutton (8147841184).jpg",
        ),
        search_terms=(
            "intruder alarm panel",
            "burglar alarm control panel",
            "security alarm keypad",
            "alarm siren security system",
        ),
    ),
    TargetSpec(
        name="bilisim",
        curated_titles=(
            "File:Technician with laptop working on server rack at NERSC.jpg",
            "File:Wikimedia Servers-0001 42.jpg",
            "File:Wikimedia Foundation Servers-8055 03.jpg",
            "File:IBM server rack internals - IBM rack server serverroom xseries xseries 336 - IMG 0556.jpg",
            "File:Rack of Cisco Hyperflex HXAF 240c M5 nodes.jpg",
            "File:Server rack hole - IMG 3430.jpg",
            "File:Empty server rack - IMG 3677.jpg",
        ),
        search_terms=(
            "server rack",
            "data center servers",
            "network infrastructure cables",
        ),
    ),
    TargetSpec(
        name="yakit",
        curated_titles=(
            "File:Dieselpump Preem Avesta.jpg",
            "File:Fuel pump at KBTP.jpg",
            "File:Fuel pump HD21.jpg",
            "File:Opel Blazer 1996 Fuel Pump.jpg",
        ),
        search_terms=(
            "fuel pump",
            "petrol station pump",
            "fuel dispenser gas station",
        ),
    ),
    TargetSpec(
        name="arac_takip",
        curated_titles=(
            "File:Neomatics ADM100 GPS Tracker (41077800725).jpg",
            "File:Kippy Tracker Device.jpg",
            "File:ITalks MCS 1608 GPS P1110442.jpg",
            "File:ITalks MCS 1608 GPS P1110445.jpg",
            "File:Neomatics ADM100 GPS Tracker at Qectel MC60CAR01A05 chip (41077800895).jpg",
        ),
        search_terms=(
            "GPS tracker",
            "vehicle tracking device",
            "car navigation GPS unit",
        ),
    ),
    TargetSpec(
        name="yazilim",
        curated_titles=(
            "File:Coding workstation (Unsplash).jpg",
            "File:Macro laptop coding (Unsplash).jpg",
            "File:CSS code on a screen (Unsplash).jpg",
            "File:Screen-python-code-matplotlib-physics-simulation.jpg",
            "File:Wikipedia Blackout Screen 1920x1080.jpg",
        ),
        search_terms=(
            "source code screen",
            "programming code monitor",
            "software developer code laptop",
            "code editor screen photo",
            "lines of code monitor",
        ),
    ),
    TargetSpec(
        name="yangin",
        curated_titles=(
            "File:Fire alarm control panel VERS-PK 2.jpg",
            "File:Fire Alarm Annunciator.jpg",
            "File:Fire alarm panel in a apartment.jpg",
            "File:Fire alarm zone indicator.jpg",
            "File:Fire alarm control panelB.jpg",
            "File:Old USSR fire alarm control panels.jpg",
            "File:Gent System 2400 Control Panel Model 2401 seen with a repeater panel.jpg",
            "File:SMS Senator Fire Alarm Control Panel.jpg",
        ),
        search_terms=(
            "fire alarm panel",
            "fire alarm control panel",
            "fire detection system panel",
        ),
    ),
    TargetSpec(
        name="elektrik",
        curated_titles=(
            "File:Dornbirn-Haemmerle-distribution board-01ASD.jpg",
            "File:Pretty distribution board.JPG",
            "File:Old Soviet distribution board.JPG",
            "File:EU-EE-Tallinn-Pirita-Outdoor distribution board.JPG",
            "File:Distribution board in gay club, right part.JPG",
            "File:Mid-1960s wooden main distribution board fuses.jpg",
            "File:Hermannstadt (Sibiu)-distribution board in Calea Gusteritei (street)-04ASD.jpg",
        ),
        search_terms=(
            "electrical distribution board",
            "electrical switchgear panel",
            "circuit breaker panel board",
        ),
    ),
)

TARGET_BY_NAME: Final[dict[str, TargetSpec]] = {t.name: t for t in TARGETS}
HIKVISION_NAMES: Final[tuple[str, str, str]] = (
    "hikvision_bullet",
    "hikvision_dome",
    "hikvision_nvr",
)


@dataclass(frozen=True, slots=True)
class Candidate:
    """A downloadable Commons representation with attribution metadata."""

    title: str
    url: str
    origin: str
    author: str
    license_name: str
    license_url: str
    description_url: str


@dataclass(frozen=True, slots=True)
class JpegStructure:
    """The structural facts extracted from JPEG marker segments."""

    width: int
    height: int
    sos_offset: int
    eoi_offset: int


@dataclass(frozen=True, slots=True)
class Verification:
    """The complete evidence package for one accepted JPEG file."""

    relative_path: str
    sha256: str
    byte_count: int
    width: int
    height: int
    mime: str
    magic: str
    unique_rgb: int
    luminance_variance: float
    decoder: str
    full_decode: bool

    @property
    def dimensions(self) -> str:
        return f"{self.width}x{self.height}"

    def as_dict(self) -> dict[str, Any]:
        return {
            "file": self.relative_path,
            "sha256": self.sha256,
            "bytes": self.byte_count,
            "dimensions": self.dimensions,
            "width": self.width,
            "height": self.height,
            "mime": self.mime,
            "magic": self.magic,
            "unique_rgb_samples": self.unique_rgb,
            "luminance_variance": round(self.luminance_variance, 3),
            "decoder": self.decoder,
            "full_decode": self.full_decode,
        }


@dataclass(frozen=True, slots=True)
class TargetResult:
    """The final disposition of one catalog target."""

    spec: TargetSpec
    status: str
    verdict: str
    source: str
    verification: Verification | None
    metadata: dict[str, Any]
    reason: str = ""


class TimedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS connection with a distinct, enforced connect timeout."""

    def connect(self) -> None:  # noqa: D102 - documented by base class
        self.sock = socket.create_connection(
            (self.host, self.port),
            timeout=CONNECT_TIMEOUT_SECONDS,
            source_address=self.source_address,
        )
        if self._tunnel_host is not None:
            self._tunnel()
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)
        self.sock.settimeout(self.timeout)


class TimedHTTPSHandler(urllib.request.HTTPSHandler):
    """URL opener handler that installs the timed HTTPS connection class."""

    def https_open(self, req: urllib.request.Request) -> Any:
        return self.do_open(
            TimedHTTPSConnection,
            req,
            context=self._context,
        )


class HostAllowlistRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Reject any redirect that leaves the approved HTTPS Wikimedia hosts."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        parts = urllib.parse.urlsplit(newurl)
        permitted_hosts = ALLOWED_HOSTS | {THUMB_HOST}
        if parts.scheme != "https" or parts.hostname not in permitted_hosts:
            raise VerificationError(
                f"redirect to disallowed endpoint rejected: {parts.scheme}://"
                f"{parts.hostname or ''}"
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def log(message: str, *, verbose: bool = False) -> None:
    """Print operational output; verbose-only messages stay silent by default."""
    if verbose:
        print(f"[verbose] {message}", flush=True)
    else:
        print(message, flush=True)


def vlog(message: str, verbose: bool) -> None:
    """Print a diagnostic line only in verbose mode."""
    if verbose:
        print(f"[verbose] {message}", flush=True)


def canonicalize_url(url: str) -> str:
    """Rewrite the Commons thumbnail CDN alias to the approved upload host."""
    parts = urllib.parse.urlsplit(url)
    if parts.hostname == THUMB_HOST:
        netloc = "upload.wikimedia.org"
        if parts.port is not None:
            netloc = f"{netloc}:{parts.port}"
        if parts.username:
            credentials = parts.username
            if parts.password:
                credentials = f"{credentials}:{parts.password}"
            netloc = f"{credentials}@{netloc}"
        return urllib.parse.urlunsplit(
            (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
        )
    return url


def strip_html(value: str) -> str:
    """Convert Commons extmetadata HTML into a readable plain-text credit."""
    without_tags = re.sub(r"<[^>]*>", " ", value)
    unescaped = html.unescape(without_tags)
    return re.sub(r"\s+", " ", unescaped).strip()


def metadata_value(extmetadata: dict[str, Any], key: str) -> str:
    """Return a cleaned extmetadata field, or an empty string when absent."""
    entry = extmetadata.get(key)
    if not isinstance(entry, dict):
        return ""
    value = entry.get("value")
    if not isinstance(value, str):
        return ""
    return strip_html(value)


def build_opener() -> urllib.request.OpenerDirector:
    """Build the HTTPS-only opener used by every network operation."""
    return urllib.request.build_opener(
        TimedHTTPSHandler(), HostAllowlistRedirectHandler()
    )


def api_get(params: dict[str, str], verbose: bool) -> dict[str, Any]:
    """Query the Commons API with bounded retries for transient failures."""
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_error = ""
    for attempt in range(1, API_ATTEMPTS + 1):
        try:
            with build_opener().open(
                request, timeout=READ_TIMEOUT_SECONDS
            ) as response:
                if response.status != 200:
                    raise VerificationError(
                        f"Commons API returned HTTP {response.status}"
                    )
                payload = response.read()
            decoded = json.loads(payload.decode("utf-8"))
            if not isinstance(decoded, dict):
                raise VerificationError("Commons API returned a non-object payload")
            return decoded
        except (urllib.error.URLError, OSError, ValueError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            vlog(
                f"Commons API attempt {attempt}/{API_ATTEMPTS} failed: {last_error}",
                verbose,
            )
            if attempt < API_ATTEMPTS:
                time.sleep(API_BACKOFF_SECONDS * attempt)
    raise FatalError(
        f"{PUBLISHER} — Commons API request failed after {API_ATTEMPTS} "
        f"attempts: {last_error}"
    )


def page_title(page: dict[str, Any]) -> str:
    """Return the canonical File: title reported by the API."""
    title = page.get("title", "")
    return title if isinstance(title, str) else ""


def candidates_from_pages(
    pages: Iterable[dict[str, Any]], origin: str, require_license: bool
) -> list[Candidate]:
    """Convert API page records into validated, licence-aware candidates."""
    results: list[Candidate] = []
    for page in pages:
        title = page_title(page)
        if not title.startswith("File:"):
            continue
        image_info = page.get("imageinfo")
        if not isinstance(image_info, list) or not image_info:
            continue
        info = image_info[0]
        if not isinstance(info, dict) or info.get("mime") != "image/jpeg":
            continue
        raw_url = info.get("thumburl") or info.get("url")
        if not isinstance(raw_url, str) or not raw_url:
            continue
        extmetadata = info.get("extmetadata")
        if not isinstance(extmetadata, dict):
            extmetadata = {}
        author = metadata_value(extmetadata, "Artist")
        license_name = metadata_value(extmetadata, "LicenseShortName")
        license_url = metadata_value(extmetadata, "LicenseUrl")
        if require_license and (not license_name or not license_url):
            continue
        if not author:
            author = "Wikimedia Commons contributor"
        if not license_name:
            license_name = "See Commons file page"
        description_url = (
            f"{COMMONS_BASE}/wiki/{urllib.parse.quote(title.replace(' ', '_'), safe=':()_,.')}"
        )
        results.append(
            Candidate(
                title=title,
                url=canonicalize_url(raw_url),
                origin=origin,
                author=author[:300],
                license_name=license_name[:120],
                license_url=license_url[:500],
                description_url=description_url,
            )
        )
    return results


def collect_curated(spec: TargetSpec, verbose: bool) -> list[Candidate]:
    """Resolve the pinned exact Commons titles in their priority order."""
    titles = list(spec.curated_titles)
    collected: list[Candidate] = []
    for start in range(0, len(titles), 40):
        batch = titles[start : start + 40]
        data = api_get(
            {
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": IMAGE_INFO_PROPS,
                "iiurlwidth": str(MIN_LONG_EDGE_PX),
            },
            verbose,
        )
        pages = data.get("query", {}).get("pages", [])
        if not isinstance(pages, list):
            pages = list(pages.values()) if isinstance(pages, dict) else []
        parsed = candidates_from_pages(pages, "curated", require_license=False)
        order = {title: index for index, title in enumerate(batch)}
        parsed.sort(key=lambda candidate: order.get(candidate.title, len(order)))
        collected.extend(parsed)
    vlog(f"{spec.name}: {len(collected)} curated candidate(s) resolved", verbose)
    return collected


def collect_search(spec: TargetSpec, verbose: bool) -> list[Candidate]:
    """Resolve bitmap search results with mandatory licence metadata."""
    collected: list[Candidate] = []
    for term in spec.search_terms:
        data = api_get(
            {
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "generator": "search",
                "gsrnamespace": "6",
                "gsrsearch": f"{term} filetype:bitmap",
                "gsrlimit": "20",
                "prop": "imageinfo",
                "iiprop": IMAGE_INFO_PROPS,
                "iiurlwidth": str(MIN_LONG_EDGE_PX),
            },
            verbose,
        )
        pages = data.get("query", {}).get("pages", [])
        if not isinstance(pages, list):
            pages = list(pages.values()) if isinstance(pages, dict) else []
        parsed = candidates_from_pages(pages, "search", require_license=True)
        collected.extend(parsed)
        vlog(
            f"{spec.name}: search '{term}' yielded {len(parsed)} licensed JPEG candidate(s)",
            verbose,
        )
    return collected


def collect_filepath(candidates: Sequence[Candidate]) -> list[Candidate]:
    """Build Special:FilePath fallbacks from already-attributed Commons titles."""
    fallbacks: list[Candidate] = []
    for candidate in candidates:
        filename = candidate.title.removeprefix("File:").replace(" ", "_")
        quoted = urllib.parse.quote(filename, safe="()_,.'-")
        fallback_url = (
            f"{COMMONS_BASE}/wiki/Special:FilePath/{quoted}?"
            f"{urllib.parse.urlencode({'width': MIN_LONG_EDGE_PX})}"
        )
        fallbacks.append(
            Candidate(
                title=candidate.title,
                url=fallback_url,
                origin="filepath",
                author=candidate.author,
                license_name=candidate.license_name,
                license_url=candidate.license_url,
                description_url=candidate.description_url,
            )
        )
    return fallbacks


def deduplicate(candidates: Iterable[Candidate]) -> list[Candidate]:
    """Preserve priority order while removing repeated title/URL pairs."""
    seen: set[tuple[str, str]] = set()
    unique: list[Candidate] = []
    for candidate in candidates:
        key = (candidate.title, candidate.url)
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique


def _fetch_jpeg_once(url: str, verbose: bool) -> tuple[bytes, str, str]:
    """Fetch one JPEG with host, status, content-type, and size enforcement."""
    request_url = canonicalize_url(url)
    for attempt in range(2):
        request = urllib.request.Request(
            request_url, headers={"User-Agent": USER_AGENT, "Accept": "image/jpeg"}
        )
        try:
            with build_opener().open(
                request, timeout=READ_TIMEOUT_SECONDS
            ) as response:
                final_url = response.geturl()
                status = int(response.status)
                content_type = str(response.headers.get("Content-Type", ""))
                host = (urllib.parse.urlsplit(final_url).hostname or "").lower()
                if status != 200:
                    raise VerificationError(f"HTTP status {status}")
                if host not in ALLOWED_HOSTS:
                    if host == THUMB_HOST and attempt == 0:
                        request_url = canonicalize_url(final_url)
                        vlog(
                            f"redirect landed on thumbnail CDN alias; retrying canonical host",
                            verbose,
                        )
                        continue
                    raise VerificationError(f"disallowed final host '{host}'")
                media_type = content_type.split(";", 1)[0].strip().lower()
                if media_type != "image/jpeg":
                    raise VerificationError(
                        f"Content-Type '{content_type}' is not image/jpeg"
                    )
                declared = response.headers.get("Content-Length")
                if declared is not None:
                    try:
                        if int(declared) > MAX_BYTES:
                            raise VerificationError(
                                f"declared size {declared} exceeds {MAX_BYTES} bytes"
                            )
                    except ValueError:
                        pass
                chunks: list[bytes] = []
                total = 0
                while True:
                    chunk = response.read(65_536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise VerificationError(
                            f"stream exceeded the {MAX_BYTES} byte limit"
                        )
                    chunks.append(chunk)
                payload = b"".join(chunks)
                return payload, final_url, media_type
        except urllib.error.HTTPError as exc:
            raise VerificationError(f"HTTP status {exc.code}") from exc
        except (urllib.error.URLError, ssl.SSLError, TimeoutError, OSError) as exc:
            raise VerificationError(f"network failure: {type(exc).__name__}: {exc}") from exc
    raise VerificationError("could not resolve an approved delivery host")


def fetch_jpeg(url: str, verbose: bool) -> tuple[bytes, str, str]:
    """Fetch a JPEG, retrying only transient network resolution failures."""
    last_failure = ""
    for attempt in range(1, 3):
        try:
            return _fetch_jpeg_once(url, verbose)
        except VerificationError as exc:
            last_failure = str(exc)
            if "network failure" not in last_failure or attempt == 2:
                raise
            vlog(
                f"transient fetch failure for {url} (attempt {attempt}/2): "
                f"{last_failure}",
                verbose,
            )
            time.sleep(API_BACKOFF_SECONDS * attempt)
    raise VerificationError(f"fetch failed: {last_failure}")


def parse_jpeg_structure(data: bytes) -> JpegStructure:
    """Validate JPEG markers and locate SOF, SOS, and EOI positions."""
    if len(data) < 4 or data[:3] != b"\xff\xd8\xff":
        raise VerificationError("JPEG magic FF D8 FF is absent")
    offset = 2
    sof: tuple[int, int] | None = None
    sos_offset = -1
    eoi_offset = -1
    while offset + 1 < len(data):
        if data[offset] != 0xFF:
            raise VerificationError(f"expected JPEG marker at offset {offset}")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            raise VerificationError("truncated JPEG marker sequence")
        marker = data[offset]
        offset += 1
        if marker == 0x00:
            raise VerificationError("byte stuffing encountered outside entropy data")
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        if marker == 0xD9:
            eoi_offset = offset - 2
            break
        if offset + 2 > len(data):
            raise VerificationError("truncated JPEG segment length")
        segment_length = int.from_bytes(data[offset : offset + 2], "big")
        if segment_length < 2 or offset + segment_length > len(data):
            raise VerificationError("invalid JPEG segment length")
        if marker in (0xC0, 0xC1, 0xC2):
            if segment_length < 8:
                raise VerificationError("truncated JPEG start-of-frame segment")
            height = int.from_bytes(data[offset + 3 : offset + 5], "big")
            width = int.from_bytes(data[offset + 5 : offset + 7], "big")
            sof = (width, height)
        if marker == 0xDA:
            sos_offset = offset - 2
            scan_start = offset + segment_length
            eoi_offset = data.find(b"\xff\xd9", scan_start)
            if eoi_offset < 0:
                raise VerificationError("EOI marker is missing after SOS")
            break
        offset += segment_length
    if sof is None:
        raise VerificationError("no SOF0/SOF1/SOF2 marker found")
    if sos_offset < 0:
        raise VerificationError("SOS marker is missing")
    if eoi_offset <= sos_offset:
        raise VerificationError("EOI marker does not follow SOS")
    width, height = sof
    if width < 1 or height < 1:
        raise VerificationError("invalid frame dimensions")
    return JpegStructure(width, height, sos_offset, eoi_offset)


def parse_ppm(data: bytes) -> tuple[int, int, bytes]:
    """Parse the binary P6 PPM produced by djpeg."""
    position = 0
    tokens: list[bytes] = []

    def skip_whitespace_and_comments(cursor: int) -> int:
        while cursor < len(data):
            if data[cursor] in b" \t\r\n":
                cursor += 1
            elif data[cursor] == 0x23:
                newline = data.find(b"\n", cursor)
                cursor = len(data) if newline < 0 else newline + 1
            else:
                break
        return cursor

    for _ in range(4):
        position = skip_whitespace_and_comments(position)
        token_start = position
        while position < len(data) and data[position] not in b" \t\r\n":
            position += 1
        if position == token_start:
            raise VerificationError("truncated PPM header")
        tokens.append(data[token_start:position])
    if tokens[0] != b"P6":
        raise VerificationError(f"djpeg produced unexpected PPM magic {tokens[0]!r}")
    try:
        width = int(tokens[1])
        height = int(tokens[2])
        max_value = int(tokens[3])
    except ValueError as exc:
        raise VerificationError("invalid numeric field in PPM header") from exc
    if width < 1 or height < 1 or max_value != 255:
        raise VerificationError("unsupported PPM dimensions or sample depth")
    position = skip_whitespace_and_comments(position)
    pixel_count = width * height * 3
    if len(data) - position < pixel_count:
        raise VerificationError("truncated PPM pixel payload")
    return width, height, data[position : position + pixel_count]


def analyze_photographic_signal(
    width: int, height: int, pixels: bytes
) -> tuple[int, float]:
    """Sample a deterministic 128x128 grid and measure colour and luminance."""
    unique: set[tuple[int, int, int]] = set()
    luminance_sum = 0
    luminance_square_sum = 0
    for grid_y in range(GRID_SIZE):
        y = min(height - 1, ((2 * grid_y + 1) * height) // (2 * GRID_SIZE))
        row_offset = y * width * 3
        for grid_x in range(GRID_SIZE):
            x = min(width - 1, ((2 * grid_x + 1) * width) // (2 * GRID_SIZE))
            index = row_offset + x * 3
            red = pixels[index]
            green = pixels[index + 1]
            blue = pixels[index + 2]
            unique.add((red, green, blue))
            luminance = (299 * red + 587 * green + 114 * blue) // 1000
            luminance_sum += luminance
            luminance_square_sum += luminance * luminance
    sample_count = GRID_SIZE * GRID_SIZE
    mean = luminance_sum / sample_count
    variance = max(0.0, luminance_square_sum / sample_count - mean * mean)
    return len(unique), variance


def verify_file(
    file_path: Path, expected_filename: str, relative_path: str, verbose: bool
) -> Verification:
    """Run every mandatory gate against a byte-identical local JPEG file."""
    if not expected_filename.lower().endswith(".jpg"):
        raise VerificationError("target filename does not use the .jpg extension")
    if not file_path.is_file():
        raise VerificationError("file does not exist")
    payload = file_path.read_bytes()
    byte_count = len(payload)
    if byte_count <= MIN_BYTES:
        raise VerificationError(f"size {byte_count} bytes is not greater than {MIN_BYTES}")
    if byte_count > MAX_BYTES:
        raise VerificationError(f"size {byte_count} bytes exceeds {MAX_BYTES}")
    if payload[:3] != b"\xff\xd8\xff":
        raise VerificationError("JPEG magic FF D8 FF is absent")
    structure = parse_jpeg_structure(payload)
    if max(structure.width, structure.height) < MIN_LONG_EDGE_PX:
        raise VerificationError(
            f"long edge {max(structure.width, structure.height)}px is below "
            f"{MIN_LONG_EDGE_PX}px"
        )

    with tempfile.NamedTemporaryFile(
        dir=IMG_DIR, prefix=".decode_", suffix=".ppm", delete=False
    ) as ppm_file:
        ppm_path = Path(ppm_file.name)
    try:
        completed = subprocess.run(
            [
                str(REQUIRED_DJPEG),
                "-pnm",
                "-outfile",
                str(ppm_path),
                str(file_path),
            ],
            shell=False,
            check=True,
            timeout=DECODE_TIMEOUT_SECONDS,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if completed.returncode != 0:
            raise VerificationError("djpeg returned a non-zero status")
        ppm_payload = ppm_path.read_bytes()
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", "replace").strip()[:300]
        raise VerificationError(f"djpeg full decode failed: {detail}") from exc
    except subprocess.TimeoutExpired as exc:
        raise VerificationError("djpeg full decode timed out") from exc
    finally:
        ppm_path.unlink(missing_ok=True)

    ppm_width, ppm_height, pixels = parse_ppm(ppm_payload)
    if (ppm_width, ppm_height) != (structure.width, structure.height):
        raise VerificationError(
            "decoded dimensions disagree with the JPEG SOF marker"
        )
    unique_count, variance = analyze_photographic_signal(ppm_width, ppm_height, pixels)
    vlog(
        f"{relative_path}: unique_rgb={unique_count}, luminance_variance={variance:.2f}",
        verbose,
    )
    if unique_count < MIN_UNIQUE_RGB:
        raise VerificationError(
            f"photographic gate failed: {unique_count} unique RGB samples "
            f"(minimum {MIN_UNIQUE_RGB})"
        )
    if variance < MIN_LUMINANCE_VARIANCE:
        raise VerificationError(
            f"photographic gate failed: luminance variance {variance:.2f} "
            f"(minimum {MIN_LUMINANCE_VARIANCE})"
        )
    return Verification(
        relative_path=relative_path,
        sha256=hashlib.sha256(payload).hexdigest(),
        byte_count=byte_count,
        width=structure.width,
        height=structure.height,
        mime="image/jpeg",
        magic="FFD8FF",
        unique_rgb=unique_count,
        luminance_variance=variance,
        decoder="djpeg -pnm (libjpeg)",
        full_decode=True,
    )


def load_existing_entries(path: Path) -> dict[str, dict[str, Any]]:
    """Read a previously written artifact without failing on absent/corrupt data."""
    if not path.is_file():
        return {}
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    targets = document.get("targets")
    if not isinstance(targets, dict):
        return {}
    return {key: value for key, value in targets.items() if isinstance(value, dict)}


def metadata_from_existing(
    spec: TargetSpec, entries: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    """Recover attribution for an already-installed, verified image."""
    previous = entries.get(spec.name, {})
    return {
        "file": spec.relative_path,
        "source_url": previous.get("source_url", "installed verified local image"),
        "commons_title": previous.get("commons_title", spec.curated_titles[0]),
        "author": previous.get("author", "Wikimedia Commons contributor"),
        "license": previous.get("license", "See Commons file page"),
        "license_url": previous.get("license_url", ""),
        "description_url": previous.get("description_url", ""),
    }


def metadata_from_candidate(
    spec: TargetSpec, candidate: Candidate, final_url: str
) -> dict[str, Any]:
    """Create an attribution record for a freshly downloaded image."""
    return {
        "file": spec.relative_path,
        "source_url": final_url,
        "commons_title": candidate.title,
        "author": candidate.author,
        "license": candidate.license_name,
        "license_url": candidate.license_url,
        "description_url": candidate.description_url,
        "discovery": candidate.origin,
    }


def resolve_target(
    spec: TargetSpec,
    force: bool,
    verbose: bool,
    used_shas: set[str],
    previous_credits: dict[str, dict[str, Any]],
) -> TargetResult:
    """Install or verify one target, iterating candidates until one passes."""
    final_path = spec.absolute_path
    if final_path.is_file() and not force:
        try:
            verification = verify_file(
                final_path, spec.filename, spec.relative_path, verbose
            )
        except VerificationError as exc:
            log(
                f"{spec.name}: installed file failed re-verification: {exc}",
                verbose=verbose,
            )
        else:
            log(f"{spec.name}: installed file passed every gate", verbose=verbose)
            return TargetResult(
                spec=spec,
                status="SKIPPED",
                verdict="SKIP",
                source="installed",
                verification=verification,
                metadata=metadata_from_existing(spec, previous_credits),
            )

    curated = collect_curated(spec, verbose)
    search = collect_search(spec, verbose)
    fallbacks = collect_filepath(curated + search)
    candidates = deduplicate([*curated, *search, *fallbacks])
    vlog(f"{spec.name}: evaluating {len(candidates)} candidate(s)", verbose)
    failures: list[str] = []
    part_path: Path | None = None

    for candidate in candidates:
        try:
            payload, final_url, media_type = fetch_jpeg(candidate.url, verbose)
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{spec.name}_", suffix=".part", dir=IMG_DIR
            )
            part_path = Path(temporary_name)
            with os.fdopen(descriptor, "wb") as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            verification = verify_file(
                part_path, spec.filename, spec.relative_path, verbose
            )
            if verification.sha256 in used_shas:
                raise VerificationError("sha256 duplicates an already accepted image")
            os.chmod(part_path, 0o644)
            os.replace(part_path, final_path)
            part_path = None
            log(
                f"{spec.name}: accepted {candidate.title} "
                f"({verification.dimensions}, {verification.byte_count} bytes, {media_type})",
                verbose=verbose,
            )
            metadata = metadata_from_candidate(spec, candidate, final_url)
            return TargetResult(
                spec=spec,
                status="DOWNLOADED",
                verdict="PASS",
                source=candidate.title,
                verification=verification,
                metadata=metadata,
            )
        except (VerificationError, OSError) as exc:
            reason = f"{candidate.origin}/{candidate.title}: {exc}"
            failures.append(reason)
            vlog(f"{spec.name}: rejected candidate — {reason}", verbose)
        finally:
            if part_path is not None:
                part_path.unlink(missing_ok=True)
                part_path = None

    reason = "no candidate passed all verification gates"
    log(f"{spec.name}: FATAL — {reason}", verbose=verbose)
    for failure in failures[:12]:
        vlog(f"{spec.name}: rejection detail — {failure}", verbose)
    return TargetResult(
        spec=spec,
        status="FAILED",
        verdict="FAIL",
        source="none",
        verification=None,
        metadata={},
        reason=reason,
    )


def verify_non_selected(
    spec: TargetSpec, verbose: bool, previous_credits: dict[str, dict[str, Any]]
) -> TargetResult:
    """Verify a target outside --only so global distinctness stays meaningful."""
    if not spec.absolute_path.is_file():
        return TargetResult(
            spec=spec,
            status="NOT-RUN",
            verdict="FAIL",
            source="none",
            verification=None,
            metadata={},
            reason="target was not processed in this run",
        )
    try:
        verification = verify_file(
            spec.absolute_path, spec.filename, spec.relative_path, verbose
        )
    except VerificationError as exc:
        return TargetResult(
            spec=spec,
            status="INVALID",
            verdict="FAIL",
            source="installed",
            verification=None,
            metadata={},
            reason=str(exc),
        )
    return TargetResult(
        spec=spec,
        status="SKIPPED",
        verdict="SKIP",
        source="installed",
        verification=verification,
        metadata=metadata_from_existing(spec, previous_credits),
    )


def check_global_invariants(results: dict[str, TargetResult]) -> list[str]:
    """Return every global consistency failure found across the ten targets."""
    problems: list[str] = []
    if len(results) != len(TARGETS):
        problems.append(f"expected {len(TARGETS)} targets, found {len(results)}")
    shas = {
        name: result.verification.sha256
        for name, result in results.items()
        if result.verification is not None
    }
    if len(shas) != len(set(shas.values())):
        duplicates = sorted(
            {
                sha
                for sha in shas.values()
                if list(shas.values()).count(sha) > 1
            }
        )
        problems.append(f"sha256 collisions detected: {', '.join(duplicates)}")
    hikvision_shas = [shas.get(name, "") for name in HIKVISION_NAMES]
    if "" in hikvision_shas:
        problems.append("HIKVISION trio is incomplete")
    elif len(set(hikvision_shas)) != 3:
        problems.append("HIKVISION trio sha256 values are not pairwise distinct")
    return problems


def build_artifact(
    results: dict[str, TargetResult], previous: dict[str, dict[str, Any]]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build the credits document and the matching verification evidence."""
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    credits_targets: dict[str, Any] = {}
    verification_targets: dict[str, Any] = {}
    for spec in TARGETS:
        result = results[spec.name]
        if result.verification is None:
            credits_targets[spec.name] = {
                **previous.get(spec.name, {}),
                "file": spec.relative_path,
                "status": result.status,
                "verdict": result.verdict,
                "reason": result.reason,
            }
            verification_targets[spec.name] = {
                "file": spec.relative_path,
                "status": result.status,
                "verdict": result.verdict,
                "reason": result.reason,
                "full_decode": False,
            }
            continue
        record: dict[str, Any] = {
            **result.verification.as_dict(),
            **result.metadata,
            "status": result.status,
            "verdict": result.verdict,
        }
        credits_targets[spec.name] = record
        verification_targets[spec.name] = dict(record)
    common = {
        "publisher": PUBLISHER,
        "generator": "download_catalog_images.py",
        "generated_at_utc": generated_at,
        "targets": credits_targets,
    }
    verification_document = {
        "publisher": PUBLISHER,
        "generator": "download_catalog_images.py",
        "generated_at_utc": generated_at,
        "verification_method": (
            "JPEG marker inspection, full djpeg -pnm decode, and deterministic "
            "deterministic 128x128 photographic-signal sampling"
        ),
        "targets": verification_targets,
    }
    return common, verification_document


def write_json(path: Path, document: dict[str, Any]) -> None:
    """Write an artifact atomically with stable, human-readable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}_", suffix=".tmp", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(document, output, ensure_ascii=False, indent=2, sort_keys=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def print_table(results: dict[str, TargetResult]) -> None:
    """Print the mandated verification table with real measured values."""
    headers = ("TARGET", "SOURCE", "STATUS", "BYTES", "DIMENSIONS", "MIME", "VERDICT")
    rows: list[tuple[str, ...]] = []
    for spec in TARGETS:
        result = results.get(spec.name)
        if result is None or result.verification is None:
            rows.append(
                (
                    spec.name,
                    result.source if result else "none",
                    result.status if result else "NOT-RUN",
                    "-",
                    "-",
                    "-",
                    result.verdict if result else "FAIL",
                )
            )
            continue
        verification = result.verification
        rows.append(
            (
                spec.name,
                result.source,
                result.status,
                str(verification.byte_count),
                verification.dimensions,
                verification.mime,
                result.verdict,
            )
        )
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]
    line = " | ".join(header.ljust(widths[index]) for index, header in enumerate(headers))
    print(line)
    print("-+-".join("-" * width for width in widths))
    for row in rows:
        print(" | ".join(value.ljust(widths[index]) for index, value in enumerate(row)))


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """Parse and validate the branded command-line interface."""
    parser = argparse.ArgumentParser(
        prog="download_catalog_images.py",
        description="Download and forensically verify the ten NAZTECH catalog photographs.",
        epilog=f"{BANNER}\nPublisher: {PUBLISHER}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--force", action="store_true", help="re-download and replace installed images"
    )
    parser.add_argument(
        "--only",
        choices=sorted(TARGET_BY_NAME),
        help="process a single target (remaining targets must already be installed)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="show the resolution plan without writing files"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="log candidate rejections and metrics"
    )
    return parser.parse_args(argv)


def locate_djpeg() -> None:
    """Fail loudly unless the mandatory djpeg decoder is available."""
    located = shutil.which("djpeg")
    if located is None:
        raise FatalError(
            f"{PUBLISHER} — REQUIRED dependency 'djpeg' was not found on PATH; "
            f"install libjpeg-turbo-progs so the djpeg decoder is available."
        )
    try:
        resolved = Path(located).resolve(strict=True)
    except OSError as exc:
        raise FatalError(
            f"{PUBLISHER} — REQUIRED dependency at {REQUIRED_DJPEG} is unusable: {exc}"
        ) from exc
    if resolved != REQUIRED_DJPEG.resolve(strict=True):
        raise FatalError(
            f"{PUBLISHER} — REQUIRED decoder mismatch: found '{resolved}', "
            f"expected {REQUIRED_DJPEG}."
        )


def dry_run(only: str | None, verbose: bool) -> int:
    """Report the curated plan and exit without network or filesystem writes."""
    selected = [TARGET_BY_NAME[only]] if only else list(TARGETS)
    for spec in selected:
        print(f"{spec.name} -> {spec.relative_path}")
        for title in spec.curated_titles:
            vlog(f"  curated: {title}", verbose)
        for term in spec.search_terms:
            vlog(f"  search fallback: {term} filetype:bitmap", verbose)
    print(f"Planned targets: {len(selected)} / {len(TARGETS)}")
    print("Dry run complete: no files downloaded, replaced, or written.")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """Execute the full download, verification, artifact, and reporting flow."""
    args = parse_args(sys.argv[1:] if argv is None else argv)
    print(BANNER, flush=True)
    try:
        locate_djpeg()
        if not REQUIRED_DJPEG.is_file():
            raise FatalError(
                f"{PUBLISHER} — REQUIRED decoder {REQUIRED_DJPEG} is missing."
            )
        if args.dry_run:
            return dry_run(args.only, args.verbose)
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        previous_credits = load_existing_entries(CREDITS_PATH)
        previous_verification = load_existing_entries(VERIFICATION_PATH)
        results: dict[str, TargetResult] = {}
        used_shas: set[str] = set()
        selected = [TARGET_BY_NAME[args.only]] if args.only else list(TARGETS)
        for spec in selected:
            result = resolve_target(
                spec, args.force, args.verbose, used_shas, previous_credits
            )
            results[spec.name] = result
            if result.verification is not None:
                used_shas.add(result.verification.sha256)
            if result.verdict != "FAIL":
                print(
                    f"{spec.name}: {result.status} ({result.verdict})",
                    flush=True,
                )
            else:
                print(f"{spec.name}: FAILED — {result.reason}", file=sys.stderr, flush=True)
        for spec in TARGETS:
            if spec.name not in results:
                results[spec.name] = verify_non_selected(
                    spec, args.verbose, previous_credits
                )
        global_problems = check_global_invariants(results)
        all_pass = all(result.verdict in {"PASS", "SKIP"} for result in results.values())
        print()
        print_table(results)
        print()
        if all_pass and not global_problems:
            credits_document, verification_document = build_artifact(
                results, {**previous_verification, **previous_credits}
            )
            write_json(CREDITS_PATH, credits_document)
            write_json(VERIFICATION_PATH, verification_document)
            print(f"Credits: {CREDITS_PATH.relative_to(PROJECT_ROOT)}")
            print(
                f"Verification evidence: {VERIFICATION_PATH.relative_to(PROJECT_ROOT)}"
            )
            print("Global checks: 10/10 verified, all sha256 values pairwise distinct.")
            print("VERDICT: PASS")
            return 0
        for problem in global_problems:
            print(f"GLOBAL CHECK FAILED: {problem}", file=sys.stderr)
        print("Artifacts were not updated because the run did not fully pass.", file=sys.stderr)
        print("VERDICT: FAIL", file=sys.stderr)
        return 1
    except FatalError as exc:
        print(f"FATAL: {exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
