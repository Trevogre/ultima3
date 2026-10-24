import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GrassDepth, grassOpacity, GRASS_CARD_BUDGET } from '../src/ui/grassDepth.ts';
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

    expect(grass.material.depthWrite).toBe(false);
    expect(grass.mesh.renderOrder).toBeLessThan(1);
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.up.set(0, 1, 1).normalize();
    camera.position.set(0, -10, 10);
    camera.lookAt(0, 0, 0);
    grass.faceCamera(camera, Math.PI / 4, 64);
    expect(grass.mesh.count).toBe(patches.length);
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
    const shapes = new Uint8Array(32 * 32).fill(Shape.Void);
    shapes[16 * 32 + 24] = Shape.Grass; // eight tiles away, outside the old 11x11 window
    grass.set([{ base: Shape.Void }], gfx, true, { side: 32, shapes, partyX: 16, partyY: 16, wraps: false });
    camera.left = -15;
    camera.right = 15;
    camera.top = 15;
    camera.bottom = -15;
    camera.updateProjectionMatrix();
    grass.faceCamera(camera, Math.PI / 4, 64);
    expect(grass.mesh.count).toBe(patches.length);
    camera.position.set(40, -10, 10);
    camera.lookAt(40, 0, 0);
    grass.faceCamera(camera, Math.PI / 4, 64);
    expect(grass.mesh.count).toBe(0);
    camera.position.set(0, -100, 100);
    camera.lookAt(0, 0, 0);
    camera.left = -100;
    camera.right = 100;
    camera.top = 100;
    camera.bottom = -100;
    camera.far = 500;
    camera.updateProjectionMatrix();
    const allGrass = new Uint8Array(64 * 64).fill(Shape.Grass);
    grass.set([], { grass: { image: {}, patches: GRASS_LAYOUTS.Standard } } as unknown as GraphicsSet, true, {
      side: 64,
      shapes: allGrass,
      partyX: 32,
      partyY: 32,
      wraps: true,
    });
    grass.faceCamera(camera, Math.PI / 4, 64);
    expect(grass.mesh.count).toBe(GRASS_CARD_BUDGET);
    grass.mesh.getMatrixAt(grass.mesh.count - 1, matrix);
    expect(matrix.elements[12]).toBeGreaterThan(25); // budget still reaches the far side
    grass.dispose();
  });
});
