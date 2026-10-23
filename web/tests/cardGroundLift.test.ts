import { describe, expect, it } from 'vitest';
import { cardGroundLift } from '../src/ui/cardGroundLift.ts';

describe('card ground clearance', () => {
  it('keeps the lower edge above ground for party, actor and building cards at every supported tilt', () => {
    for (const size of [0.5, 1]) {
      for (let degrees = 0; degrees <= 70; degrees++) {
        const tilt = (degrees * Math.PI) / 180;
        const sin = Math.sin(tilt);
        const centreHeight = (size * sin * sin) / 2 + cardGroundLift(size, tilt);
        expect(centreHeight - (size * sin) / 2).toBeCloseTo(0.001, 10);
      }
    }
  });

  it('adds only a small clearance overhead and at the maximum tilt', () => {
    expect(cardGroundLift(1, 0)).toBe(0.001);
    expect(cardGroundLift(1, (70 * Math.PI) / 180)).toBeLessThan(0.03);
  });
});
