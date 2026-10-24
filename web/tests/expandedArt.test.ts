import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { TILE_SETS } from '../src/ui/help.ts';
import { VEGETATION_LAYOUTS } from '../src/ui/vegetationLayouts.ts';

/** Decode the shipped RGBA PNGs so animation invariants check actual pixels. */
function rgba(file: string) {
  const png = readFileSync(new URL(`../public/graphics/Van Gogh-${file}.png`, import.meta.url));
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20),
    chunks: Buffer[] = [];
  expect([png[24], png[25]]).toEqual([8, 6]);
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const compressed = inflateSync(Buffer.concat(chunks)),
    stride = width * 4,
    pixels = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c,
      da = Math.abs(p - a),
      db = Math.abs(p - b),
      dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = compressed[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x,
        a = x >= 4 ? pixels[i - 4] : 0,
        b = y ? pixels[i - stride] : 0,
        c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      pixels[i] = (compressed[y * (stride + 1) + x + 1] + prediction) & 255;
    }
  }
  return (x: number, y: number) => pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4);
}

describe('opt-in Van Gogh art package', () => {
  it('provides chest card silhouettes without changing painted foreground pixels or the flat background', () => {
    const atlas = rgba('Tiles'),
      cards = rgba('ChestCards');
    for (const frame of [0, 1]) {
      expect(cards(frame * 128 + 120, 5)[3]).toBe(0);
      expect(atlas(frame * 128 + 120, 9 * 128 + 5)[3]).toBeGreaterThan(0);
      expect(cards(frame * 128 + 60, 80)).toEqual(atlas(frame * 128 + 60, 9 * 128 + 80));
      let visible = 0,
        clear = 0;
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const card = cards(frame * 128 + x, y),
            original = atlas(frame * 128 + x, 9 * 128 + y);
          expect(card.subarray(0, 3)).toEqual(original.subarray(0, 3));
          if (card[3]) visible++;
          else clear++;
        }
      expect(visible).toBeGreaterThan(7000);
      expect(clear).toBeGreaterThan(4000);
    }
  });
  it('keeps the starter ranger frames clear of the whirlpool below the class figures', () => {
    const atlas = rgba('Tiles');
    for (const frame of [0, 1]) {
      for (let y = 124; y < 128; y++) {
        let opaque = 0;
        for (let x = 0; x < 128; x++) if (atlas((8 + frame) * 128 + x, 14 * 128 + y)[3] >= 8) opaque++;
        expect(opaque).toBeLessThan(100); // feet are allowed, a full-width next tile is not
      }
      for (const x of [0, 127]) expect(atlas((8 + frame) * 128 + x, 15 * 128 - 1)[3]).toBeLessThan(8);
    }
  });
  it('keeps the jester outfit, head and feet fixed while only his raised hand waves', () => {
    const atlas = rgba('Tiles');
    let changed = 0;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const a = atlas(2 * 128 + x, 128 + y),
          b = atlas(3 * 128 + x, 128 + y);
        if (!a.equals(b)) {
          expect(x < 36 && y >= 18 && y < 56).toBe(true);
          changed++;
        }
      }
    expect(changed).toBeGreaterThan(20);
  });
  it('keeps the neighbouring force-field stripe out of alternate NPC frames', () => {
    const atlas = rgba('Tiles');
    for (let index = 16; index <= 23; index++)
      for (let y = 0; y < 128; y++) for (const x of [126, 127]) expect(atlas(3 * 128 + x, (index % 16) * 128 + y)[3]).toBe(0);
  });
  it('keeps both whirlpool frames inside their row, without the green serpent tile bleeding below', () => {
    const atlas = rgba('Tiles');
    for (const frame of [0, 1])
      for (let x = 0; x < 128; x++) {
        const pixel = atlas(frame * 128 + x, 13 * 128 - 1);
        expect(pixel[2]).toBeGreaterThan(pixel[1]);
        expect(pixel[3]).toBe(255);
      }
  });
  it('animates only flag cloth and retains blue doors, stone edges and the painted ground', () => {
    const atlas = rgba('Tiles'),
      cards = rgba('BuildingCards'),
      grounds = rgba('BuildingGrounds');
    for (const { index, slot, flag } of [
      { index: 6, slot: 0, flag: [45, 0, 92, 24] },
      { index: 7, slot: 1, flag: [66, 0, 107, 25] },
    ]) {
      let changed = 0,
        background = 0;
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const a = atlas(x, index * 128 + y),
            b = atlas(x + 128, index * 128 + y);
          const inside = x >= flag[0] && x < flag[2] && y >= flag[1] && y < flag[3];
          if (!a.equals(b)) {
            expect(inside).toBe(true);
            changed++;
          }
          expect(grounds(slot * 128 + x, y)).toEqual(grounds((slot + 4) * 128 + x, y));
          for (const frame of [0, 1]) {
            const original = atlas(x + frame * 128, index * 128 + y),
              card = cards((slot + frame * 4) * 128 + x, y);
            if (card[3] === 255) expect(card).toEqual(original);
            else {
              expect(grounds((slot + frame * 4) * 128 + x, y)).toEqual(original);
              background++;
            }
          }
        }
      expect(changed).toBeGreaterThan(100);
      expect(background).toBeGreaterThan(1000);
    }
    // Cool-coloured interiors and pale outer walls must never become holes.
    for (const [slot, x, y] of [
      [0, 38, 65],
      [0, 90, 105],
      [0, 18, 85],
      [1, 23, 47],
      [1, 85, 47],
      [1, 12, 80],
    ])
      expect(cards(slot * 128 + x, y)[3]).toBe(255);
  });
  it('ships a canonical atlas, paired building cutouts and independently anchored plants', () => {
    expect(TILE_SETS[0]).toBe('Standard');
    expect(TILE_SETS).toContain('Van Gogh');
    const manifest = JSON.parse(readFileSync(new URL('../docs/generated/van-gogh/manifest.json', import.meta.url), 'utf8')) as {
      files: Record<string, string>;
    };
    const dimensions: Record<string, number[]> = {
      Tiles: [1536, 2048],
      ChestCards: [256, 128],
      BuildingCards: [1024, 128],
      BuildingGrounds: [1024, 128],
      VegetationCards: [1024, 128],
      ForestCard: [128, 128],
      TreeCards: [384, 128],
      BrushCards: [512, 128],
    };
    for (const [name, hash] of Object.entries(manifest.files)) {
      const bytes = readFileSync(new URL(`../public/graphics/${name}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
      const suffix = name.replace('Van Gogh-', '').replace('.png', '');
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(dimensions[suffix]);
    }
    expect(Object.keys(manifest.files)).toHaveLength(8);
    expect(VEGETATION_LAYOUTS['Van Gogh']).toEqual(VEGETATION_LAYOUTS.Standard);
  });

  it('preserves every historical sheet used as generation reference', () => {
    const sources = JSON.parse(readFileSync(new URL('../docs/generated/van-gogh/sources.json', import.meta.url), 'utf8')) as {
      file: string;
      sha256: string;
    }[];
    expect(sources).toHaveLength(12);
    for (const source of sources) {
      expect(
        createHash('sha256')
          .update(readFileSync(new URL(`../public/graphics/${source.file}`, import.meta.url)))
          .digest('hex'),
      ).toBe(source.sha256);
    }
  });
});
