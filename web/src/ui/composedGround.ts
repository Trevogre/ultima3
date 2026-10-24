import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ComposedWorld } from '../game/worldComposition.ts';
import type { Landscape } from '../game/landscape.ts';
import { landscapeOffset } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';

const grass = new Color(0x61784a),
  stone = new Color(0x827f70),
  floor = new Color(0x9b9177),
  sand = new Color(0x9a946a);
export function structureGround(shape: number): boolean {
  return (
    shape === Shape.Floor ||
    shape === Shape.Wall ||
    shape === Shape.Wall + 4 ||
    shape === Shape.Door ||
    shape === Shape.ForceField ||
    shape === Shape.Town ||
    shape === Shape.Castle ||
    shape === Shape.Shrine ||
    shape === Shape.Dungeon ||
    (shape >= 76 && shape <= 114)
  );
}
export const composedGroundColour = (shape: number): Color =>
  shape === Shape.Water
    ? sand
    : shape === Shape.Mountains || shape === Shape.Dungeon
      ? stone
      : structureGround(shape) && shape !== Shape.Town && shape !== Shape.Castle && shape !== Shape.Shrine
        ? floor
        : grass;

/** Known cells only; shared corners have identical elevations, colours and normals. */
export function composedGround(
  plan: ComposedWorld,
  landscape: Landscape,
  lowered: boolean,
  foundations: ReadonlySet<number> = new Set(),
): { ground: BufferGeometry; water: BufferGeometry } {
  const positions: number[] = [],
    colours: number[] = [],
    waterPositions: number[] = [],
    beds: number[] = [],
    wet: number[] = [];
  const { side, shapes, partyX, partyY, wraps } = landscape;
  const at = (x: number, y: number) => {
    if (wraps) return shapes[((y + side) % side) * side + ((x + side) % side)];
    return x < 0 || y < 0 || x >= side || y >= side ? Shape.Void : shapes[y * side + x];
  };
  const cornerColour = (x: number, y: number): Color => {
    const out = new Color(0, 0, 0);
    let count = 0;
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]) {
      const shape = at(x + dx, y + dy);
      if (shape === Shape.Void) continue;
      out.add(composedGroundColour(shape));
      count++;
    }
    return out.multiplyScalar(1 / Math.max(1, count));
  };
  for (const cell of plan.cells) {
    if (cell.terrain === Shape.Lava || structureGround(cell.terrain) || foundations.has(cell.index)) continue; // Solid foundations and animated lava use separate meshes.
    const col = cell.index % side,
      row = Math.floor(cell.index / side);
    const x = landscapeOffset(col, partyX, side, wraps),
      y = -landscapeOffset(row, partyY, side, wraps);
    const centreBed = cell.terrain === Shape.Water ? (lowered ? -0.42 : -0.2) : 0;
    const corners = [
      [x - 0.5, y + 0.5],
      [x + 0.5, y + 0.5],
      [x + 0.5, y - 0.5],
      [x - 0.5, y - 0.5],
    ];
    const offsets = [row * (side + 1) + col, row * (side + 1) + col + 1, (row + 1) * (side + 1) + col + 1, (row + 1) * (side + 1) + col];
    const shades = [cornerColour(col, row), cornerColour(col + 1, row), cornerColour(col + 1, row + 1), cornerColour(col, row + 1)];
    for (let edge = 0; edge < 4; edge++)
      for (const k of [-1, (edge + 1) % 4, edge]) {
        const px = k < 0 ? x : corners[k][0],
          py = k < 0 ? y : corners[k][1];
        const bed = k < 0 ? centreBed : lowered ? plan.corners[offsets[k]] * (0.42 / 0.22) : plan.corners[offsets[k]] < -0.219 ? -0.2 : 0;
        positions.push(px, py, bed);
        const c = k < 0 ? composedGroundColour(cell.terrain) : shades[k];
        colours.push(c.r, c.g, c.b);
        waterPositions.push(px, py, lowered ? -0.22 : 0);
        beds.push(bed);
        wet.push(cell.terrain === Shape.Water ? 1 : 0);
      }
  }
  const raw = new BufferGeometry();
  raw.setAttribute('position', new Float32BufferAttribute(positions, 3));
  raw.setAttribute('color', new Float32BufferAttribute(colours, 3));
  const ground = mergeVertices(raw);
  raw.dispose();
  ground.computeVertexNormals();
  ground.computeBoundingSphere();
  const water = new BufferGeometry();
  water.setAttribute('position', new Float32BufferAttribute(waterPositions, 3));
  water.setAttribute('bedHeight', new Float32BufferAttribute(beds, 1));
  water.setAttribute('waterCell', new Float32BufferAttribute(wet, 1));
  water.computeVertexNormals();
  water.computeBoundingSphere();
  return { ground, water };
}

/** Height on the same four-triangle fan used by the ground mesh. */
export function composedHeight(plan: ComposedWorld, index: number, terrain: number, dx: number, dy: number, lowered: boolean): number {
  const centre = terrain === Shape.Water ? (lowered ? -0.42 : -0.2) : 0;
  const x = index % plan.side,
    y = Math.floor(index / plan.side),
    stride = plan.side + 1;
  const scale = (lowered ? 0.42 : 0.2) / 0.22;
  const h = [
    plan.corners[y * stride + x],
    plan.corners[y * stride + x + 1],
    plan.corners[(y + 1) * stride + x + 1],
    plan.corners[(y + 1) * stride + x],
  ].map((n) => (lowered ? n * scale : n < -0.219 ? -0.2 : 0));
  const reach = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  if (reach < 1e-9) return centre;
  let a: number, b: number, t: number;
  if (Math.abs(dx) > Math.abs(dy)) {
    [a, b] = dx > 0 ? [1, 2] : [0, 3];
    t = dy / (2 * Math.abs(dx)) + 0.5;
  } else {
    [a, b] = dy > 0 ? [3, 2] : [0, 1];
    t = dx / (2 * Math.abs(dy)) + 0.5;
  }
  return centre * (1 - reach) + (h[a] * (1 - t) + h[b] * t) * reach;
}
