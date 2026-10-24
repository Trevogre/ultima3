import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { TileMapScene } from '../src/ui/tileMapScene.ts';
import { ModelRig } from '../src/ui/modelRigs.ts';
import { MODEL_SETS } from '../src/ui/modelSets.ts';
import { DEFAULT_3D_SETTINGS } from '../src/ui/view3DSettings.ts';
import { Shape } from '../src/game/tiles.ts';
import { terrainElevation } from '../src/ui/terrainDepth.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

afterEach(() => vi.unstubAllGlobals());
describe('whirlpool water surface', () => {
  it('depth-tests sprite whirlpools below adjacent land without changing legacy hit overlays', () => {
    const ctx = new Proxy(
      { createRadialGradient: () => ({ addColorStop() {} }), getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4) }) },
      { get: (obj, key) => (Reflect.get(obj, key) as unknown) ?? (() => {}) },
    );
    vi.stubGlobal('document', { createElement: () => ({ width: 64, height: 64, getContext: () => ctx }) });
    const scene = new TileMapScene(16, 2, () => {});
    const gfx = { drawShape() {} } as unknown as GraphicsSet;
    const cells = [
      { base: Shape.Water, overlay: Shape.Whirlpool },
      { base: Shape.Grass },
      { base: Shape.Water },
      { base: Shape.Mountains },
    ];
    const effects = (scene as unknown as { groundEffects: Mesh[] }).groundEffects;
    try {
      for (const recessedWater of [true, false]) {
        scene.setOptions({ ...DEFAULT_3D_SETTINGS, recessedWater, buildings: false });
        scene.setGroundEffectsDepthTest(false);
        scene.setLandscape(null, gfx, cells);
        expect((effects[0].material as MeshBasicMaterial).depthTest).toBe(true);
        expect((effects[0].material as MeshBasicMaterial).depthWrite).toBe(false);
        expect(effects[0].position.z).toBeCloseTo(terrainElevation(Shape.Water, recessedWater) + 0.003);
        expect((effects[1].material as MeshBasicMaterial).depthTest).toBe(false);
      }
      scene.setLandscape(
        null,
        gfx,
        cells.map((c) => ({ base: c.base })),
      );
      expect((effects[0].material as MeshBasicMaterial).depthTest).toBe(false);
    } finally {
      scene.dispose();
    }
  });
  it('keeps both model whirlpools flat while rotating, without boat-like bobbing or pitch', () => {
    const material = new MeshLambertMaterial();
    for (const set of MODEL_SETS) {
      const rig = new ModelRig(Shape.Whirlpool, set, material);
      for (const time of [0, 0.3, 1, 2, 5]) {
        rig.pose(time, 'idle', 1, 0.7);
        expect(rig.torso.position.z).toBe(0);
        expect(rig.torso.rotation.x).toBe(0);
        expect(rig.torso.rotation.z).toBe(time * 0.5);
      }
      rig.dispose();
    }
    material.dispose();
  });
});
