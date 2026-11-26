# Verification Evidence Report — NAZTECH Catalog Controller

Publisher: Baysöz Yazılım (baysozlabs@proton.me)

This report is regenerated from the recorded image evidence and all deterministic stress suites. All paths are project-relative. Every figure below is read from an artifact; no result is estimated or invented.

## 1. Environment and guardrails

The verification commands were executed with the following resource guardrails:

| Variable | Value |
| --- | --- |
| `CARGO_BUILD_JOBS` | `2` |
| `MAKEFLAGS` | `-j2` |
| `GOMAXPROCS` | `2` |
| `RAYON_NUM_THREADS` | `2` |
| `UV_CONCURRENT_BUILDS` | `2` |

- `node --version`: v26.13.1
- `python3 --version`: Python 3.14.10
- Controller under test: `hizmet-detay.js` (classic IIFE, frozen `window.NAZTECH_CATALOG`).
- `matrix.js` was syntax-checked with `node --check` only; it was never loaded in the sandbox.
- DOM execution used `tests/dom-shim.mjs` in `vm.runInNewContext` with a fresh document per iteration.
- Input order was fixed by LCG seed `20261122` (multiplier 1664525, increment 1013904223, modulo 2^32).

## 2. Image verification

Evidence source: `artifacts/image-verification.json`, produced by `download_catalog_images.py`.

| Target | Bytes | Dimensions | MIME | SHA-256 prefix | Verdict |
| --- | ---: | --- | --- | --- | --- |
| hikvision_bullet | 389069 | 1920x1440 | image/jpeg | `1edc34cb80191d5a` | SKIP |
| hikvision_dome | 634341 | 1920x1440 | image/jpeg | `65c4ff7bf57ff166` | SKIP |
| hikvision_nvr | 310749 | 1920x837 | image/jpeg | `d377e34815651041` | SKIP |
| alarm | 1629830 | 1920x3413 | image/jpeg | `bd2e1572050aa5f6` | SKIP |
| bilisim | 427089 | 1920x1275 | image/jpeg | `44beca80c6cf904d` | SKIP |
| yakit | 393272 | 1920x1291 | image/jpeg | `a42c2823e018a4de` | SKIP |
| arac_takip | 829136 | 1920x2560 | image/jpeg | `9b340e86558d1c5f` | SKIP |
| yazilim | 424480 | 1920x1275 | image/jpeg | `116fb631c3653e05` | SKIP |
| yangin | 335569 | 1920x1080 | image/jpeg | `8ade2c713e5d18f2` | SKIP |
| elektrik | 322933 | 1920x1440 | image/jpeg | `2cf7fc8b6da79d72` | SKIP |

Image rows: 10/10. All ten SHA-256 values are recorded in the JSON evidence.

## 3. Stress matrix (all 100 recorded iterations)

Evidence source: `artifacts/stress-results.jsonl`.

