/** Lift a camera-facing card so its lowest edge stays just above the ground. */
export function cardGroundLift(size: number, tilt: number): number {
  const sin = Math.sin(tilt);
  // The existing foot-anchor shift raises the centre by size * sin² / 2,
  // while the card's lower edge extends down by size * sin / 2.
  return (size * sin * (1 - sin)) / 2 + 0.001;
}
