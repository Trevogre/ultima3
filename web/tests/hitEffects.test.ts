import { describe, expect, it, vi } from 'vitest';
import { drawPaintedHit, usesGroundHit } from '../src/ui/hitEffects.ts';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

describe('painted ground hit indicators', () => {
  it('uses ground effects for Standard and Van Gogh while retaining legacy HIT tiles elsewhere', () => {
    expect(usesGroundHit('Standard')).toBe(true);
    expect(usesGroundHit('Van Gogh')).toBe(true);
    expect(usesGroundHit('Apple II Mono')).toBe(false);
  });
  it('expands a clipped painted ring from frame A, keeping its centre clear and its drawing state contained', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), moveTo: vi.fn(), clip: vi.fn(), drawImage: vi.fn() };
    const tileRect = vi.fn(() => ({ x: 10, y: 20, w: 128, h: 128 }));
    const gfx = { maskedTiles: {}, tileRect } as unknown as GraphicsSet;
    for (const shape of [Shape.MagicBall, Shape.FireBall]) {
      let previous = 0;
      for (const frame of [1, 2, 3]) {
        ctx.arc.mockClear();
        drawPaintedHit(ctx as unknown as CanvasRenderingContext2D, gfx, 0, 0, 64, frame, shape);
        const radius = ctx.arc.mock.calls[0][2] as number;
        expect(radius).toBeGreaterThan(previous);
        previous = radius;
        expect(ctx.arc.mock.calls[1][2]).toBeGreaterThan(0);
        expect(ctx.arc.mock.calls[1][2]).toBeLessThan(radius);
        expect(ctx.clip).toHaveBeenLastCalledWith('evenodd');
        expect(tileRect).toHaveBeenLastCalledWith(shape >> 1, false);
        expect(ctx.drawImage).toHaveBeenLastCalledWith(gfx.maskedTiles, 10, 20, 128, 128, 32 - radius, 32 - radius, radius * 2, radius * 2);
      }
    }
    expect(ctx.save).toHaveBeenCalledTimes(6);
    expect(ctx.restore).toHaveBeenCalledTimes(6);
  });
});
