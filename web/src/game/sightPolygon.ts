/** Continuous, camera-independent sight in map coordinates (tile centres are integers). */
export interface SightPoint {
  x: number;
  y: number;
}
export interface SightRegion {
  side: number;
  eye: SightPoint;
  polygon: SightPoint[];
  /** Broad phase: includes partially visible cells and exposed blocking surfaces. */
  visible: Uint8Array;
  surfaces: number[];
}

/** Clip a polygon to a tile. Also retains zero-area exposed wall edges. */
export function sightTile(polygon: SightPoint[], x: number, y: number): SightPoint[] {
  let points = polygon;
  for (const [axis, bound, sign] of [
    ['x', x - 0.5, 1],
    ['x', x + 0.5, -1],
    ['y', y - 0.5, 1],
    ['y', y + 0.5, -1],
  ] as const) {
    const output: SightPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const da = (a[axis] - bound) * sign,
        db = (b[axis] - bound) * sign;
      if (da >= -1e-9) output.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
        const t = da / (da - db);
        output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    points = output;
    if (!points.length) break;
  }
  return points;
}
export function sightArea(points: SightPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Rays at every exposed wall corner, immediately to either side, produce an exact polygon. */
export function buildSightRegion(side: number, x: number, y: number, blocked: (x: number, y: number) => boolean): SightRegion {
  const solid = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= side || cy >= side || blocked(cx, cy);
  const corners = new Set<string>([`-0.5,-0.5`, `${side - 0.5},-0.5`, `${side - 0.5},${side - 0.5}`, `-0.5,${side - 0.5}`]);
  for (let cy = 0; cy < side; cy++)
    for (let cx = 0; cx < side; cx++) {
      if (!solid(cx, cy)) continue;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        if (solid(cx + dx, cy + dy)) continue;
        if (dx) for (const oy of [-0.5, 0.5]) corners.add(`${cx + dx * 0.5},${cy + oy}`);
        else for (const ox of [-0.5, 0.5]) corners.add(`${cx + ox},${cy + dy * 0.5}`);
      }
    }
  const ray = (angle: number): SightPoint => {
    const dx = Math.cos(angle),
      dy = Math.sin(angle),
      sx = Math.sign(dx),
      sy = Math.sign(dy);
    const stepX = 1 / Math.abs(dx),
      stepY = 1 / Math.abs(dy);
    let cx = x,
      cy = y,
      nextX = stepX / 2,
      nextY = stepY / 2,
      distance = 0;
    for (let i = 0; i <= side * 2 + 2; i++) {
      if (Math.abs(nextX - nextY) < 1e-10) {
        distance = nextX;
        if (solid(cx + sx, cy) || solid(cx, cy + sy)) break;
        cx += sx;
        cy += sy;
        nextX += stepX;
        nextY += stepY;
      } else if (nextX < nextY) {
        distance = nextX;
        cx += sx;
        nextX += stepX;
      } else {
        distance = nextY;
        cy += sy;
        nextY += stepY;
      }
      if (solid(cx, cy)) break;
    }
    return { x: x + dx * distance, y: y + dy * distance };
  };
  const angles = [...corners]
    .flatMap((corner) => {
      const [cx, cy] = corner.split(',').map(Number),
        angle = Math.atan2(cy - y, cx - x);
      return [angle - 1e-7, angle, angle + 1e-7];
    })
    .sort((a, b) => a - b);
  const polygon = angles.map(ray),
    visible = new Uint8Array(side * side),
    surfaces: number[] = [];
  for (let cy = 0; cy < side; cy++)
    for (let cx = 0; cx < side; cx++) {
      const clipped = sightTile(polygon, cx, cy),
        area = sightArea(clipped);
      const surface = solid(cx, cy) && clipped.length > 1 && clipped.some((p) => Math.hypot(p.x - clipped[0].x, p.y - clipped[0].y) > 1e-5);
      if (area > 1e-8 || surface) {
        const index = cy * side + cx;
        visible[index] = 1;
        if (surface) surfaces.push(index);
      }
    }
  visible[y * side + x] = 1;
  return { side, eye: { x, y }, polygon, visible, surfaces };
}
