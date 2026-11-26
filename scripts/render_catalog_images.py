#!/usr/bin/env python3
# Baysöz Yazılım — baysozlabs@proton.me
# Deterministic headless-Chromium renderer for the LAVOX / N2MOBİL / NAZTECH
# catalog imagery used by the Naztech Bilisim production web portal.
"""Render six high-DPI obsidian-and-gold catalog JPEGs from inline SVG/CSS.

The generator is dependency-light: it uses Playwright's synchronous API and a
single Chromium browser instance to rasterise deterministic, self-contained
HTML documents.  Every visual is authored as detailed vector artwork (metal
gradients, ports, LEDs, vents, screws, screens, circuit traces and a reflective
studio plinth); no network images, placeholders, or mocked assets are used.

Outputs are 3840x2160 baseline JPEGs (CSS viewport 1920x1080 at device scale
factor 2, quality 92).  A verification log with byte sizes and decoded
dimensions is written to artifacts/catalog-image-generation.log.
"""

from __future__ import annotations

import html
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Final, Sequence

from playwright.sync_api import Browser, BrowserContext, sync_playwright

# ---------------------------------------------------------------------------
# Environment / paths
# ---------------------------------------------------------------------------

REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
IMG_DIR: Final[Path] = REPO_ROOT / "img"
ARTIFACT_DIR: Final[Path] = REPO_ROOT / "artifacts"
LOG_PATH: Final[Path] = ARTIFACT_DIR / "catalog-image-generation.log"

CHROME_CANDIDATES: Final[tuple[Path, ...]] = (
    Path("/home/muslumbaysoz/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"),
    Path("/home/muslumbaysoz/.cache/ms-playwright/chromium-1255/chrome-linux/chrome"),
)
VIEWPORT: Final[dict[str, int]] = {"width": 1920, "height": 1080}
DEVICE_SCALE_FACTOR: Final[int] = 2
JPEG_QUALITY: Final[int] = 92
EXPECTED_SIZE: Final[tuple[int, int]] = (3840, 2160)

TEAL: Final[str] = "#19A7B8"
PINK: Final[str] = "#E93B77"
GOLD: Final[str] = "#D4AF37"
GOLD_LIGHT: Final[str] = "#f3d478"


def _enforce_hardware_guardrails() -> None:
    """Apply the Baysöz Yazılım low-memory build guards for this process."""
    for key, value in (
        ("CARGO_BUILD_JOBS", "2"),
        ("MAKEFLAGS", "-j2"),
        ("GOMAXPROCS", "2"),
        ("RAYON_NUM_THREADS", "2"),
        ("UV_CONCURRENT_BUILDS", "2"),
    ):
        os.environ.setdefault(key, value)


_enforce_hardware_guardrails()


# ---------------------------------------------------------------------------
# SVG primitives (small, reusable, strictly typed builders)
# ---------------------------------------------------------------------------


def esc(value: object) -> str:
    """Escape a value for safe inclusion in SVG/HTML text nodes."""
    return html.escape(str(value), quote=True)


def svg_text(
    x: float,
    y: float,
    value: object,
    *,
    size: float = 16,
    fill: str = "#cbd3de",
    weight: int = 600,
    anchor: str = "start",
    spacing: float = 0,
    family: str = "Arial, Helvetica, sans-serif",
    style: str = "",
) -> str:
    """Build an SVG ``<text>`` element with explicit typography."""
    return (
        f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" '
        f'letter-spacing="{spacing}" {style}>{esc(value)}</text>'
    )


def screw(x: float, y: float, r: float = 8.0) -> str:
    """Build a photorealistic cross-slot machine screw."""
    return (
        f'<g transform="translate({x} {y})">'
        f'<circle r="{r}" fill="url(#steel)" stroke="#050608" stroke-width="1.6"/>'
        f'<circle r="{r * 0.62:.1f}" fill="#14171d" stroke="#7d8593" stroke-width=".7"/>'
        f'<path d="M{-r * 0.42:.1f} 0 H{r * 0.42:.1f}" stroke="#aab1bd" stroke-width="1.8"/>'
        f'<path d="M0 {-r * 0.42:.1f} V{r * 0.42:.1f}" stroke="#aab1bd" stroke-width="1.4" opacity=".85"/>'
        f"</g>"
    )


def led(x: float, y: float, color: str, r: float = 5.0, halo: bool = True) -> str:
    """Build a glowing indicator LED with an optional diffuse halo."""
    glow = (
        f'<circle cx="{x}" cy="{y}" r="{r * 3.2:.1f}" fill="{color}" opacity=".22" filter="url(#blur6)"/>'
        if halo
        else ""
    )
    return (
        glow
        + f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" stroke="#040507" stroke-width="1"/>'
        + f'<circle cx="{x - r * 0.28:.1f}" cy="{y - r * 0.3:.1f}" r="{r * 0.32:.1f}" fill="#ffffff" opacity=".7"/>'
    )


def vent_grid(
    x: float,
    y: float,
    w: float,
    h: float,
    cols: int,
    rows: int,
    *,
    fill: str = "#05070a",
) -> str:
    """Build a perforated grille made from individual recessed slots."""
    out: list[str] = []
    sx, sy = w / cols, h / rows
    for c in range(cols):
        for r in range(rows):
            px = x + c * sx + max(1.0, sx * 0.18)
            py = y + r * sy + max(1.0, sy * 0.22)
            sw = max(1.2, sx * 0.64)
            sh = max(1.0, sy * 0.52)
            out.append(f'<rect x="{px:.1f}" y="{py:.1f}" width="{sw:.1f}" height="{sh:.1f}" rx="1" fill="{fill}"/>')
    return "".join(out)


def panel(
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    rx: float = 6,
    fill: str = "url(#steelV)",
    stroke: str = "#080a0d",
    sw: float = 2,
) -> str:
    """Build a beveled hardware faceplate."""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


# ---------------------------------------------------------------------------
# Shared stage: background, circuit traces and reflective studio plinth
# ---------------------------------------------------------------------------

SVG_DEFS: Final[str] = """<defs>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#171a20"/><stop offset=".12" stop-color="#525a66"/>
    <stop offset=".3" stop-color="#292e37"/><stop offset=".55" stop-color="#6b7380"/>
    <stop offset=".78" stop-color="#282d35"/><stop offset="1" stop-color="#0e1014"/>
  </linearGradient>
  <linearGradient id="steelV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6c7480"/><stop offset=".22" stop-color="#343a44"/>
    <stop offset=".68" stop-color="#1c1f26"/><stop offset="1" stop-color="#0c0e12"/>
  </linearGradient>
  <linearGradient id="darkPanel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1c2028"/><stop offset=".5" stop-color="#101319"/>
    <stop offset="1" stop-color="#080a0e"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbebb4"/><stop offset=".3" stop-color="#d4af37"/>
    <stop offset=".62" stop-color="#8f6f1e"/><stop offset="1" stop-color="#f3d478"/>
  </linearGradient>
  <linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f7dfa0"/><stop offset=".45" stop-color="#b8912c"/>
    <stop offset="1" stop-color="#5c4712"/>
  </linearGradient>
  <linearGradient id="copper" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffd79a"/><stop offset=".4" stop-color="#c98f45"/>
    <stop offset=".75" stop-color="#7d4f21"/><stop offset="1" stop-color="#c98f45"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2c3742" stop-opacity=".95"/>
    <stop offset=".45" stop-color="#0d151d" stop-opacity=".9"/>
    <stop offset="1" stop-color="#1a232c" stop-opacity=".95"/>
  </linearGradient>
  <linearGradient id="screenBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#10212b"/><stop offset="1" stop-color="#050d14"/>
  </linearGradient>
  <linearGradient id="whiteShell" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9aa3ae"/><stop offset=".16" stop-color="#eef2f5"/>
    <stop offset=".45" stop-color="#c3cbd4"/><stop offset=".72" stop-color="#f7fafc"/>
    <stop offset="1" stop-color="#8d96a2"/>
  </linearGradient>
  <radialGradient id="stageGlow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#d4af37" stop-opacity=".22"/>
    <stop offset=".55" stop-color="#d4af37" stop-opacity=".06"/>
    <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="marble" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#20242b"/><stop offset=".5" stop-color="#11141a"/>
    <stop offset="1" stop-color="#080a0d"/>
  </linearGradient>
  <pattern id="perf" width="9" height="9" patternUnits="userSpaceOnUse">
    <circle cx="4.5" cy="4.5" r="1.5" fill="#06080b"/>
  </pattern>
  <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="blur6" x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="6"/>
  </filter>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
    <feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="#000000" flood-opacity=".72"/>
  </filter>
</defs>"""

