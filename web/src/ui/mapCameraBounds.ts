/** Half-width/height on the ground covered by a square orthographic viewport. */
export function groundExtents(viewSide: number, yaw: number, tilt: number, zoom: number): { x: number; y: number } {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const stretch = 1 / Math.cos(tilt);
  const half = viewSide / (2 * zoom);
  return { x: half * (c + s * stretch), y: half * (s + c * stretch) };
}

/** Minimum zoom that keeps all four viewport corners over the map at this angle. */
export function minimumMapZoom(viewSide: number, mapSide: number, yaw: number, tilt: number): number {
  const half = groundExtents(viewSide, yaw, tilt, 1);
  return (2 * Math.max(half.x, half.y)) / mapSide;
}

/** Fit the arena and one-tile-high cards/cubes, leaving a small border. */
export function battlefieldZoom(side: number, yaw: number, tilt: number): number {
  const span = side * (Math.abs(Math.cos(yaw)) + Math.abs(Math.sin(yaw)));
  return (0.9 * side) / Math.max(span, span * Math.cos(tilt) + 2 * Math.sin(tilt));
}

/** Stay near the party, shifting inward only when the ground footprint reaches an edge. */
export function mapCameraTarget(
  viewSide: number,
  mapSide: number,
  yaw: number,
  tilt: number,
  zoom: number,
  centreX: number,
  centreY: number,
): { x: number; y: number } {
  const half = groundExtents(viewSide, yaw, tilt, zoom);
  const clamp = (centre: number, extent: number): number => {
    const room = Math.max(0, mapSide / 2 - extent);
    return Math.max(centre - room, Math.min(centre + room, 0));
  };
  return { x: clamp(centreX, half.x), y: clamp(centreY, half.y) };
}
