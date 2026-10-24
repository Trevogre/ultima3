# 3D asset generation and RTX 5090 handoff

Saved 2026-10-24. This document preserves the project direction and the proposed
local generation setup so development can continue on another machine without
access to the original chat. It is a plan, not a receipt for a working Hunyuan
installation or an approved asset library.

## What the user wants

Create a substantial, attractive, animated 3D presentation of Ultima III, inspired
by the generated Van Gogh artwork. The user explicitly rejected the current
simple figures, primitive meshes, and painted/rounded variations of the low-poly
set as inadequate. More polygons, a different colour palette, or another shader
does not by itself meet the request. The requested bar is the quality of strong
Tripo-style generated assets, followed by deliberate cleanup and visual review.

The character models need readable anatomy, faces, hands, clothing, equipment,
and silhouettes from all sides. They must have directionality and skeleton-based
animation, rather than rotating sprite cards or two-frame sprite-like motion.
Target states include idle, walk, attack, cast, and hit, with room for further
states and convincing transitions. Character classes and NPCs must retain their
identities; do not replace every humanoid with the same ranger.

Build the style around a coherent asset library: several trees, brush clusters,
rocks, buildings, props, and ground details. Make shores and terrain read as a
connected landscape. Overworld water represents an ocean, not separate square
paintings or shallow decorative pools.

Establish quality with one playable coastal scene and one strong animated
character before expanding across all game assets. Technical tests passing is
not evidence that the art meets the requested quality.

## Important corrections from the user

- **The in-game scale was right. The ranger authoring preview was wrong.** Do
  not globally shrink game figures/trees/grass or stretch game mountains to fix
  that preview. Treat the playable renderer as the scale reference.
- The current geography scale and ocean adjustments in
  `web/tools/models/world-preview.ts` apply only to the isolated ranger preview.
  They are not approved new in-game scale rules. Its small figure, vegetation
  ratios, mountain proportions, and camera distance remain authoring choices.
- **Composed is a third 3D set, not a separate Layout option.** F7 cycles
  Low-poly → Van Gogh → Composed. The same choices appear in the 3D set menu.
  Old saved `worldLayout: Composed` preferences migrate to `modelSet: Composed`.
- Keep Low-poly, the existing Van Gogh model presentation, Classic, sprite/card
  modes, and F6 tile-set selection available. Original sprite files and gameplay
  data must remain unchanged.
- F6 leaves model mode and cycles the sprite tile set. Preserve the camera and
  selected 3D set so F7 can return to it; F6 must not enable 3D from Classic.
- Do not silently switch back to paid generation or subscribe to a small monthly
  allowance. The user rejected the economics of a $20 plan with 25 standard and
  8 high-quality generations and wants inexpensive repeated local iteration.

## Current repository state

The Composed set is selectable and functional, but its artwork is a prototype
and **has not met the requested quality bar**. Most careers, NPCs, creatures, and
buildings still use the older model assets. The ranger has an 18-joint skeleton
and five clips, but foot planting, weapon handling, anatomy/material polish, and
animation quality need further work. Do not describe this as a finished painterly
model replacement.

Useful files (paths below are repository-relative):

| File                                        | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `web/docs/models/atelier/README.md`         | Existing model studies, asset evidence, limitations             |
| `web/src/ui/modelSets.ts`                   | Independent F7 model-set registry and descriptions              |
| `web/src/ui/modelAssetSets.ts`              | Geometry/actor factories and existing fallbacks                 |
| `web/src/ui/modelScene.ts`                  | Visibility-admitted figures, motion, lighting, composed scenery |
| `web/src/ui/atelierCharacters.ts`           | Lazy GLB loader; currently only ranger class/party marker       |
| `web/src/ui/skinnedModel.ts`                | glTF skeleton cloning, mixer, clips, tints, disposal            |
| `web/src/ui/modelAnimation.ts`              | Presentation motion/action clock; does not change game rules    |
| `web/src/ui/atelierEnvironment.ts`          | Environment GLB loader and required mesh names                  |
| `web/src/ui/composedWorldScene.ts`          | Shared ground/water, instanced scenery, culling, wind and LOD   |
| `web/src/game/worldComposition.ts`          | Deterministic neighbour-aware map composition                   |
| `web/src/game/worldCompositionOverrides.ts` | Restricted presentation override parsing                        |
| `web/public/data/world-layouts.json`        | Editable version-1 per-map/per-cell overrides; currently empty  |
| `web/public/models/atelier/`                | Current self-contained ranger/environment GLBs                  |
| `web/docs/models/atelier/`                  | Editable Blender studies and inspection reports                 |
| `web/tools/models/`                         | Blender source scripts and GLB inspection tools                 |
| `web/tools/preview-atelier-ranger.html`     | Full raw-map authoring scene; preview-only scale/ocean          |
| `web/tools/preview-presentations.html`      | Real map renderer with model-set and hero selection             |
| `web/docs/continuous-sight.md`              | Shared continuous town visibility clipping                      |

The existing Blender source scripts contain a Mac-specific absolute `ROOT` path.
Make output paths portable or configure them for the new checkout before running
them on the PC. Do not accidentally export over assets from an unrelated scene.

