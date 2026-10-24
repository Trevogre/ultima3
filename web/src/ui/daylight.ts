/** A cosmetic day per 96 outdoor turns, starting at noon. */
export function daylightColour(phase: number, timer: number): [number, number, number] {
  const turn = phase * 12 + (12 - timer);
  const sun = Math.cos(((turn - 48) / 96) * Math.PI * 2);
  const day = Math.max(0, Math.min(1, (sun + 0.25) / 1.25));
  const twilight = Math.max(0, 1 - Math.abs(sun) * 4);
  // Moonlit blue nights remain readable; sunrise and sunset warm the scene.
  return [0.35 + 0.65 * day + 0.12 * twilight, 0.43 + 0.57 * day, 0.65 + 0.35 * day - 0.12 * twilight];
}
