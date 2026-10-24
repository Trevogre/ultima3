# Atelier ranger and composed-world study

This is a **work-in-progress review milestone**, not the completed replacement
for the game's current Van Gogh model set. Production model selection is unchanged.

## Review

Run the normal Vite server and open
`http://127.0.0.1:5173/tools/preview-atelier-ranger.html`.

The viewer loads the actual exported GLB through Three.js, with continuous
Idle / Walk / Attack / Cast / Hit clips. Drag to orbit, wheel to zoom, WASD to
walk, or select a clip. Character view and Whole map switch framing. Tiled /
Composed compares independent tile heights with shared shoreline corner samples.
The scene uses the original 64×64 Sosaria layout. It is an isolated authoring
viewer: no game saves, discovery state or preferences are written.

The terrain is scaffolding. The 8,880 planned placements currently appear in the
plan data only; this scene does not pretend they are a finished asset library.

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

## Whole-map composition foundation

`web/src/game/worldComposition.ts` supplies stable plans for all visible/known
cells, same-terrain connected regions, forest interior/edge density, shoreline
reeds, varied placement transforms and per-coordinate overrides. One shared
corner-height grid keeps adjacent ground surfaces connected. Wrapping maps have
matching corner samples and connected regions across the seam.

Unknown cells generate no placement and imply no water or shore. Runtime use
must pass `buildLandscape`'s visibility-filtered shapes and preserve the continuous
sight mask. The review viewer intentionally reads the full original map for
**offline authoring only**; it is not a runtime fog-of-war implementation.

## Remaining goal work

- Raise the character's material and silhouette quality through further visual
  review; improve walk foot contact, attack/weapon handling and transitions.
- Author several distinct trees, brush, rocks, grass and buildings; animate
  vegetation without recycling the rejected rounded primitive models.
- Develop painterly ground, water and shoreline surfaces that work together.
- Render the planned placements with batching/LOD and authored override files.
- Integrate the asset loader with the actual game motion/action pipeline.
- Add remembered World layout: Tiled / Composed in Models settings and reuse
  existing map-extension controls. Keep tile types, movement and discovery intact.
- Verify a polished playable coastal scene in the actual game before expanding
  replacement coverage to the rest of its characters and terrain.

NPC identity/voice work is separate: `web/docs/npc-audio/README.txt` documents the
committed catalog/editor and the recording-job queue. No recording provider is
connected, so no generated voices are claimed.
