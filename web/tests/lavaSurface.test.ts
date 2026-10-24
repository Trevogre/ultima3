import { afterEach, describe, expect, it, vi } from 'vitest';
import { LavaSurface } from '../src/ui/lavaSurface.ts';
import { DEFAULT_3D_SETTINGS, read3DSettings, presentationPreset } from '../src/ui/view3DSettings.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { Shape } from '../src/game/tiles.ts';
import { Matrix4, Vector3 } from 'three';
afterEach(() => vi.unstubAllGlobals());
describe('painted lava surface', () => {
  it('migrates the option and preserves explicit Off overrides', () => {
    expect(read3DSettings({}).lavaBubbles).toBe(true);
    expect(read3DSettings({ lavaBubbles: false }).lavaBubbles).toBe(false);
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, lavaBubbles: false })).toBe('Custom');
  });
  it('only enhances known Van Gogh lava in the sprite-based 3D view', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 64, height: 64, getContext: () => ({ clearRect() {} }) }) });
    const drawShape = vi.fn();
    const gfx = { tiles: { src: 'http://localhost/graphics/Van%20Gogh-Tiles.png' }, drawShape } as unknown as GraphicsSet;
    const lava = new LavaSurface({ value: false });
    const cells = [Shape.Lava, Shape.Void, Shape.Water, Shape.Grass].map((base) => ({ base }));
    lava.set(null, cells, gfx, DEFAULT_3D_SETTINGS);
    expect(lava.mesh.count).toBe(1);
    expect(drawShape).toHaveBeenCalledWith(expect.anything(), Shape.Lava, 0, 0, 64);
    const matrix = new Matrix4();
    lava.mesh.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).z).toBeCloseTo(0.002);
    expect(lava.material.depthTest).toBe(true);
    lava.set(null, cells, gfx, DEFAULT_3D_SETTINGS, { originX: 12, originY: 24 });
    const seed = lava.geometry.getAttribute('lavaCell');
    expect([seed.getX(0), seed.getY(0)]).toEqual([12, 24]);
    for (const options of [
      { ...DEFAULT_3D_SETTINGS, lavaBubbles: false },
      { ...DEFAULT_3D_SETTINGS, enabled: false },
      { ...DEFAULT_3D_SETTINGS, renderStyle: 'Models' as const },
    ]) {
      lava.set(null, cells, gfx, options);
      expect(lava.mesh.count).toBe(0);
    }
    lava.set(null, cells, { ...gfx, tiles: { src: '/graphics/Standard-Tiles.png' } } as GraphicsSet, DEFAULT_3D_SETTINGS);
    expect(lava.mesh.count).toBe(0);
    lava.dispose();
  });
});
