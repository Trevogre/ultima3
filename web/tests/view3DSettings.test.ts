import { describe, expect, it } from 'vitest';
import { DEFAULT_3D_SETTINGS, read3DSettings } from '../src/ui/view3DSettings.ts';
import { cutoutBackground } from '../src/ui/billboardArt.ts';

describe('3D display preferences', () => {
  it('upgrades missing or partial old preferences while preserving explicit Off choices', () => {
    expect(read3DSettings(undefined)).toEqual(DEFAULT_3D_SETTINGS);
    expect(read3DSettings({ characters: false, buildings: false })).toEqual({
      ...DEFAULT_3D_SETTINGS,
      characters: false,
      buildings: false,
    });
    expect(read3DSettings({ enabled: false, distantTerrain: false, mouseCamera: false })).toMatchObject({
      enabled: false,
      distantTerrain: false,
      mouseCamera: false,
    });
    expect(read3DSettings({ walls: false, mountains: false })).toMatchObject({ walls: false, mountains: false });
  });

  it('ignores invalid values and gives each reader independent defaults', () => {
    const first = read3DSettings({ enabled: 'false', characters: 0, buildings: null });
    expect(first).toEqual(DEFAULT_3D_SETTINGS);
    first.characters = false;
    expect(read3DSettings(null).characters).toBe(true);
  });
});

describe('building card artwork', () => {
  it('removes exterior ground while preserving the same colour enclosed inside a building', () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
    const ground = pixels.slice();
    for (let y = 1; y <= 3; y++)
      for (let x = 1; x <= 3; x++) {
        if (x === 2 && y === 2) continue;
        const at = (y * 5 + x) * 4;
        pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
      }
    cutoutBackground(pixels, ground, 5, 5);
    expect(pixels[3]).toBe(0);
    expect(pixels[(2 * 5 + 2) * 4 + 3]).toBe(255);
    expect(pixels[(1 * 5 + 1) * 4 + 3]).toBe(255);
  });

  it('preserves art which already has a transparent cutout', () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    pixels.set([30, 80, 50, 128], 4 * 4);
    const original = pixels.slice();
    cutoutBackground(pixels, original, 3, 3);
    expect(pixels).toEqual(original);
  });
});
