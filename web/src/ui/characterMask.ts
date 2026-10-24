import { Shape } from '../game/tiles.ts';

/** Characters and their sheet variants; never terrain, signs or spell effects. */
export function characterCard(shape: number): boolean {
  return (
    shape === Shape.Horse ||
    shape === Shape.Frigate ||
    (shape >= Shape.Serpent && shape <= Shape.Pirate) ||
    (shape >= 0x20 && shape <= 0x3c) ||
    shape === Shape.Ranger ||
    (shape >= 0x80 && shape <= 0xbe)
  );
}

/** Derive alpha only for opaque legacy figures, retaining enclosed background-colour details. */
export function clearCharacterBackground(pixels: Uint8ClampedArray, width: number, height: number, background: 0 | 255): void {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) return;
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) queue.push(y * width, y * width + width - 1);
  for (let n = 0; n < queue.length; n++) {
    const i = queue[n];
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    if (pixels[p] !== background || pixels[p + 1] !== background || pixels[p + 2] !== background) continue;
    pixels[p + 3] = 0;
    const x = i % width;
    if (x) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (i >= width) queue.push(i - width);
    if (i < width * (height - 1)) queue.push(i + width);
  }
}
