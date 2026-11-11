# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed: Vite, React, TypeScript, Three.js, React Three Fiber and drei; no proprietary jewelry SDK.

## Users

A full-stack developer and modeling/product colleagues preparing a commercial DIY jewelry configurator. The customer-facing brand pages and current shopping flow use Chinese copy for Chinese readers.

## Product Purpose

相言 presents silver-tone jewelry and lets visitors start from a real reference design, adjust it in a 3D configurator, and keep a confirmed design in a local demo cart. The app also evaluates readable metal and stone detail, source geometry and asset traceability. Production SKU correspondence, actual orders and commerce systems remain future work.

## Capabilities and Constraints

- The Chinese brand homepage follows the user-supplied jewelry-site HTML prototype. A top navigation select switches between 巴黎极简 (default), 法式浪漫, 意式雕塑 and 建筑黑白; the selection persists in browser storage and is shared by the homepage, all five editors and cart. UI themes do not filter product images or change the silver-tone model material.
- The catalog contains five implemented models: 围钻戒指 (`ring-02`), 花环戒指 (`ring-floral`), 花冠戒指 (`ring-rosette`), 繁花戒指 (`ring-petal`) and 冠冕戒指 (`ring-crown`). The homepage pairs its existing Ring 02 hero with four close-up wearing cards linked to the corresponding new editors, followed by a three-column desktop catalog of all five original model images. Each original design can be added directly to the local demo cart. A visible ring-style select switches between the five editors.
- Ring 02 remains the parametric editor, retaining its head and shank customization, automatic accent placement, local draft, estimate and confirmed configuration snapshot. The four new editors use their own source geometry and preserve each ring's original cut, size, setting and stone layout. They support gem appearance changes only in the regions that actually exist: center/halo for floral and rosette, center/halo/shoulder for petal, and center/shoulder for crown. They do not change setting or pavé geometry.
- The new `SourceRingStudio` editors support per-style local drafts, up to ten undo steps within the current session, restoration and comparison of the original design, camera views, a review dialog and model-specific confirmation into the cart. Engraving is an optional text setting with a position illustration, limited to 16 ASCII characters from letters, digits, spaces and `. & -`; it is saved in the configuration, not rendered as new engraving geometry. The new-model demo estimate is the template base price plus ¥100 for each supported gem region changed from the default diamond appearance.
- The demo cart preserves each confirmed design's model-specific screenshot when available, configuration, gem information and estimate. Direct original purchases or unavailable screenshots use the correctly labeled reference image for that model. It supports configuration details, item removal, a cart count and a reference-price total. Data remains in the current browser; the cart does not charge money or create a real order. Displayed prices and lead times are demonstrations, pending formal confirmation.
- All four supplied OBJ files were read from Downloads and integrated, with source files and metadata retained in `assets/source/`. The earlier protected-WeChat-directory read failure is resolved. Floral, rosette, petal and crown contain 17, 3, 35 and 17 source gemstones respectively. Rosette deliberately retains its one center stone and two accent stones; no extra stones were invented to fill its metal petals. Display normalization preserves source proportions; source units are uncalibrated and are not physical sizing or manufacturing specifications.
- The secondary showroom retains reference rings, the gem library, background choices and image export. The FORME module editor keeps its previously implemented visual system and behavior; this redesign does not add module-editor autosave or change its material defaults.
- Payment, inventory and manufacturing sign-off are outside the demo. Browser viewport emulation is not a phone hardware test. No deployment or manufacturing readiness is claimed.
- All five campaign photographs are labeled as AI wearing illustrations and remain distinct from model views and confirmed configuration snapshots. They preserve close-up framing and were edited after user feedback to reduce the ring-head scale and correct the band direction around the finger. These visual edits do not establish physical scale or exact product geometry. Commercial guarantees, customer reviews and price comparisons from the supplied prototype were not adopted as product facts.

## Evidence on Hand

The current redesign direction is recorded in `docs/prototype-redesign-brief.md`; its source is the user-provided `/Users/limer/Downloads/珠宝品牌官网原型.html`. The implemented theme values and component rules are recorded in `DESIGN.md` and `.impeccable/design.json`. The five campaign image sources and final edit prompts are recorded in `docs/campaign-provenance.md`; project image assets are stored locally under `public/media/campaign/`. Source OBJ metadata, gemstone counts, file hashes and unknown units are recorded in each new ring’s `assets/source/<ring-id>/source.json`. Local screenshots for the homepage, theme variants, editor, cart and small viewport are in `../prototype-refresh/`; they show browser output, not deployment or hardware validation.

Earlier approved implementation plans are in `../docs/superpowers/`. Supplied 3DM gemstones have been converted and checked; provenance is recorded in `assets/atelier-gems-provenance.json`. Blue Nile live-viewer comparison and commercial limitations are documented in `docs/commercial-render-review.md`. Do not fabricate product availability, visual parity or performance claims.

## Accessibility & Inclusion

Named keyboard-accessible controls, visible focus, reduced-motion preference, understandable loading and recovery states. Keep visible Chinese labels, native select behavior and clear text for demo pricing, image provenance and storage errors.
