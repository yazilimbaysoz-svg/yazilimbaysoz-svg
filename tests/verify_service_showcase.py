#!/usr/bin/env python3
"""Baysöz Yazılım — NAZTECH 8-card image showcase browser verification.

Drives headless Chromium through the live site, validates the real DOM of all
eight catalog cards and the #hizmetModal dialog, and records verifiable logs
and screenshots. Supports the mandatory 100-run stress loop.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright, Page

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts" / "showcase"
BASE_URL = os.environ.get("NAZTECH_BASE_URL", "http://localhost:8080")
WHATSAPP_NUMBER = "905530341894"
CHROMIUM_PATH = os.environ.get("NAZTECH_CHROMIUM_PATH")
MATRIX_SHA256 = "5ecc4e6d35cd6d420f0b1e61002a7c20fea80b58577f11e5789e89fdfacbc10a"

EXPECTED_IMAGES: dict[str, str] = {
    "1": "img/hikvision_bullet.jpg",
    "2": "img/alarm.png",
    "3": "img/bilisim.jpg",
    "4": "img/yakit.jpg",
    "5": "img/arac_takip.jpg",
    "6": "img/yazilim.jpg",
    "7": "img/yangin.jpg",
    "8": "img/elektrik.jpg",
}


class CheckFailure(AssertionError):
    """Raised when one observable acceptance criterion is not met."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailure(message)


