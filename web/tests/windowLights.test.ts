import { describe, expect, it } from 'vitest';
import { Shape } from '../src/game/tiles.ts';
import { WindowLights, windowNight, windowSpill } from '../src/ui/windowLights.ts';
import { DEFAULT_3D_SETTINGS } from '../src/ui/view3DSettings.ts';
import { daylightColour } from '../src/ui/daylight.ts';

describe('night window light', () => {
  it('fades out in daylight and when the day/night tint is disabled', () => {
    expect(windowNight([1, 1, 1])).toBe(0);
    expect(windowNight(daylightColour(4, 12))).toBe(0);
    expect(windowNight(daylightColour(0, 12))).toBe(1);
  });
  it('falls off within a few tiles and casts shadows behind raised terrain', () => {
    const options = { ...DEFAULT_3D_SETTINGS, mountains: true, walls: true };
    expect(windowSpill(1, 0, () => Shape.Grass, options)).toBeGreaterThan(windowSpill(2, 0, () => Shape.Grass, options));
    expect(windowSpill(3.5, 0, () => Shape.Grass, options)).toBe(0);
    const wall = (x: number) => (Math.round(x) === 1 ? Shape.Wall : Shape.Grass);
    expect(windowSpill(2, 0, wall, options)).toBe(0);
    expect(windowSpill(2, 0, wall, { ...options, walls: false })).toBeGreaterThan(0);
    expect(windowSpill(2, 0, (x) => (Math.round(x) === 1 ? Shape.Mountains : Shape.Grass), options)).toBe(0);
    expect(windowSpill(2, 0, () => Shape.Void, options)).toBe(0);
  });
  it('only places lights at known settlements and clears them when disabled or switching scenes', () => {
    const lights = new WindowLights();
    const cells = [Shape.Town, Shape.Grass, Shape.Void, Shape.Castle].map((base) => ({ base }));
    lights.setNight(1);
    lights.set(null, cells, DEFAULT_3D_SETTINGS, true);
    expect(lights.group.children).toHaveLength(2);
    expect(lights.group.children[0].position.x).toBe(-0.5);
    lights.setNight(0);
    expect(lights.group.visible).toBe(false);
    lights.set(null, cells, DEFAULT_3D_SETTINGS, false);
    expect(lights.group.children).toHaveLength(0);
    lights.dispose();
  });
});
