import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newWorld } from './helpers.ts';
import { parseExport, restore } from '../src/game/save.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'showcase');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('the showcase saves', () => {
  it('are there, each listed in their README', () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    const readme = readFileSync(join(DIR, 'README.md'), 'utf8');
    for (const f of files) expect(readme).toContain(`(${f})`);
  });

  it('each import as the title menu imports them, a party formed on the surface', () => {
    for (const f of files) {
      const { save } = parseExport(readFileSync(join(DIR, f), 'utf8'));
      const world = newWorld();
      expect(restore(world, save), f).toBe(true);
      expect(world.party.formed, f).toBe(true);
      expect(world.party.size, f).toBe(4);
    }
  });
});
