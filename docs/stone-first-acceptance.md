# Stone-first finished-ring experiment — acceptance checklist

This branch is intended to replace the visually unreliable generated ATELIER v4–v6 demos with **existing finished gemstone + setting assets**. It is not a manufacturing CAD release.

## Model baseline

Use `成品戒指` and compare the same metal / light preset / camera on:
1. **经典光环** — true center stone `CenterDiamond` from the original fitted asset; its prongs, basket, halo and pavé remain from the GLB. Optical appearance presets change IOR / absorption / dispersion only.
2. **枕形光环** — original cushion with fixed prongs and densely arranged shoulder stones. Changing metal / studio look is supported; stone refitting is **not**.
3. **复古椭圆** — original oval and double-halo metal mount. Changing metal / studio look is supported; stone refitting is **not**.

All extracted gem meshes render through `OpticalGem`, metal through `createMetalMaterial`; `JewelryLighting` feeds the same local HDR to gemstones and metal.

## Three required visual gates

### G1 — diamond refraction, facet contrast, fire
- Use Classic Halo, white metal, contrast studio, **high quality**.
- Capture `主石细节`. Rotate 0°, 45°, 90°; verify bright / dark facets **move with the camera** and are not simply painted onto the mesh.
- Compare with a screenshot taken with identical resolution and orientation in the previous release.
- Change the Classic Halo optical preview from diamond to sapphire and back; verify the **center gem only** changes absorption and IOR and the pavé remains neutral.
- Note: this does **not** simulate cut grade, physical gem identification, inventory, diamond certificates or full spectral caustics.

### G2 — white-gold/rose-gold/yellow-gold studio reflection
- Use the same ring, overall view, `柔光商品棚`; cycle all three metals.
- Use `切面特写` for harder highlights. Rotate the ring and inspect whether the highlight stripe moves and reveals its rounded profile.
- Check that the metal retains specular reflections instead of a constant mid-grey plastic appearance.
- Record screenshots with the same camera and exposure; do not claim a result before inspecting real GPU captures.

### G3 — pavé / prong close-up
- On each finished ring, use `密镶特写` and the existing `镶座侧面` camera.
- Check that each diamond is surrounded by the existing metal seat/prongs; gaps must be assessed from the source asset, **not** by counting pixels in a screenshot.
- Zoom in and look for floating prongs, gems intersecting motifs, diamond/metal z-fighting, and missing stone setting anchors.
- Future industrial review must calculate true millimeter girdle clearances, remaining metal wall, and stone-setting manufacturability from CAD using known source units.

## Regression

```bash
npm ci
npm test
npm run build
npm run dev
```

- All 3 original finished ring routes should load.
- Classic Halo has 4 optical appearance previews; other finished ring optical appearance buttons remain disabled to avoid false changes.
- Switching from Sapphire back to Diamond must restore the original appearance, without mutating any shared source geometry.
- `密镶特写` must not change four-view export file count.
- Existing `模组 DIY` tab and its service remain untouched.

## Licensing and production boundary

The WebGi-derived ring assets are included for non-commercial reference only, subject to the provenance and third-party notices in this repository. The optical shader is from the repo's documented open-source setup. This branch does **not** establish production-ready gem dimensions, geometry booleans, or commercial visual parity.

## Follow-up for genuinely editable finished settings

To expose stone-size and setting choice safely, acquire original millimeter-calibrated CAD/BRep per ring, semantic gemstone + seat anchors, shared-prong topology and tolerances. Implement constrained seating, prong/girdle collision checks and offline production validation **before** unlocking arbitrary gemstone resizing or automatic pave density.