Relevant history, which must be synced to the other machine along with this plan:

- `cf0a4ba`: rigged ranger study and animation adapter.
- `bd8f850`: authored environment library and Blender source.
- `78bea2e`: shared composed scenery and shoreline renderer.
- `bb116dd`: third Composed set, preference migration, live skinned ranger.
- `a61582d`: ranger preview scale/ocean correction, isolated from the game.

The last verified baseline had 560 passing tests across 78 files, lint and
formatting passing, and a successful production build. Re-run checks on the new
machine; this is a historical checkpoint, not a guarantee about future changes.

## Hardware assessment and missing facts

The Mac was checked directly: MacBook Pro, M3 Max, 14-core CPU, 30-core GPU,
36 GB unified memory, approximately 59 GiB free storage at inspection. PyTorch
was present and an actual Metal/MPS tensor calculation succeeded outside the
restricted execution sandbox. An initial sandbox-only probe incorrectly showed
MPS unavailable; do not confuse sandbox GPU restrictions with hardware support.
The full Hunyuan pipeline has not been installed or benchmarked on this Mac.

The user reports an **RTX 5090 in their PC**. The standard card specification is
32 GB VRAM. The PC's OS, system RAM, free disk, GPU driver, installed CUDA tools,
and actual available GPU memory have **not** been inspected. No PC connection or
local generation server has been established.

Hunyuan3D 2.1 is the initial candidate, not a proven final provider. Its upstream
documentation lists approximately 10 GB VRAM for shape generation, 21 GB for
texturing, and 29 GB combined. A 32 GB card is a plausible fit, but has limited
headroom at those settings. Begin with one job at a time and use staged loading
or offload if necessary. Check the complete textured path, not only a small
geometry-only test.

Prefer the 5090 for the first serious quality/iteration test. The Mac is a
possible experimental MPS path, but working Metal tensors do not establish that
the CUDA-based rasterizers and full texture pipeline will run unchanged.

Before choosing installation commands, establish:

1. Windows or Linux, OS version, system RAM, free storage, driver and `nvidia-smi`.
2. A suitable isolated environment and GPU-compatible Python/PyTorch/CUDA stack.
3. Available disk space for weights, caches, generated meshes and textures.
   Reserving roughly 100 GB of working room is a planning allowance, not an
   upstream minimum. Likewise, 64 GB system RAM would be useful headroom, not a
   measured requirement for this particular PC.
4. A successful real CUDA operation and Hunyuan custom-extension smoke test.
   The old upstream PyTorch 2.5.1/CUDA 12.4 instructions must not be copied blindly
   onto a Blackwell GPU. Select and test a Blackwell-compatible stack; verify
   compiled extensions as well as PyTorch detecting the card.

Do not promise generation times, memory fit, or Tripo-equivalent quality before
measuring them. Local generation avoids per-call cloud billing, but still uses
compute, storage and electricity. Review the exact selected weights/code license
before distributing resulting game assets; do not assume all components share
the repository's asset license.

## How to connect local generation

Two supported development arrangements are acceptable:

**Everything on the PC:** sync this repository, open the project in the coding
agent there, install/configure Blender and the local generation worker there,
and use loopback connections. This avoids cross-machine file transfer initially.
Windows versus Linux/WSL2 must be established before choosing a build route.

**Mac development with a PC worker:** keep the repository/game/Blender on the Mac,
run Hunyuan on the 5090 PC, and reach its loopback API through an SSH tunnel or
another explicitly configured private connection. Sync each completed model and
its metadata back to the asset workspace before importing it. The PC needs a
working authorized remote connection first; it is not currently accessible.

The already-connected MCP for Blender supports **Tencent Hunyuan 3D → Local API**.
Its documented default URL is `http://localhost:8081`. This local mode does not
require MCP Premium or Tencent Cloud credentials. With a tunnel, that URL can
point to the PC worker while Blender remains on the Mac.

Set up the worker first, then enable the integration and configure its local
URL. Confirm provider status and that requests reach the local worker, not a
paid Official API or Premium backend. A direct CLI/API adapter is also acceptable
if it gives better job handling; another MCP server is not inherently required.

Before enabling unattended generation:

- Inspect the installed addon request schema and the selected server's actual
  endpoints. Hunyuan 2.0/2.1 examples and different addons are not automatically
  interchangeable. Test health, submission, status, error handling and GLB import.
- Use an isolated environment, a dedicated output/cache directory, loopback
  binding and concurrency one initially. The upstream API example's broader
  binding/concurrency defaults are not the intended starting configuration.
- Check for an existing live worker/job before restarting or resubmitting.
  Preserve job handles and avoid treating a polling timeout as a stopped job.
- Keep weights/caches outside Git. Keep credentials and machine-specific remote
  details outside committed source. Never bake the worker URL into the game.

## First quality and performance benchmark

Use **one ranger and one tree**, generated from strong, reviewed reference
images. These tests are for image-to-3D quality, not another primitive-model
approximation. Start with a clear full-body character reference suitable for
rigging, with visible separated limbs and readable clothing/equipment. A tree
reference should establish the complete trunk and canopy silhouette.

