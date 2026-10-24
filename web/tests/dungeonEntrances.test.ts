import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { Shape } from '../src/game/tiles.ts';
import { dungeonFaces, inferDungeonFace, DUNGEON_FACE_OVERRIDES, MOUNTAIN_SIDES } from '../src/ui/dungeonEntrances.ts';
import { TileMapScene } from '../src/ui/tileMapScene.ts';
import { DEFAULT_3D_SETTINGS } from '../src/ui/view3DSettings.ts';
import { DungeonEntranceFaces } from '../src/ui/dungeonEntranceFaces.ts';
import { newWorld } from './helpers.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

afterEach(() => vi.unstubAllGlobals());
describe('mountain-mounted dungeon entrances', () => {
  it('prefers an adjacent mountain with a straight open approach and allows an authored alternative', () => {
    const shapes = new Uint8Array(25).fill(Shape.Grass);
    shapes[12] = Shape.Dungeon;
    shapes[7] = shapes[13] = shapes[17] = Shape.Mountains;
    expect(inferDungeonFace(shapes, 5, 12, false)).toBe('east');
    expect(inferDungeonFace(shapes, 5, 12, false, 'south')).toBe('south');
    shapes[17] = Shape.Void;
    expect(inferDungeonFace(shapes, 5, 12, false, 'south')).toBeNull();
  });
  it('has stable valid choices for all six mountain-adjacent Sosaria dungeons, leaving the fire-surrounded dungeon alone', () => {
    const world = newWorld(),
      shapes = Uint8Array.from(world.surface.tiles, (v) => (v & 252) >> 1);
    expect(Object.keys(DUNGEON_FACE_OVERRIDES)).toHaveLength(6);
    for (const [key, direction] of Object.entries(DUNGEON_FACE_OVERRIDES)) {
      const [mapId, x, y] = key.split('/').map(Number);
      expect(mapId).toBe(world.surface.id);
      expect(shapes[y * 64 + x]).toBe(Shape.Dungeon);
      expect(inferDungeonFace(shapes, 64, y * 64 + x, true)).toBe(direction);
      const [dx, dy] = MOUNTAIN_SIDES[direction];
      expect([Shape.Grass, Shape.Brush, Shape.Forest]).toContain(shapes[(y - dy) * 64 + x - dx]);
    }
    expect(inferDungeonFace(shapes, 64, 34 * 64 + 49, true)).toBeNull();
  });
  it('never exposes an unseen mountain or switches an authored face as exploration changes, including local-only views', () => {
    const shapes = new Uint8Array(64 * 64).fill(Shape.Void);
    shapes[6 * 64 + 56] = Shape.Dungeon;
    shapes[6 * 64 + 55] = Shape.Mountains;
    const landscape = { mapId: 420, side: 64, shapes, partyX: 56, partyY: 6, wraps: true };
    expect(dungeonFaces(landscape, [])).toEqual([]);
    shapes[5 * 64 + 56] = Shape.Mountains;
    expect(dungeonFaces(landscape, [])[0]).toMatchObject({ x: 0, y: -0, dx: 0, dy: -1, host: 5 * 64 + 56 });
    const cells = Array.from({ length: 9 }, (_, i) => ({ base: i === 4 ? Shape.Dungeon : i === 1 ? Shape.Mountains : Shape.Grass }));
    expect(dungeonFaces(null, cells, { mapId: 420, originX: 55, originY: 5, side: 64 })[0].direction).toBe('north');
  });
  it('clears the entry tile only while a supported cliff is rendered, preserving inputs and flat fallback', () => {
    const ctx = new Proxy(
      { createRadialGradient: () => ({ addColorStop() {} }), getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4) }) },
      { get: (obj, key) => (Reflect.get(obj, key) as unknown) ?? (() => {}) },
    );
    vi.stubGlobal('document', { createElement: () => ({ width: 64, height: 64, getContext: () => ctx }) });
    const scene = new TileMapScene(16, 3, () => {});
    const gfx = { drawShape() {}, tileRect: () => ({ x: 0, y: 0, w: 64, h: 64 }) } as unknown as GraphicsSet;
    const cells = Array.from({ length: 9 }, (_, i) => ({ base: i === 4 ? Shape.Dungeon : i === 1 ? Shape.Mountains : Shape.Grass }));
    try {
      for (const renderStyle of ['Cards', 'Models'] as const) {
        scene.setOptions({ ...DEFAULT_3D_SETTINGS, renderStyle });
        scene.setLandscape(null, gfx, cells);
        expect(scene.dungeonEntryGround(4)).toBe(true);
        expect(cells[4].base).toBe(Shape.Dungeon);
        scene.setOptions({ ...DEFAULT_3D_SETTINGS, renderStyle, mountains: false });
        scene.setLandscape(null, gfx, cells);
        expect(scene.dungeonEntryGround(4)).toBe(false);
      }
      scene.setOptions({ ...DEFAULT_3D_SETTINGS, fixedAngle: 0 });
      scene.setLandscape(null, gfx, cells);
      expect(scene.dungeonEntryGround(4)).toBe(false);
    } finally {
      scene.dispose();
    }
  });
  it('handles a wrapped neighbor and keeps each textured face upright, outside the mountain and facing the entry square', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) });
    const faces = new DungeonEntranceFaces({ value: false }),
      gfx = { drawShape() {} } as unknown as GraphicsSet;
    const shapes = new Uint8Array(9).fill(Shape.Grass);
    shapes[3] = Shape.Dungeon;
    shapes[5] = Shape.Mountains;
    expect(inferDungeonFace(shapes, 3, 3, true)).toBe('west');
    for (const direction of Object.keys(MOUNTAIN_SIDES) as (keyof typeof MOUNTAIN_SIDES)[]) {
      const [dx, dy] = MOUNTAIN_SIDES[direction];
      faces.set([{ index: 4, host: 4 + dx + 3 * dy, x: 0, y: 0, dx, dy, direction }], gfx);
      const matrix = new Matrix4();
      faces.mesh.getMatrixAt(0, matrix);
      const normal = new Vector3(0, 0, 1).transformDirection(matrix);
      expect(normal.distanceTo(new Vector3(-dx, dy, 0))).toBeLessThan(1e-6);
      expect(new Vector3(0, 1, 0).transformDirection(matrix).z).toBeCloseTo(1);
      expect(new Vector3().setFromMatrixPosition(matrix).z).toBeCloseTo(0.5);
      expect(faces.material.depthTest).toBe(true);
    }
    faces.dispose();
  });
});