CIRCUITS: Final[str] = """<g fill="none" stroke="#d4af37" stroke-width="2" opacity=".15" stroke-linejoin="round">
  <path d="M90 360 H320 L386 294 H648 L706 352 H980"/>
  <path d="M1830 330 H1610 L1546 266 H1302 L1246 322 H1010"/>
  <path d="M120 470 H300 L360 530 H560"/>
  <path d="M1800 470 H1624 L1568 524 H1370"/>
  <path d="M420 190 V236 L480 296 V392"/>
  <path d="M1500 186 V240 L1440 300 V378"/>
  <path d="M760 200 H900 L950 250 H1100"/>
</g>
<g fill="#f3d478" opacity=".38">
  <circle cx="980" cy="352" r="4"/><circle cx="1010" cy="322" r="4"/>
  <circle cx="560" cy="530" r="3.5"/><circle cx="1370" cy="524" r="3.5"/>
  <circle cx="480" cy="296" r="3.5"/><circle cx="1440" cy="300" r="3.5"/>
</g>"""

PLATFORM: Final[str] = """<g>
  <ellipse cx="960" cy="874" rx="780" ry="118" fill="#000000" opacity=".75" filter="url(#blur6)"/>
  <ellipse cx="960" cy="820" rx="724" ry="104" fill="url(#stageGlow)"/>
  <ellipse cx="960" cy="830" rx="700" ry="96" fill="url(#marble)" stroke="url(#gold)" stroke-width="2.2"/>
  <path d="M300 826 Q560 790 820 836 T1380 818" fill="none" stroke="#8a92a0" stroke-width="1" opacity=".13"/>
  <path d="M420 860 Q700 812 960 856 T1500 842" fill="none" stroke="#c9d1dc" stroke-width="1" opacity=".09"/>
  <path d="M520 792 Q760 830 1040 796 T1400 820" fill="none" stroke="#ffffff" stroke-width="1" opacity=".07"/>
  <ellipse cx="960" cy="830" rx="650" ry="72" fill="none" stroke="#f3d478" stroke-width="1" opacity=".26"/>
</g>"""


# ---------------------------------------------------------------------------
# Subject 1 — corporate server rack / fiber backbone
# ---------------------------------------------------------------------------


