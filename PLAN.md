# Plan — NAZTECH WebGL Hardware Inspector

**Baysöz Yazılım — baysozlabs@proton.me**

Status: design complete for the model registry, lighting rig, texture lifecycle, and verification strategy. Implementation follows the exact counts in `ARCHITECTURE.md`; no placeholder geometry, mocked renderer, or TODO marker is accepted.

## E Dedicated VM Test Strategy

The existing interaction harness covers the canvas layer. The WebGL inspector requires its own deterministic harness in `tests/run_webgl_vm_verification.mjs` because a real GPU is not available in CI and network loading must not affect the verdict.

### E.1 Isolation model

- Load the viewer source into a fresh `node:vm` context for every iteration; no context is reused.
- Provide a minimal `window` and dependency-free DOM shim containing the modal, stage, toolbar, status panel, and canvas factory.
- Provide a deterministic Three.js r160 stub with the constructors used by the registry, lights, camera, renderer, texture, scene traversal, and disposal counters.
- Record render calls, geometry/material/texture creation, disposal calls, listener counts, script insertions, and console output.
- Replace network loading with a seeded script controller that can force success, timeout, integrity failure, and local fallback.
- Never use a real clock, real random source, local path, host name, or account identifier in logs.

### E.2 Scenario classes and allocation

Each run uses seed `20261122` with a shuffled 100-run plan:

| Class | Runs | Coverage |
| --- | ---: | --- |
| `valid` | 40 | All eight catalog IDs, all exact mesh counts, complete decal sets, normal open/render/close. |
| `empty` | 12 | Missing modal, missing stage, missing WebGL capability, absent Three.js global. |
| `malformed` | 18 | Invalid ID, duplicate part name, unknown primitive, unknown material, non-finite transform, missing decal, orphan animation target. |
| `boundary` | 20 | Zoom clamps `3..12`, angle wrap at `±π`, zero delta, oversized delta, tiny and huge stage sizes, rapid open/close, reduced-motion toggle. |
| `mutation` | 10 | CDN failure chain, timeout, context loss, visibility change, resize during render, stale-epoch callback arrival. |

### E.3 Assertions per run

1. `validateModelRegistry` returns `true` for unmodified registries and `false` for each injected malformed registry.
2. Section B mesh counts match exactly for catalogs `1..8`; every model count remains within `30..199`.
3. Names are unique; primitive arity, material tokens, numeric transforms, scene envelope bounds, and decal names pass.
4. Every animation target resolves; updater execution produces finite values under both normal and reduced-motion modes.
5. `open()` creates one renderer and one canvas; repeated open invalidates the previous epoch and leaves no active RAF after close.
6. Drag, wheel, `+`/`-`, arrow keys, reset, and auto-rotate update yaw, pitch, and radius without NaN and within clamps.
7. Loader failure, WebGL failure, and context loss restore the legacy photo viewer and emit zero `console.error` calls.
8. Every created geometry, material, texture, renderer, listener, and pending script is disposed or removed by the end of the run.
9. State transitions remain inside the documented state machine; stale callbacks never mutate a newer session.
10. The harness writes one compact JSONL record per run and prints `STRESS_VERDICT_WEBGL: 100/100 PASS` only when all 100 runs pass.

### E.4 Evidence and gate

- Run with the hardware guardrails: `CARGO_BUILD_JOBS=2`, `MAKEFLAGS="-j2"`, `GOMAXPROCS=2`, `RAYON_NUM_THREADS=2`, and `UV_CONCURRENT_BUILDS=2`.
- Commands: `node --check *.js tests/*.mjs`, the existing verification harnesses, then `node tests/run_webgl_vm_verification.mjs`.
- Write machine-readable evidence to `artifacts/webgl-stress-results.jsonl` and render it into `KANIT_RAPORU.md` with real sample output lines.
- Any failure restarts the loop from run 1. The release gate requires 100/100, clean evidence, a department audit, and an independent live jury verdict of `VERDICT: UNANIMOUS PASS`.

## F Risk Register

| ID | Risk | Impact | Likelihood | Mitigation and gate |
| --- | --- | --- | --- | --- |
| R01 | Three.js CDN or SRI source fails | Interactive 3D unavailable | Medium | Three-source fallback chain plus local bundle; fail-closed to photo inspector; VM mutation runs cover timeout and integrity failure. |
| R02 | Mesh count drifts outside `30..199` | Contract and memory budget regressions | Low | Exact per-model counts in registry validation; VM asserts counts every valid run. |
| R03 | Duplicate or orphaned part names | Animation writes wrong mesh or no mesh | Low | Name uniqueness and animation-target resolution are hard validation failures. |
| R04 | Non-finite transform or oversized primitive | Blank scene or GPU crash | Low | Numeric, positivity, segment-cap, and scene-envelope validation before renderer allocation. |
| R05 | Decal canvas text is blurry or misplaced | Brand quality failure | Medium | Fixed pixel sizes, mipmaps, anisotropy cap, polygon offset, and exact decal transform assertions. |
| R06 | Correct trademark rendering | Legal/brand credibility | Medium | Use approved text constants; HIKVISION red/black treatment and N2MOBIL wordmark are separate validated textures; no guessed vector marks. |
| R07 | GPU memory pressure on 8 GB systems | Stutter or context loss | Medium | Pixel-ratio cap `2`, 1024 shadow map, per-session texture cache, explicit disposal, mesh counts far below ceiling. |
| R08 | WebGL context loss on modal churn | Dead canvas or stale frame | Medium | Epoch guards, context-loss handler, legacy fallback, and mutation harness coverage. |
| R09 | Reduced-motion users still see animation | Accessibility failure | Low | Static emissive values and disabled auto-rotate; VM reduced-motion assertions in valid and boundary classes. |
| R10 | Legacy photo viewer and WebGL viewer conflict | Duplicate controls or focus trap | Medium | Legacy surface is suppressed only for active 3D sessions and restored on close/failure; focus stays inside the modal. |
| R11 | Shared material mutation causes all LEDs to pulse together | Visual defects | Medium | Animated descriptors clone materials; dispose tracking verifies cloned materials are released. |
| R12 | CSP blocks inline canvas or external scripts | Loader failure | Medium | Canvas drawing needs no inline script; all logic stays in external files; fallback remains functional. |
| R13 | VM stub passes but browser shader path fails | Late visual defect | Medium | VM verifies logic and lifecycle; department jury performs live browser inspection before release. |
| R14 | Local identifiers leak into artifacts | Privacy and compliance failure | Low | Log schema contains only run metadata, class, pass flag, error count, and detail token; pre-delivery scan rejects local paths and usernames. |

**Baysöz Yazılım — baysozlabs@proton.me**
