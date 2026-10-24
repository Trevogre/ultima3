import { Shape } from '../game/tiles.ts';
import type { GraphicsSet } from './graphics.ts';

export function usesGroundHit(tileSet: string): boolean {
  return tileSet === 'Standard' || tileSet === 'Van Gogh';
}

/** Expand the set's painted orb rim as a ground ring, never its HIT-text frame. */
export function drawPaintedHit(
  ctx: CanvasRenderingContext2D,
  gfx: GraphicsSet,
  x: number,
  y: number,
  size: number,
  frame: number,
  shape: number,
): void {
  const radius = (([0, 2.6, 4.6, 6.8][frame] ?? 0) * size) / 16;
  if (!radius) return;
  const cx = x + size / 2,
    cy = y + size / 2,
    inner = radius * (frame === 3 ? 0.72 : 0.52);
  const orb = shape === Shape.MagicBall ? Shape.MagicBall : Shape.FireBall;
  const rect = gfx.tileRect(orb >> 1, false);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.moveTo(cx + inner, cy);
  ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.drawImage(gfx.maskedTiles, rect.x, rect.y, rect.w, rect.h, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}