def rack_hardware() -> str:
    """Draw a 42U rack with patch panel, switch, firewall, blade servers and PDU."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    parts.append(panel(500, 202, 920, 648, rx=18, fill="url(#steelV)"))
    parts.append(
        '<rect x="516" y="218" width="888" height="616" rx="10" fill="#090b0f" '
        'stroke="url(#gold)" stroke-width="2.2"/>'
    )
    # Rack rails with mounting holes.
    for rx in (532, 1372):
        parts.append(f'<rect x="{rx}" y="226" width="20" height="600" rx="4" fill="url(#steel)" opacity=".9"/>')
        for yy in range(238, 824, 26):
            parts.append(
                f'<circle cx="{rx + 10}" cy="{yy}" r="3" fill="#030405" stroke="#666e7c" stroke-width=".8"/>'
            )
    # Top identification strip.
    parts.append(
        '<rect x="566" y="228" width="772" height="24" rx="4" fill="#0e1219" stroke="#2a313c" stroke-width="1"/>'
    )
    parts.append(svg_text(580, 245, "LAVOX  /  NEXT-GEN CORE  ·  42U", size=13, fill=GOLD_LIGHT, spacing=2))
    parts.append(svg_text(1324, 245, "NXC-4200", size=12, fill="#8b94a3", anchor="end", spacing=1))

    # --- Fiber patch panel (y=258..326) ---
    parts.append(panel(566, 258, 772, 66, rx=5, fill="url(#darkPanel)"))
    parts.append('<rect x="566" y="258" width="772" height="3" fill="url(#gold)" opacity=".7"/>')
    parts.append(svg_text(580, 279, "FIBER PATCH", size=11, fill="#9aa4b3", spacing=1.4))
    port_colors = ("#37c6d8", "#37c6d8", "#d4af37", "#6fa8ff")
    for row in range(2):
        for col in range(12):
            idx = row * 12 + col
            px = 580 + col * 55
            py = 288 + row * 19
            parts.append(
                f'<rect x="{px}" y="{py}" width="34" height="13" rx="2" fill="#05070a" stroke="#3a424e" stroke-width="1"/>'
                f'<rect x="{px + 4}" y="{py + 3}" width="9" height="7" rx="1" fill="{port_colors[idx % 4]}" opacity=".85"/>'
                f'<rect x="{px + 17}" y="{py + 3}" width="9" height="7" rx="1" fill="{port_colors[(idx + 2) % 4]}" opacity=".7"/>'
            )
            if idx % 3 == 0:
                parts.append(svg_text(px + 1, py - 2, f"{idx + 1:02d}", size=7, fill="#6f7886"))
    parts.append(screw(1318, 291, 7))
    # Fiber patch cables draping to the right cable manager.
    for i, color in enumerate(("#37c6d8", "#d4af37", "#6fa8ff", "#37c6d8", "#e07a5f")):
        sx = 600 + i * 34
        parts.append(
            f'<path d="M{sx} 300 C{sx + 40} 372 {1200 + i * 12} 340 {1284 + i * 6} 392 '
            f'S1336 520 1360 660" fill="none" stroke="{color}" stroke-width="6" opacity=".5" '
            'stroke-linecap="round"/>'
            f'<path d="M{sx} 300 C{sx + 40} 372 {1200 + i * 12} 340 {1284 + i * 6} 392 '
            f'S1336 520 1360 660" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".3"/>'
        )

    # --- Managed switch (y=332..400) ---
    parts.append(panel(566, 332, 772, 66, rx=5, fill="url(#darkPanel)"))
    parts.append('<rect x="566" y="332" width="772" height="3" fill="url(#gold)" opacity=".55"/>')
    parts.append(svg_text(580, 352, "MANAGED SWITCH  48G  +  4SFP", size=11, fill="#9aa4b3", spacing=1.2))
    for row in range(2):
        for col in range(12):
            px = 580 + col * 39
            py = 362 + row * 25
            parts.append(
                f'<rect x="{px}" y="{py}" width="30" height="17" rx="2" fill="#040609" stroke="#454d59" stroke-width="1"/>'
                f'<rect x="{px + 3}" y="{py + 4}" width="24" height="10" rx="1" fill="#111820"/>'
            )
            for k in range(4):
                parts.append(f'<rect x="{px + 4 + k * 5.6:.1f}" y="{py + 6}" width="2" height="5" fill="{GOLD_LIGHT}" opacity=".7"/>')
            parts.append(led(px + 15, py - 5, "#49e08a" if (col + row) % 3 else "#f0b429", 2.6, halo=False))
    for i in range(4):
        px = 1070 + i * 46
        parts.append(
            f'<rect x="{px}" y="362" width="38" height="26" rx="3" fill="url(#goldV)" stroke="#0a0c10" stroke-width="1.5"/>'
            f'<rect x="{px + 5}" y="368" width="28" height="14" rx="2" fill="#0a0f14"/>'
        )
    parts.append('<rect x="1264" y="360" width="58" height="30" rx="3" fill="#07131b" stroke="#1f4a58" stroke-width="1"/>')
    parts.append(svg_text(1293, 380, "10GbE", size=10, fill="#37c6d8", anchor="middle", spacing=.5))
    parts.append(screw(1318, 365, 7))

    # --- Next-generation firewall (y=406..464) ---
    parts.append(panel(566, 406, 772, 56, rx=5, fill="url(#darkPanel)"))
    parts.append('<rect x="566" y="406" width="772" height="3" fill="url(#gold)" opacity=".6"/>')
    parts.append(svg_text(582, 435, "NGFW", size=20, fill="#e8edf4", weight=800, spacing=2))
    parts.append(svg_text(660, 434, "THREAT-INSPECT / 2026", size=11, fill="#7e8898", spacing=1))
    for i in range(14):
        parts.append(f'<rect x="760" y="420" width="3" height="{8 + (i % 5) * 4}" fill="{TEAL if i % 2 else GOLD}" opacity=".65"/>')
    for i, color in enumerate(("#49e08a", "#49e08a", "#f0b429", "#49e08a")):
        parts.append(led(1030 + i * 20, 436, color, 4))
    parts.append(vent_grid(1120, 418, 170, 32, 24, 4))
    parts.append(screw(1318, 434, 7))

    # --- Blade servers (y=472..764) ---
    for i in range(5):
        sy = 472 + i * 58
        parts.append(panel(566, sy, 772, 52, rx=4, fill="url(#steelV)"))
        parts.append('<rect x="566" y="sy" width="772" height="2" fill="url(#gold)" opacity=".5"/>'.replace("sy", str(sy)))
        # Handle ends.
        parts.append(f'<rect x="572" y="{sy + 8}" width="26" height="36" rx="4" fill="#0b0e13" stroke="#69717e" stroke-width="1.5"/>')
        parts.append(f'<rect x="1306" y="{sy + 8}" width="26" height="36" rx="4" fill="#0b0e13" stroke="#69717e" stroke-width="1.5"/>')
        # Drive bays.
        for d in range(4):
            bx = 610 + d * 74
            parts.append(
                f'<rect x="{bx}" y="{sy + 9}" width="66" height="34" rx="3" fill="#12161d" stroke="#3b434f" stroke-width="1.2"/>'
                f'<rect x="{bx + 4}" y="{sy + 13}" width="58" height="24" rx="2" fill="url(#perf)" opacity=".9"/>'
                f'<rect x="{bx + 47}" y="{sy + 24}" width="11" height="4" rx="1" fill="#5c6572"/>'
            )
            parts.append(led(bx + 8, sy + 16, "#49e08a" if (i + d) % 4 else "#f0b429", 2.6, halo=False))
        parts.append(vent_grid(920, sy + 10, 180, 32, 26, 4))
        parts.append(svg_text(1120, sy + 22, "NX-4200", size=11, fill="#cfd6e0", weight=700, spacing=1))
        parts.append(svg_text(1120, sy + 38, "DUAL Xeon · 512GB · NVMe", size=9, fill="#79828f"))
        for j, c in enumerate(("#49e08a", "#49e08a", "#37c6d8")):
            parts.append(led(1240 + j * 16, sy + 26, c, 3.4, halo=False))
        parts.append(screw(1319, sy + 26, 5.5))

    # --- Redundant PDU / UPS (y=778..830) ---
    parts.append(panel(566, 778, 772, 48, rx=4, fill="url(#darkPanel)"))
    parts.append('<rect x="566" y="778" width="772" height="3" fill="url(#gold)" opacity=".6"/>')
    parts.append(svg_text(582, 807, "PDU / UPS", size=12, fill="#dfe5ee", weight=700, spacing=1))
    for i in range(8):
        px = 700 + i * 52
        parts.append(
            f'<rect x="{px}" y="792" width="40" height="22" rx="3" fill="#05070a" stroke="#454d59" stroke-width="1"/>'
            f'<circle cx="{px + 13}" cy="803" r="3" fill="#0a0d12" stroke="#737b88" stroke-width="1"/>'
            f'<circle cx="{px + 27}" cy="803" r="3" fill="#0a0d12" stroke="#737b88" stroke-width="1"/>'
        )
    parts.append('<rect x="1160" y="790" width="86" height="26" rx="3" fill="#071018" stroke="#1c4d5a" stroke-width="1"/>')
    parts.append(svg_text(1203, 808, "230V  16A", size=12, fill="#37c6d8", anchor="middle", spacing=.5))
    parts.append(led(1270, 803, "#49e08a", 4))
    parts.append(screw(1318, 802, 6.5))

    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Subject 2 — next-generation fuel dispenser / tank automation
# ---------------------------------------------------------------------------


def fuel_hardware() -> str:
    """Draw a 2026 fuel dispenser with touchscreen, hose, nozzle and tank gauges."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    # Pedestal.
    parts.append(
        '<path d="M690 812 H1130 L1160 848 H660 Z" fill="url(#steelV)" stroke="#05070a" stroke-width="2"/>'
    )
    parts.append('<rect x="676" y="800" width="468" height="16" rx="6" fill="url(#goldV)" opacity=".8"/>')
    # Main dispenser body.
    parts.append(
        '<rect x="700" y="252" width="420" height="556" rx="34" fill="url(#whiteShell)" '
        'stroke="#0b0d11" stroke-width="3"/>'
    )
    parts.append(
        '<rect x="716" y="268" width="388" height="524" rx="26" fill="none" stroke="#ffffff" stroke-width="2" opacity=".35"/>'
    )
    parts.append('<rect x="700" y="252" width="420" height="10" rx="5" fill="url(#gold)"/>')
    # Glossy front console.
    parts.append(
        '<rect x="736" y="292" width="348" height="286" rx="18" fill="url(#glass)" '
        'stroke="#0a0e13" stroke-width="2.5"/>'
    )
    # Touchscreen with fueling UI.
    parts.append('<rect x="752" y="308" width="316" height="204" rx="10" fill="url(#screenBg)" stroke="#233a46" stroke-width="1.5"/>')
    parts.append(svg_text(770, 336, "LAVOX  FUEL OS  2026", size=12, fill=TEAL, spacing=1.4))
    parts.append(svg_text(770, 374, "95 OKTAN", size=15, fill="#cbd5e1", spacing=1))
    parts.append(svg_text(1050, 374, "36.48 TL/L", size=15, fill=GOLD_LIGHT, anchor="end"))
    parts.append(svg_text(770, 428, "38.72", size=46, fill="#ffffff", weight=700))
    parts.append(svg_text(922, 428, "L", size=20, fill="#9fb0bf"))
    parts.append(svg_text(1050, 428, "1.412,80 TL", size=20, fill=GOLD_LIGHT, anchor="end"))
    # Fill gauge.
    parts.append('<rect x="770" y="452" width="280" height="14" rx="7" fill="#0a141b" stroke="#2b4653" stroke-width="1"/>')
    parts.append('<rect x="772" y="454" width="212" height="10" rx="5" fill="url(#gold)"/>')
    parts.append(svg_text(770, 498, "YAKIT  ·  ÖDEME ONAYLANDI", size=11, fill="#7f98a8", spacing=1))
    # Keypad and reader.
    for r in range(3):
        for c in range(3):
            kx = 770 + c * 52
            ky = 532 + r * 30
            parts.append(f'<rect x="{kx}" y="{ky}" width="42" height="22" rx="4" fill="#182028" stroke="#46515e" stroke-width="1"/>')
    parts.append('<rect x="940" y="532" width="118" height="26" rx="5" fill="#0a0e13" stroke="#414b58" stroke-width="1"/>')
    parts.append('<rect x="950" y="540" width="98" height="10" rx="3" fill="#050709"/>')
    parts.append(svg_text(999, 574, "TEMASSIZ ÖDEME", size=9, fill="#8c97a5", anchor="middle", spacing=.6))
    # Fuel grade buttons with illuminated rings.
    for i, (grade, color) in enumerate((("95", TEAL), ("98", GOLD_LIGHT), ("DİZEL", "#e07a5f"))):
        gx = 752 + i * 108
        parts.append(f'<circle cx="{gx + 42}" cy="612" r="26" fill="#10161d" stroke="{color}" stroke-width="2.5"/>')
        parts.append(svg_text(gx + 42, 618, grade, size=13 if i < 2 else 10, fill=color, anchor="middle", weight=700))
    # Side holster, hose and nozzle.
    parts.append('<path d="M1120 470 C1210 470 1240 520 1240 592 C1240 650 1200 676 1170 700" fill="none" stroke="#0a0c10" stroke-width="17" stroke-linecap="round"/>')
    parts.append('<path d="M1120 470 C1210 470 1240 520 1240 592 C1240 650 1200 676 1170 700" fill="none" stroke="#2b3038" stroke-width="9" stroke-linecap="round"/>')
    parts.append('<path d="M1120 470 C1210 470 1240 520 1240 592 C1240 650 1200 676 1170 700" fill="none" stroke="#6b7380" stroke-width="2" opacity=".6"/>')
    parts.append('<rect x="1140" y="690" width="46" height="92" rx="10" fill="url(#steel)" stroke="#06080b" stroke-width="2" transform="rotate(14 1163 736)"/>')
    parts.append('<path d="M1150 700 L1142 640 L1188 636 L1180 700 Z" fill="url(#steelV)" stroke="#06080b" stroke-width="2" transform="rotate(14 1163 736)"/>')
    parts.append('<rect x="1138" y="632" width="54" height="14" rx="5" fill="#c0392b" transform="rotate(14 1163 736)"/>')
    parts.append(screw(723, 790, 6))
    parts.append(screw(1097, 790, 6))

    # Tank automation / level telemetry cabinet.
    parts.append('<rect x="1250" y="430" width="300" height="382" rx="16" fill="url(#steelV)" stroke="#07090c" stroke-width="2.5"/>')
    parts.append('<rect x="1264" y="444" width="272" height="354" rx="10" fill="#0b0f14" stroke="url(#gold)" stroke-width="1.6"/>')
    parts.append(svg_text(1282, 474, "TANK OTOMASYONU", size=14, fill=GOLD_LIGHT, spacing=1.5))
    parts.append(svg_text(1282, 494, "ATG-4  ·  SENSOR BUS", size=10, fill="#7e8898", spacing=1))
    tank_data = (("T1", 82, TEAL), ("T2", 64, GOLD), ("T3", 91, TEAL), ("T4", 47, "#e07a5f"))
    for i, (name, level, color) in enumerate(tank_data):
        ty = 520 + i * 62
        parts.append(svg_text(1282, ty, name, size=13, fill="#cbd5e1", weight=700))
        parts.append(f'<rect x="1314" y="{ty - 12}" width="182" height="16" rx="4" fill="#05080b" stroke="#2d3743" stroke-width="1"/>')
        parts.append(f'<rect x="1316" y="{ty - 10}" width="{int(178 * level / 100)}" height="12" rx="3" fill="{color}" opacity=".85"/>')
        parts.append(svg_text(1518, ty, f"%{level}", size=12, fill=color, anchor="end"))
        parts.append(f'<circle cx="1300" cy="{ty - 4}" r="3" fill="{color}"/>')
    parts.append('<rect x="1282" y="772" width="246" height="16" rx="4" fill="#071018" stroke="#1c4d5a" stroke-width="1"/>')
    parts.append(svg_text(1405, 784, "SIZDİRMA KONTROLÜ  ·  AKTİF", size=9, fill="#37c6d8", anchor="middle", spacing=.6))
    parts.append(screw(1272, 448, 5.5))
    parts.append(screw(1528, 448, 5.5))
    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Subject 3 — N2MOBİL GPS fleet tracker + live fleet map