For each attempt, retain the reference image, input hash, seed, model/weights
revision, generation parameters, raw output, and a small machine-readable result
record. Record wall time separately for geometry and textures, peak VRAM,
triangle count, texture dimensions, failures and any manual repairs. Preserve
the raw output; normalize/export a separate candidate rather than overwriting it.

Review front, back, side and three-quarter views in Blender and the actual game
renderer. Inspect hands/face/feet, detached or fused parts, backside completeness,
texture seams, baked-in shadows and painterly consistency. Repeat several seeds
to measure whether the output is reliably useful enough for iteration. A single
flattering render is insufficient.

If the generated character clears the geometry/material bar, prepare usable
topology, UVs, a skeleton and skin weights, then implement and inspect all five
animation states. Hunyuan shape/texturing does not by itself prove rigging or
animation is done. Judge walk contact, deformation, attack/weapon handling,
transitions and directionality at the actual gameplay scale.

Benchmark results should drive the next decision: keep Hunyuan locally, adjust
its settings, or compare another local generator. Do not claim equivalence to a
current commercial Tripo model without an actual comparison. If the art remains
poor, report that directly rather than relabeling the prototype as finished.

## Whole-map composition requirements

Use the original 64×64 terrain layout as the underlying game authority. Produce
stable, neighbour-aware arrangements: forest edges/interiors, mountain ridges,
coastlines, brush patches and varied ground detail. Reuse a carefully made asset
library in varied arrangements, rather than loading 4,096 unrelated models or
repeating one identical tree/grass tile everywhere. Allow editable location
overrides and retain each cell's original terrain identity.

Existing composition uses map ID and original coordinates for stable variation,
shared ground corners, instancing, distance detail and camera culling. Extend
that foundation where useful; do not discard gameplay rules to make a prettier
static scene. `world-layouts.json` supports per-map `x,y` variant, density and
rotation overrides. Sosaria is map 420; Ambrosia is 421.

The authoring viewer may inspect the full original map. **Runtime composition
must consume visibility-filtered terrain**, preserve discovery/fog of war and
continuous town sight clipping across terrain, models, effects and shadows.
Unknown terrain must not generate revealing trees, mountains, shore or lights.
Opening doors must still update sight. Model loading must not resurrect hidden
NPCs or change movement, collision, dungeon entry, combat or saves.

Generated replacements must load offline as reviewed, self-contained game assets.
Scale, grounding, axes, material setup, animation names, disposal, LOD and budgets
must be checked in the actual renderer. Preserve existing fallback presentation
on a failed asset load, and make replacement coverage explicit.

## Verify and resume

From a synced checkout, use the repository's current Node requirements and run:

```sh
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

Useful save-free checks on the dev server:

- `/tools/preview-presentations.html`: live renderer, Composed set, hero/actions.
- `/tools/preview-atelier-ranger.html`: isolated full-map/character authoring view.
- `/?at=place:yew&peek&tiles=VanGogh`: playable Yew; F7 chooses model set.
  `peek` avoids writes to game saves and preferences.
- `/tools/preview-town-sight.html`: visibility and door boundary checks.

After integration changes, run the relevant model/visibility tests, then the
required broader checks:

```sh
npm test
npm run lint
npm run format:check
npm run build
```

The first resumed task is **PC hardware/software audit → isolated local worker →
real textured generation benchmark → visual review**. Do not start by producing
more scripted primitive art or expanding the placeholder asset coverage.

Suggested prompt for the next coding session:

> Read `web/docs/models/5090-HANDOFF.md` and inspect the current repository before
> continuing. Set up and benchmark local Hunyuan generation on the RTX 5090, using
> a Blackwell-compatible environment. Establish one high-quality ranger and tree
> before expanding the library. Preserve in-game scale and the existing sets;
> Composed is the third F7 model set. The current art is a rejected-quality
> prototype, not the target. Do not use paid generation without explicit approval.
> Record source inputs, settings, costs/time and visual evidence so iteration is
> reproducible. Ask for PC details/connection only where they cannot be inspected.

## Parallel voice work to preserve

The broader request also included per-NPC identity/voice preparation. The catalog,
voice assignment editor and static recording-job queue are already implemented;
see `web/docs/npc-audio/README.txt`. Placed NPC identities must remain unique,
including individual guards. No voice-generation provider is configured and no
generated recordings are claimed. Preserve that preparation; future generation
and recorded playback remain work to wire up separately. Do not invent gender
or replace the original dialogue/game facts to make an audio demo.

## Sources checked during hardware assessment

These are reference links, not pinned installation instructions. Recheck current
versions and inspect code before installation:

- [Hunyuan3D 2.1 source and requirements](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)
- [Hunyuan3D API server](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/api_server.py)
- [MCP for Blender local Hunyuan API setup](https://www.mcp-for-blender.com/docs/integrations/hunyuan3d)
- [PyTorch Blackwell/CUDA 12.8 support background](https://pytorch.org/blog/pytorch-2-7/)
- [RTX 5090 hardware specifications](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/)
