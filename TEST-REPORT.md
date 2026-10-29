# Verification history

## Commercial display correction — 2026-10-29

- Full suite: 67 tests across 20 files passed. TypeScript check and production build passed. Current JS chunks: entry 615.71 kB / 176.87 kB gzip; lazy viewer 850.41 kB / 242.20 kB gzip. The existing >500 kB bundle advisory and upstream Three deprecation warnings remain.
- Changes: neutral metal tent with dark cards and softer gradients, lower polished-metal roughness, reduced gemstone light/dispersion, a documented approximate observer cone, lower floor reflection, and the floor preset-color bug fix. Existing radiance tests validate finite nonnegative achromatic textures, contrast and ownership. The new floor-color regression failed before the fix and passed afterward.
- Actual browser comparison: the same local ring, white metal, catalog preset and overall camera at CSS 984×692 before/after. Blue Nile's live interactive ring was inspected separately; it is a different SKU, camera and viewport, so no equal-product or photorealistic-parity conclusion is drawn.
- Checked round loose stone face-up, ring detail, both lighting presets and all three metal appearances. Browser error log was empty after these interactions. Final narrow CSS viewport was 300×649, scroll width 300; idle canvas reached 32 refinement samples.
- Four actual JPEG exports completed. Updated `public/media/sample/{overall,front,side,stone}.jpg` are 786×961 white-metal/catalog images from the new renderer. After a reload, image mode showed all four thumbnails and the main image loaded successfully.
- Before/after and detail screenshots are in workspace `../research/2026-10-29-commercial-render/`. The floor correction changed the surrounding background along with the metal/gem treatment; screenshots are evidence, not pixel regression goldens or a controlled perceptual study.
- Real-device GPU performance, full-scene optical accuracy, long-run memory, physical SKU correspondence and final commercial acceptance were not verified. This iteration does not supersede those limitations. See `docs/commercial-render-review.md` for remaining geometry and optical gaps.

## Reference GLB, mirror floor and open optics — 2026-10-25 / handoff 2026-10-26

- Current suite: 55 tests across 16 files; full suite passed. TypeScript and Vite production build passed. Bundle advisory remains: 1,424.73 kB raw / 403.12 kB gzip, above 500 kB advisory. Node test imports emit upstream THREE_CJS_DEPRECATED warnings; browser emits the pre-existing Three.Clock deprecation warning.
- Actual reference GLB is copied unchanged (SHA-256 5d9267d36298bc9c21b58f6d86e600ffa91aabebf78fbb092884d11232027514). Both EXR hashes match the inspected source. Draco decoder is local. No third-party upload, external deployment, Git initialization or source asset removal.
- Current rendering uses the supplied reference ring and actual referenced dual EXRs, not the archived original softboxes. Procedural DIY still uses its MIT stone and original generated metal geometry. Prior entries describe previous revisions, not current runtime inputs.
- New tests cover ancestor transforms and owned geometry, fixed-reference structural controls, per-draw reflected/jittered camera matrices and framebuffer dimensions, BVH/material/floor disposal, exclusion/restoration of reflection floor during shadow capture, finite 32-sample idle state and projected-crown clearance.
- Independent read-only reviewer passed the then-current 54 tests and identified one Important failure: EXR rejection remained cached during retry. A real React suspense-cache regression failed before the fix, then passed after exact EXRLoader+two-URL cache invalidation. Final suite 55/55. No other confirmed Critical/Important/Minor findings; no second review requested.
- Browser verification: actual desktop DOM sizes included 1230×923 and 1107×769; actual narrow DOM was 300×769 (initial 281×649). Requested viewport overrides differ from actual host CSS pixels. Narrow check had no horizontal overflow. Actual canvas data-refinement-samples reached 32 after stopping, including after rotation was disabled.
- Checked three metals, overall/detail/side views, standard/high quality, compatibility enable/restore, both procedural shanks and size changes. Three repeated round trips reference↔DIY retained selected split/white/large; save displayed success. Saved the original split/white/large values, not the temporary gold/rose test selections. Quality/mode remain viewing preferences, not persisted product configuration.
- Browser error log was empty after tested interactions. One early asynchronous wait timed out before convergence; later actual DOM confirmed rotation off and 32 samples, without a code change. No frame-time or long-session GPU-memory guarantee is inferred.
- Native JPEG proof files: `.impeccable/review/2026-10-25/reference-desktop-visible.jpg`, `reference-gem-detail.jpg`, `reference-mobile.jpg`. Host screenshots may clip the virtual viewport or show its current scroll offset; these are observed renders, not full-page regression goldens. Temporary viewport override reset and extra test tab closed.
- Reviewer scope rulings: final image judged from parent browser captures, no pixel parity promise; SSR/SSAO and motion-reprojected TAA explicitly deferred; reference model/EXRs remain research assets with unverified commercial clearance. Static accumulation is not path tracing. Real phone GPU, context-loss recovery and long-session GPU-memory profiling remain unverified.