def collect_console_errors(page: Page) -> list[str]:
    errors: list[str] = []
    page.on("console", lambda msg: errors.append("console: " + msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: errors.append("pageerror: " + str(err)))
    return errors


def image_geometry(page: Page, css_selector: str) -> dict[str, float]:
    return page.eval_on_selector(
        css_selector,
        """el => {
            const image = el.tagName === 'IMG' ? el : el.querySelector('img');
            const measured = el.tagName === 'IMG' ? el : el;
            const box = measured.getBoundingClientRect();
            return {
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                complete: image.complete ? 1 : 0,
                width: box.width,
                height: box.height,
                ratio: box.width / box.height
        };
    }""",
    )


def code_rain_contract(page: Page) -> dict[str, Any]:
    """Return the measurable DOM and style contract of the golden rain canvas."""
    return page.evaluate(
        """() => {
            const hero = document.getElementById('anasayfa');
            const canvas = hero && hero.querySelector(':scope > canvas');
            if (!canvas) return null;
            const style = getComputedStyle(canvas);
            return {
                parentId: canvas.parentElement ? canvas.parentElement.id : null,
                isFirstElementChild: !!hero && hero.firstElementChild === canvas,
                id: canvas.id,
                inlineStyle: canvas.style.cssText,
                width: canvas.width,
                height: canvas.height,
                heroWidth: hero ? hero.offsetWidth : 0,
                heroHeight: hero ? hero.offsetHeight : 0,
                cssPosition: style.position,
                cssInset: style.inset,
                cssOpacity: style.opacity,
                cssZIndex: style.zIndex,
                cssPointerEvents: style.pointerEvents
            };
        }"""
    )


def arm_code_rain_probe(page: Page) -> dict[str, int]:
    """Sample the animated canvas bitmap into an in-page comparison buffer."""
    return page.evaluate(
        """() => {
            const canvas = document.querySelector('#anasayfa > canvas');
            if (!canvas) throw new Error('matrix canvas missing');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('matrix canvas 2D context missing');
            const w = Math.min(480, canvas.width);
            const h = Math.min(320, canvas.height);
            const first = new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
            let firstLit = 0;
            for (let i = 0; i < first.length; i += 4) {
                if (first[i] + first[i + 1] + first[i + 2] > 90) firstLit++;
            }
            window.__nzMatrixRainProbe = { w: w, h: h, first: first, firstLit: firstLit };
            return { w: w, h: h, firstLit: firstLit };
        }"""
    )


def read_code_rain_probe(page: Page) -> dict[str, Any]:
    """Compare a second bitmap sample against the buffered first sample."""
    return page.evaluate(
        """() => {
            const probe = window.__nzMatrixRainProbe;
            const canvas = document.querySelector('#anasayfa > canvas');
            if (!probe || !canvas) throw new Error('matrix rain probe missing');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('matrix canvas 2D context missing');
            const now = ctx.getImageData(0, 0, probe.w, probe.h).data;
            let changed = 0;
            let maxDelta = 0;
            let lit = 0;
            for (let i = 0; i < now.length; i += 4) {
                const delta = Math.abs(now[i] - probe.first[i]) +
                    Math.abs(now[i + 1] - probe.first[i + 1]) +
                    Math.abs(now[i + 2] - probe.first[i + 2]) +
                    Math.abs(now[i + 3] - probe.first[i + 3]);
                if (delta > 24) changed++;
                if (delta > maxDelta) maxDelta = delta;
                if (now[i] + now[i + 1] + now[i + 2] > 90) lit++;
            }
            const total = probe.w * probe.h;
            return {
                sampleWidth: probe.w,
                sampleHeight: probe.h,
                firstLit: probe.firstLit,
                lit: lit,
                changed: changed,
                total: total,
                changedRatio: changed / total,
                maxDelta: maxDelta
            };
        }"""
    )


def run_iteration(page: Page, index: int, shots: bool) -> dict[str, Any]:
    started = time.time()
    errors = collect_console_errors(page)
    report: dict[str, Any] = {
        "run": index,
        "pass": False,
        "errors": errors,
        "matrixSha256": "",
        "code_rain": {},
        "protected_ui": {},
        "cards": [],
        "modals": [],
    }
    try:
        page.goto(BASE_URL, wait_until="load", timeout=30000)
        page.wait_for_selector('[data-catalog="1"] .service-card__media img', state="attached")
        page.wait_for_function(
            "() => Array.from(document.querySelectorAll('[data-catalog] .service-card__media img'))"
            ".every(img => img.complete && img.naturalWidth >= 1280)",
            timeout=15000,
        )

        card_count = page.locator("[data-catalog]").count()
        require(card_count == 8, f"expected 8 catalog cards, found {card_count}")

        hero_min_height = page.evaluate(
            "() => parseFloat(getComputedStyle(document.getElementById('anasayfa')).minHeight)"
        )
        require(hero_min_height >= 600, f"local Tailwind runtime did not apply utilities (hero min-height={hero_min_height})")

        matrix_digest = hashlib.sha256((ROOT / "matrix.js").read_bytes()).hexdigest()
        require(matrix_digest == MATRIX_SHA256, f"matrix.js byte drift: {matrix_digest}")
        report["matrixSha256"] = matrix_digest

        require(page.locator("canvas").count() == 1, "expected exactly one canvas: the golden matrix rain canvas")
        matrix_canvas = page.locator("#anasayfa > canvas")
        require(matrix_canvas.count() == 1, "matrix rain canvas must be a direct child of #anasayfa")
        require(page.locator("#particleCanvas").count() == 0, "#particleCanvas must not be reintroduced")
        require(page.locator('script[src="matrix.js"]').count() == 1, "matrix.js must be loaded exactly once")
        require(
            page.locator("#naztech-code-rain, #naztech-particle-zfix").count() == 0,
            "deprecated inline code-rain or occlusion style remains",
        )

        page.wait_for_function(
            "() => { const c = document.querySelector('#anasayfa > canvas'); "
            "return Boolean(c && c.width > 0 && c.height > 0); }",
            timeout=10000,
        )
        page.wait_for_timeout(160)

        contract = code_rain_contract(page)
        require(contract is not None, "matrix rain canvas contract is missing")
        require(contract["parentId"] == "anasayfa", "matrix canvas is outside #anasayfa")
        require(contract["isFirstElementChild"], "matrix canvas must be inserted before hero content")
        require(contract["id"] == "", "matrix canvas must not acquire #particleCanvas")
        require(contract["width"] > 0 and contract["height"] > 0, "matrix canvas has no backing store")
        require(contract["width"] == contract["heroWidth"], "matrix canvas backing width mismatch")
        require(contract["height"] == contract["heroHeight"], "matrix canvas backing height mismatch")

        normalized_inline = contract["inlineStyle"].replace(" ", "").lower()
        require(
            normalized_inline == "position:absolute;inset:0px;width:100%;height:100%;pointer-events:none;opacity:0.28;z-index:1;",
            f"matrix canvas inline style drifted: {contract['inlineStyle']}",
        )
        require(contract["cssPosition"] == "absolute", "matrix canvas computed position mismatch")
        require(contract["cssInset"] in {"0px", "0px 0px 0px 0px"}, "matrix canvas computed inset mismatch")
        require(contract["cssOpacity"] == "0.28", "matrix canvas computed opacity mismatch")
        require(contract["cssZIndex"] == "1", "matrix canvas computed z-index mismatch")
        require(contract["cssPointerEvents"] == "none", "matrix canvas must not intercept pointer events")

        probe = arm_code_rain_probe(page)
        require(probe["firstLit"] > 0, "matrix rain rendered no visible pixels in the first sample")
        page.wait_for_timeout(420)
        diff = read_code_rain_probe(page)
        require(diff["lit"] > 0, "matrix rain rendered no visible pixels in the second sample")
        require(diff["changed"] >= 50, f"matrix rain pixels did not change: {diff}")
        require(diff["changedRatio"] >= 0.001, f"matrix rain change ratio too small: {diff}")
        report["code_rain"] = {"contract": contract, "probe": probe, "diff": diff}

        marquee = page.locator(".partner-marquee")
        require(marquee.count() == 1, "partner marquee missing")
        require(page.locator(".partner-marquee__group").count() == 2, "partner marquee groups changed")
        require(page.locator(".partner-marquee__partner").count() == 6, "partner marquee partners changed")
        require(
            page.locator(".partner-marquee__logo, .partner-marquee__mark").count() == 6,
            "partner marquee logos changed",
        )
        report["protected_ui"] = {
            "marqueeGroups": 2,
            "marqueePartners": 6,
        }

        legacy_scripts = page.evaluate(
            "() => Array.from(document.scripts).map(s => s.src || s.textContent)"
            ".filter(s => /webgl|3d-viewer|3d-model/i.test(s))"
        )
        require(len(legacy_scripts) == 0, f"legacy 3D scripts are still loaded: {legacy_scripts}")

        legacy_nodes = page.locator("[data-3d-viewer], .webgl-container, .modal-3d-wrap").count()
        require(legacy_nodes == 0, f"legacy WebGL containers remain: {legacy_nodes}")

        modal = page.locator("#hizmetModal")
        require(modal.count() == 1, "expected exactly one #hizmetModal dialog")
        require(modal.get_attribute("aria-hidden") == "true", "modal must start hidden")

        if shots:
            ARTIFACTS.mkdir(parents=True, exist_ok=True)
            page.wait_for_selector("#nztPreloader", state="detached", timeout=8000)
            total_height = page.evaluate("() => document.body.scrollHeight")
            for offset in range(0, total_height, 600):
                page.evaluate("y => window.scrollTo(0, y)", offset)
                page.wait_for_timeout(60)
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(200)
            page.screenshot(path=str(ARTIFACTS / "00-full-page.png"), full_page=True)
        else:
            page.evaluate("() => { const p = document.getElementById('nztPreloader'); if (p) p.remove(); }")

        portal_button = page.locator("#nzpNavButton")
        require(portal_button.count() == 1, "portal navigation button missing")
        require(portal_button.is_visible(), "portal navigation button is not visible")
        portal_button.click()
        overlay = page.locator("#nzpAuthOverlay")
        overlay.wait_for(state="visible", timeout=5000)
        overlay_z = page.eval_on_selector(
            "#nzpAuthOverlay",
            "el => Number.parseInt(getComputedStyle(el).zIndex, 10)",
        )
        require(overlay_z >= 10000, f"portal overlay z-index regressed: {overlay_z}")
        overlay.locator(".nzp-close").first.click()
        overlay.wait_for(state="hidden", timeout=5000)
        report["protected_ui"]["portalZIndex"] = overlay_z

        for catalog_id in sorted(EXPECTED_IMAGES):
            expected_src = EXPECTED_IMAGES[catalog_id]
            card_selector = f'[data-catalog="{catalog_id}"]'
            card = page.locator(card_selector)
            image = card.locator(".service-card__media img")
            require(image.count() == 1, f"card {catalog_id} must contain exactly one media image")
            require(
                image.get_attribute("src").endswith(expected_src),
                f"card {catalog_id} uses {image.get_attribute('src')}, expected {expected_src}",
            )
            require(card.get_attribute("aria-controls") == "hizmetModal", f"card {catalog_id} aria-controls mismatch")

            geometry = image_geometry(page, f"{card_selector} .service-card__media")
            require(geometry["naturalWidth"] == 1920 and geometry["naturalHeight"] == 1080,
                    f"card {catalog_id} image is {geometry['naturalWidth']}x{geometry['naturalHeight']}, expected 1920x1080")
            require(abs(geometry["ratio"] - 16 / 9) < 0.02,
                    f"card {catalog_id} media ratio {geometry['ratio']:.4f} is not 16:9")
            report["cards"].append({"id": catalog_id, "src": expected_src, **geometry})

            if shots:
                card.scroll_into_view_if_needed()
                page.wait_for_timeout(120)
                card.screenshot(path=str(ARTIFACTS / f"card-{catalog_id}.png"))

            card.click()
            modal.wait_for(state="visible", timeout=5000)
            modal_z = page.eval_on_selector(
                "#hizmetModal",
                "el => Number.parseInt(getComputedStyle(el).zIndex, 10)",
            )
            require(modal_z >= 9999, f"#hizmetModal z-index regressed: {modal_z}")
            report["protected_ui"]["modalZIndex"] = modal_z
            require(modal.inner_text().strip() != "", f"modal for card {catalog_id} is empty")
            title = page.locator("#modalTitle").inner_text().strip()
            require(len(title) > 3, f"modal for card {catalog_id} has no title")
            figure_count = page.locator("#modalGallery .modal__figure").count()
            require(figure_count >= 1, f"modal for card {catalog_id} has no showcase figure")

            page.wait_for_function(
                "() => { const i = document.querySelector('#modalGallery img'); return i && i.complete && i.naturalWidth >= 1280; }",
                timeout=10000,
            )
            modal_geometry = image_geometry(page, "#modalGallery .modal__figure img")
            require(abs(modal_geometry["ratio"] - 16 / 9) < 0.02,
                    f"modal figure ratio {modal_geometry['ratio']:.4f} is not 16:9")

            whatsapp = page.locator("#modalWhatsApp")
            require(whatsapp.is_visible(), f"WhatsApp button missing for card {catalog_id}")
            href = whatsapp.get_attribute("href") or ""
            require(href.startswith(f"https://wa.me/{WHATSAPP_NUMBER}?text="),
                    f"WhatsApp href {href!r} has the wrong number")
            require("%20" in href, f"WhatsApp href {href!r} has no catalog-specific message")
            require(whatsapp.get_attribute("data-whatsapp-number") == WHATSAPP_NUMBER,
                    "WhatsApp number attribute mismatch")

            report["modals"].append({
                "id": catalog_id,
                "title": title,
                "figures": figure_count,
                "showcase_ratio": round(modal_geometry["ratio"], 4),
                "whatsapp": href[:110],
            })

            if shots:
                page.wait_for_timeout(120)
                page.locator("#modalBox").screenshot(path=str(ARTIFACTS / f"modal-{catalog_id}.png"))
                page.eval_on_selector("#modalBox", "el => { el.scrollTop = el.scrollHeight; }")
                page.wait_for_timeout(150)
                whatsapp.scroll_into_view_if_needed()
                page.locator("#modalBox").screenshot(path=str(ARTIFACTS / f"modal-{catalog_id}-offer.png"))

            page.locator("#closeModal").click()
            modal.wait_for(state="hidden", timeout=5000)
            require(modal.get_attribute("aria-hidden") == "true", f"modal for card {catalog_id} did not reset aria-hidden")

        require(not errors, f"browser reported errors: {errors}")
        report["pass"] = True
    except Exception as exc:  # noqa: BLE001 - a failing iteration must be recorded, not abort the loop
        report["failure"] = f"{type(exc).__name__}: {exc}"
    report["elapsed_ms"] = round((time.time() - started) * 1000, 1)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=1, help="number of consecutive verification runs")
    parser.add_argument("--shots", action="store_true", help="capture full-page, 8 card and 8 modal screenshots")
    args = parser.parse_args()

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    results_path = ARTIFACTS / "showcase-stress-results.jsonl"
    summary_path = ARTIFACTS / "showcase-verification.json"

    passed = 0
    with sync_playwright() as playwright:
        launch_options: dict[str, Any] = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
        if CHROMIUM_PATH:
            launch_options["executable_path"] = CHROMIUM_PATH
        browser = playwright.chromium.launch(**launch_options)
        try:
            with results_path.open("w", encoding="utf-8") as stream:
                for run in range(1, args.runs + 1):
                    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
                    try:
                        result = run_iteration(page, run, args.shots and run == 1)
                    finally:
                        page.close()
                    stream.write(json.dumps(result, ensure_ascii=False) + "\n")
                    stream.flush()
                    if result["pass"]:
                        passed += 1
                    else:
                        print(f"RUN {run} FAILED: {result.get('failure')}", file=sys.stderr)
        finally:
            browser.close()

    summary = {
        "base_url": BASE_URL,
        "requested_runs": args.runs,
        "passed_runs": passed,
        "failed_runs": args.runs - passed,
        "screenshots": sorted(p.name for p in ARTIFACTS.glob("*.png")) if args.shots else [],
        "verdict": "100/100 PASS" if args.runs == 100 and passed == 100 else f"{passed}/{args.runs} PASS",
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("STRESS_VERDICT_SHOWCASE: " + summary["verdict"])
    return 0 if passed == args.runs else 1


if __name__ == "__main__":
    raise SystemExit(main())
