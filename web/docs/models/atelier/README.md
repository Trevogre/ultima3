# Atelier ranger and composed-world study

This is a **work-in-progress review milestone**, not the completed replacement
for the game's current Van Gogh model set. The character study is not yet used by the game. The new environment library is
available in Models through the opt-in **Layout: Composed** setting; Tiled remains
the default. The Low-poly choice uses faceted, lighter vegetation; Van Gogh uses the fuller
smooth meshes. Existing figures/buildings still use their prior model-set assets.

## Review

Run the normal Vite server and open
`http://127.0.0.1:5173/tools/preview-atelier-ranger.html`.

The viewer loads the actual exported GLB through Three.js, with continuous
Idle / Walk / Attack / Cast / Hit clips. Drag to orbit, wheel to zoom, WASD to
walk, or select a clip. Character view and Whole map switch framing. Tiled /
Composed compares independent tile heights with shared shoreline corner samples.
The scene uses the original 64×64 Sosaria layout. It is an isolated authoring
viewer: no game saves, discovery state or preferences are written.

The review now renders the authored environment library through the same composed
scene used by the game. Its buildings are still omitted: this is a coastal
character/environment study, not a complete game view. The whole map contains
stable scenery placements with camera culling and distant tree/brush meshes.

## Character source and evidence

- `web/tools/models/build_atelier_ranger.py`: locally authored, reproducible
  Blender mesh, vertex paint, 18-joint skeleton and five animation actions.
  `ROOT` names the intended export workspace. It preserves unrelated scenes,
  rebuilds only its named study, and exports selected objects from that scene.
- `ranger-study.blend`: editable source including review camera and lighting.
- `web/public/models/atelier/ranger.glb`: self-contained game-format export,
  one skinned mesh, 13,955 triangles, 18 joints, 7,124 weighted vertices.
- `glb-inspection.json`: exported-byte hash, dimensions, clip durations and
  structural validation. Regenerate with
  `node --import ./tools/node-ts.mjs tools/models/inspect-glb.ts` from `web/`.
- `web/src/ui/skinnedModel.ts`: animation adapter using cloned glTF skeletons,
  crossfades, individual materials, ground alignment and explicit resource cleanup.
- `web/tests/skinnedModel.test.ts`: loads the actual GLB, verifies all five clips,
  dimensions, independent skeletons and joint deformation through action states.

Blender multi-angle and animation-strip review identified and corrected a backward
cast reach and the walk knee-flex direction. Browser review confirms actual GPU
import, shading and clip playback. These checks establish a working rig/export
pipeline; they do not establish final art quality. Attack is an unarmed motion;
weapon handling and convincing foot planting still require work.

## Composed environment in the game

`web/src/game/worldComposition.ts` supplies stable plans for all visible/known
cells, same-terrain connected regions, forest interior/edge density, shoreline
reeds, varied placement transforms and per-coordinate overrides. One shared
corner-height grid keeps adjacent natural ground surfaces connected. Structural
tiles keep solid, unlettered foundations, including below the waterline; animated
lava retains its existing material. Flat-water mode keeps dry land flat and
masks water to its own cells. Procedural paint, wind and waves repeat their phase
across the wrapping map seam. Wrapping maps have
matching corner samples and connected regions across the seam.

Use Pause / Settings → 3D Settings → Style: 3D models → Layout: Composed.
Turn Distant land off to retain the original local footprint. Layout is remembered,
including across presentation changes. Tiled restores the prior model scenery.

The library has 23 authored plant/rock meshes and 10 distant meshes, exported as
`environment.glb`; `environment-study.blend` is the editable source. The runtime
uses actual geometry with vertex-painted colour, not sprite cards. Plants sway,
rocks stay fixed, and water receives shadows from figures and scenery. Ground
samples, plants and actor feet share the same height interpolation.

`web/tools/models/inspect-environment.ts` inspects the exported bytes with the
runtime loader, records hashes/bounds/budgets, and rejects missing variants or
external dependencies. `environment-inspection.json` records the current result.
Both GLBs, the optional loader chunk and the override JSON are included in the
production offline cache. The library loads only when Composed is selected.

`web/public/data/world-layouts.json` is the version-1 presentation addon. Its maps
are keyed by map ID, then original `x,y` cell coordinate. Values may contain
`variant` (0..4 for tree/brush/grass/rock, 0..2 for reeds), `density` (0..2),
and `rotation` (radians). For example, a cell can use a single preferred tree
variant while retaining stable placement positions. It cannot change terrain,
movement, discovery or load arbitrary assets.

Unknown cells generate no placement and imply no water or shore. Runtime use
must pass `buildLandscape`'s visibility-filtered shapes and preserve the continuous
sight mask. The review viewer intentionally reads the full original map for
**offline authoring only**; it is not a runtime fog-of-war implementation.

## Remaining goal work

- Raise the character's material and silhouette quality through further visual
  review; improve walk foot contact, attack/weapon handling and transitions.
- Continue visual refinement of the authored vegetation/rock library and create
  substantial new building assets; the existing buildings are still in use.
- Refine the composed ground, water and shore materials and mountain-ridge
  composition through further scene review.
- Integrate the asset loader with the actual game motion/action pipeline.
- Verify a polished playable coastal scene in the actual game before expanding
  replacement coverage to the rest of its characters and terrain.

NPC identity/voice work is separate: `web/docs/npc-audio/README.txt` documents the
committed catalog/editor and the recording-job queue. No recording provider is
connected, so no generated voices are claimed.
