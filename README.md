# NAZTECH Bilişim — Corporate Website

**Maintained by Baysöz Yazılım** (baysozlabs@proton.me)

This repository contains the NAZTECH Bilişim corporate website: a static, gold-and-obsidian landing site with 8 interactive service catalogs, verified HD imagery, and a deterministic stress verification harness.

## Project Contents

- `index.html` — main site markup, semantic service cards, and modal skeleton
- `style.css` — canonical design tokens, energy ring, modal, and responsive styling
- `matrix.js` — golden matrix code-rain animation (preserved)
- `hizmet-detay.js` — service catalog data model, modal controller, and accessibility wiring
- `tezweb-3d.js` — canvas interaction layer: preloader, hero scene, KPI counters, card tilt, and photo viewer
- `webgl-3d-viewer.js` — Three.js WebGL hardware inspector for the eight catalog models
- `security-shield.js` — shortcut/drag hardening, golden circuit scan modal, and comment scrubbing
- `YONETICI_KILAVUZU.md` — Turkish administrator guide for non-technical content updates
- `download_catalog_images.py` — Wikimedia Commons image acquisition and verification CLI
- `img/` — verified catalog photographs and `CREDITS.json`
- `tests/` — deterministic DOM-shim stress harness
- `scripts/render_kanit.py` — evidence report renderer
- `artifacts/` — machine-readable verification evidence
- `KANIT_RAPORU.md` — verification evidence report

## Verification Guardrails

```bash
export CARGO_BUILD_JOBS=2 MAKEFLAGS="-j2" GOMAXPROCS=2 RAYON_NUM_THREADS=2 UV_CONCURRENT_BUILDS=2
```

## Verification Commands

```bash
python3 download_catalog_images.py
node --check *.js tests/*.mjs
node tests/run_verification.mjs
node tests/run_3d_verification.mjs
node tests/run_shield_verification.mjs
python3 scripts/render_kanit.py
```

## Compliance Notes

- All software identifiers, comments, and documentation are in English; Turkish appears only in user-facing site content.
- No local paths, OS usernames, or personal identifiers are embedded in repository files or artifacts.
- Image attribution is recorded in `img/CREDITS.json`.

Copyright © 2026 Baysöz Yazılım (baysozlabs@proton.me).