# ---------------------------------------------------------------------------


def fleet_hardware() -> str:
    """Draw a GPS telematics unit wired to a live fleet-tracking map display."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    # GPS telematics device (hero hardware).
    parts.append('<rect x="330" y="470" width="430" height="250" rx="24" fill="url(#steelV)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<rect x="346" y="486" width="398" height="218" rx="16" fill="#0c1016" stroke="url(#gold)" stroke-width="1.8"/>')
    parts.append(svg_text(366, 518, "N2MOBİL  ·  GPS / GNSS", size=15, fill=PINK, weight=700, spacing=1.5))
    parts.append(svg_text(366, 538, "FM-9000  NEXTGEN TELEMATICS", size=10, fill="#7d8796", spacing=1))
    # Connector block.
    parts.append('<rect x="366" y="556" width="118" height="120" rx="8" fill="#151a21" stroke="#3d4551" stroke-width="1.5"/>')
    for i in range(4):
        for j in range(3):
            px = 378 + i * 26
            py = 570 + j * 34
            parts.append(f'<rect x="{px}" y="{py}" width="18" height="24" rx="2" fill="#05070a" stroke="#59616d" stroke-width=".9"/>')
            parts.append(f'<rect x="{px + 4}" y="{py + 5}" width="10" height="10" fill="{GOLD if (i + j) % 2 else "#9aa3b0"}" opacity=".7"/>')
    # SMA antenna connector.
    parts.append('<circle cx="560" cy="588" r="26" fill="url(#steel)" stroke="#06080b" stroke-width="2"/>')
    parts.append('<circle cx="560" cy="588" r="15" fill="#0b0e13" stroke="#aeb5bf" stroke-width="1.5"/>')
    parts.append('<circle cx="560" cy="588" r="6" fill="{GOLD}" />'.replace("{GOLD}", GOLD))
    parts.append(svg_text(560, 636, "ANT", size=9, fill="#8d96a4", anchor="middle", spacing=1))
    # Status LEDs and SIM slot.
    for i, (label, color) in enumerate((("PWR", TEAL), ("GPS", GOLD_LIGHT), ("GSM", PINK), ("CAN", TEAL))):
        lx = 522 + i * 52
        parts.append(led(lx, 662, color, 5))
        parts.append(svg_text(lx, 682, label, size=8, fill="#8993a1", anchor="middle", spacing=.5))
    parts.append('<rect x="366" y="690" width="358" height="10" rx="3" fill="#05070a" stroke="#3d4551" stroke-width="1"/>')
    parts.append('<rect x="372" y="692" width="120" height="6" rx="2" fill="url(#goldV)" opacity=".7"/>')
    parts.append(screw(360, 498, 6))
    parts.append(screw(730, 498, 6))
    parts.append(screw(360, 702, 6))
    parts.append(screw(730, 702, 6))
    # Signal waves linking device to the map.
    for r in (34, 58, 84):
        parts.append(
            f'<path d="M800 {594 - r} A{r} {r} 0 0 1 800 {594 + r}" fill="none" stroke="{PINK}" '
            f'stroke-width="2" opacity="{0.4 - r / 300:.2f}"/>'
        )

    # Fleet map display.
    parts.append('<rect x="880" y="262" width="700" height="500" rx="18" fill="url(#steelV)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<rect x="898" y="280" width="664" height="464" rx="10" fill="url(#screenBg)" stroke="#263542" stroke-width="2"/>')
    # Map grid and roads.
    for gx in range(920, 1560, 56):
        parts.append(f'<line x1="{gx}" y1="300" x2="{gx}" y2="726" stroke="#1b3340" stroke-width="1" opacity=".55"/>')
    for gy in range(300, 730, 52):
        parts.append(f'<line x1="912" y1="{gy}" x2="1552" y2="{gy}" stroke="#1b3340" stroke-width="1" opacity=".55"/>')
    parts.append('<path d="M912 620 Q1010 560 1080 600 T1260 520 T1552 470" fill="none" stroke="#2c4b5c" stroke-width="10" opacity=".45"/>')
    parts.append('<path d="M960 300 Q1000 420 1120 460 T1300 660" fill="none" stroke="#2c4b5c" stroke-width="8" opacity=".4"/>')
    parts.append('<path d="M912 620 Q1010 560 1080 600 T1260 520 T1552 470" fill="none" stroke="#2c4b5c" stroke-width="8" opacity=".4"/>')
    # Live route with glow.
    route = "M940 660 C1010 640 1010 520 1080 500 S1210 560 1260 470 S1420 410 1520 360"
    parts.append(f'<path d="{route}" fill="none" stroke="{PINK}" stroke-width="9" opacity=".28" filter="url(#glow)"/>')
    parts.append(f'<path d="{route}" fill="none" stroke="{PINK}" stroke-width="3.5"/>')
    # Vehicle markers.
    for vx, vy, rot in ((1010, 636, -28), (1080, 500, 12), (1260, 470, -18), (1420, 415, 24), (940, 660, 0)):
        parts.append(
            f'<g transform="translate({vx} {vy}) rotate({rot})">'
            f'<circle r="13" fill="{PINK}" opacity=".18" filter="url(#blur6)"/>'
            f'<path d="M0 -11 L9 9 L0 4 L-9 9 Z" fill="#ffffff" stroke="{PINK}" stroke-width="2"/>'
            f"</g>"
        )
    # Map HUD.
    parts.append('<rect x="912" y="298" width="250" height="34" rx="6" fill="#070f16" opacity=".92" stroke="#24404f" stroke-width="1"/>')
    parts.append(svg_text(928, 320, "CANLI FİLO  ·  124 ARAÇ", size=13, fill=PINK, spacing=1))
    parts.append('<circle cx="1540" cy="316" r="6" fill="#49e08a" filter="url(#glow)"/>')
    parts.append(svg_text(1524, 321, "ÇEVRİMİÇİ", size=10, fill="#9fb2bf", anchor="end", spacing=.8))
    parts.append('<rect x="912" y="688" width="638" height="42" rx="6" fill="#070f16" opacity=".92" stroke="#24404f" stroke-width="1"/>')
    stats = (("128", "TOPLAM"), ("124", "AKTİF"), ("4", "BAĞLANTISIZ"), ("%97", "SİNYAL"))
    for i, (val, lab) in enumerate(stats):
        sx = 936 + i * 158
        parts.append(svg_text(sx, 714, val, size=18, fill="#ffffff" if i < 2 else GOLD_LIGHT, weight=700))
        parts.append(svg_text(sx + 44, 713, lab, size=9, fill="#8497a5", spacing=.6))
    # Display stand.
    parts.append('<path d="M1200 762 H1260 L1276 820 H1184 Z" fill="url(#steel)" stroke="#06080b" stroke-width="2"/>')
    parts.append('<rect x="1130" y="818" width="200" height="12" rx="6" fill="url(#goldV)" opacity=".85"/>')
    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Subject 4 — enterprise ERP / software dashboard on an ultrawide monitor
# ---------------------------------------------------------------------------


def software_hardware() -> str:
    """Draw an ultrawide studio monitor showing a dense enterprise ERP dashboard."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    # Bezel and screen.
    parts.append('<rect x="372" y="248" width="1176" height="500" rx="18" fill="url(#steelV)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<rect x="388" y="264" width="1144" height="468" rx="8" fill="#04070a" stroke="url(#gold)" stroke-width="1.6"/>')
    parts.append('<rect x="396" y="272" width="1128" height="452" rx="4" fill="url(#screenBg)"/>')
    parts.append('<rect x="396" y="272" width="1128" height="452" rx="4" fill="url(#glass)" opacity=".18"/>')
    # Sidebar.
    parts.append('<rect x="396" y="272" width="188" height="452" fill="#0a1118"/>')
    parts.append('<rect x="396" y="272" width="188" height="48" fill="#101a23"/>')
    parts.append(svg_text(414, 302, "NAZTECH ERP", size=14, fill=GOLD_LIGHT, weight=700, spacing=1))
    menu = ("Genel Bakış", "Satış", "Finans", "Stok", "Üretim", "İnsan Kaynakları", "Raporlar")
    for i, item in enumerate(menu):
        my = 344 + i * 48
        if i == 0:
            parts.append(f'<rect x="404" y="{my - 22}" width="172" height="38" rx="5" fill="#152a35" stroke="{TEAL}" stroke-width="1"/>')
        color = TEAL if i == 0 else "#7f8b9a"
        parts.append(f'<circle cx="422" cy="{my - 3}" r="5" fill="none" stroke="{color}" stroke-width="1.8"/>')
        parts.append(svg_text(438, my + 2, item, size=11, fill=color, spacing=.3))
    # Top bar.
    parts.append('<rect x="584" y="272" width="940" height="48" fill="#0c151d"/>')
    parts.append(svg_text(606, 302, "YÖNETİM PANELİ  ·  2026/Q4", size=13, fill="#dbe3ec", weight=700, spacing=1))
    parts.append(svg_text(1490, 302, "CARİ HESAP  ·  TRY", size=10, fill="#8493a2", anchor="end", spacing=.6))
    # KPI cards.
    kpis = (("CIRO", "₺48.2M", "+12.4%", TEAL), ("SİPARİŞ", "1.284", "+8.1%", GOLD_LIGHT), ("MÜŞTERİ", "3.920", "+3.7%", "#7ea6ff"), ("MARJ", "%18.6", "+1.2%", "#49e08a"))
    for i, (label, value, delta, color) in enumerate(kpis):
        kx = 606 + i * 228
        parts.append(f'<rect x="{kx}" y="334" width="212" height="88" rx="7" fill="#101920" stroke="#26343f" stroke-width="1"/>')
        parts.append(svg_text(kx + 14, 356, label, size=10, fill="#8493a2", spacing=1))
        parts.append(svg_text(kx + 14, 392, value, size=26, fill="#ffffff", weight=700))
        parts.append(svg_text(kx + 198, 390, delta, size=11, fill=color, anchor="end", weight=700))
    # Area chart.
    parts.append('<rect x="606" y="438" width="560" height="266" rx="7" fill="#0c151c" stroke="#26343f" stroke-width="1"/>')
    parts.append(svg_text(624, 464, "GELİR TRENDİ  ·  12 AY", size=11, fill="#9fb0bf", spacing=1))
    values = (38, 44, 41, 55, 51, 63, 58, 71, 67, 79, 76, 90)
    x0, ybase, width = 626, 676, 520
    step = width / (len(values) - 1)
    pts = " ".join(f"{x0 + i * step:.1f},{ybase - v * 1.9:.1f}" for i, v in enumerate(values))
    area = f"M{x0},{ybase} L" + " L".join(f"{x0 + i * step:.1f},{ybase - v * 1.9:.1f}" for i, v in enumerate(values)) + f" L{x0 + width},{ybase} Z"
    parts.append(f'<polygon points="{area}" fill="url(#gold)" opacity=".16"/>')
    parts.append(f'<polyline points="{pts}" fill="none" stroke="{GOLD_LIGHT}" stroke-width="2.5"/>')
    for i, v in enumerate(values):
        parts.append(f'<circle cx="{x0 + i * step:.1f}" cy="{ybase - v * 1.9:.1f}" r="2.6" fill="#f7e3a6"/>')
    for gy in (500, 552, 604, 656):
        parts.append(f'<line x1="626" y1="{gy}" x2="1146" y2="{gy}" stroke="#1d2c36" stroke-width="1"/>')
    # Bar chart + donut.
    parts.append('<rect x="1182" y="438" width="170" height="266" rx="7" fill="#0c151c" stroke="#26343f" stroke-width="1"/>')
    parts.append(svg_text(1198, 464, "BÖLGE", size=11, fill="#9fb0bf", spacing=1))
    heights = (74, 96, 58, 88, 66, 104, 82)
    for i, bh in enumerate(heights):
        bx = 1198 + i * 21
        parts.append(f'<rect x="{bx}" y="{680 - bh}" width="13" height="{bh}" rx="2" fill="{TEAL if i % 2 else GOLD}" opacity=".85"/>')
    parts.append('<rect x="1368" y="438" width="156" height="266" rx="7" fill="#0c151c" stroke="#26343f" stroke-width="1"/>')
    parts.append(svg_text(1384, 464, "PAY", size=11, fill="#9fb0bf", spacing=1))
    parts.append('<circle cx="1446" cy="548" r="48" fill="none" stroke="#1d2c36" stroke-width="14"/>')
    parts.append('<circle cx="1446" cy="548" r="48" fill="none" stroke="' + GOLD_LIGHT + '" stroke-width="14" stroke-dasharray="150 300" transform="rotate(-90 1446 548)"/>')
    parts.append('<circle cx="1446" cy="548" r="48" fill="none" stroke="' + TEAL + '" stroke-width="14" stroke-dasharray="90 360" stroke-dashoffset="-150" transform="rotate(-90 1446 548)"/>')
    parts.append(svg_text(1446, 554, "48%", size=17, fill="#ffffff", anchor="middle", weight=700))
    for i, (lab, color) in enumerate((("Kurumsal", GOLD_LIGHT), ("Bireysel", TEAL))):
        parts.append(f'<circle cx="1390" cy="{632 + i * 26}" r="5" fill="{color}"/>')
        parts.append(svg_text(1404, 636 + i * 26, lab, size=10, fill="#9fb0bf"))
    # Stand.
    parts.append('<path d="M900 748 H1020 L1040 806 H880 Z" fill="url(#steel)" stroke="#06080b" stroke-width="2"/>')
    parts.append('<path d="M930 806 H990 L1010 826 H910 Z" fill="url(#goldV)" opacity=".8"/>')
    parts.append('<rect x="828" y="824" width="264" height="14" rx="7" fill="url(#steelV)" stroke="#06080b" stroke-width="2"/>')
    parts.append(screw(390, 266, 4.5))
    parts.append(screw(1528, 266, 4.5))
    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Subject 5 — addressable fire alarm panel + smoke detector
