import { describe, expect, it } from 'vitest';
import { daylightColour } from '../src/ui/daylight.ts';

describe('cosmetic daylight', () => {
  it('starts the initial game at full daylight, with readable blue moonlight at midnight', () => {
    expect(daylightColour(4, 12)).toEqual([1, 1, 1]);
    const [red, green, blue] = daylightColour(0, 12);
    expect(red).toBeGreaterThanOrEqual(0.35);
    expect(blue).toBeGreaterThan(green);
    expect(green).toBeGreaterThan(red);
  });

  it('has warm twilight and a gradual repeating cycle across phase boundaries', () => {
    const dusk = daylightColour(6, 12);
    expect(dusk[0]).toBeGreaterThan(daylightColour(0, 12)[0]);
    expect(dusk[2]).toBeLessThan(0.65 + 0.35 * 0.2);
    for (let turn = 0; turn < 96; turn++) {
      const colour = daylightColour(Math.floor(turn / 12), 12 - (turn % 12));
      const next = (turn + 1) % 96;
      const following = daylightColour(Math.floor(next / 12), 12 - (next % 12));
      colour.forEach((channel, i) => {
        expect(channel).toBeGreaterThanOrEqual(0.35);
        expect(channel).toBeLessThanOrEqual(1);
        expect(Math.abs(channel - following[i])).toBeLessThan(0.08);
      });
    }
  });
});
