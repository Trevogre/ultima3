import { Shape } from './tiles.ts';

export interface WorldPlacement {
  kind: 'tree' | 'brush' | 'grass' | 'rock' | 'reed';
  variant: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}
export interface ComposedCell {
  index: number;
  terrain: number;
  seed: number;
  region: number;
  shore: boolean;
  forestEdge: boolean;
  placements: WorldPlacement[];
}
export interface CompositionOverride {
  variant?: number;
  density?: number;
  rotation?: number;
}
export interface ComposedWorld {
  mapId: number;
  side: number;
  wraps: boolean;
  cells: ComposedCell[];
  corners: Float32Array;
}

/** Stable coordinate seed: revisiting a place does not shuffle its scenery. */
export function compositionSeed(mapId: number, x: number, y: number, salt = 0): number {
  let n = Math.imul(mapId + 1, 0x45d9f3b) ^ Math.imul(x + 1, 0x119de1f3) ^ Math.imul(y + 1, 0x3449f5) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}
const neighbours = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** Presentation plans accept visibility-filtered terrain. Void contributes no inferred scenery. */
export function composeWorld(
  mapId: number,
  shapes: ArrayLike<number>,
  side: number,
  overrides: Record<string, CompositionOverride> = {},
  wraps = false,
): ComposedWorld {
  if (!Number.isInteger(side) || side <= 0 || shapes.length !== side * side) throw new Error('Composition requires a square map');
  const wrap = (n: number) => ((n % side) + side) % side;
  const at = (x: number, y: number) =>
    wraps ? shapes[wrap(y) * side + wrap(x)] : x < 0 || y < 0 || x >= side || y >= side ? Shape.Void : shapes[y * side + x];
  const regions = new Int32Array(shapes.length).fill(-1);
  // Shared regions distinguish coherent groves/ridges from isolated detail patches.
  for (let i = 0; i < shapes.length; i++) {
    if (regions[i] >= 0 || shapes[i] === Shape.Void) continue;
    const queue = [i];
    regions[i] = i;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const n = queue[cursor],
        x = n % side,
        y = Math.floor(n / side);
      for (const [dx, dy] of neighbours) {
        const nx = wraps ? wrap(x + dx) : x + dx,
          ny = wraps ? wrap(y + dy) : y + dy,
          next = ny * side + nx;
        if (nx < 0 || ny < 0 || nx >= side || ny >= side || regions[next] >= 0 || shapes[next] !== shapes[i]) continue;
        regions[next] = i;
        queue.push(next);
      }
    }
  }
  const cells: ComposedCell[] = [];
  for (let i = 0; i < shapes.length; i++) {
    const terrain = shapes[i];
    if (terrain === Shape.Void) continue;
    const x = i % side,
      y = Math.floor(i / side),
      seed = compositionSeed(mapId, x, y);
    const adjacent = neighbours.map(([dx, dy]) => at(x + dx, y + dy));
    const shore = terrain !== Shape.Water && adjacent.includes(Shape.Water);
    const forestEdge = terrain === Shape.Forest && adjacent.some((t) => t !== Shape.Forest && t !== Shape.Void);
    const override = overrides[`${x},${y}`] ?? {};
    const density = Number.isFinite(override.density) ? Math.max(0, Math.min(2, override.density!)) : 1;
    const placements: WorldPlacement[] = [];
    const random = (salt: number) => compositionSeed(mapId, x, y, salt) / 0x100000000;
    const kind =
      terrain === Shape.Forest
        ? 'tree'
        : terrain === Shape.Brush
          ? 'brush'
          : terrain === Shape.Grass
            ? 'grass'
            : terrain === Shape.Mountains
              ? 'rock'
              : null;
    const count = Math.round(
      (kind === 'tree' ? (forestEdge ? 3 : 5) : kind === 'grass' ? 4 : kind === 'brush' ? 3 : kind === 'rock' ? 2 : 0) * density,
    );
    if (kind)
      for (let p = 0; p < count; p++) {
        const angle = random(p * 17 + 1) * Math.PI * 2,
          distance = 0.19 + random(p * 17 + 2) * 0.24;
        placements.push({
          kind,
          variant: Number.isInteger(override.variant) ? Math.max(0, Math.min(7, override.variant!)) : Math.floor(random(p * 17 + 3) * 5),
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          rotation: Number.isFinite(override.rotation) ? override.rotation! : random(p * 17 + 4) * Math.PI * 2,
          scale: 0.76 + random(p * 17 + 5) * 0.45,
        });
      }
    if (shore && (terrain === Shape.Grass || terrain === Shape.Brush))
      for (const [dx, dy] of neighbours) {
        if (at(x + dx, y + dy) !== Shape.Water) continue;
        placements.push({
          kind: 'reed',
          variant: seed % 3,
          x: x + dx * 0.39,
          y: y + dy * 0.39,
          rotation: random(701) * Math.PI * 2,
          scale: 0.7 + random(702) * 0.3,
        });
      }
    cells.push({ index: i, terrain, seed, region: regions[i], shore, forestEdge, placements });
  }
  // Every tile shares the same corner samples. Unknown cells never imply water,
  // shore, slope, vegetation, or another terrain type through the fog boundary.
  const corners = new Float32Array((side + 1) ** 2);
  for (let y = 0; y <= side; y++)
    for (let x = 0; x <= side; x++) {
      const adjacent = [at(x - 1, y - 1), at(x, y - 1), at(x - 1, y), at(x, y)].filter((t) => t !== Shape.Void);
      corners[y * (side + 1) + x] = adjacent.length
        ? adjacent.reduce((height, t) => height + (t === Shape.Water ? -0.22 : 0), 0) / adjacent.length
        : 0;
    }
  return { mapId, side, wraps, cells, corners };
}
