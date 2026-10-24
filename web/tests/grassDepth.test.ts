import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GrassDepth, grassOpacity } from '../src/ui/grassDepth.ts';
import { GRASS_LAYOUTS } from '../src/ui/grassLayouts.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { Shape } from '../src/game/tiles.ts';
import { read3DSettings } from '../src/ui/view3DSettings.ts';
afterEach(() => vi.unstubAllGlobals());
describe('optional native grass depth', () => {
  it('fades overhead and distant cards and preserves an explicit setting', () => {
    expect(grassOpacity(0, 64)).toBe(0);
    expect(grassOpacity(Math.PI / 4, 20)).toBe(0);
    expect(grassOpacity(Math.PI / 4, 64)).toBeGreaterThan(0);
    expect(read3DSettings({}).grassDepth).toBe(false);
    expect(read3DSettings({ grassDepth: true }).grassDepth).toBe(true);
  });
  it('ships hash-verified source-derived atlases only for reviewed sets', () => {
    const records = JSON.parse(readFileSync(new URL('../docs/grass-depth/manifest.json', import.meta.url), 'utf8')) as {
      set: string;
      source: string;
      sourceSha256: string;
      atlas: string;
      sha256: string;
      marks: number;
    }[];
    expect(records.map((r) => r.set)).toEqual(['Standard', 'PC EGA']);
    for (const r of records) {
      expect(GRASS_LAYOUTS[r.set]).toHaveLength(r.marks);
      for (const [file, hash] of [
        [r.source, r.sourceSha256],
        [r.atlas, r.sha256],
      ])
        expect(
          createHash('sha256')
            .update(readFileSync(new URL(`../public/graphics/${file}`, import.meta.url)))
            .digest('hex'),
        ).toBe(hash);
    }
  });
  it('uses only visible grass, keeps native bases fixed, and creates no hidden or unsupported cards', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage() {} }) }) });
    const grass = new GrassDepth(),
      patches = GRASS_LAYOUTS['PC EGA'];
    const gfx = { grass: { image: {}, patches } } as unknown as GraphicsSet;
    grass.set([{ base: Shape.Grass }, { base: Shape.Void }, { base: Shape.Forest }, { base: Shape.Water }], gfx, true);
    expect(grass.mesh.count).toBe(patches.length);
    expect(grass.material.depthWrite).toBe(false);
    expect(grass.mesh.renderOrder).toBeLessThan(1);
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.up.set(0, 1, 1).normalize();
    camera.position.set(0, -10, 10);
    camera.lookAt(0, 0, 0);
    grass.faceCamera(camera, Math.PI / 4, 64);
    const matrix = new Matrix4();
    patches.forEach((patch, i) => {
      grass.mesh.getMatrixAt(i, matrix);
      const point = new Vector3(patch[8] - 0.5, -0.5, 0).applyMatrix4(matrix);
      expect(point.x).toBeCloseTo(-1 + patch[0]);
      expect(point.y).toBeCloseTo(1 - patch[1]);
      expect(point.z).toBeCloseTo(0.003);
    });
    grass.faceCamera(camera, 0, 64);
    expect(grass.mesh.visible).toBe(false);
    grass.set([{ base: Shape.Grass }], {} as GraphicsSet, true);
    expect(grass.mesh.count).toBe(0);
    grass.set([{ base: Shape.Grass }], gfx, false);
    expect(grass.mesh.count).toBe(0);
    grass.dispose();
  });
});
