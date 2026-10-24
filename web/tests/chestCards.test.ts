import { describe, expect, it, vi } from 'vitest';
import { GraphicsSet } from '../src/ui/graphics.ts';
import { Shape } from '../src/game/tiles.ts';

// Exercise actual draw routing without a DOM or image decoder.
describe('reviewed chest card rendering', () => {
  it('uses both cutout frames only for angled cards and preserves flat and missing-set fallbacks', () => {
    const tiles = {},
      cards = { height: 128 },
      swapped = new Uint8Array(192);
    const gfx = Object.create(GraphicsSet.prototype) as GraphicsSet;
    Object.assign(gfx, {
      tileSize: 128,
      maskedTiles: tiles,
      opaqueTiles: tiles,
      chestCards: cards,
      hasClassFigures: true,
      swapped,
      scroll: new Map(),
    });
    const drawImage = vi.fn(),
      ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    for (const frame of [0, 1]) {
      swapped[Shape.Chest >> 1] = frame;
      gfx.drawShape(ctx, Shape.Chest, 10, 20, 64, { masked: true, card: true });
      expect(drawImage).toHaveBeenLastCalledWith(cards, frame * 128, 0, 128, 128, 10, 20, 64, 64);
      gfx.drawShape(ctx, Shape.Chest, 10, 20, 64, { masked: true, card: false });
      expect(drawImage).toHaveBeenLastCalledWith(tiles, frame * 128, 9 * 128, 128, 128, 10, 20, 64, 64);
    }
    Object.assign(gfx, { chestCards: null });
    gfx.drawShape(ctx, Shape.Chest, 10, 20, 64, { masked: true, card: true });
    expect(drawImage).toHaveBeenLastCalledWith(tiles, 128, 9 * 128, 128, 128, 10, 20, 64, 64);
  });
});

describe('reviewed door front routing', () => {
  it('fills the standing plane from the door front while keeping the complete overhead tile', () => {
    const gfx = Object.create(GraphicsSet.prototype) as GraphicsSet;
    const tiles = {},
      card = { width: 74, height: 120 };
    Object.assign(gfx, {
      tileSize: 128,
      maskedTiles: tiles,
      opaqueTiles: tiles,
      doorCard: card,
      hasClassFigures: true,
      swapped: new Uint8Array(192),
      scroll: new Map(),
    });
    const drawImage = vi.fn(),
      ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    gfx.drawShape(ctx, Shape.Door, 0, 0, 64, { masked: true, card: true });
    expect(drawImage).toHaveBeenLastCalledWith(card, 0, 0, 74, 120, 0, 0, 64, 64);
    gfx.drawShape(ctx, Shape.Door, 0, 0, 64, { masked: true });
    expect(drawImage).toHaveBeenLastCalledWith(tiles, 5 * 128, 14 * 128, 128, 128, 0, 0, 64, 64);
  });
});
