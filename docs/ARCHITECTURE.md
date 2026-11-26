# Architecture — NAZTECH WebGL Hardware Inspector

**Baysöz Yazılım — baysozlabs@proton.me**

## Scope

This document finishes the model contract for the eight catalog scenes. The viewer remains a dependency-light classic script, loads Three.js r160 lazily, and keeps all model definitions as immutable descriptors. Pedestal, trims, deck, lights, and contact-shadow planes are scene furniture; they are not part of the per-model mesh budget.

## A.3 Completed Registry Validation Rules

Validation runs at script evaluation, before any loader injection or WebGL allocation. Failure is fail-closed: no partial scene is built, the status panel explains the fallback, and the existing photo viewer is restored.

1. **Catalog closure.** `MODEL_IDS` is exactly `1` through `8`. Each registry entry has a non-empty display label.
2. **Global mesh budget.** Every model has at least 30 and at most 199 descriptors. Section B supplies the exact per-model target; the exact value is asserted in addition to the global range.
3. **Name uniqueness.** Descriptor names are non-empty strings and unique within a model. Generated names use zero-padded `01..N` suffixes.
4. **Primitive whitelist.** Only supported core r160 constructors are allowed: `box`, `cylinder`, `sphere`, `torus`, `cone`, `plane`, and `circle`.
5. **Primitive arity.** Constructor argument counts match the primitive contract: box 3, cylinder 4, sphere 2 or 3, torus 4, cone 2 or 3, plane 2, circle 2. Segment/radial counts are integers from 8 to 96.
6. **Numeric safety.** All geometry arguments, positions, rotations, and scales are finite numbers. Dimensions and radii are strictly positive; scales are greater than zero; rotations are bounded to `[-2π, 2π]`.
7. **Material whitelist.** Materials must exist in the frozen finish palette. Base surfaces and emissive surfaces are validated separately so a display cannot silently acquire a structural metal finish.
8. **Transform bounds.** Positions are within a deterministic scene envelope (`|x| <= 4`, `0 <= y <= 4`, `|z| <= 4`) after local scale. Models are centered around the pedestal target `(0, 1.15, 0)`.
9. **Decal contract.** Every model must include every decal name listed in Section B. Decal descriptors are planes, use a dedicated texture-backed material, and set `transparent`, `depthWrite: false`, and `polygonOffset` in the renderer layer.
10. **Animation targets.** Every updater target must resolve to an existing descriptor name. Animated parts own cloned materials so shared base materials are never mutated.
11. **Updater contract.** Updaters are pure frame functions of `(context, elapsed, delta, reducedMotion)`. Reduced motion yields static emissive values and no positional drift.
12. **Layer integrity.** No descriptor may use scene-furniture names, duplicate a pedestal trim name, or rely on DOM state. No descriptor may depend on external image URLs.
13. **Determinism.** Descriptor order is stable, generated groups are computed from fixed counts, and no random value, timestamp, host value, or local path enters a descriptor.
14. **Freeze and cleanup.** Registry entries, descriptors, argument arrays, vectors, and updater lists are frozen. All created geometries, materials, textures, render targets, and renderer contexts are disposed on close, failure, or context loss.

## Finish Palette

| Token | Finish |
| --- | --- |
| `cameraWhite` | Matte powder-coated aluminum, `#F4F5F7`, low gloss |
| `whiteEnamel` | Satin white enamel, `#E8EDF2` |
| `glossBlack` | Gloss polymer bezel, `#111317`, clearcoat |
| `opticalGlass` | Blue/violet anti-reflection optical glass simulation |
| `stainless` | Brushed stainless steel, high metalness, medium roughness |
| `anodizedBlack` | Anodized black aluminum, high metalness |
| `obsidian` | Dark structural polymer, near-black |
| `steelDark` | Dark painted steel |
| `copper` | Polished copper busbar finish, `#B87333` |
| `gold` / `goldLight` | NAZTECH champagne-gold accent system |
| `lcdBlue` | Blue emissive display glass |
| `signalRed` | Red emissive indicator glass |

## B Exact Per-Model Part Plans

Counts are final registry assertions. Repeated names are expanded by fixed-count generators; the total count includes decals.

