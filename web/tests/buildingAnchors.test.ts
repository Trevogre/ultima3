import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import { buildingBase } from '../src/ui/billboardArt.ts';
import { BuildingBillboards, buildingSlide } from '../src/ui/buildingBillboards.ts';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
afterEach(() => vi.unstubAllGlobals());

describe('building foundation anchors', () => {
  it('finds an inset/asymmetric foundation rather than the bottom of the tile', () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (const [x, y] of [
      [2, 1],
      [3, 1],
      [4, 2],
      [3, 5],
      [4, 5],
    ])
      pixels.set([0, 0, 0, 255], (y * 8 + x) * 4);
    const before = pixels.slice();
    expect(buildingBase(pixels, 8, 8)).toEqual([32, 48]);
    expect(pixels).toEqual(before);
    pixels[(5 * 8 + 3) * 4 + 3] = 0;
    expect(buildingBase(pixels, 8, 8)).toEqual([36, 48]);
    expect(buildingBase(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toEqual([32, 64]);
  });
  it('slides from original overhead placement to a centred grounded foundation while sharing the pivot with shadows', () => {
    const foundation = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 10; y <= 47; y++) for (let x = 20; x < 36; x++) foundation[(y * 64 + x) * 4 + 3] = 255;
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          imageSmoothingEnabled: false,
          clearRect() {},
          drawImage() {},
          putImageData() {},
          getImageData: () => ({ data: foundation.slice() }),
        }),
      }),
    });
    const gfx = { tileRect: () => ({ x: 0, y: 0 }), drawShape() {} } as unknown as GraphicsSet;
    const buildings = new BuildingBillboards({ value: false });
    buildings.set(null, [{ base: Shape.Town }], gfx, true);
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100),
      matrix = new Matrix4();
    for (const tilt of [0, (10 * Math.PI) / 180, Math.PI / 4, (70 * Math.PI) / 180])
      for (const yaw of [0, 1.6, 3.4]) {
        camera.position.set(10 * Math.sin(yaw) * Math.sin(tilt), -10 * Math.cos(yaw) * Math.sin(tilt), 10 * Math.cos(tilt));
        camera.up.set(-Math.sin(yaw) * Math.cos(tilt), Math.cos(yaw) * Math.cos(tilt), Math.sin(tilt));
        camera.lookAt(0, 0, 0);
        buildings.faceCamera(camera, tilt);
        buildings.mesh.getMatrixAt(0, matrix);
        const base = new Vector3(28 / 64 - 0.5, 0.5 - 48 / 64, 0).applyMatrix4(matrix);
        expect(base.x).toBeCloseTo((28 / 64 - 0.5) * (1 - buildingSlide(tilt)));
        expect(base.y).toBeCloseTo((0.5 - 48 / 64) * (1 - buildingSlide(tilt)));
        expect(base.z).toBeCloseTo(0.002);
        if (tilt === 0) {
          expect(matrix.elements[12]).toBeCloseTo(0);
          expect(matrix.elements[13]).toBeCloseTo(0);
          expect(matrix.elements[0]).toBeCloseTo(1);
          expect(matrix.elements[5]).toBeCloseTo(1);
        }
      }
    const footprints: number[][] = [];
    buildings.forEachFootprint((x, y, size) => footprints.push([x, y, size]));
    expect(footprints).toEqual([[0, 0, 1]]);
    buildings.forEachShadow((x, y, _slot, anchor) => expect([x, y, ...anchor]).toEqual([0, 0, 28 / 64, 1 - 48 / 64]));
    const nearTop = (10 * Math.PI) / 180;
    const rotations = [];
    for (const yaw of [(179 * Math.PI) / 180, (181 * Math.PI) / 180]) {
      camera.position.set(10 * Math.sin(yaw) * Math.sin(nearTop), -10 * Math.cos(yaw) * Math.sin(nearTop), 10 * Math.cos(nearTop));
      camera.up.set(-Math.sin(yaw) * Math.cos(nearTop), Math.cos(yaw) * Math.cos(nearTop), Math.sin(nearTop));
      camera.lookAt(0, 0, 0);
      buildings.faceCamera(camera, nearTop);
      rotations.push(buildings.cardRotation.clone());
    }
    expect(rotations[0].angleTo(rotations[1])).toBeLessThan(0.05);
    buildings.forEachFootprint((x, y) => {
      expect(x).toBeCloseTo((28 / 64 - 0.5) * 0.5);
      expect(y).toBeCloseTo((0.5 - 48 / 64) * 0.5);
    });
    buildings.dispose();
  });
});
