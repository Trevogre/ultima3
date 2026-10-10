import { describe, it, expect } from 'vitest';
import { FakeIO, newWorld, savedCopy } from './helpers.ts';
import { TIPS, TIPS_NUDGE, tipsPage } from '../src/game/tips.ts';
import { wrapText } from '../src/ui/menus.ts';
import { PAGE_WIDTH } from '../src/ui/help.ts';
import { Game } from '../src/game/game.ts';
import { restore } from '../src/game/save.ts';
import { World } from '../src/game/world.ts';

describe('the Tips page', () => {
  it('lists every topic, the selected one opened to its text, all within the page', () => {
    const page = tipsPage(TIPS, 2, PAGE_WIDTH, wrapText);
    expect(page.lines.filter((l) => l.startsWith('- '))).toEqual(TIPS.map((t) => `- ${t.topic}`));
    expect(page.lines[page.cursorLine]).toBe(`- ${TIPS[2].topic}`);
    expect(page.lines[page.openEnd]).toBe(`- ${TIPS[3].topic}`);
    const opened = page.lines
      .slice(page.cursorLine + 1, page.openEnd)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(opened).toBe(TIPS[2].text.join(' '));
    for (let i = 0; i < TIPS.length; i++)
      for (const line of tipsPage(TIPS, i, PAGE_WIDTH, wrapText).lines) expect(line.length, line).toBeLessThanOrEqual(PAGE_WIDTH);
  });

  it('keeps every opened topic short enough to show whole on the page', () => {
    for (let i = 0; i < TIPS.length; i++) {
      const page = tipsPage(TIPS, i, PAGE_WIDTH, wrapText);
      expect(page.openEnd - page.cursorLine, TIPS[i].topic).toBeLessThanOrEqual(19); // PAGE_ROWS
    }
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
