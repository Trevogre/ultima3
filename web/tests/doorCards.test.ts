import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, Vector3, DoubleSide } from 'three';
import { DoorCards, doorOrientation } from '../src/ui/doorCards.ts';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import type { ViewCell } from '../src/game/viewport.ts';

afterEach(() => vi.unstubAllGlobals());
describe('fixed door cards', () => {
  it('spans the opening at the tile centre with a grounded, two-sided vertical plane', () => {
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect() {},
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4).fill(255) }),
        }),
      }),
    });
    const doors = new DoorCards({ value: false }),
      gfx = { drawShape: vi.fn() } as unknown as GraphicsSet;
    const cells: ViewCell[] = Array.from({ length: 9 }, () => ({ base: Shape.Floor }));
    cells[4].overlay = Shape.Door;
    cells[3].base = cells[5].base = Shape.Wall;
    doors.set(null, cells, gfx, true);
    expect(doors.mesh.count).toBe(1);
    expect(doors.material.side).toBe(DoubleSide);
    expect(doors.material.depthWrite).toBe(true);
    expect(doors.material.depthTest).toBe(true);
    const matrix = new Matrix4();
    doors.mesh.getMatrixAt(0, matrix);
    const position = doors.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const point = new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
      expect(point.y).toBeCloseTo(0);
      expect(Math.abs(point.x)).toBeCloseTo(0.5);
      expect(point.z).toBeGreaterThan(0);
      expect(point.z).toBeLessThan(1.002);
    }
    cells[3].base = cells[5].base = Shape.Floor;
    cells[1].base = cells[7].base = Shape.Wall;
    doors.set(null, cells, gfx, true);
    doors.mesh.getMatrixAt(0, matrix);
    for (let i = 0; i < position.count; i++) {
      const point = new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
      expect(point.x).toBeCloseTo(0);
      expect(Math.abs(point.y)).toBeCloseTo(0.5);
    }
    doors.set(null, cells, gfx, false);
    expect(doors.mesh.count).toBe(0);
    expect(doors.mesh.visible).toBe(false);
    cells[4] = { base: Shape.Void, overlay: Shape.Door };
    doors.set(null, cells, gfx, true);
    expect(doors.mesh.count).toBe(0);
    doors.set({ side: 3, partyX: 0, partyY: 0, wraps: true, shapes: new Uint8Array([72, 72, 72, 72, 72, 72, 72, 72, 93]) }, [], gfx, true);
    expect(doors.mesh.count).toBe(1);
    doors.mesh.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([-1, 1, expect.closeTo(0.001)]);
    doors.dispose();
  });
  it('uses map neighbours, including counters, rather than a camera angle', () => {
    const at = (x: number, y: number) => (x === 0 && Math.abs(y) === 1 ? Shape.Wall + 4 : Shape.Floor);
    expect(doorOrientation(at, 0, 0)).toBe(Math.PI / 2);
    expect(doorOrientation(() => Shape.Void, 0, 0)).toBe(0);
  });
});
