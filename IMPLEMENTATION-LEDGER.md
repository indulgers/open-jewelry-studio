# SDD ledger — plan: docs/superpowers/plans/2026-10-18-open-source-jewelry-demo.md

Latest revision: reference GLB / planar reflection / open optics implemented under `docs/superpowers/plans/2026-10-25-reference-ring-rendering.md`; current execution record is `2026-10-25-reference-ring-progress.md` beside it. Current runtime and verification supersede historical lighting/source statements below; see the newest TEST-REPORT.md entry.

Execution: native, approved by user on 2026-10-18. Spec and full plan read.

## Setup / rulings

- Ruling: no Git/worktree bookkeeping scripts — workspace is not a Git repository, and approved plan forbids automatic initialization. Use isolated jewelry-demo directory and this persistent ledger; cost: no commit-based recovery, keep files and test evidence.
- Ruling: preserve pinned visual design and execute code-first — user approved warm neutral large Viewer/right configuration layout and inline implementation; Impeccable launcher has no execute permission. Use directly read craft guidance; no new concept tournament or generated page comp. Cost: final review judges actual rendered screenshots rather than a comp match.
- Ruling: project-local npm cache — default home cache is not writable in the sandbox. Use /private/tmp/jewelry-npm-cache, do not change user cache permissions. Cost: dependencies may need downloading again after temp cleanup.

## Pre-flight interfaces

- Task 1 → 3/5: Configuration enums and reducer actions match consumers; clean.
- Task 2 → 3/4/5: GLB manifest requires single named mesh and orientation; asset selection must finish before placement is frozen.
- Task 3 → 4: bounds applied after asset orientation; explicit +Y table normal; clean.
- Task 4 → 5: quality, rotation and reset are viewing preferences, not persisted product fields; clean.
- Task 5 → 6: local saved configuration and accessible controls support real browser verification; clean.

## Tasks

- Task 1: complete; RED 10 explicit unimplemented failures → GREEN configuration/storage 10/10.
- Task 2: complete; missing-GLB gate RED → prepared and inspected GLB GREEN; provenance test passed; 2440 bytes, 22 source triangles, closed-edge and nonzero-volume checks passed.
- Task 3: geometry tests passed (5); browser visual inspection still pending.
- Task 4: quality/boundary tests passed (3); GPU and controls verification pending.
- Task 5: real reducer panel tests passed (2); build successful, browser pending.
- Task 6: pending.

## Execution evidence / rulings

- Full unit suite: 21/21 pass, six files; production typecheck/build exit 0. Build emits expected >500 kB Three.js chunk advisory (1.35 MB raw / 380.5 kB gzip), not hidden or treated as a build failure.
- Ruling: use Wikimedia Commons CC0 simplified gemstone STL converted to GLB — Poly Pizza stayed at security verification, which was not bypassed; public Commons source explicitly permits modification and distribution. Preserve its original geometry and label simplified cut. Cost: fewer facets than a commercial brilliant-cut model; replaceable by modeling colleague later.
- Ruling: manually exposed simplified-material recovery in addition to shader-error fallback — allows recovery when the browser does not surface a catchable React error. Cost: glass-like fallback is visibly less accurate, explicitly labeled.

## Realism revision / final verification — 2026-10-19

- Ruling: supersede the simplified CC0 primary stone with Ehsan Moradi's MIT Math Diamond — user explicitly rejected low realism; original glTF/bin and full MIT notice retained. Cost: MIT notice must accompany distribution; source is a visual cut, not certified gemmological geometry.
- Ruling: replace procedural light cards with a locally hosted CC0 Poly Haven studio HDR — clearer polished-metal/refraction lighting within the open-source requirement. Cost: 1.62MB additional asset and a separate loader/retry dependency; both loader caches now cleared on retry.
- Tasks 1–5 implemented. Task 6 browser verification and one fresh review completed with limitations in TEST-REPORT.md; not a commercial production-readiness sign-off.
- Final test evidence: 31/31 across 8 files, build exit 0, GLB inspection exit 0. Actual 390×844 and 1440×960 screenshots captured; no horizontal overflow.
- Reviewer findings fixed: strict string checks (array coercion RED→GREEN), environment retry cache (real missing-HDR → restore → retry verified), size-aware shoulder/prong joint (geometry contact RED→GREEN).
- Visual refinements: 252-triangle brilliant cut (not 252 gemmological facets), rounded rectangular band, closed band ends, size-dependent split shoulders, lower basket, 3/6 refraction budgets, detail/side view shortcuts, compact framing and non-overlapping mobile toolbar.
- minor (deferred): bundle splitting remains; initial Three.js payload is 381KB gzip.
- minor (deferred): exhaustive touch-device/GPU memory/context-loss profiling; no performance or real-device compatibility guarantee.
- Review scope ruled on: final visual parity with Helzberg is deliberately not asserted; final screenshots reviewed by main. GPU trends remain a stated test limitation, not implicitly passed.
- No files deleted; original low-poly source and unused candidate archive retained for provenance. No Git repository initialized and no external deployment performed.

