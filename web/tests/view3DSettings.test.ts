import { describe, expect, it } from 'vitest';
import { DEFAULT_3D_SETTINGS, read3DSettings } from '../src/ui/view3DSettings.ts';
import { cutoutBackground } from '../src/ui/billboardArt.ts';

describe('3D display preferences', () => {
  it('enables cosmetic day/night by default while preserving an explicit Off choice', () => {
    expect(read3DSettings({}).dayNight).toBe(true);
    expect(read3DSettings({ dayNight: false }).dayNight).toBe(false);
  });
  it('defaults map rotation to 5 independently of tilt and preserves valid saved rotation', () => {
    expect(read3DSettings({ fixedAngle: 45 })).toMatchObject({ fixedAngle: 45, fixedRotation: 5 });
    expect(read3DSettings({ fixedRotation: 120 }).fixedRotation).toBe(120);
    for (const fixedRotation of [-5, 360, NaN, Infinity, '25']) expect(read3DSettings({ fixedRotation }).fixedRotation).toBe(5);
  });
  it('defaults to 45 degrees and accepts only finite fixed angles in the supported range', () => {
    expect(read3DSettings({}).fixedAngle).toBe(45);
    for (const fixedAngle of [0, 25, 45, 70]) expect(read3DSettings({ fixedAngle }).fixedAngle).toBe(fixedAngle);
    for (const fixedAngle of [-1, 71, NaN, Infinity, '25', true, null]) expect(read3DSettings({ fixedAngle }).fixedAngle).toBe(45);
  });
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
    expect(read3DSettings({ fixedCamera: false }).fixedCamera).toBe(false);
    expect(read3DSettings({ fixedCamera: 'free' }).fixedCamera).toBe(true);
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
