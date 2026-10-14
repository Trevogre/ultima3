import { describe, it, expect } from 'vitest';
import { FakeIO, newWorld, savedCopy } from './helpers.ts';
import { TIPS, TIPS_NUDGE, tipPages, type Tip } from '../src/game/tips.ts';
import { wrapText } from '../src/ui/menus.ts';
import { PAGE_ROWS, PAGE_WIDTH } from '../src/ui/help.ts';
import { Game } from '../src/game/game.ts';
import { restore } from '../src/game/save.ts';
import { World } from '../src/game/world.ts';

describe("a Tips topic's pages", () => {
  const pages = (tip: Tip, rows = PAGE_ROWS) => tipPages(tip, PAGE_WIDTH, rows, wrapText);

  it('holds every paragraph, a blank line between, each line within the page', () => {
    for (const tip of TIPS) {
      const all = pages(tip).flat();
      for (const line of all) expect(line.length, line).toBeLessThanOrEqual(PAGE_WIDTH);
      expect(all.join(' ').replace(/\s+/g, ' ').trim(), tip.topic).toBe(tip.text.join(' '));
    }
  });

  it('keeps every topic short enough to show whole on one page', () => {
    for (const tip of TIPS) expect(pages(tip), tip.topic).toHaveLength(1);
  });

  it('starts a paragraph that would not fit on the next page, and cuts one longer than a page', () => {
    const tip: Tip = { topic: 'Test', text: ['one two', 'three four five six seven eight nine ten eleven'] };
    const wrap = (text: string, width: number) => wrapText(text, width, Infinity);
    expect(tipPages(tip, 12, 3, wrap)).toEqual([['one two'], ['three four', 'five six', 'seven eight'], ['nine ten', 'eleven']]);
  });
});

describe('the nudge to Tips', () => {
  const play = async (world: World) => {
    const io = new FakeIO(world.resources);
    io.keys.push(' ', ' ', 'Q');
    await new Game(world, io).run();
    return io.output.split(TIPS_NUDGE).length - 1;
  };

  it('fits the message area and is said once, on a new game', async () => {
    for (const line of TIPS_NUDGE.split('\n')) expect(line.length).toBeLessThanOrEqual(16);
    const world = newWorld();
    expect(await play(world)).toBe(1);
    expect(world.tipsNudged).toBe(true);
    expect(await play(world)).toBe(0);
  });

  it('is remembered with the game, and never said to a game from before Tips', async () => {
    const world = newWorld();
    const fresh = savedCopy(world);
    expect(fresh.tipsNudged).toBe(false);
    const older = { ...fresh };
    delete older.tipsNudged;
    const again = newWorld();
    expect(restore(again, older)).toBe(true);
    expect(await play(again)).toBe(0);
    expect(restore(again, fresh)).toBe(true);
    expect(await play(again)).toBe(1);
  });
});
