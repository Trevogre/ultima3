/** Grid sight rays and exposed wall faces, independent of camera angle, with solid corners. */
export function townSightMask(side: number, x: number, y: number, blocked: (x: number, y: number) => boolean): Uint8Array {
  const visible = new Uint8Array(side * side);
  const sight = (tx: number, ty: number, edgeX = 0, edgeY = 0): boolean => {
    let cx = x,
      cy = y;
    const dx = tx + edgeX - x,
      dy = ty + edgeY - y,
      sx = Math.sign(dx),
      sy = Math.sign(dy);
    const stepX = dx ? 1 / Math.abs(dx) : Infinity,
      stepY = dy ? 1 / Math.abs(dy) : Infinity;
    let nextX = stepX / 2,
      nextY = stepY / 2;
    while (cx !== tx || cy !== ty) {
      if (Math.abs(nextX - nextY) < 1e-10) {
        // A ray touching a solid corner cannot see through either wall edge.
        if (blocked(cx + sx, cy) || blocked(cx, cy + sy)) return false;
        cx += sx;
        cy += sy;
        nextX += stepX;
        nextY += stepY;
      } else if (nextX < nextY) {
        cx += sx;
        nextX += stepX;
      } else {
        cy += sy;
        nextY += stepY;
      }
      if (cx === tx && cy === ty) return true; // the blocking surface itself is visible
      if (blocked(cx, cy)) return false;
    }
    return true;
  };
  for (let ty = 0; ty < side; ty++)
    for (let tx = 0; tx < side; tx++) {
      // Exposed wall faces remain visible down a hall even when their centres
      // are occluded by another tile in the same continuous wall.
      if (
        sight(tx, ty) ||
        (blocked(tx, ty) &&
          ((tx !== x && sight(tx, ty, Math.sign(x - tx) * 0.499, 0)) || (ty !== y && sight(tx, ty, 0, Math.sign(y - ty) * 0.499))))
      )
        visible[ty * side + tx] = 1;
    }
  return visible;
}
