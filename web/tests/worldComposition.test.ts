import { describe, expect, it } from 'vitest';
import { composeWorld } from '../src/game/worldComposition.ts';
import { Shape } from '../src/game/tiles.ts';

describe('whole-map presentation composition', () => {
  it('plans all 4096 cells deterministically without modifying the terrain bytes', () => {
    const shapes = new Uint8Array(4096).fill(Shape.Forest),
      original = shapes.slice();
    const a = composeWorld(400, shapes, 64),
      b = composeWorld(400, shapes, 64);
    expect(a).toEqual(b);
    expect(a.cells).toHaveLength(4096);
    expect(shapes).toEqual(original);
    expect(new Set(a.cells.map((c) => c.seed)).size).toBe(4096);
    expect(composeWorld(401, shapes, 64).cells[0].seed).not.toBe(a.cells[0].seed);
  });
  it('composes forest edges and shores from neighbours and shares corner elevations', () => {
    const shapes = new Uint8Array(25).fill(Shape.Forest);
    shapes[11] = Shape.Grass;
    shapes[12] = Shape.Water;
    const world = composeWorld(1, shapes, 5),
      at = (i: number) => world.cells.find((c) => c.index === i)!;
    expect(at(10).forestEdge).toBe(true);
    expect(at(0).forestEdge).toBe(false);
    expect(at(0).placements).toHaveLength(5);
    expect(at(10).placements).toHaveLength(3);
    expect(at(11).shore).toBe(true);
    expect(at(11).placements.some((p) => p.kind === 'reed')).toBe(true);
    expect(world.corners[2 * 6 + 2]).toBeCloseTo(-0.055);
    expect(world.corners).toHaveLength(36);
  });
  it('omits unknown terrain and never infers water/trees behind it', () => {
    const shapes = new Uint8Array(9).fill(Shape.Void);
    shapes[4] = Shape.Grass;
    const world = composeWorld(1, shapes, 3);
    expect(world.cells).toHaveLength(1);
    expect(world.cells[0].shore).toBe(false);
    expect(world.cells[0].placements.every((p) => p.kind === 'grass')).toBe(true);
    expect(world.corners.every((h) => h === 0)).toBe(true);
  });
  it('joins regions and identical corner samples across a wrapping world seam', () => {
    const shapes = new Uint8Array(16).fill(Shape.Grass);
    shapes[4] = Shape.Forest;
    shapes[7] = Shape.Forest;
    shapes[15] = Shape.Water;
    const wrapped = composeWorld(2, shapes, 4, {}, true);
    expect(wrapped.cells[4].region).toBe(wrapped.cells[7].region);
    expect(wrapped.cells[3].shore).toBe(true);
    for (let y = 0; y <= 4; y++) expect(wrapped.corners[y * 5]).toBe(wrapped.corners[y * 5 + 4]);
    for (let x = 0; x <= 4; x++) expect(wrapped.corners[x]).toBe(wrapped.corners[20 + x]);
  });
  it('applies authored presentation overrides at one stable location only', () => {
    const shapes = new Uint8Array(16).fill(Shape.Forest),
      original = composeWorld(2, shapes, 4);
    const edited = composeWorld(2, shapes, 4, { '1,1': { variant: 4, density: 2, rotation: 1.5 } });
    expect(edited.cells[5].placements).toHaveLength(10);
    expect(edited.cells[5].placements.every((p) => p.variant === 4 && p.rotation === 1.5)).toBe(true);
    expect(edited.cells[6]).toEqual(original.cells[6]);
  });
});