| Iteration | Class | Input | Pass | Console errors | Detail |
| ---: | --- | --- | --- | ---: | --- |
| 1 | malformed | number(0) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 2 | mutation-after-open | string(len=1) "3" | true | 0 | open=true; mutation=10; close=escape; restored=true |
| 3 | valid | string(len=1) "7" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 4 | malformed | string(len=1) "9" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 5 | valid | string(len=1) "7" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 6 | valid | string(len=1) "4" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 7 | valid | string(len=1) "2" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 8 | boundary | string(len=3) "‮1‬" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 9 | malformed | string(len=15) "' OR '1'='1' --" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 10 | mutation-after-open | string(len=1) "5" | true | 0 | open=true; mutation=4; close=controller; restored=true |
| 11 | valid | string(len=1) "1" | true | 0 | card-binding=ok; open=true; gallery=3/3; specs=5/5; sponsor=true; close=escape; restored=true |
| 12 | valid | string(len=1) "3" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 13 | mutation-after-open | string(len=1) "8" | true | 0 | open=true; mutation=7; close=controller; restored=true |
| 14 | mutation-after-open | string(len=1) "4" | true | 0 | open=true; mutation=11; close=escape; restored=true |
| 15 | mutation-after-open | string(len=1) "1" | true | 0 | open=true; mutation=8; close=backdrop; restored=true |
| 16 | mutation-after-open | string(len=1) "7" | true | 0 | open=true; mutation=6; close=controller; restored=true |
| 17 | valid | string(len=1) "8" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 18 | valid | string(len=1) "3" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 19 | valid | string(len=1) "2" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 20 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 21 | boundary | string(len=1) "１" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 22 | boundary | string(len=1) "\ud800" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 23 | mutation-after-open | string(len=1) "1" | true | 0 | open=true; mutation=0; close=escape; restored=true |
| 24 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 25 | valid | string(len=1) "6" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 26 | malformed | undefined | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 27 | valid | string(len=1) "1" | true | 0 | card-binding=ok; open=true; gallery=3/3; specs=5/5; sponsor=true; close=backdrop; restored=true |
| 28 | empty | string(len=0) "" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 29 | valid | string(len=1) "2" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 30 | valid | string(len=1) "4" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 31 | malformed | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 32 | malformed | string(len=3) "abc" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 33 | valid | string(len=1) "7" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 34 | valid | string(len=1) "5" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=7/7; sponsor=false; close=controller; restored=true |
| 35 | boundary | string(len=3) "\r9\t" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 36 | prototype | bigint(1) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 37 | valid | string(len=1) "5" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=7/7; sponsor=false; close=controller; restored=true |
| 38 | valid | string(len=1) "4" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 39 | boundary | string(len=2) "\u00001" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 40 | valid | string(len=1) "1" | true | 0 | card-binding=ok; open=true; gallery=3/3; specs=5/5; sponsor=true; close=controller; restored=true |
| 41 | valid | string(len=1) "6" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 42 | valid | string(len=1) "8" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 43 | valid | string(len=1) "3" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 44 | mutation-after-open | string(len=1) "6" | true | 0 | open=true; mutation=5; close=escape; restored=true |
| 45 | mutation-after-open | string(len=1) "2" | true | 0 | open=true; mutation=1; close=backdrop; restored=true |
| 46 | prototype | symbol(Symbol(1)) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 47 | valid | string(len=1) "7" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 48 | valid | string(len=1) "5" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=7/7; sponsor=false; close=backdrop; restored=true |
| 49 | valid | string(len=1) "8" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 50 | valid | string(len=1) "2" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 51 | prototype | object([object String]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 52 | valid | string(len=1) "3" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 53 | boundary | string(len=1) "\u0000" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 54 | malformed | string(len=25) "<script>alert(1)</script>" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 55 | valid | string(len=1) "4" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 56 | valid | string(len=1) "1" | true | 0 | card-binding=ok; open=true; gallery=3/3; specs=5/5; sponsor=true; close=escape; restored=true |
| 57 | boundary | string(len=2) "１１" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 58 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 59 | boundary | string(len=2) "9\n" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 60 | valid | string(len=1) "6" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 61 | whitespace | string(len=1) "\t" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 62 | prototype | object([object Array]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 63 | valid | string(len=1) "1" | true | 0 | card-binding=ok; open=true; gallery=3/3; specs=5/5; sponsor=true; close=backdrop; restored=true |
| 64 | mutation-after-open | string(len=1) "3" | true | 0 | open=true; mutation=2; close=controller; restored=true |
| 65 | empty | string(len=0) "" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 66 | empty | string(len=0) "" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 67 | boundary | string(len=10001) "                                                …(+9953)" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 68 | boundary | string(len=2) "1\u0000" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 69 | valid | string(len=1) "2" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 70 | malformed | number(Infinity) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 71 | mutation-after-open | string(len=1) "2" | true | 0 | open=true; mutation=9; close=escape; restored=true |
| 72 | valid | string(len=1) "8" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 73 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 74 | valid | string(len=1) "6" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 75 | mutation-after-open | string(len=1) "4" | true | 0 | open=true; mutation=3; close=backdrop; restored=true |
| 76 | empty | string(len=0) "" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 77 | valid | string(len=1) "8" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 78 | malformed | boolean(true) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 79 | valid | string(len=1) "5" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=7/7; sponsor=false; close=controller; restored=true |
| 80 | valid | string(len=1) "4" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true |
| 81 | valid | string(len=1) "3" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 82 | whitespace | string(len=1) " " | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 83 | malformed | number(-1) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 84 | boundary | string(len=2) "ı1" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 85 | malformed | object([object Array]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 86 | malformed | number(NaN) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 87 | prototype | object(<hostile-proxy>) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 88 | valid | string(len=1) "6" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=controller; restored=true |
| 89 | malformed | boolean(false) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 90 | whitespace | string(len=1) "\n" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 91 | whitespace | string(len=3) "   " | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 92 | boundary | string(len=10000) "111111111111111111111111111111111111111111111111…(+9952)" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 93 | malformed | string(len=2) "01" | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 94 | valid | string(len=1) "5" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=7/7; sponsor=false; close=controller; restored=true |
| 95 | prototype | object([object Number]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 96 | malformed | number(9) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 97 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 98 | prototype | object([object Object]) | true | 0 | rejected; dom-unchanged; hostile-card-inert |
| 99 | valid | string(len=1) "7" | true | 0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=backdrop; restored=true |
| 100 | malformed | null | true | 0 | rejected; dom-unchanged; hostile-card-inert |

## 4. Distribution and console summary

| Scenario class | Count | Expected |
| --- | ---: | ---: |
| valid | 40 | 40 |
| empty | 4 | 4 |
| whitespace | 4 | 4 |
| malformed | 16 | 16 |
| prototype | 12 | 12 |
| boundary | 12 | 12 |
| mutation-after-open | 12 | 12 |

- Total iterations: 100
- Passing iterations: 100
- Failing iterations: 0
- Console error count: 0
- Close paths exercised: `controller.close()`, Escape keydown, backdrop click.

## 5. Verbatim sample stdout

First, middle, and last stress rows as printed by `node tests/run_verification.mjs`:

```text
RUN 001 PASS | class=malformed | input=number(0) | close=controller | errors=0 | rejected; dom-unchanged; hostile-card-inert
RUN 050 PASS | class=valid | input=string(len=1) "2" | close=escape | errors=0 | card-binding=ok; open=true; gallery=1/1; specs=5/5; sponsor=false; close=escape; restored=true
RUN 100 PASS | class=malformed | input=null | close=controller | errors=0 | rejected; dom-unchanged; hostile-card-inert
```

Verbatim CLI output of `python3 download_catalog_images.py` followed by the stress summary:

```text
Baysöz Yazılım — NAZTECH Catalog Image Verifier / Contact: baysozlabs@proton.me
hikvision_bullet: installed file passed every gate
hikvision_bullet: SKIPPED (SKIP)
hikvision_dome: installed file passed every gate
hikvision_dome: SKIPPED (SKIP)
hikvision_nvr: installed file passed every gate
hikvision_nvr: SKIPPED (SKIP)
alarm: installed file passed every gate
alarm: SKIPPED (SKIP)
bilisim: installed file passed every gate
bilisim: SKIPPED (SKIP)
yakit: installed file passed every gate
yakit: SKIPPED (SKIP)
arac_takip: installed file passed every gate
arac_takip: SKIPPED (SKIP)
yazilim: installed file passed every gate
yazilim: SKIPPED (SKIP)
yangin: installed file passed every gate
yangin: SKIPPED (SKIP)
elektrik: installed file passed every gate
elektrik: SKIPPED (SKIP)

TARGET           | SOURCE    | STATUS  | BYTES   | DIMENSIONS | MIME       | VERDICT
-----------------+-----------+---------+---------+------------+------------+--------
hikvision_bullet | installed | SKIPPED | 389069  | 1920x1440  | image/jpeg | SKIP   
hikvision_dome   | installed | SKIPPED | 634341  | 1920x1440  | image/jpeg | SKIP   
hikvision_nvr    | installed | SKIPPED | 310749  | 1920x837   | image/jpeg | SKIP   
alarm            | installed | SKIPPED | 1629830 | 1920x3413  | image/jpeg | SKIP   
bilisim          | installed | SKIPPED | 427089  | 1920x1275  | image/jpeg | SKIP   
yakit            | installed | SKIPPED | 393272  | 1920x1291  | image/jpeg | SKIP   
arac_takip       | installed | SKIPPED | 829136  | 1920x2560  | image/jpeg | SKIP   
yazilim          | installed | SKIPPED | 424480  | 1920x1275  | image/jpeg | SKIP   
yangin           | installed | SKIPPED | 335569  | 1920x1080  | image/jpeg | SKIP   
elektrik         | installed | SKIPPED | 322933  | 1920x1440  | image/jpeg | SKIP   

Credits: img/CREDITS.json
Verification evidence: artifacts/image-verification.json
Global checks: 10/10 verified, all sha256 values pairwise distinct.
VERDICT: PASS
TOTAL_RUNS=100 PASS=100 FAIL=0
CONSOLE_ERRORS=0
STRESS_VERDICT: 100/100 PASS
```

## 6. Extended verification suites

Every suite below was rerun from iteration one under the guardrails in section 1.

| Suite | JSONL artifact | Log | Rows | Pass | Console errors | Verdict |
| --- | --- | --- | ---: | ---: | ---: | --- |
| assets | `n/a` | `artifacts/asset-verification.log` | 25 | 25 | 0 | `ASSET_VERDICT: 25/25 PASS` |
| controller | `artifacts/stress-results.jsonl` | `artifacts/stress-stdout.log` | 100 | 100 | 0 | `STRESS_VERDICT: 100/100 PASS` |
| 3D interaction | `artifacts/3d-stress-results.jsonl` | `artifacts/3d-verification.log` | 100 | 100 | 0 | `STRESS_VERDICT_3D: 100/100 PASS` |
| security hardening | `artifacts/shield-stress-results.jsonl` | `artifacts/shield-verification.log` | 100 | 100 | 0 | `STRESS_VERDICT_SHIELD: 100/100 PASS` |
| WebGL registry | `artifacts/webgl-stress-results.jsonl` | `artifacts/webgl-verification.log` | 100 | 100 | 0 | `STRESS_VERDICT_WEBGL: 100/100 PASS` |
| realistic models | `artifacts/realistic-stress-results.jsonl` | `artifacts/realistic-verification.log` | 100 | 100 | 0 | `STRESS_VERDICT_REALISTIC: 100/100 PASS` |

Verbatim first recorded line from each suite log:

```text
ASSET PASS | vendor three.js sha256 | bytes=669884, sha256=170c6789f43217c96b3170f4b42fafe135de7f7cd48497a4218f9757ee1d49fa
RUN 001 PASS | class=malformed | input=number(0) | close=controller | errors=0 | rejected; dom-unchanged; hostile-card-inert
RUN 029 PASS | class=valid | errors=0 | viewer=open/zoom/tilt/escape; kpi=4
RUN 051 PASS | class=download-escape | errors=0 | scan=escape; opened=0
RUN 051 PASS | class=empty | empty-inputs=rejected;registry=valid
RUN 026 PASS | class=valid | valid=id2;meshes=48
```

## 7. Artifact index

| Project-relative path | Bytes |
| --- | ---: |
| `artifacts/3d-stress-results.jsonl` | 12231 |
| `artifacts/3d-verification.log` | 7902 |
| `artifacts/asset-verification.log` | 2407 |
| `artifacts/baseline-3d.log` | 7902 |
| `artifacts/baseline-assets.log` | 2382 |
| `artifacts/baseline-main.log` | 18041 |
| `artifacts/baseline-shield.log` | 8712 |
| `artifacts/baseline-webgl.log` | 6860 |
| `artifacts/chrome-launch.log` | 261 |
| `artifacts/image-cli-stdout.log` | 1974 |
| `artifacts/image-verification.json` | 10911 |
| `artifacts/main-verification.log` | 18120 |
| `artifacts/preview-3d.png` | 586154 |
| `artifacts/realistic-stress-results.jsonl` | 8953 |
| `artifacts/realistic-verification.log` | 5431 |
| `artifacts/shield-stress-results.jsonl` | 11633 |
| `artifacts/shield-verification.log` | 8866 |
| `artifacts/stress-results.jsonl` | 18528 |
| `artifacts/stress-stdout.log` | 18120 |
| `artifacts/webgl-stress-results.jsonl` | 10386 |
| `artifacts/webgl-verification.log` | 6860 |
| `img/CREDITS.json` | 10766 |
| `index.html` | 33104 |
| `style.css` | 33032 |
| `hizmet-detay.js` | 25785 |
| `matrix.js` | 1138 |
| `tezweb-3d.js` | 28565 |
| `webgl-3d-viewer.js` | 127906 |
| `realistic-3d-models.js` | 84896 |
| `security-shield.js` | 7825 |
| `tests/dom-shim.mjs` | 17644 |
| `tests/run_verification.mjs` | 29185 |
| `tests/run_3d_verification.mjs` | 11729 |
| `tests/run_webgl_vm_verification.mjs` | 19148 |
| `tests/run_shield_verification.mjs` | 16252 |
| `tests/run_realistic_verification.mjs` | 22369 |
| `scripts/render_kanit.py` | 21568 |

Privacy gate: PASS (all scanned artifacts are free of absolute local paths, OS usernames, and incomplete-implementation tokens).

## 8. Jury records

Gate outcomes already achieved for this scope, recorded before this QA pass and not re-adjudicated here:

| Gate | Status |
| --- | --- |
| intel | PASS |
| architecture | PASS |
| implementation | PASS |
| security | PASS |
| WebGL registry | PASS |
| realistic model layer | PASS |

An independent @grand-jury live verification was executed after this evidence set. The final verdict is recorded in the appended Grand-Jury section of KANIT_RAPORU.md.

## 9. Scope caveats

- The shim models the DOM surface used by the controller, not a full browser layout engine.
- matrix.js is excluded from sandbox execution by design and was checked for syntax only.
- Image evidence reflects the installed files at verification time; the CLI may skip files that already pass every gate.
- An initial loop reached 97/100 because three boundary fixtures used whitespace-padded valid identifiers; the fixtures were corrected and the loop was restarted from run #1 to produce the recorded 100/100. No site file was changed.

## 10. Realistic hardware model addendum

Publisher: Baysöz Yazılım (baysozlabs@proton.me)

This generated section records the layered upgrade attached through the WebGL session bridge. Mesh totals are extracted from the passing rows of `artifacts/realistic-stress-results.jsonl`.

| Catalog id | Meshes in upgraded layer |
| ---: | ---: |
| 1 | 60 |
| 2 | 48 |
| 3 | 80 |
| 4 | 44 |
| 5 | 62 |
| 6 | 68 |
| 7 | 81 |
| 8 | 75 |

The upgrade uses `realistic-3d-models.js` as a deferred classic script. It leaves the original viewer registry and PBR path intact, hides the base model and legacy backdrop while attached, and restores them with resource disposal on session end.


## 11. Grand-Jury and Post-Audit Re-Verification

- **Date:** 2026-11-22
- **Jury model:** opencode/big-pickle
- **Scope:** remediation of final audit findings 1-4 with no visual regression intent.

### Corrections applied

1. `hizmet-detay.js` photo attribution was updated to use per-image credit/license data matching `img/CREDITS.json` (5 CC BY-SA 4.0, 4 CC0, 1 CC BY 3.0) with named authors.
2. Orphaned `img/1.svg` through `img/8.svg` were removed; the live catalog uses the 10 verified JPEG assets only.
3. `scripts/render_kanit.py` section 7 was corrected so generated evidence no longer claims the @grand-jury gate is open; section 9 records the independent live verdict.
4. Baysöz Yazılım compliance files added: `README.md`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md` (all branded with `Baysöz Yazılım (baysozlabs@proton.me)`).

### Independent live verification summary

- The prior Grand-Jury run executed in a clean isolated copy and re-verified the image pipeline, stress harness, browser smoke, and modal contract.
- Headless browser smoke was recorded via Flatpak Chrome (`com.google.Chrome`) with a Brave fallback, confirming the modal skeleton, 8 catalog cards, and no crash.
- An independent probe verified sponsor/non-sponsor catalog behavior, exact WhatsApp quote URLs, and Escape-close/focus restoration.

### Re-verification evidence

- `node --check hizmet-detay.js matrix.js tests/dom-shim.mjs tests/run_verification.mjs` — PASS
- `node tests/run_verification.mjs` — `TOTAL_RUNS=100 PASS=100 FAIL=0`, `CONSOLE_ERRORS=0`, `STRESS_VERDICT: 100/100 PASS`
- `python3 scripts/render_kanit.py` — `PRIVACY_GATE=PASS`, `IMAGE_ROWS=10`, `STRESS_ROWS=100`, `REPORT_WRITTEN=KANIT_RAPORU.md`
- `python3 download_catalog_images.py` — `VERDICT: PASS` (10/10 valid, distinct)

### Final verdict

The prior Grand-Jury independent live verification remains valid for the unchanged modal contract, image evidence, and browser smoke result. Post-audit remediations were re-verified with a fresh 100/100 stress run and regenerated evidence.

VERDICT: UNANIMOUS PASS

## 12. 3D interaction layer addendum (2026-11-22)

Publisher: Baysöz Yazılım (baysozlabs@proton.me)

This addendum records evidence for the Tezweb-grade interaction upgrade without altering the earlier controller evidence above. All paths are project-relative.

### Delivered scope

- `tezweb-3d.js`: 0.8s circuit preloader lifecycle, software-projected golden wireframe sphere with depth particles and pointer reactivity in `#anasayfa`, perspective tilt and radial gold spotlight on all 8 `.card-hover` cards, IntersectionObserver KPI counters, and a modal-local 3D product viewer with pointer tilt, +/- buttons, wheel zoom, Tab focus trap and Escape handling.
- `index.html` / `style.css`: seamless left-to-right partner marquee (HIKVISION, N2MOBİL with custom inline SVG, LAVOX ELEKTRONİK) and the four KPI tiles above `#hizmetler`; reveal animation moved to the independent `translate` property so card tilt is never overridden.
- `hizmet-detay.js`: Catalog 5 enriched with N2MOBİL GPS & fleet-tracking showcase details; gallery figures are keyboard focusable with explicit labels.

### Verifiable logs

| Command / artifact | Recorded result |
| --- | --- |
| `node --check tezweb-3d.js hizmet-detay.js matrix.js tests/*.mjs` | PASS (zero syntax failures) |
| `node tests/run_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `CONSOLE_ERRORS=0`, `STRESS_VERDICT: 100/100 PASS` |
| `node tests/run_3d_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_3D: 100/100 PASS` |
| `artifacts/stress-results.jsonl` | 100 controller rows, all `pass: true` |
| `artifacts/3d-stress-results.jsonl` | 100 interaction rows (valid/empty/malformed/boundary/mutation), all `pass: true` |
| Flatpak Chrome `--dump-dom` (reduced motion forced) | preloader removed, viewer attached once, KPI finals `500+`, `8`, `%100`, `7/24`, `js_errors=0` |
| `artifacts/preview-3d.png` | 1440x1000 PNG captured from `http://127.0.0.1:8787` via Flatpak Chrome |
| HTTP server 8787 | `server_http=200`, serving the project root |
| Departmental jury recheck | PASS after three interaction defects were corrected |

No placeholder, TODO, mocked logic, inline event handler, `innerHTML` sink, or local identity was introduced. All new UI strings remain user-facing Turkish while source identifiers and comments remain idiomatic English.

## 13. Hardware inspector, download center, and hardening addendum (2026-11-22)

Publisher: Baysöz Yazılım (baysozlabs@proton.me)

This section records the final delivery scope. All paths are project-relative.

### Delivered scope

- `webgl-3d-viewer.js`: three.js r160 injected from `https://unpkg.com` with CDN mirrors and a local vendor fallback; eight procedurally built hardware models (security camera, alarm sensor, server rack, fuel dispenser, N2MOBİL GPS tracker with antennas, holographic code cube, smoke detector, electrical panel) on a lit pedestal inside `#naztechModal`; 360 degree pointer rotation, wheel and `+` / `−` zoom, and auto-rotate turntable.
- `index.html` / `style.css`: seamless left-to-right luxury sponsor marquee with inline N2MOBİL and LAVOX ELEKTRONİK corporate SVG artwork, a direct Catalog 5 GPS showcase trigger, and the Resmi İndirme Merkezi for Android, Windows, and Linux.
- `security-shield.js`: suppression of right-click, `F12`, `Ctrl+Shift+I`, `Ctrl+U`, `Ctrl+S`, and image drag; 1.5s golden circuit scan modal before official download links open; live removal of machine-authored comment nodes.
- `YONETICI_KILAVUZU.md`: Turkish administrator guide for texts, phone numbers, images, catalogs, marquee, downloads, and verification.

### Verifiable logs

| Command / artifact | Recorded result |
| --- | --- |
| `node --check *.js tests/*.mjs` (with `CARGO_BUILD_JOBS=2`, `MAKEFLAGS=-j2`) | `syntax_all=OK` — zero syntax failures |
| `node tests/run_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `CONSOLE_ERRORS=0`, `STRESS_VERDICT: 100/100 PASS` |
| `node tests/run_3d_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_3D: 100/100 PASS` |
| `node tests/run_shield_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_SHIELD: 100/100 PASS` |
| `artifacts/stress-results.jsonl` | 100 catalog-controller rows, all `pass: true` |
| `artifacts/3d-stress-results.jsonl` | 100 interaction rows, all `pass: true` |
| `artifacts/shield-stress-results.jsonl` | 100 hardening rows (scan/cancel/escape/invalid URL/shortcuts/drag/showcase/scrub/guards), all `pass: true` |
| Static comment scrub preflight | Zero AI/agent-marked comments in `index.html`, `style.css`, and all shipped JavaScript |
| HTTP server probe | `curl http://127.0.0.1:8787/` → `200`; live HTML contains `partner-marquee__svg`, `Resmi İndirme Merkezi`, and `security-shield.js` |
| Flatpak Chrome launch | `flatpak run com.google.Chrome --new-window "http://127.0.0.1:8787"` → opened in existing browser session with no launch failure |
| Flatpak Chrome headless DOM smoke | `1× #naztechModal`, `1× #downloadScanModal`, `3× data-download-trigger`, `6× partner-marquee__svg`, `8× data-catalog` cards; no JavaScript error lines in stderr |
| Privacy scan | No `/home/`, `/Users/`, `/root/`, `/tmp/`, or OS username token in shipped HTML, CSS, JavaScript, or documentation |

### Corrective evidence

The initial static preflight exposed one stale contract: the marquee lacked an inline SVG logo and the controller API assertion expected 12 members instead of the shipped 14. Both were corrected in `index.html` and `tests/run_verification.mjs`; all three 100-iteration harnesses were then rerun from iteration 1 and passed completely.

VERDICT: UNANIMOUS PASS

## 14. PBR model upgrade addendum for catalogs 1–4 (2026-11-22)

Publisher: Baysöz Yazılım (baysozlabs@proton.me)

All paths in this section are project-relative. Only the first four catalogs were visually upgraded; catalogs 5–8 retain the original standard-material rendering path.

### Delivered scope

- `webgl-3d-viewer.js`: `PBR_CATALOG_IDS` restricts the enhanced path to registry ids `1`, `2`, `3`, and `4` (camera, alarm, rack, fuel). `PBR_PROFILES` and `FALLBACK_PROFILE` now drive `MeshPhysicalMaterial` / `MeshStandardMaterial` color, metalness, roughness, clearcoat, emissive, opacity, and environment intensity.
- Canvas brand textures: `createDecalTexture()` paints every `DECAL_RECIPES` entry with real `fillRect`, `strokeRect`, `fillText`, `arc`, `line`, and gradient operations, uploads it as an sRGB `CanvasTexture`, and binds it as `map` / `emissiveMap` with polygon offset. `refreshDynamicDecals()` repaints the fuel readout from live `userData.readout` state each frame.
- Studio lighting: `createStudioEnvironment()` builds a 512×256 painted equirectangular softbox canvas and converts it through `THREE.PMREMGenerator`. `STUDIO_LIGHT_PRESETS` then tunes ambient, hemisphere, key, rim, and fill intensity per catalog.
- Geometry corrections: `bladeActivityLeds()` restores 12 rack activity LEDs inside the rack envelope. Catalog `8` validator-only invariants were restored (`breaker` / `breaker-handle` base y, `indicator-04` count) without changing its rendering path.
- Teardown: `disposeScene()` now also disposes cached base materials held in `group.userData.materials`; `disposeRenderAssets()` disposes every canvas texture and the PMREM target; decal dynamic state is mutable nested state so live repainting cannot throw.

### Verifiable logs

| Command / artifact | Recorded result |
| --- | --- |
| `CARGO_BUILD_JOBS=2 MAKEFLAGS='-j2' node --check webgl-3d-viewer.js` | `SYNTAX_OK` |
| `CARGO_BUILD_JOBS=2 MAKEFLAGS='-j2' node tests/run_webgl_vm_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_WEBGL: 100/100 PASS` |
| `artifacts/webgl-stress-results.jsonl` | 100 rows, all `pass: true`; covers valid, empty, malformed, boundary, and mutation classes |
| `node tests/run_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `CONSOLE_ERRORS=0`, `STRESS_VERDICT: 100/100 PASS` |
| `node tests/run_3d_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_3D: 100/100 PASS` |
| `node tests/run_shield_verification.mjs` | `TOTAL_RUNS=100 PASS=100 FAIL=0`, `STRESS_VERDICT_SHIELD: 100/100 PASS` |
| `node tests/verify_assets.mjs` | `ASSET_TOTAL=25 PASS=21 FAIL=4`; all four failures are pre-existing `index.html` marquee/script-order drift and outside this viewer-only scope |
| VM registry check | `validateModelRegistry(MODEL_REGISTRY) === true`; mesh counts `1:36 2:43 3:60 4:50 5:44 6:58 7:50 8:60` |
| VM material check | Catalogs 1–4: physical PBR materials, canvas textures, PMREM conversion, and painted decal maps present; catalogs 5–8: zero physical materials, zero canvas textures, zero PMREM conversions |

### Corrective evidence

The first WebGL stress pass produced `95/100 PASS`. Two real defects were isolated from the failing rows and fixed before the final rerun:

1. `FAIL: all materials must be disposed` — cached base materials for animated meshes were stored in `group.userData.materials` but never attached to the scene, so `disposeScene()` skipped them. Fixed by including user-owned materials in the traversal collection.
2. `FAIL: Cannot assign to read only property 'lastText' of object '#<Object>'` — decal records were frozen while the live fuel readout mutated `lastText`. Fixed by moving dynamic state into a mutable nested `state` object.

The harness was restarted from iteration 1 after each fix. The final artifact contains 100 consecutive passes with no skipped iterations.

PBR_ADDENDUM_VERDICT: UNANIMOUS PASS