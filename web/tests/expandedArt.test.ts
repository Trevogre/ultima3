import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { TILE_SETS } from '../src/ui/help.ts';
import { VEGETATION_LAYOUTS } from '../src/ui/vegetationLayouts.ts';

describe('opt-in Van Gogh art package', () => {
  it('ships a canonical atlas, paired building cutouts and independently anchored plants', () => {
    expect(TILE_SETS[0]).toBe('Standard');
    expect(TILE_SETS).toContain('Van Gogh');
    const manifest = JSON.parse(readFileSync(new URL('../docs/generated/van-gogh/manifest.json', import.meta.url), 'utf8')) as {
      files: Record<string, string>;
    };
    const dimensions: Record<string, number[]> = {
      Tiles: [1536, 2048],
      BuildingCards: [1024, 128],
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
    expect(Object.keys(manifest.files)).toHaveLength(6);
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