| Catalog | Mesh count | Exact groups and key transforms | Materials, finishes, and decals |
| --- | ---: | --- | --- |
| 1 — HIKVISION ColorVu bullet camera | 36 | Shell 10: `camera-body` box `1.7 x 0.72 x 0.95` at `(0,0.90,0)`; `camera-top-shroud` at `y=1.30`; `camera-side-left/right` at `x=±0.88`; `camera-back-plate`; `camera-cable-port`; `housing-vent-01..04` along `x=-0.30 + 0.20i`. Optics 5: `lens-barrel`, `lens-hood` rotated `+π/2` on X at `z=0.62/0.86`; `lens-inner-ring`, `lens-front-ring` at `z=0.995/1.005`; `lens-glass` at `z=0.99`. Illumination 14: `ir-led-ring` torus; `ir-emitter-01..12` on `ringXY(r=0.47,y=0.92,z=0.78)`; `status-led`. Bracket 5: `bracket` at `y=0.45`; `mount-screw-01..04` on `ringXY(r=0.62,y=0.90,z=0.49)`. Decals 2: `camera-label-left/right` planes at `x=±0.885`, `y=0.92`, rotated `∓π/2` on Y. | `cameraWhite` body, visor, sides; `whiteEnamel` bracket; `glossBlack` bezel and hood; `opticalGlass` lens; `gold`/`goldLight` rings; `signalRed` IR/status. Decals carry red/black HIKVISION wordmark plus `ColorVu 4K` badge on both sides. |
| 2 — Alarm keypad and PIR sensor | 43 | PIR/siren head 24: `sensor-housing`; `pir-dome` at `(0,1.05,0.18)` scaled `(1,1,0.6)`; `fresnel-ring-01..03` on `ringXZ(r=0.34,y=1.05)`; `siren-horn` and `siren-led` at `y=1.72/1.78`; `siren-emitter-01..06` on `ringXY(r=0.16,y=1.72,z=0.22)`; `sensor-vent-01..06`; `panel-screw-01..04`; `wall-mount`. Keypad 19: `keypad-body` at `(1.35,0.62,0.20)`; `keypad-bezel`; `lcd-screen`; `keypad-key-01..12` in a 4 x 3 grid; `keypad-status-01..03`; `keypad-brand-decal`. | `whiteEnamel` sensor shell; `opticalGlass` Fresnel dome; `obsidian` keypad; `lcdBlue` backlit LCD; `signalRed` siren; `stainless` screws and grille. Decals carry zone numbers, arm/disarm legends, and the NAZTECH alarm badge. |
| 3 — 19-inch enterprise rack | 60 | Structure 12: `rack-frame` box `1.6 x 2.1 x 1.05` at `y=1.10`; `rack-top`, `rack-base`, `rack-side-left/right`, `rack-door-glass` at `z=0.55`, `rack-door-frame`, `cable-tray`, `rack-rail-01..04`. Blades 12: `server-blade-01..06` stepped `+0.24` in Y from `0.78`; `blade-bezel-01..06`. Status 20: `blade-activity-led-01..12`; `switch-port-01..08`. Network 10: `network-switch`, `patch-panel`, `patch-cable-01..04`, `rack-fan-01..04` on `ringXZ(r=0.28,y=2.18)`. Details 6: `asset-tag`, `switch-label`, `rack-vent-01..04`. | `steelDark` frame and rails; tinted `opticalGlass` door; `stainless` blades and rails; `obsidian` bezels; `lcdBlue`/green status LEDs. Decals carry asset tag, switch port map, and NAZTECH rack label. |
| 4 — Commercial fuel dispenser | 50 | Enclosure 14: `dispenser-base`, `dispenser-body` at `(0,0.98,0)`, `top-cap`, `front-bezel`, `side-panel-left/right`, `pump-panel-01..06`, `cabinet-vent-01..02`. Display 7: `display` at `(0,1.48,0.40)`; `display-pixel-01..06`. Fueling 16: `hose-anchor`; `hose-segment-01..08`; `nozzle` at `(0.68,0.72,0.48)`; `nozzle-detail-01..04`; `holster`; `nozzle-trigger`. Tank/telemetry 7: `tank` rotated `π/2` on Z at `x=-1.15`; `tank-band-01..04`; `telemetry-antenna`; `telemetry-base`. Decals/status 6: `fuel-grade-decal`, `price-decal`, `flow-led-01..04`. | `stainless` main body and nozzle; `obsidian` bezel; `opticalGlass` display; `lcdBlue` pixels; `signalRed` flow LEDs; `gold`/`goldLight` bands. Decals carry fuel grade, price per litre, and telemetry branding. |
| 5 — N2MOBIL GPS fleet tracker | 44 | Housing 11: `tracker-box` box `1.15 x 0.42 x 0.80` at `y=0.78`; `tracker-lid`, `tracker-base`; `side-rib-01..04`; `tracker-screw-01..04`. Antennas 8: `gsm-sma-antenna` at `x=-0.38`, `gps-sma-antenna` at `x=0.38`, both rising from `y=1.08`; `gsm-gold-tip`, `gps-gold-tip`; `antenna-collar-01..04`. Electronics 11: `status-led`; `relay-led-01..04`; `connector-pin-01..04`; `sim-slot`; `reset-pin`. Orbit 8: `satellite-orbit` torus `r=1.05` tilted on X; `satellite`; `satellite-panel-01..04`; `orbit-tick-01..02`. Decals 6: `n2mobil-top-logo`, `n2mobil-side-decal`, `imei-label`, `gps-label`, `gsm-label`, `power-label`. | `anodizedBlack` housing; `stainless` SMA bodies; `gold` tips and contacts; `lcdBlue` telemetry LEDs; `signalRed` status. Decals place a crisp N2MOBIL wordmark on the lid and side with GPS/GSM and IMEI micro-labels. |
| 6 — Dual-monitor software workstation | 58 | Monitors 12: `monitor-left/right` at `x=±0.85`, `y=1.45`, yaw `∓0.12`; `bezel-left/right`; `screen-left/right`; `monitor-stem-left/right`; `monitor-foot-left/right`; `monitor-hinge-left/right`. Desk/input 16: `desk-surface`; `keyboard-base`; `keycap-01..12`; `mouse`; `mouse-wheel`. Tower 12: `workstation-tower` at `x=1.35`; `tower-front`; `tower-vent-01..04`; `tower-led-01..03`; `motherboard-tray`; `psu`; `cable-duct`. Visual layers 12: `code-line-01..06` on the left screen; `dashboard-bar-01..04`, `dashboard-ring`, `cursor` on the right screen. Stand 6: `stand-column`, `stand-base`, `stand-arm-left/right`, `cable-clip-01..02`. | `stainless` aluminum stand and monitor arms; `obsidian` bezels and tower; `opticalGlass` screens; `lcdBlue` code glow; `goldLight` ERP accents. Decals are live canvas textures: syntax-coloured code editor on the left and KPI dashboard with charts on the right. |
| 7 — Addressable fire alarm system | 50 | Control panel 16: `panel-cabinet` at `(-0.65,0.95,0)`; `panel-door`; `panel-lcd`; `panel-zone-label`; `panel-brand-decal`; `panel-button-01..06`; `panel-led-01..04`; `panel-key-slot`. Detector 14: `detector-base`, `detector-grille`, `smoke-chamber`, `chamber-rib-01..04`, `grille-bar-01..04`, `test-led`, `test-led-array-01`, `detector-test-label`. Bell 8: `alarm-bell`, `bell-rim`, `bell-striker`, `bell-bracket`, `bell-bolt-01..04`. Manual call point 8: `call-point-body`, `call-point-glass`, `call-point-button`, `call-point-label`, `call-point-screw-01..04`. Cabling 4: `conduit-01..02`, `cable-gland-01..02`. | Red enamel panel and call point; `whiteEnamel` detector; tinted `opticalGlass` chamber; `gold` bell; `signalRed` LEDs; `stainless` fasteners. Decals carry zone addresses, panel brand, detector test mark, and a high-contrast call-point instruction plate. |
| 8 — Electrical distribution and compensation panel | 60 | Cabinet 12: `panel-cabinet` box `1.85 x 2.20 x 0.80` at `y=1.15`; `panel-door` at `z=0.44`; `panel-door-frame`; `panel-backplate`; `cabinet-vent-01..04`; `door-hinge-01..03`; `lock`. Copper 10: `busbar-phase-a/b/c`, `busbar-neutral`, `busbar-earth` at `y=1.90`; `busbar-support-01..04`; `copper-link-01`. Breakers 19: `din-rail-01..03`; `breaker-01..08` stepped `-0.19` in Y from `1.65`; `breaker-handle-01..08`. Terminals 10: `terminal-block-01..08`; `cable-duct`; `earth-stud`. Meters 7: `volt-meter`, `ampere-meter`, `meter-bezel-01..02`, `indicator-01..03`. Labels 2: `warning-plate`, `phase-label`. | `steelDark` cabinet; tinted door glass; `copper` busbars and links; `anodizedBlack` breakers; `goldLight` handles; `lcdBlue` meters; `signalRed` indicators. Decals carry voltage/current readings, L1/L2/L3/N/PE phase marks, and a high-voltage warning plate. |