## Poimandres rendering treatment — 2026-10-24

- User requested applying the previously inspected Diamond Ring treatment to this demo; preserve the existing configuration UI, licensed gemstone and procedural assembly.
- Shared locally hosted CC0 Peppermint Powerplant 2 HDR for metals/refraction, controlled color dispersion, neutral white-metal base, stronger PBR environment reflections, thresholded bloom and one final ACES tone-mapping pass. High quality rebuilds its refraction material/BVH correctly; compatibility mode skips postprocessing.
- Ruling after read-only review: do not keep the installed drei shadow components' private render targets alive across repeated remounts. Use a small owned contact-shadow capture/blur implementation, refresh only on geometry/quality changes, dispose every private resource explicitly and restore renderer/scene state in finally. Cost: this is depth-based soft contact shadow, not the reference's Monte Carlo accumulated shadow.
- TDD/lifecycle checks and final full suite: 36/36, typecheck/build and GLB inspection exit 0. Existing Three.Clock warning and large-bundle advisory remain documented in TEST-REPORT.md. No real-device or long-session GPU profiling claim.
- New environment provenance/hash, Poimandres MIT notice and drei MIT notice retained. The source-uncertain reference ring model was not acquired or shipped. No existing source asset was deleted; no Git initialization, external deployment or local saved-design overwrite.

## Neutral jewelry studio — 2026-10-24

- Plan: `../docs/superpowers/plans/2026-10-24-neutral-jewelry-rendering.md`. User approved the preceding priorities and implementation directly. Native execution in the existing non-Git directory; no initialization or worktree/commit simulation.
- Task 1: complete — separate original achromatic half-float HDR environments, broad metal softboxes and gemstone ceiling/floor returns; reduced metal amplification, clearcoat and Bloom; existing MIT gemstone retained. Owned texture factory disposes exactly once. Factory absence was observed before implementation, followed by passing radiance/lifecycle/bounds tests.
- Task 2: complete — original six-petal open gallery with rounded prong tips, sealed metal sweep ends, continuous lower shoulder rail and softer band bevel. Open-end manifold regression failed with 24 boundary edges before caps, then passed. Existing small-stone shoulder/basket test remains green.
- Task 3: implementation/browser verification complete — compact detail camera pulls back; projected crown-top regression failed at NDC y=0.679 before the overall-view correction. A narrower camera framing now reserves the overlaid heading space. Actual browser samples: mobile widths 281–300 and height 649, desktop 984×738, no horizontal overflow. Requested overrides differ from actual DOM sizes because of the host browser sizing/zoom; do not report requested sizes as measured ones.
- Ruling: preserve the licensed 252-triangle cut instead of copying the commercial reference's stone or pretending to have acquired a new jewelry asset. Author the lighting and setting locally. Cost: the reference's elaborate woven band, its proprietary gem pipeline and full scene reflections remain unmatched.
- Ruling: shader/lighting and visual contract are verified separately — real geometry/radiance/lifecycle tests plus actual browser captures; no unit-test assertion claims photographic parity or absence of HDR clipping. Cost: visual acceptance remains subjective and true mobile GPU behavior needs hardware testing.
- Review: fresh read-only reviewer found no confirmed Critical/Important/Minor issues, independently ran the then-current 41 tests, checked map compatibility, aggregate geometry winding and resource ownership. The additional compact-heading regression increased the suite to 42 tests. No reviewer re-run requested.
- Review scope rulings: final visual quality, crown clearance and framing judged from current screenshots only; no pixel parity claim. StrictMode/context-loss GPU memory and cold shadow timing were not profiled and are not signed off. Existing full-renderer retry path and unit-tested explicit resource disposal are retained. GemAsset's pre-existing `dispose={null}` behavior was noted without evidence of a persistent user-path leak; keep this as a profiling boundary, not a proven fix or leak claim.
- No browser save action was used, no local saved design overwritten, no commercial model/HDR copied, no external deployment performed. Former CC0 environment files remain archived and attributed, not deleted.
