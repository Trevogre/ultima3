import { Shape } from '../game/tiles.ts';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import type { ViewCell } from '../game/viewport.ts';

export const MOUNTAIN_SIDES = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
} as const;
export type MountainSide = keyof typeof MOUNTAIN_SIDES;
/** Key: map id / dungeon entry X / Y. Direction points from the entry square to its host mountain. */
export const DUNGEON_FACE_OVERRIDES: Record<string, MountainSide> = {
  '420/56/6': 'north',
  '420/46/7': 'east',
  '420/9/28': 'east',
  '420/58/30': 'north',
  '420/58/44': 'north',
  '420/19/57': 'west',
};

const walkable = (s: number | undefined) =>
  s !== undefined && [Shape.Grass, Shape.Brush, Shape.Forest, Shape.Floor, Shape.Dungeon].includes(s as never);
export function inferDungeonFace(
  shapes: ArrayLike<number>,
  side: number,
  index: number,
  wraps: boolean,
  preferred?: MountainSide,
): MountainSide | null {
  const x = index % side,
    y = Math.floor(index / side);
  const at = (dx: number, dy: number) => {
    const nx = x + dx,
      ny = y + dy;
    if (!wraps && (nx < 0 || ny < 0 || nx >= side || ny >= side)) return undefined;
    return shapes[((ny + side) % side) * side + ((nx + side) % side)];
  };
  // An authored choice never flips to another face as fog changes.
  if (preferred) {
    const [dx, dy] = MOUNTAIN_SIDES[preferred];
    return at(dx, dy) === Shape.Mountains ? preferred : null;
  }
  let best: MountainSide | null = null,
    score = -1;
  for (const direction of Object.keys(MOUNTAIN_SIDES) as MountainSide[]) {
    const [dx, dy] = MOUNTAIN_SIDES[direction];
    if (at(dx, dy) !== Shape.Mountains) continue;
    const candidate =
      (walkable(at(-dx, -dy)) ? 10 : 0) + (walkable(at(-2 * dx, -2 * dy)) ? 2 : 0) + (at(2 * dx, 2 * dy) === Shape.Mountains ? 1 : 0);
    if (candidate > score) {
      best = direction;
      score = candidate;
    }
  }
  return best;
}

export interface DungeonFace {
  index: number;
  host: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  direction: MountainSide;
}
/** Only filtered, already-visible mountains may receive a doorway. */
export interface LocalMapLocation {
  mapId: number;
  originX: number;
  originY: number;
  side: number;
}
export function dungeonFaces(landscape: Landscape | null, cells: ViewCell[], location?: LocalMapLocation): DungeonFace[] {
  const shapes = landscape?.shapes ?? cells.map((c) => c.base),
    side = landscape?.side ?? Math.sqrt(cells.length),
    wraps = landscape?.wraps ?? false;
  const result: DungeonFace[] = [];
  Array.from(shapes).forEach((shape, index) => {
    if (shape !== Shape.Dungeon) return;
    const col = index % side,
      row = Math.floor(index / side);
    const mapId = landscape?.mapId ?? location?.mapId;
    const worldX = landscape ? col : location ? (location.originX + col + location.side) % location.side : col;
    const worldY = landscape ? row : location ? (location.originY + row + location.side) % location.side : row;
    const preferred = mapId === undefined ? undefined : DUNGEON_FACE_OVERRIDES[`${mapId}/${worldX}/${worldY}`];
    const direction = inferDungeonFace(shapes, side, index, wraps, preferred);
    if (!direction) return;
    const [dx, dy] = MOUNTAIN_SIDES[direction];
    result.push({
      index,
      host: ((row + dy + side) % side) * side + ((col + dx + side) % side),
      x: landscape ? landscapeOffset(col, landscape.partyX, side, wraps) : col - (side - 1) / 2,
      y: landscape ? -landscapeOffset(row, landscape.partyY, side, wraps) : (side - 1) / 2 - row,
      dx,
      dy,
      direction,
    });
  });
  return result;
}