## C Studio Lighting Upgrades

1. **Renderer baseline.** Keep `SRGBColorSpace`, `ACESFilmicToneMapping`, exposure `1.05`, antialiasing, pixel-ratio cap `2`, and `PCFSoftShadowMap`. Shadow map size stays `1024 x 1024`; bias and normal bias are tuned per scene to avoid acne on thin decals.
2. **Three-point studio rig.** Replace the single warm key with a neutral-white key `(4,7,5)` at `2.0`, a champagne-gold rim `(-5,4,-4)` at `1.4`, and a cool-blue fill `(3,2,5)` at `0.55`. Ambient and hemisphere contributions are lowered so metal edges retain contrast.
3. **Procedural reflections.** Generate a 512 x 256 equirectangular canvas gradient with two soft rectangular strip highlights, convert it with `PMREMGenerator.fromEquirectangular`, and assign it to `scene.environment` only. No HDR download and no background replacement.
4. **Material response.** Use `MeshPhysicalMaterial` for white housings, glass, and polished metal. Set metalness/roughness by finish token and `envMapIntensity` between `0.35` and `0.9`. Emissive parts use cloned materials; base structural materials stay shared.
5. **Pedestal treatment.** Preserve the black pedestal and gold trims. Add one texture-backed contact-shadow plane under the model; it is scene furniture and not a registry mesh. The deck receives shadows, while the model group casts them.
6. **Per-catalog bias.** Camera, fuel, fire, and electrical scenes favour neutral/warm light. Rack, tracker orbit, and software scenes keep a cooler fill for screens and status LEDs. Reduced motion disables animation but never disables lighting.

