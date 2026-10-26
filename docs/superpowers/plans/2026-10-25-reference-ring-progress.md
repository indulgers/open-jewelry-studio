# SDD ledger — plan: docs/superpowers/plans/2026-10-25-reference-ring-rendering.md

Ruling: Work inline in this non-Git project; no worktree/commit scripts — no repository exists, and initializing Git is outside the requested rendering change — cost: no Git rollback, retain all verification artifacts and do not remove existing source/assets.

Ruling: User's “开始吧” approves executing the already described four-step direction; no repeated questionnaire — preserve the specified approach — cost: defaults are documented below and remain reversible.

Ruling: Separate fixed reference rendering from procedural DIY rather than silently distort supplied CAD geometry — preserve factual controls and previous configurations — cost: reference shank/size are not editable.

Pre-flight: Task 1 supplies world-space gem geometry and dual environment texture; Task 2 consumes these and owns optical material/BVH. Task 3 owns final render, while floor draws in the scene and updates optics per draw. Task 4 checks both modes. No incompatible interfaces found.

Ruling: Defer full motion TAA and SSR/SSAO; implement floor reflection, contact shadows and 32-sample idle accumulation first — avoid stacking uncalibrated effects before a visible baseline — cost: this does not yet reproduce every iJewel pass.

Task 1: complete. Reference geometry and control tests observed RED, then GREEN. Full suite 46/46 passed; TypeScript passed. Local model, two EXRs, and all Draco decoder files copied to new paths; original files unchanged. Reference preparation bakes ancestor matrices into owned geometry, translates the assembled model to the shared ground, and rejects missing gemstone. Reference mode disables structural controls without editing persisted DIY settings.

Task 2: complete. GPU ownership/camera/shadow-exclusion tests observed RED then GREEN; suite 50/50 passed. Custom environment-reflected Fresnel and internal BVH exit rays replace white Fresnel approximation; absorption coefficients are path-based (white diamond absorption zero). Target resolution and mirrored/jittered projection are synchronized on every gem draw. Floor uses owned Three Reflector and a filtered, faded ground shader. A multi-root BVH fixture failure identified material groups as the cause; clear groups on the owned tracing clone, never source geometry. Node tests emit upstream THREE_CJS_DEPRECATED warning, not test failures.

Task 3: complete. Compatibility budget/refinement tests observed RED then GREEN, full suite 53/53 and TypeScript passed. Idle TAARenderPass converged to data-refinement-samples=32 in the actual browser. Beauty composer uses one final OutputPass, restrained Bloom, motion resets and finite idle invalidations. Composer recreated/disposed on resize/quality to avoid stale accumulation-target dimensions.

Task 4 in progress. First browser batch: narrow reference view and desktop/detail view rendered, no shader errors. Confirmed oversized desktop framing; new reference-specific camera regression test observed RED (crown at NDC y=0.860) then GREEN with reserved header/reflection space. Fixed misleading disabled labels to explicitly name retained DIY settings. No material/lighting artistic rework after this bounded batch.

Final review: fresh read-only reference_render_review verified code and installed upstream render/lifecycle implementations, independently passed 54/54 tests. No Critical/Minor findings. One Important: failed EXR cache not cleared by retry.

Final: fixed EXR retry — real React Suspense/useLoader cache regression observed RED (retry stayed in error), then GREEN after clearing the exact EXRLoader + both URL inputs; suite 55/55. TypeScript caught an optional two-argument test callback, corrected to mirror the real loader boundary; TypeScript and production build then passed.

Final: Ruling: image quality/parity is judged from actual browser captures, not from unit tests or reviewer's code-only assessment — parent inspected desktop/narrow/detail renders — cost: no quantitative pixel parity or physical-optical guarantee.

Final: Ruling: reviewer deferred motion TAA/SSR/SSAO and commercial clearance consistently with scope — keep them explicitly unimplemented/unverified — cost: not a drop-in commercial iJewel equivalent.

Task 4: complete. Actual narrow DOM 300×769, desktop 1230×923 (host captures can clip the virtual viewport). No narrow horizontal overflow; final browser error logs empty. Three metals, view presets, both qualities, compatibility round trip, size/shank changes, three model-mode round trips, rotation on/off and save exercised. Original saved split/white/large restored/saved; no temporary test metal persisted. Canvas reached32 samples after becoming idle. Native JPEG proofs retained under .impeccable/review/2026-10-25/. Temporary viewport reset; extra test tab closed; main preview retained.

No Git-dependent scripts run and no work artifacts removed. Provenance/docs now distinguish research GLB/EXRs from open-source rendering code. Remaining advisories/limits: bundle >500kB, upstream deprecation warnings, no real-phone or long-session GPU/context-loss profiling; no deferred Minor findings from this review.
