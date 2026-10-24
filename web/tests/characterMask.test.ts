import { describe, expect, it } from 'vitest';
import { characterCard, clearCharacterBackground, useCharacterCutouts } from '../src/ui/characterMask.ts';
import { Shape } from '../src/game/tiles.ts';

describe('legacy character card alpha', () => {
  it('keeps original backgrounds overhead and flat, deriving alpha only for angled character cards', () => {
    expect(useCharacterCutouts(true, true, 0)).toBe(false);
    expect(useCharacterCutouts(true, true, Math.PI / 4)).toBe(true);
    expect(useCharacterCutouts(true, false, Math.PI / 4)).toBe(false);
    expect(useCharacterCutouts(false, true, Math.PI / 4)).toBe(false);
    expect(useCharacterCutouts(true, true, 0.001)).toBe(false);
  });
  it.each([0, 255] as const)('removes only exterior %i while retaining enclosed details and all RGB', (background) => {
    const pixels = new Uint8ClampedArray(7 * 7 * 4);
    for (let i = 0; i < 49; i++) pixels.set([background, background, background, 255], i * 4);
    for (let y = 1; y < 6; y++)
      for (let x = 1; x < 6; x++)
        if (x === 1 || x === 5 || y === 1 || y === 5)
          pixels.set([255 - background, 255 - background, 255 - background, 255], (y * 7 + x) * 4);
    const before = pixels.slice();
    clearCharacterBackground(pixels, 7, 7, background);
    expect(pixels[3]).toBe(0);
    expect(pixels[(3 * 7 + 3) * 4 + 3]).toBe(255);
    for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) expect(pixels[i]).toBe(before[i]);
  });
  it('preserves native alpha including partial edge transparency', () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    pixels[3] = 128;
    const before = pixels.slice();
    clearCharacterBackground(pixels, 4, 4, 255);
    expect(pixels).toEqual(before);
  });
  it('excludes terrain, letters, buildings, whirlpool and spell effects', () => {
    for (const shape of [Shape.Grass, Shape.Forest, Shape.Brush, Shape.Town, Shape.Water, Shape.Whirlpool, Shape.MagicBall, 0x4c])
      expect(characterCard(shape)).toBe(false);
    for (const shape of [Shape.Ranger, Shape.Jester, Shape.Horse, 0x20, 0x3c, 0x80, 0xbe]) expect(characterCard(shape)).toBe(true);
  });
});