## Initial verification — 2026-10-19

## Automated

- 31 tests passed across 8 files; full `npm test`, exit 0.
- TypeScript + Vite production build passed, exit 0.
- GLB inspection passed: 12,364 bytes, named Gemstone mesh, 3 accessors; provenance hash test passed.
- RED→GREEN regressions cover malformed array configuration, closed split-band ends, small-stone shoulder/setting contact, mobile camera framing and lower basket support. Existing interleaved-attribute regression remains covered.
- Build advisory remains: Three.js-related JS chunk 1.35MB / 381KB gzip, above Vite's 500KB advisory. Not a build failure.

## Browser checks

- Actual viewport 390×844 and 1440×960: no horizontal overflow; saved screenshots under `.impeccable/review/`.
- 20 consecutive shank switches without a visible failure; all three metals and stone sizes exercised over the session.
- Saved split/white/large, changed unsaved selections, reloaded: split/white/large restored. Quality is intentionally not persisted.
- Overall, gemstone detail and side-setting controls exercised; screenshot inspection confirms closer framing and visible cut/setting.
- Temporarily renamed local HDR, reloaded into a real loading error, restored the file and clicked retry: viewer recovered without clearing configuration. Also corrected misleading context-loss overlay caused by intentional renderer teardown.
- Current view renders the local MIT brilliant-cut GLB with the local CC0 studio environment, not a reference-site screenshot or proprietary SDK.

## Review

Fresh read-only reviewer found strict parser, HDR retry cache and small-stone split-shoulder connectivity issues. All addressed. The connectivity finding was reproduced in a real geometry test before the fix. No second review requested.

Reviewer did not judge final screenshot parity, GPU memory trends or browser recovery. Main verified framing and browser recovery; parity with Helzberg is not claimed. GPU profiling remains unverified.

## Limitations

Mobile layout was checked in a desktop browser viewport, not an iPhone/Android GPU. Manual orbit/scroll gestures, touch gestures, actual context-loss/restoration and long-session GPU memory were not exhaustively tested. No physical accuracy, manufacturability or commercial photorealistic parity is claimed. See README.md for rendering boundaries.

## Diamond Ring rendering revision — 2026-10-24

