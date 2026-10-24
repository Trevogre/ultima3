import { Shape } from '../game/tiles.ts';
import type { GraphicsSet } from './graphics.ts';

export function isBuilding(shape: number): boolean {
  return shape === Shape.Town || shape === Shape.Castle || shape === Shape.Dungeon || shape === Shape.Shrine;
}

export function buildingGround(shape: number): number {
  return shape === Shape.Dungeon ? Shape.Mountains : Shape.Grass;
}

/** Remove only background connected to an image edge, keeping enclosed details intact. */
export function cutoutBackground(pixels: Uint8ClampedArray, ground: Uint8ClampedArray, width: number, height: number): void {
  const rgba = (i: number): string => `${pixels[i * 4]},${pixels[i * 4 + 1]},${pixels[i * 4 + 2]}`;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  if ([0, width - 1, (height - 1) * width, width * height - 1].every((i) => pixels[i * 4 + 3] === 0)) return;
  const colours = new Map<string, number>();
  for (const i of border) colours.set(rgba(i), (colours.get(rgba(i)) ?? 0) + 1);
  const dominant = [...colours].sort((a, b) => b[1] - a[1])[0];
  const background = dominant && dominant[1] >= border.length * 0.35 ? dominant[0] : null;
  const seen = new Uint8Array(width * height);
  const queue = [...border];
  for (let n = 0; n < queue.length; n++) {
    const i = queue[n];
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    const matches = pixels[p] === ground[p] && pixels[p + 1] === ground[p + 1] && pixels[p + 2] === ground[p + 2];
    if (pixels[p + 3] && !matches && rgba(i) !== background) continue;
    pixels[p + 3] = 0;
    const x = i % width;
    if (x) queue.push(i - 1);
    if (x < width - 1) queue.push(i + 1);
    if (i >= width) queue.push(i - width);
    if (i < width * (height - 1)) queue.push(i + width);
  }
}

const cache = new WeakMap<GraphicsSet, Map<string, HTMLCanvasElement>>();

/** Derive cutouts from the existing tile art; never alter the source graphics files. */
export function buildingArt(gfx: GraphicsSet, shape: number): HTMLCanvasElement {
  let images = cache.get(gfx);
  if (!images) {
    images = new Map();
    cache.set(gfx, images);
  }
  const rect = gfx.tileRect(shape >> 1);
  const key = `${shape}:${rect.x}:${rect.y}`;
  const saved = images.get(key);
  if (saved) return saved;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  if (gfx.buildingCards) {
    const slot = ([Shape.Town, Shape.Castle, Shape.Dungeon, Shape.Shrine] as number[]).indexOf(shape);
    if (slot >= 0) {
      const size = gfx.buildingCards.height;
      const frame = Math.floor(rect.x / rect.w) % 2;
      ctx.drawImage(gfx.buildingCards, (slot + frame * 4) * size, 0, size, size, 0, 0, 64, 64);
      images.set(key, canvas);
      return canvas;
    }
  }
  gfx.drawShape(ctx, buildingGround(shape), 0, 0, 64);
  const ground = ctx.getImageData(0, 0, 64, 64);
  ctx.clearRect(0, 0, 64, 64);
  gfx.drawShape(ctx, shape, 0, 0, 64, { masked: true });
  const image = ctx.getImageData(0, 0, 64, 64);
  cutoutBackground(image.data, ground.data, 64, 64);
  ctx.putImageData(image, 0, 0);
  images.set(key, canvas);
  return canvas;
}

/** Native tile coordinates of the lowest retained foundation pixels. */
export function buildingBase(pixels: Uint8ClampedArray, width: number, height: number): readonly [number, number] {
  for (let y = height - 1; y >= 0; y--) {
    let sum = 0,
      count = 0;
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      sum += x + 0.5;
      count++;
    }
    if (count) return [((sum / count) * 64) / width, ((y + 1) * 64) / height];
  }
  return [32, 64];
}

const bases = new WeakMap<HTMLCanvasElement, readonly [number, number]>();
export function buildingAnchor(gfx: GraphicsSet, shape: number): readonly [number, number] {
  const image = buildingArt(gfx, shape);
  let base = bases.get(image);
  if (!base) {
    base = buildingBase(image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
    bases.set(image, base);
  }
  return base;
}