## D Texture Lifecycle

1. **Generation.** All decals and screen content are drawn to in-memory canvases with deterministic text constants, system font fallbacks, and explicit pixel sizes. No external logo fetch exists inside the 3D path.
2. **Texture settings.** Use `CanvasTexture`, `SRGBColorSpace`, `LinearMipmapLinearFilter` minification, `LinearFilter` magnification, mipmaps enabled, and anisotropy bounded by `min(4, renderer.capabilities.getMaxAnisotropy())`. Mark `needsUpdate` once after drawing.
3. **Material binding.** Decals receive dedicated transparent materials with `depthWrite: false`, `polygonOffset: true`, `polygonOffsetFactor: -1`, and `DoubleSide` only for two-sided camera and tracker plates. Screens use emissive maps with bounded intensity.
4. **Cache scope.** Textures are created per viewer session after renderer construction and keyed by model ID plus texture name. Repeated open events rebuild a fresh session; stale textures are never reused across contexts.
5. **Animation policy.** Frame updates never redraw canvases. Updaters animate cloned emissive intensity, rotation, or position only. This keeps text crisp and prevents per-frame GPU uploads.
6. **Disposal.** On close, failure, reduced-motion switch, or context loss: stop the animation frame, detach listeners, dispose textures, dispose geometries and materials, dispose the renderer, force context loss, remove the canvas, and clear all session references.
7. **Validation.** A missing required decal texture is a registry failure, not a blank plane. The viewer falls back to the photo inspector with a user-facing status message and zero console errors.

**Baysöz Yazılım — baysozlabs@proton.me**
