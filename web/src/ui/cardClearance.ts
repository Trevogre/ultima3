interface XY {
  x: number;
  y: number;
}
interface Edges {
  left: boolean;
  right: boolean;
  bottom: boolean;
  top: boolean;
}

/** Keep a billboard out of adjacent solid tiles, retaining normal depth tests.
 * Only tight opposing walls require shrinking; a single wall just shifts it.
 */
export function confineCard(center: XY, right: XY, up: XY, size: number, tileX: number, tileY: number, blocked: Edges) {
  const halfX = (size * (Math.abs(right.x) + Math.abs(up.x))) / 2;
  const halfY = (size * (Math.abs(right.y) + Math.abs(up.y))) / 2;
  const halfTile = 0.499;
  const scale = Math.min(1, blocked.left && blocked.right ? halfTile / halfX : 1, blocked.bottom && blocked.top ? halfTile / halfY : 1);
  const x = Math.max(
    blocked.left ? tileX - halfTile + halfX * scale : -Infinity,
    Math.min(center.x, blocked.right ? tileX + halfTile - halfX * scale : Infinity),
  );
  const y = Math.max(
    blocked.bottom ? tileY - halfTile + halfY * scale : -Infinity,
    Math.min(center.y, blocked.top ? tileY + halfTile - halfY * scale : Infinity),
  );
  return { dx: x - center.x, dy: y - center.y, scale };
}
