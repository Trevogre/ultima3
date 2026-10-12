/**
 * chart.ts
 *
 * Sosaria's chart: the page of the map (worldMap.ts) under what the party has seen of the land, as a map the party
 * set out with would be - its coasts drawn in ink on old paper, the land a shade darker than the sea, and nothing
 * else: no forests, no towns, no names. Made from the map as the game ships it, so a ship or a monster at sea is not
 * drawn into it. The squares the party has seen are drawn over it in the tile set's tiles (screen.ts).
 */

import { MAP_SIDE } from '../game/automap.ts';
import { coastSegments } from '../game/worldMap.ts';

const PAPER: [number, number, number] = [226, 203, 160];
const INK = '#4a3524';

/** A small seeded generator, so the paper's grain is the same every time the chart is drawn. */
function grain(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw the chart on `ctx`, `sq` pixels a square, from which squares are land; the map wraps at its edges. */
export function drawChart(ctx: CanvasRenderingContext2D, sq: number, isLand: (x: number, y: number) => boolean): void {
  const size = Math.round(sq * MAP_SIDE);
  // Paper, with a grain: each pixel a little lighter or darker, the same each time.
  const image = ctx.createImageData(size, size);
  const rand = grain(1983);
  for (let i = 0; i < size * size; i++) {
    const d = (rand() - 0.5) * 18;
    image.data[i * 4] = PAPER[0] + d;
    image.data[i * 4 + 1] = PAPER[1] + d;
    image.data[i * 4 + 2] = PAPER[2] + d * 0.8;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  // The land a shade darker than the sea.
  ctx.fillStyle = 'rgba(120, 88, 40, 0.16)';
  for (let y = 0; y < MAP_SIDE; y++) for (let x = 0; x < MAP_SIDE; x++) if (isLand(x, y)) ctx.fillRect(x * sq, y * sq, sq, sq);
  // The coasts in ink, a wide pale line under a fine dark one, so a coast reads as drawn.
  const segments = coastSegments(isLand, MAP_SIDE, true);
  const stroke = (colour: string, width: number) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segments) {
      ctx.moveTo(x1 * sq, y1 * sq);
      ctx.lineTo(x2 * sq, y2 * sq);
    }
    ctx.stroke();
  };
  stroke('rgba(74, 53, 36, 0.25)', Math.max(3, sq * 0.45));
  stroke(INK, Math.max(1.2, sq * 0.15));
  // The paper's edges darkened with age.
  const age = ctx.createRadialGradient(size / 2, size / 2, size * 0.35, size / 2, size / 2, size * 0.75);
  age.addColorStop(0, 'rgba(90, 60, 20, 0)');
  age.addColorStop(1, 'rgba(90, 60, 20, 0.35)');
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, size, size);
}
