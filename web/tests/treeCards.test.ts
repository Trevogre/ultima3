import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MeshBasicMaterial, OrthographicCamera, Matrix4, Vector3 } from 'three';
import { BuildingBillboards, STANDARD_TREE_ANCHORS, STANDARD_BRUSH_ANCHORS } from '../src/ui/buildingBillboards.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { VEGETATION_LAYOUTS } from '../src/ui/vegetationLayouts.ts';
import { Shape } from '../src/game/tiles.ts';
import { DEFAULT_3D_SETTINGS, presentationPreset, read3DSettings, useTreeCards } from '../src/ui/view3DSettings.ts';

afterEach(() => vi.unstubAllGlobals());

describe('optional reviewed tree cards', () => {
  it('defaults Off, preserves choices, and uses original flat tiles overhead or without a cutout', () => {
    expect(read3DSettings({}).treeCards).toBe(false);
    expect(read3DSettings({ treeCards: true }).treeCards).toBe(true);
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, treeCards: true })).toBe('Custom');
    expect(useTreeCards(true, 0, true)).toBe(false);
    expect(useTreeCards(true, Math.PI / 4, true)).toBe(true);
    expect(useTreeCards(true, Math.PI / 4, false)).toBe(false);
    expect(useTreeCards(false, Math.PI / 4, true)).toBe(false);
  });

  it('ships separate, hash-verified cutouts without modifying the source sheets', () => {
    const manifest = JSON.parse(readFileSync(new URL('../docs/forest-cards/manifest.json', import.meta.url), 'utf8')) as {
      set: string;
      source: string;
      card: string;
      sourceSha256: string;
      cardSha256: string;
    }[];
    const brush = JSON.parse(readFileSync(new URL('../docs/forest-cards/brush-manifest.json', import.meta.url), 'utf8')) as typeof manifest;
    expect(brush).toHaveLength(8);
    const layouts = JSON.parse(readFileSync(new URL('../docs/forest-cards/vegetation-layouts.json', import.meta.url), 'utf8')) as {
      set: string;
      file: string;
      sha256: string;
    }[];
    expect(layouts).toHaveLength(9);
    for (const item of layouts) {
      const bytes = readFileSync(new URL(`../public/graphics/${item.file}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256);
    }
    expect(manifest).toHaveLength(9);
    expect(manifest.map((m) => m.set)).not.toContain('PC VGA');
    expect(manifest.map((m) => m.set)).not.toContain('Macintosh B&W');
    for (const item of [...manifest, ...brush]) {
      for (const [name, hash] of [
        [item.source, item.sourceSha256],
        [item.card, item.cardSha256],
      ]) {
        const bytes = readFileSync(new URL(`../public/graphics/${name}`, import.meta.url));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
      }
      expect(item.card).not.toBe(item.source);
    }
  });

  it('uses only filtered forest locations and draws behind actors without hiding them in the depth buffer', () => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ imageSmoothingEnabled: false, clearRect() {}, drawImage() {} }) }),
    });
    const trees = new BuildingBillboards({ value: false }, 'trees');
    const gfx = { forestCard: {} } as GraphicsSet;
    trees.set(null, [{ base: Shape.Forest }, { base: Shape.Void }, { base: Shape.Grass }, { base: Shape.Water }], gfx, true);
    expect(trees.mesh.count).toBe(1);
    const material = trees.mesh.material as MeshBasicMaterial;
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(trees.mesh.renderOrder).toBeLessThan(1);
    const buildings = new BuildingBillboards({ value: false });
    // Buildings must write depth before trees draw, allowing nearer trees to
    // cover cities without making tree depth hide the later player cards.
    expect(buildings.mesh.renderOrder).toBeLessThan(trees.mesh.renderOrder);
    expect((buildings.mesh.material as MeshBasicMaterial).depthWrite).toBe(true);
    buildings.dispose();
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 500);
    camera.position.set(0, -10, 10);
    camera.up.set(0, 1, 1).normalize();
    camera.lookAt(0, 0, 0);
    trees.faceCamera(camera, Math.PI / 4);
    const matrix = new Matrix4();
    trees.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements.every(Number.isFinite)).toBe(true);
    trees.set(
      { side: 2, shapes: new Uint8Array([Shape.Void, Shape.Forest, Shape.Void, Shape.Void]), partyX: 0, partyY: 0, wraps: true },
      [],
      gfx,
      true,
    );
    expect(trees.mesh.count).toBe(1);
    trees.set(null, [{ base: Shape.Forest }], { forestCard: {}, treeCards: {} } as GraphicsSet, true);
    expect(trees.mesh.count).toBe(3);
    expect(trees.mesh.instanceMatrix.count).toBeGreaterThanOrEqual(4096 * 3);
    for (const tilt of [0, Math.PI / 4, (70 * Math.PI) / 180]) {
      for (const yaw of [(5 * Math.PI) / 180, 2]) {
        camera.position.set(10 * Math.sin(yaw) * Math.sin(tilt), -10 * Math.cos(yaw) * Math.sin(tilt), 10 * Math.cos(tilt));
        camera.up.set(-Math.sin(yaw) * Math.cos(tilt), Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt));
        camera.lookAt(0, 0, 0);
        trees.faceCamera(camera, tilt);
        STANDARD_TREE_ANCHORS.forEach(([px, py], i) => {
          trees.mesh.getMatrixAt(i, matrix);
          const base = new Vector3(px / 64 - 0.5, 0.5 - py / 64, 0).applyMatrix4(matrix);
          expect(base.x).toBeCloseTo(px / 64 - 0.5);
          expect(base.y).toBeCloseTo(0.5 - py / 64);
          expect(base.z).toBeCloseTo(0.002);
        });
      }
    }
    const footprints: number[][] = [];
    trees.forEachFootprint((x, y, size) => footprints.push([x, y, size]));
    expect(footprints).toHaveLength(3);
    expect(footprints.every((f) => f[2] === 0.45)).toBe(true);
    // Standard brush has four independently anchored clumps, even if no
    // forest cutout is available. Unsupported brush must not become grass.
    trees.set(null, [{ base: Shape.Brush }], { brushCards: { width: 256 } } as GraphicsSet, true);
    expect(trees.mesh.count).toBe(4);
    trees.faceCamera(camera, (70 * Math.PI) / 180);
    STANDARD_BRUSH_ANCHORS.forEach(([px, py], i) => {
      trees.mesh.getMatrixAt(i, matrix);
      const base = new Vector3(px / 64 - 0.5, 0.5 - py / 64, 0).applyMatrix4(matrix);
      expect(base.x).toBeCloseTo(px / 64 - 0.5);
      expect(base.y).toBeCloseTo(0.5 - py / 64);
      expect(base.z).toBeCloseTo(0.002);
    });
    trees.set(null, [{ base: Shape.Brush }], gfx, true);
    expect(trees.mesh.count).toBe(0);
    trees.set(null, [{ base: Shape.Brush }], { brushCards: { width: 16 } } as GraphicsSet, true);
    expect(trees.mesh.count).toBe(1);
    for (const name of ['Apple II Color', 'Apple II Mono', 'PC EGA', 'PC CGA', 'Commodore 64']) {
      const layout = VEGETATION_LAYOUTS[name];
      expect(layout.trees).toHaveLength(3);
      expect(layout.brush).toHaveLength(4);
      for (const [shape, anchors] of [
        [Shape.Forest, layout.trees],
        [Shape.Brush, layout.brush],
      ] as const) {
        trees.set(null, [{ base: shape }], { forestCard: {}, brushCards: {}, vegetation: { image: {}, layout } } as GraphicsSet, true);
        expect(trees.mesh.count).toBe(anchors.length);
        for (const tilt of [0, Math.PI / 4, (70 * Math.PI) / 180]) {
          camera.position.set(0, -10 * Math.sin(tilt), 10 * Math.cos(tilt));
          camera.up.set(0, Math.cos(tilt), Math.sin(tilt));
          camera.lookAt(0, 0, 0);
          trees.faceCamera(camera, tilt);
          anchors.forEach(([px, py], i) => {
            trees.mesh.getMatrixAt(i, matrix);
            const base = new Vector3(px / 64 - 0.5, 0.5 - py / 64, 0).applyMatrix4(matrix);
            expect(base.x).toBeCloseTo(px / 64 - 0.5);
            expect(base.y).toBeCloseTo(0.5 - py / 64);
            expect(base.z).toBeCloseTo(0.002);
          });
        }
        const shadows: number[][] = [];
        trees.forEachShadow((x, y, _slot, anchor) => shadows.push([x, y, ...anchor]));
        anchors.forEach(([px, py], i) => expect(shadows[i]).toEqual([px / 64 - 0.5, 0.5 - py / 64, px / 64, 1 - py / 64]));
      }
    }
    trees.set(null, [{ base: Shape.Forest }], { forestCard: null } as GraphicsSet, true);
    expect(trees.mesh.count).toBe(0);
    trees.dispose();
  });
});
