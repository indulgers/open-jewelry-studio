# Third-party notices

## Active complete ring — 2026-10-28

Diamond Shader Lab by Ehsan Moradi, MIT, commit edd718e34c081d3ea0f6c99017b87cf8d022f329.
Source: https://github.com/ehsanwwe/diamond-shader-lab
`public/models/atelier/ring.glb` is copied from `public/models/diamond-ring.glb` (574,312 bytes; SHA-256 1272ad9599e19cdfc3bea7d57abbe96e94ee86668833283291dc5bf7ec12b69e).
Full notice: public/licenses/diamond-shader-lab-MIT.txt. Runtime replaces materials, centers the assembly, and substitutes the user-supplied round center stone while preserving halo and shoulder stones. The model is procedurally authored in the source repository; its HDR files and shader were not copied.

The 19 gemstones in `public/models/atelier/gems/` were converted from the user's 宝石.zip using rhino3dm 8.35.0. They retain original mesh geometry and facet normal splits, rotated from Rhino Z-up to glTF Y-up. They are user-provided assets, not represented as public-domain stock. Original units are unspecified. Source inventory and geometry hashes: assets/atelier-gems-provenance.json.

Current metal and gemstone environments are original generated neutral light-card textures in `studioLighting.ts`, with local studio presets. No iJewel environment or SDK is loaded by the default scene.

The local optical tracer retains drei's MIT vertex/BVH foundation, with independently implemented Fresnel energy splitting and approximate static mount intersection. The reference `ektogamat/webgi-jewelry` is CC BY-NC-ND 4.0 and depends on a proprietary WebGi SDK; it was studied only, with no assets or SDK copied.

## Procedural DIY gemstone

Math Diamond from Diamond Shader Lab by Ehsan Moradi, MIT.
Source: https://github.com/ehsanwwe/diamond-shader-lab
Full copyright and license: LICENSES/diamond-shader-lab-MIT.txt.
Original math-diamond.gltf and math-diamond.bin are retained in assets/source/gem.
Packed into self-contained GLB, mesh/node renamed; original 252 triangles and flat facet normals retained. Runtime refraction material replaces the original material.

## Archived six-prong model and lighting — research assets, not active

User-supplied `file 1792852545908.glb.glb`, copied read-only to public/models/reference/six-prong.glb.
SHA-256: 5d9267d36298bc9c21b58f6d86e600ffa91aabebf78fbb092884d11232027514.
Its metadata points to https://playground.ijewel3d.com/sample-models/ring-6-prong.glb (a provenance clue, not a verified identical original).

The GLB explicitly references these lighting resources, now served locally:
- public/environments/reference/gem.exr — https://packs.ijewel3d.com/files/env_gem_002_30251392af.exr
  SHA-256: 09935dd42436ca2dcfdb233f6bf9bdf1ceb5cdc65aeed0e5cca96c0c5e48e4f6.
- public/environments/reference/metal.exr — https://packs.ijewel3d.com/files/env_metal_054_65b37abc28.exr
  SHA-256: 7a9056e8b158f57329aeeece1da19cefaf95fcedb861b69a5bae084c2ee63f2b.

Commercial redistribution/use rights for the reference model and EXRs have NOT been established. They are included in this local demo for the user's requested rendering research, not represented as open-licensed assets. Do not publish these binaries as a cleared commercial asset pack. No iJewel SDK or proprietary WebGi shader implementation is included.

## Original geometry and archived generated lighting

The procedural six-petal setting, rounded prong tips, capped sweeps and shank refinements are original project geometry. Original neutral softboxes are the active lighting for the P0–P4 sample.

## Optical material and mirror floor

The local gemstone material adapts drei MeshRefractionMaterial's MIT vertex/BVH technique by N8Programs; fragment tracing/surface-environment reflection and path-length attenuation are implemented locally.
Source: https://github.com/pmndrs/drei/blob/master/src/materials/MeshRefractionMaterial.tsx
MIT notice: LICENSES/drei-MIT.txt. BVH implementation is imported from three-mesh-bvh (MIT).
The planar floor uses Three.js Reflector with a local ground fragment shader. Three.js is MIT.

Draco glTF decoders copied from the installed Three.js examples to public/draco are Google Draco, Apache-2.0. Decoder source notices are preserved. Source: https://github.com/google/draco.

## Archived lighting (not currently used)

Peppermint Powerplant 2 by Andreas Mischok / Poly Haven, CC0.
Source: https://polyhaven.com/a/peppermint_powerplant_2
License: https://polyhaven.com/license
Local 1K HDR: public/environments/peppermint_powerplant_2_1k.hdr. No runtime remote dependency.
Acquisition/hash record: assets/environment-provenance.json.

## Rendering reference

Diamond Ring by Paul Henschel, in the Poimandres examples repository, MIT.
Source: https://github.com/pmndrs/examples/tree/main/examples/diamond-ring
License: https://github.com/pmndrs/examples/blob/main/LICENSE
Notice retained in LICENSES/pmndrs-examples-MIT.txt.
We adapted the environment/refraction/soft-shadow/bloom approach, not its ring GLB.
The reference model's independent provenance was not established and that file is not included here.

The local contact-shadow capture/blur implementation is based on drei's ContactShadows technique.
Source: https://github.com/pmndrs/drei/blob/master/src/core/ContactShadows.tsx
Its render targets, geometries and materials have explicit local disposal, and renderer state is restored in a finally block.
MIT copyright/license notice retained in LICENSES/drei-MIT.txt. Blur shaders are imported from the installed three-stdlib dependency.

## Archived lighting (not currently used)

Studio Small 09 by Sergej Majboroda / Poly Haven, CC0.
Source: https://polyhaven.com/a/studio_small_09
License: https://polyhaven.com/license
Local 1K HDR: public/environments/studio_small_09_1k.hdr. No runtime remote dependency.

## Archived prototype gemstone (not shipped in the viewer)

“Diamant 20220723.stl” by PantheraLeo1359531, Wikimedia Commons, CC0 1.0.
Source: https://commons.wikimedia.org/wiki/File:Diamant_20220723.stl
License: https://creativecommons.org/publicdomain/zero/1.0/

Converted STL → GLB, rotated/centered, flat normals regenerated. Runtime materials are our own. The original is a simplified six-sided faceted gem, not a commercially certified diamond cut. No attribution is required under CC0; we retain it for provenance.

## Code dependencies

React / React DOM, Three.js, React Three Fiber, drei, three-mesh-bvh, @react-three/postprocessing, postprocessing, Vite, Vitest and testing tools retain their respective licenses in node_modules and the lockfile. glTF Transform Core is MIT; TypeScript is Apache-2.0. No iJewel3D SDK or proprietary WebGi jewelry plugin is included. All runtime model/environment/decoder requests are local; this does not imply the reference binaries have an open commercial license.
