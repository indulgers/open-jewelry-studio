# Reference ring rendering implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline, with test-first changes and one fresh final review.

**Goal:** Render the supplied six-prong GLB using separate real metal/gem EXRs, a planar reflective floor, improved open gemstone optics, and idle accumulation without losing the procedural configurator.

**Execution status:** Completed; current verification is 55/55 tests, TypeScript and production build passed. Detailed per-task evidence and scope rulings are in `2026-10-25-reference-ring-progress.md`. Checkboxes below retain the original step-level brief; this status and the ledger are authoritative for resuming work.

**Architecture:** Keep a reference preview and procedural DIY as explicitly separate modes. Bake source world matrices into owned geometries, preserve the reference assembly, and swap only its metal material. Share local dual EXRs, custom BVH optical material, a Three.js Reflector floor, and a demand-driven HDR postprocessing pipeline between modes.

**Tech Stack:** Existing React, R3F, Three.js, drei, three-mesh-bvh; no commercial SDK or new dependencies.

**Spec:** The user-approved four-step implementation direction in chat; factual input in ../../../../research/2026-10-25-user-glb-and-rendering-findings.md.

## Global constraints

- Preserve original GLB read-only; no third-party uploads, deployment, or publication.
- Keep the existing two procedural shanks, three sizes/metals, saved configuration, quality, rotation, camera shortcuts, and compatibility mode.
- Reference geometry is fixed: disable shank/size choices in reference mode and explain how to return to DIY. Do not imply manufacturing-grade dimensional editing.
- Use only locally served binaries, including Draco decoder; distinguish unverified reference-asset licensing from MIT dependencies.
- This folder has no Git repository. Work in place; no Git init, branch/worktree, commits, or Git-dependent ledger scripts. Keep this plan and progress record.
- Refine incumbent UI; do not redesign layout or brand. Source-model mode starts as reference; saved DIY options remain untouched.

## Review focus

- GLB world transforms and source ownership: geometry must retain assembly alignment and repeated mounts must not mutate cache objects.
- Reference/DIY switching: disabled controls must not silently alter saved settings; loading/error/retry paths must reset readiness.
- Mirrored/jittered camera: gemstone uniforms must use the actual camera and render-target dimensions per draw, not only the main R3F camera.
- Demand rendering: camera/material/mode/size changes reset accumulation; stationary previews stop invalidating after convergence.
- GPU lifetimes: custom BVH textures, floor targets/geometries/materials, accumulation targets, effects, and loaded-asset cache ownership remain explicit.

## Task 1: Real reference model and dual EXRs

Files: src/assets/referenceManifest.ts; src/geometry/referenceRing.ts + test; src/viewer/ReferenceRing.tsx; JewelryLighting.tsx; App.tsx; Configurator.tsx + tests; public/models and environments/draco.

- [ ] Write tests for nonidentity ancestor transforms, separate gemstone classification, immutable source geometries, rejected missing/invalid meshes, and reference-mode disabled structural controls.
- [ ] Run tests and observe missing-feature failures.
- [ ] Copy binary inputs to new local asset names; preserve source. Include local Draco decoder files. Implement owned world-space geometry preparation, reference renderer, explicit model mode and real EXR lighting.
- [ ] Run full test suite and typecheck; record results in progress ledger.

## Task 2: Open optical material and planar floor

Files: src/viewer/gemOptics.ts + test; OpticalGem.tsx; GemAsset.tsx; planarFloor.ts + test; JewelryFloor.tsx; JewelryStage.tsx; contactShadowResources.ts + tests; quality.ts.

- [ ] Test Beer–Lambert attenuation zero/positive path, IOR Fresnel boundary, actual draw-camera uniforms/target dimensions, floor reflection lifecycle and exclusion from shadow captures.
- [ ] Observe failures before implementation.
- [ ] Adapt installed MIT drei material via a subclass; trace internal BVH rays, sample true environment reflection at the surface, apply optional path absorption. No white Fresnel boost. Update camera/resolution in mesh onBeforeRender for every draw.
- [ ] Use Three Reflector with a neutral ground shader, slight filtered reflection and distance fade. Own/release its target, geometry and material, and exclude it from override-material shadow passes. Disable floor in compatibility mode.
- [ ] Full test suite/typecheck.

## Task 3: Idle refinement and integration

Files: src/viewer/progressiveState.ts + test; JewelryPostprocessing.tsx; cameraViews.ts + tests; quality.ts + tests; JewelryStage.tsx.

- [ ] Test reset on movement/content changes, finite convergence, compatibility bypass and a lower standard rendering budget.
- [ ] Observe failures, then implement a Three.js HDR composer with TAARenderPass idle accumulation (32 jitter samples), restrained Bloom and one OutputPass. Moving camera uses nonaccumulating rendering; reset on configuration/mode/quality/resize and camera movement.
- [ ] Keep existing contact shadows; do not add uncalibrated SSR or SSAO in the same integration. Document as deferred rather than claim parity. This is idle accumulation, not motion-reprojected TAA.
- [ ] Run tests/build and asset inspection.

## Task 4: Verify visual/interaction paths and review

Files: AssetCredits.tsx; README.md; THIRD_PARTY_NOTICES.md; docs test report; this plan + progress ledger.

- [ ] Desktop/mobile batched inspection through provided browser tooling: reference/DIY, metals, detail views, quality, compatibility, save/restore and repeated mode toggles. Capture screenshots and console errors. If browser cannot render, report that limitation without claiming visual success.
- [ ] One bounded fix batch for confirmed defects, with regression tests.
- [ ] Fresh read-only review per executing-plans; fix Important/Critical with RED→GREEN, full suite/build.
- [ ] Update source/provenance and implementation limits. Keep artifacts because no Git history exists.