# ---------------------------------------------------------------------------


def fire_hardware() -> str:
    """Draw an addressable fire-alarm control panel, smoke detector and sounder."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    # Control panel cabinet.
    parts.append('<rect x="470" y="250" width="660" height="580" rx="18" fill="url(#steelV)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<rect x="486" y="266" width="628" height="548" rx="10" fill="#0c1016" stroke="url(#gold)" stroke-width="2"/>')
    parts.append('<rect x="486" y="266" width="628" height="56" rx="10" fill="url(#goldV)" opacity=".16"/>')
    parts.append(svg_text(508, 300, "ADRESİF YANGIN ALARM PANELİ", size=19, fill=GOLD_LIGHT, weight=700, spacing=1.5))
    parts.append(svg_text(1070, 298, "FA-2026 / 2 LOOP", size=11, fill="#9aa4b2", anchor="end", spacing=1))
    # LCD with device list.
    parts.append('<rect x="508" y="340" width="396" height="212" rx="8" fill="url(#screenBg)" stroke="#245039" stroke-width="2"/>')
    parts.append(svg_text(526, 366, "LOOP 1   ·   126 CİHAZ   ·   NORMAL", size=11, fill="#49e08a", spacing=.8))
    lines = (
        "01  DUMAN DED.   KAT 1   OK",
        "02  ISI DED.     KAT 2   OK",
        "03  MANUEL BUT.  KAT 1   OK",
        "04  SIREne       KAT 3   OK",
        "05  MODÜL        KAT 2   OK",
        "06  DUMAN DED.   KAT 4   OK",
    )
    for i, line in enumerate(lines):
        parts.append(svg_text(526, 398 + i * 24, line.replace("SIREne", "SİREN"), size=11, fill="#b9c7d2", spacing=.4))
    parts.append('<rect x="924" y="340" width="158" height="212" rx="8" fill="#11161d" stroke="#2b333d" stroke-width="1.5"/>')
    parts.append(svg_text(1003, 364, "ZONLAR", size=11, fill="#9aa4b2", anchor="middle", spacing=1.4))
    for i in range(8):
        zy = 386 + i * 19
        parts.append(led(950, zy, "#49e08a" if i not in (3, 6) else "#e07a5f", 4, halo=False))
        parts.append(svg_text(966, zy + 4, f"Z{i + 1}", size=10, fill="#9fa9b6"))
        parts.append(f'<rect x="1000" y="{zy - 5}" width="60" height="10" rx="2" fill="#05080b" stroke="#2c343e" stroke-width=".8"/>')
        parts.append(f'<rect x="1002" y="{zy - 3}" width="{40 + (i % 3) * 8}" height="6" fill="{GOLD if i % 2 else TEAL}" opacity=".6"/>')
    # Numeric keypad and function keys.
    for r in range(3):
        for c in range(3):
            kx = 512 + c * 54
            ky = 578 + r * 40
            parts.append(f'<rect x="{kx}" y="{ky}" width="44" height="30" rx="5" fill="#171d25" stroke="#454e5a" stroke-width="1.2"/>')
            parts.append(svg_text(kx + 22, ky + 20, str(r * 3 + c + 1), size=13, fill="#cbd5df", anchor="middle"))
    functions = (("ONAYLA", "#e07a5f"), ("SIFIRLA", GOLD), ("SESSİZ", TEAL))
    for i, (lab, color) in enumerate(functions):
        fx = 700 + i * 94
        parts.append(f'<rect x="{fx}" y="578" width="84" height="40" rx="6" fill="#171d25" stroke="{color}" stroke-width="1.8"/>')
        parts.append(svg_text(fx + 42, 603, lab, size=10, fill=color, anchor="middle", spacing=.4))
    for i, (lab, color) in enumerate((("DEVRE", "#49e08a"), ("ARIZA", "#f0b429"), ("ALARM", "#e0403f"))):
        fx = 700 + i * 94
        parts.append(f'<rect x="{fx}" y="630" width="84" height="38" rx="6" fill="#12171e" stroke="#3a424d" stroke-width="1.2"/>')
        parts.append(led(fx + 14, 649, color, 4, halo=False))
        parts.append(svg_text(fx + 48, 653, lab, size=10, fill="#9fa9b6", anchor="middle"))
    parts.append(vent_grid(996, 578, 96, 86, 16, 14))
    parts.append('<circle cx="1082" cy="742" r="16" fill="url(#steel)" stroke="#05070a" stroke-width="2"/>')
    parts.append('<circle cx="1082" cy="742" r="8" fill="#0a0d12" stroke="#9aa3b0" stroke-width="1.5"/>')
    parts.append(svg_text(508, 792, "EN 54-2  ·  ADDRESSABLE  ·  LAVOX SAFETY", size=10, fill="#798391", spacing=1.2))
    parts.append(screw(504, 282, 6))
    parts.append(screw(1096, 282, 6))

    # Smoke detector (white dome, vents, red LED).
    parts.append('<ellipse cx="1340" cy="700" rx="118" ry="20" fill="#000" opacity=".55" filter="url(#blur6)"/>')
    parts.append('<ellipse cx="1340" cy="470" rx="118" ry="30" fill="url(#whiteShell)" stroke="#0b0d11" stroke-width="2"/>')
    parts.append('<path d="M1222 470 A118 88 0 0 0 1458 470 L1458 500 A118 62 0 0 1 1222 500 Z" fill="url(#whiteShell)" stroke="#0b0d11" stroke-width="2"/>')
    parts.append('<ellipse cx="1340" cy="470" rx="96" ry="22" fill="#d8dee5" opacity=".55"/>')
    for i in range(14):
        ax = 1248 + i * 14
        parts.append(f'<path d="M{ax} 486 L{ax + 6} 486 L{ax + 4} 516 L{ax + 2} 516 Z" fill="#6c7683" opacity=".8"/>')
    parts.append(led(1340, 480, "#e0403f", 6))
    parts.append('<circle cx="1340" cy="470" r="34" fill="none" stroke="#9aa3ae" stroke-width="1.5" opacity=".7"/>')
    parts.append(svg_text(1340, 560, "DUMAN DEDektÖRÜ".replace("dedektÖRÜ", "DEDEKTÖRÜ"), size=12, fill="#aeb8c4", anchor="middle", spacing=1))
    # Sounder beacon.
    parts.append('<path d="M1298 646 A58 46 0 0 1 1414 646 L1414 672 H1298 Z" fill="#b92d2d" stroke="#05070a" stroke-width="2"/>')
    parts.append('<ellipse cx="1356" cy="646" rx="58" ry="20" fill="#e0403f" opacity=".85"/>')
    parts.append(led(1356, 648, "#ff8a80", 6))
    parts.append(svg_text(1356, 706, "SİREN / IŞIK", size=10, fill="#9aa4b2", anchor="middle", spacing=.8))
    parts.append('<path d="M1130 540 H1210" fill="none" stroke="#2b323c" stroke-width="6"/>')
    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Subject 6 — industrial electrical switchgear
# ---------------------------------------------------------------------------


def electrical_hardware() -> str:
    """Draw an open industrial switchgear cabinet with breakers and busbars."""
    parts: list[str] = ['<g filter="url(#shadow)">']
    # Enclosure.
    parts.append('<rect x="500" y="216" width="920" height="620" rx="16" fill="url(#steelV)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<rect x="516" y="232" width="888" height="588" rx="8" fill="#0b0e13" stroke="url(#gold)" stroke-width="2"/>')
    # Left door, slightly ajar.
    parts.append('<path d="M516 232 L360 262 L360 818 L516 820 Z" fill="url(#steel)" stroke="#05070a" stroke-width="3"/>')
    parts.append('<path d="M360 262 L516 232 L516 820 L360 818 Z" fill="none" stroke="#6f7783" stroke-width="1" opacity=".5"/>')
    parts.append('<rect x="392" y="500" width="22" height="70" rx="8" fill="url(#goldV)" stroke="#05070a" stroke-width="2"/>')
    parts.append('<circle cx="403" cy="498" r="9" fill="url(#steel)" stroke="#05070a" stroke-width="2"/>')
    parts.append(svg_text(402, 700, "LV / 400V", size=12, fill=GOLD_LIGHT, anchor="middle", spacing=1))
    # Interior back panel.
    parts.append('<rect x="540" y="248" width="848" height="556" rx="6" fill="#151a21" stroke="#2b323c" stroke-width="2"/>')
    parts.append('<rect x="540" y="248" width="848" height="556" rx="6" fill="url(#perf)" opacity=".18"/>')
    # Copper busbars.
    for by, bh in ((270, 26), (308, 20)):
        parts.append(f'<rect x="560" y="{by}" width="808" height="{bh}" rx="3" fill="url(#copper)" stroke="#5a3517" stroke-width="1.5"/>')
        parts.append(f'<rect x="560" y="{by + 3}" width="808" height="4" fill="#ffe0b0" opacity=".45"/>')
        for bx in range(600, 1360, 80):
            parts.append(f'<circle cx="{bx}" cy="{by + bh // 2}" r="6" fill="#0a0c10" stroke="#d9a86a" stroke-width="2"/>')
    # Digital power meter.
    parts.append('<rect x="560" y="352" width="212" height="132" rx="6" fill="#0c1016" stroke="#414a56" stroke-width="2"/>')
    parts.append('<rect x="572" y="364" width="188" height="74" rx="4" fill="url(#screenBg)" stroke="#1c4d5a" stroke-width="1"/>')
    parts.append(svg_text(584, 388, "400.0 V", size=17, fill="#37c6d8", spacing=.6))
    parts.append(svg_text(584, 412, "126.4 A", size=17, fill=GOLD_LIGHT, spacing=.6))
    parts.append(svg_text(584, 430, "50.00 Hz", size=11, fill="#8fa2b0", spacing=.6))
    parts.append(svg_text(666, 474, "PM-400  ·  ANALYSER", size=9, fill="#87919f", anchor="middle", spacing=.6))
    # Indicator lamps.
    for i, (lab, color) in enumerate((("GÜÇ", "#49e08a"), ("ARIZA", "#e0403f"), ("UYARI", "#f0b429"))):
        lx = 806 + i * 76
        parts.append(f'<circle cx="{lx}" cy="392" r="18" fill="url(#steel)" stroke="#05070a" stroke-width="2"/>')
        parts.append(led(lx, 392, color, 9))
        parts.append(svg_text(lx, 430, lab, size=9, fill="#9aa4b2", anchor="middle", spacing=.6))
    # Main breaker + branch MCBs.
    parts.append('<rect x="1050" y="352" width="316" height="132" rx="6" fill="#0d1117" stroke="#414a56" stroke-width="2"/>')
    parts.append(svg_text(1066, 374, "ANA ŞALTER  ·  250A", size=11, fill="#c3ccd7", spacing=.8))
    parts.append('<rect x="1066" y="388" width="284" height="80" rx="5" fill="#1b2028" stroke="#525b67" stroke-width="1.5"/>')
    parts.append('<rect x="1192" y="400" width="34" height="56" rx="5" fill="url(#steel)" stroke="#05070a" stroke-width="2"/>')
    parts.append('<rect x="1199" y="406" width="20" height="30" rx="3" fill="#e0403f"/>')
    parts.append(svg_text(1082, 438, "3P", size=13, fill="#9aa4b2"))
    parts.append(led(1320, 414, "#49e08a", 5))
    # Branch MCB row.
    parts.append('<rect x="560" y="506" width="806" height="170" rx="6" fill="#0d1117" stroke="#414a56" stroke-width="2"/>')
    parts.append(svg_text(576, 528, "DAĞITIM  ·  MCB 1-12", size=11, fill="#c3ccd7", spacing=.8))
    for i in range(12):
        bx = 570 + i * 65
        parts.append(f'<rect x="{bx}" y="542" width="56" height="116" rx="4" fill="url(#steelV)" stroke="#05070a" stroke-width="1.6"/>')
        parts.append(f'<rect x="{bx + 6}" y="550" width="44" height="26" rx="3" fill="#11161c" stroke="#4a525e" stroke-width="1"/>')
        parts.append(svg_text(bx + 28, 568, f"{i + 1:02d}", size=10, fill="#cfd7e1", anchor="middle"))
        parts.append(f'<rect x="{bx + 16}" y="584" width="24" height="34" rx="4" fill="#d9dee5" stroke="#0a0c10" stroke-width="2"/>')
        parts.append(f'<rect x="{bx + 21}" y="590" width="14" height="20" rx="2" fill="#2b313b"/>')
        parts.append(led(bx + 28, 634, "#49e08a" if i % 5 else "#f0b429", 3.4, halo=False))
        parts.append(f'<rect x="{bx + 8}" y="644" width="40" height="4" fill="url(#goldV)" opacity=".6"/>')
    # Terminal blocks and cable glands.
    for i in range(26):
        tx = 566 + i * 30
        parts.append(f'<rect x="{tx}" y="690" width="24" height="28" rx="2" fill="#1b2028" stroke="#4c545f" stroke-width="1"/>')
        parts.append(f'<rect x="{tx + 5}" y="696" width="14" height="16" fill="url(#copper)" opacity=".7"/>')
    for i in range(9):
        gx = 600 + i * 88
        parts.append(f'<circle cx="{gx}" cy="786" r="15" fill="url(#steel)" stroke="#05070a" stroke-width="2"/>')
        parts.append(f'<circle cx="{gx}" cy="786" r="8" fill="#05070a" stroke="#8d96a2" stroke-width="1.5"/>')
    # Warning placard.
    parts.append('<path d="M1300 690 L1336 754 L1264 754 Z" fill="#f0b429" stroke="#0a0c10" stroke-width="2"/>')
    parts.append(svg_text(1300, 738, "!", size=28, fill="#111318", anchor="middle", weight=900))
    parts.append(svg_text(1300, 786, "DİKKAT", size=10, fill="#d4af37", anchor="middle", spacing=1))
    parts.append(screw(516, 248, 6))
    parts.append(screw(1388, 248, 6))
    parts.append("</g>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Page composition
# ---------------------------------------------------------------------------

BASE_CSS: Final[str] = """
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; }
body {
  background: #0d0e11;
  font-family: 'Inter', 'Segoe UI', Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.frame { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
.bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 72% 58% at 50% 44%, #1a1d24 0%, #101218 52%, #08090b 100%),
    radial-gradient(ellipse 60% 40% at 50% 118%, rgba(212,175,55,.14), transparent 70%);
}
.grid {
  position: absolute; inset: 0; opacity: .5;
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 80px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 80px);
}
.stage { position: absolute; inset: 0; width: 1920px; height: 1080px; }
.strip { position: absolute; top: 168px; bottom: 196px; width: 4px; border-radius: 2px; }
.strip-l {
  left: 24px; background: linear-gradient(180deg, transparent, #d4af37 18%, #f3d478 50%, #d4af37 82%, transparent);
  box-shadow: 0 0 18px 5px rgba(212,175,55,.45), 0 0 60px 12px rgba(212,175,55,.16);
}
.strip-r {
  right: 24px; background: linear-gradient(180deg, transparent, #d4af37 18%, #f3d478 50%, #d4af37 82%, transparent);
  box-shadow: 0 0 18px 5px rgba(212,175,55,.45), 0 0 60px 12px rgba(212,175,55,.16);
}
.brand { position: absolute; top: 66px; z-index: 5; }
.brand-left { left: 76px; }
.lavox {
  color: #19A7B8; font-weight: 900; font-style: italic; font-size: 62px;
  line-height: .92; letter-spacing: 4px; text-shadow: 0 0 26px rgba(25,167,184,.28);
}
.lavox-sub { color: #19A7B8; font-size: 19px; letter-spacing: 10px; margin-top: 8px; }
.brand-right { right: 76px; text-align: right; }
.rmark { font-weight: 900; font-style: italic; font-size: 58px; line-height: 1; letter-spacing: 2px; }
.rmark.n2 { font-size: 52px; }
.rdivider {
  width: 100%; height: 2px; margin-top: 12px;
  background: linear-gradient(90deg, transparent, #d4af37 30%, #f3d478 60%, transparent);
}
.caption {
  position: absolute; left: 50%; bottom: 42px; transform: translateX(-50%);
  z-index: 5; text-align: center; width: 1180px;
  padding: 16px 0 12px;
  border-top: 1px solid rgba(212,175,55,.5);
  background: linear-gradient(180deg, rgba(8,9,11,.05), rgba(8,9,11,.55));
}
.cap-title {
  font-family: 'Cinzel', 'Trajan Pro', Georgia, 'Times New Roman', serif;
  font-size: 34px; letter-spacing: 9px; font-weight: 600; color: #d4af37;
  text-shadow: 0 0 22px rgba(212,175,55,.24);
}
.cap-sub { margin-top: 9px; font-size: 12px; letter-spacing: 5px; color: #8b93a0; }
"""

CaptionSpec = tuple[str, str, str, str]


@dataclass(frozen=True, slots=True)
class RenderSpec:
    """A single catalog render job: target file, branding and vector artwork."""

    filename: str
    hardware: Callable[[], str]
    right_brand: str
    right_color: str
    right_class: str
    caption: str


SPECS: Final[tuple[RenderSpec, ...]] = (
    RenderSpec("bilisim.jpg", rack_hardware, "NAZTECH", GOLD, "", "KURUMSAL AĞ ALTYAPISI"),
    RenderSpec("yakit.jpg", fuel_hardware, "NAZTECH", GOLD, "", "YAKIT VE TANK OTOMASYONU"),
    RenderSpec("arac_takip.jpg", fleet_hardware, "N2MOBİL", PINK, "n2", "ARAÇ TAKİP VE FİLO YÖNETİMİ"),
    RenderSpec("yazilim.jpg", software_hardware, "NAZTECH", GOLD, "", "KURUMSAL YAZILIM VE ERP"),
    RenderSpec("yangin.jpg", fire_hardware, "NAZTECH", GOLD, "", "ADRESİF YANGIN ALARM SİSTEMLERİ"),
    RenderSpec("elektrik.jpg", electrical_hardware, "NAZTECH", GOLD, "", "ENDÜSTRİYEL ELEKTRİK PANOLARI"),
)


def build_html(spec: RenderSpec) -> str:
    """Assemble a fully self-contained HTML document for one render job."""
    header = (
        '<div class="brand brand-left">'
        '<div class="lavox">LAVOX</div>'
        '<div class="lavox-sub">electronics</div>'
        "</div>"
        '<div class="brand brand-right">'
        f'<div class="rmark {spec.right_class}" style="color:{spec.right_color}">{esc(spec.right_brand)}</div>'
        '<div class="rdivider"></div>'
        "</div>"
    )
    footer = (
        '<div class="caption">'
        f'<div class="cap-title">{esc(spec.caption)}</div>'
        '<div class="cap-sub">NAZTECH BILISIM · ENERGY · TEKNOLOGY · SOFTWARE</div>'
        "</div>"
    )
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<title>Catalog Render</title><style>" + BASE_CSS + "</style></head><body>"
        '<div class="frame">'
        '<div class="bg"></div><div class="grid"></div>'
        '<svg class="stage" viewBox="0 0 1920 1080" width="1920" height="1080">'
        + SVG_DEFS
        + CIRCUITS
        + PLATFORM
        + spec.hardware()
        + "</svg>"
        '<div class="strip strip-l"></div><div class="strip strip-r"></div>'
        + header
        + footer
        + "</div></body></html>"
    )


# ---------------------------------------------------------------------------
# Verification helpers
# ---------------------------------------------------------------------------


def jpeg_dimensions(path: Path) -> tuple[int, int]:
    """Decode JPEG SOF dimensions directly from the marker stream (no Pillow)."""
    data = path.read_bytes()
    if len(data) < 4 or data[0] != 0xFF or data[1] != 0xD8:
        raise ValueError(f"Not a JPEG file: {path.name}")
    offset = 2
    while offset + 9 < len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            offset += 2
            continue
        segment_length = int.from_bytes(data[offset + 2 : offset + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height = int.from_bytes(data[offset + 5 : offset + 7], "big")
            width = int.from_bytes(data[offset + 7 : offset + 9], "big")
            return width, height
        offset += 2 + segment_length
    raise ValueError(f"No SOF marker found in {path.name}")


def resolve_chrome() -> Path:
    """Return the first available pinned Chromium executable."""
    for candidate in CHROME_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("Pinned Chromium executable not found in configured locations")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """Render all catalog assets, verify them and append a verification log."""
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    chrome = resolve_chrome()
    lines: list[str] = [
        "=" * 78,
        f"UTC: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "Baysöz Yazılım — catalog image generation (baysozlabs@proton.me)",
        f"Chromium: {chrome}",
        f"Viewport: {VIEWPORT['width']}x{VIEWPORT['height']}  DSF: {DEVICE_SCALE_FACTOR}  "
        f"JPEG quality: {JPEG_QUALITY}  Expected output: {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]}",
    ]

    with sync_playwright() as playwright:
        browser: Browser = playwright.chromium.launch(
            executable_path=str(chrome),
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
        )
        try:
            context: BrowserContext = browser.new_context(
                viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE_FACTOR
            )
            page = context.new_page()
            for spec in SPECS:
                target = IMG_DIR / spec.filename
                page.set_content(build_html(spec), wait_until="load")
                page.screenshot(path=str(target), type="jpeg", quality=JPEG_QUALITY, full_page=False)
                width, height = jpeg_dimensions(target)
                size_bytes = target.stat().st_size
                ok = (width, height) == EXPECTED_SIZE and target.read_bytes()[:2] == b"\xff\xd8"
                status = "PASS" if ok else "FAIL"
                lines.append(
                    f"{status}  {spec.filename:<18} bytes={size_bytes:<9} "
                    f"dimensions={width}x{height}  caption={spec.caption}"
                )
                if not ok:
                    raise RuntimeError(f"Verification failed for {spec.filename}: {width}x{height}")
            context.close()
        finally:
            browser.close()

    lines.append(f"RESULT: {len(SPECS)}/{len(SPECS)} PASS")
    lines.append("=" * 78)
    report = "\n".join(lines) + "\n"
    LOG_PATH.write_text(report, encoding="utf-8")
    sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
