import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForceFieldWalls, FORCE_FIELD_THICKNESS } from '../src/ui/forceFieldWalls.ts';
import { Matrix4, Vector3 } from 'three';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
afterEach(() => vi.unstubAllGlobals());
describe('vertical force fields', () => {
  it('stands on the floor, spans a wall opening, and reloads the selected animation frame', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {} }) }) });
    const drawShape = vi.fn(),
      gfx = { drawShape } as unknown as GraphicsSet;
    const field = new ForceFieldWalls({ value: false });
    const cells: { base: number }[] = Array.from({ length: 9 }, () => ({ base: Shape.Floor }));
    cells[4].base = Shape.ForceField;
    cells[3].base = cells[5].base = Shape.Wall;
    field.set(null, cells, gfx, true);
    expect(field.mesh.count).toBe(1);
    expect(drawShape).toHaveBeenCalledWith(expect.anything(), Shape.ForceField, 0, 0, 64);
    const matrix = new Matrix4();
    field.mesh.getMatrixAt(0, matrix);
    const position = field.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix);
      expect(Math.abs(p.y)).toBeCloseTo(FORCE_FIELD_THICKNESS / 2);
      expect(Math.abs(p.x)).toBeCloseTo(0.5);
      expect(p.z).toBeGreaterThan(0);
      expect(p.z).toBeLessThan(1.003);
    }
    cells[3].base = cells[5].base = Shape.Floor;
    cells[1].base = cells[7].base = Shape.ForceField;
    field.set(null, cells, gfx, true);
    expect(field.mesh.count).toBe(3);
    field.mesh.getMatrixAt(1, matrix);
    expect(Math.abs(matrix.elements[1])).toBeCloseTo(1);
    expect(drawShape).toHaveBeenCalledTimes(2);
    field.set(null, cells, gfx, false);
    expect(field.mesh.count).toBe(0);
    expect(field.mesh.visible).toBe(false);
    field.set(null, [{ base: Shape.Void, overlay: Shape.ForceField }], gfx, true);
    expect(field.mesh.count).toBe(0);
    expect(field.material.depthTest).toBe(true);
    expect(field.material.depthWrite).toBe(true);
    field.dispose();
  });
});
