import { describe, expect, it } from 'vitest';
import { confineCard } from '../src/ui/cardClearance.ts';

describe('actor clearance from neighbouring cubes', () => {
  it('clears rear walls through a full orbit at all supported tilts, including party corner slots', () => {
    for (const size of [0.5, 1])
      for (const tiltDegrees of [5, 25, 45, 70])
        for (let yawDegrees = 0; yawDegrees < 360; yawDegrees += 5) {
          const tilt = (tiltDegrees * Math.PI) / 180,
            yaw = (yawDegrees * Math.PI) / 180;
          const right = { x: Math.cos(yaw), y: Math.sin(yaw) },
            up = { x: -Math.sin(yaw) * Math.cos(tilt), y: Math.cos(yaw) * Math.cos(tilt) };
          for (const edges of [
            { left: false, right: false, bottom: false, top: true },
            { left: true, right: false, bottom: false, top: true },
            { left: true, right: true, bottom: true, top: true },
          ])
            for (const anchor of size === 1
              ? [{ x: 0, y: 0 }]
              : [
                  { x: -0.25, y: 0.25 },
                  { x: 0.25, y: -0.25 },
                ]) {
              const center = { x: anchor.x + (up.x * size * Math.sin(tilt)) / 2, y: anchor.y + (up.y * size * Math.sin(tilt)) / 2 };
              const fit = confineCard(center, right, up, size, 0, 0, edges);
              for (const x of [-0.5, 0.5])
                for (const y of [-0.5, 0.5]) {
                  const px = center.x + fit.dx + (right.x * x + up.x * y) * size * fit.scale;
                  const py = center.y + fit.dy + (right.y * x + up.y * y) * size * fit.scale;
                  if (edges.left) expect(px).toBeGreaterThanOrEqual(-0.49900001);
                  if (edges.right) expect(px).toBeLessThanOrEqual(0.49900001);
                  if (edges.bottom) expect(py).toBeGreaterThanOrEqual(-0.49900001);
                  if (edges.top) expect(py).toBeLessThanOrEqual(0.49900001);
                }
              if (!edges.left && !edges.right) expect(fit.scale).toBe(1);
            }
        }
  });
  it('leaves unblocked cards unchanged', () => {
    expect(
      confineCard({ x: 0.25, y: 0.25 }, { x: 0.7, y: 0.7 }, { x: -0.5, y: 0.5 }, 1, 0, 0, {
        left: false,
        right: false,
        bottom: false,
        top: false,
      }),
    ).toEqual({ dx: 0, dy: 0, scale: 1 });
  });
});