- Full suite: 36 tests across 10 files passed; TypeScript check and production build exited 0. GLB inspection still reports 12,364 bytes, named Gemstone mesh, 3 accessors.
- New coverage: compatibility mode disables postprocessing and reduces the shadow target; high quality increases shadow precision; the actual local HDR decodes with finite HDR highlights; all eight private shadow targets/geometries/materials dispose exactly once; a failed GPU capture restores the original renderer target, clear state, ground visibility and scene override/background.
- RED→GREEN: quality fallback/shadow-budget assertions failed before implementation; the owned shadow module was absent before its tests were introduced. Existing parser/geometry/storage tests remain green.
- Build advisory: final JS chunk 1,446.47 kB / 405.67 kB gzip, above Vite's 500 kB advisory. This is not a build failure; no first-load speed guarantee is made.
- Cold browser check: three metals, all stone sizes, both shank styles with repeated changes, standard/high quality, simplified-material enable/restore, rotation toggle and reset were exercised. Current choices were not saved over the existing local configuration. Final cold-run log contained no errors; an upstream Three.Clock deprecation warning remains.
- Mobile and desktop-width layouts were observed without horizontal overflow. The in-app browser's viewport overrides/captures changed with its panel size; actual DOM samples included 390×844, 751×544 and 1107×738. A requested 1440×960 override was not stably reflected, so it is not claimed as a verified final viewport. Native preview captures are JPEG, not full-page goldens.
- Final visual proof: `.impeccable/review/2026-10-24/gem-detail.jpg`; other diagnostic captures remain in the review directory. The screenshot shows the actual local GLB/materials, not the reference website's model.
- Read-only review identified undisposed private resources in the installed upstream shadow components. The final implementation uses a locally owned depth/blur contact-shadow pipeline instead of remounting those components. The lifecycle fix is unit-tested; actual long-session GPU memory growth has not been profiled.
- Deliberate difference from the reference: no reference ring GLB, no Monte Carlo accumulated shadow pass, lower bloom intensity, explicit ACES tone mapping, existing product controls and models preserved. Realistic parity and true spectral diamond optics are not claimed.

## Neutral studio / iJewel-inspired calibration — 2026-10-24

- Final full suite: 42 tests across 11 files, exit 0; TypeScript check and Vite production build exit 0. Asset inspection unchanged: 12,364-byte MIT GLB, named Gemstone mesh, 3 accessors.
- New tests exercise actual half-float radiance data: both maps are achromatic, independent, contain HDR highlights and dark regions, have bounded dimensions, and dispose once without sharing resources across viewer instances.
- Geometry RED→GREEN: old open prongs had 24 boundary edges; sealed sweeps and rounded tips pass manifold checks. Existing small-stone shoulder/basket contact and comfort-fit/band-end checks remain green.
- Camera RED→GREEN: compact detail pullback and overall projected-crown clearance. Crown top was NDC y=0.679 before correction, failing the <0.6 heading-clearance contract; now passes.
- Actual browser checks: cold load, all three metal appearances and sizes, both shanks, standard/high quality, compatibility enable/restore, rotation on/off and reset. Controls' checked/pressed states were read back. Save was not clicked. No render errors were observed; the existing upstream Three.Clock deprecation warning remains.
- Actual mobile DOM samples were 281–300×649; desktop sample 984×738. Both had no horizontal overflow. Browser overrides do not equal actual CSS pixels in this host; requested 390×844 and 1280×960 are not misreported as measured viewports. Desktop-browser responsive testing is not real-phone GPU testing.
- Proof files: `.impeccable/review/2026-10-24/neutral-mobile.jpg`, `neutral-desktop.jpg`, `neutral-gem-detail.jpg`. Native captures can show the viewport's current scroll offset; these are visual evidence, not full-page goldens. Earlier captures in the directory document earlier revisions, not this final lighting state.
- Read-only reviewer independently passed the then-current 41 tests and found no confirmed Critical/Important/Minor findings. Additional compact-heading coverage brought final count to 42. Reviewer verified equirectangular shader compatibility, resource ownership, winding and normals for all stone sizes; visual parity and GPU trends were explicitly not judged.
- Calibration remains an approximation: original six-petal gallery and studio maps, not a copy of iJewel's woven ring, proprietary shader or assets. No SSR / floor mirror / true caustics added. No HDR clipping or full-scene optical accuracy claim is made. Full renderer retry/context loss and long-run GPU memory profiling were not re-exercised in this revision.
- Bundle advisory remains above 500 kB; final build reports about 1.45 MB raw / 406 kB gzip. No dependency upgrade, external deployment, saved-design overwrite or source-asset deletion.
