import { Shape } from '../game/tiles.ts';

export const WATER_DEPTH = 0.2;
export const MOUNTAIN_STEPS = [
  { width: 1, height: 0.45, base: 0 },
  { width: 0.72, height: 0.4, base: 0.45 },
  { width: 0.44, height: 0.35, base: 0.85 },
] as const;

export function terrainElevation(shape: number, recessedWater: boolean): number {
  return recessedWater && shape === Shape.Water ? -WATER_DEPTH : 0;
}

/** Only known, visible cardinal water neighbours create shoreline sides. */
export function isCoastalLand(shapes: ArrayLike<number>, side: number, index: number, wraps: boolean): boolean {
  const shape = shapes[index];
  if (shape === Shape.Void || shape === Shape.Water) return false;
  const x = index % side;
  const y = Math.floor(index / side);
  return [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].some(([dx, dy]) => {
    const nx = x + dx,
      ny = y + dy;
    if (!wraps && (nx < 0 || ny < 0 || nx >= side || ny >= side)) return false;
    return shapes[((ny + side) % side) * side + ((nx + side) % side)] === Shape.Water;
  });
}
