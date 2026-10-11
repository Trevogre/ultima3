import { describe, it, expect } from 'vitest';
import { newWorld, FakeIO } from './helpers.ts';
import { hitChance, shop, wareHint } from '../src/game/shops.ts';
import { Key, type MenuOption } from '../src/game/io.ts';
import { World } from '../src/game/world.ts';
import { wrapText, HINT_ROWS } from '../src/ui/menus.ts';

const GREEN = '#40ff40';
const RED = '#ff4040';
const GREY = '#808080';

/** Member 0 as a named member of `career` (its letter) with weapon `weapon` readied and armour `armour` worn. */
function member(world: World, career: string, weapon: number, armour: number) {
  const p = world.member(0);
  p.name = 'Kaix';
  p.bytes[23] = career.charCodeAt(0);
  p.bytes[48] = weapon;
  p.bytes[40] = armour;
  return p;
}

describe('weighing a ware for the member at the counter', () => {
  it('gives the chance a blow lands for each armour, as combat rolls it', () => {
    // A roll of 0 to armour + 16, under 8: 8 chances in armour + 17.
    expect([0, 1, 2, 3, 4, 5, 6].map(hitChance)).toEqual([47, 44, 42, 40, 38, 36, 35]);
  });

  it('weighs a weapon by its damage a hit against the one readied', () => {
    const world = newWorld();
    const p = member(world, 'F', 1, 1); // a fighter with a dagger
    expect(wareHint(world, p, true, 2)).toEqual({ hint: "3 more damage a hit than Kaix's Dagger", colour: GREEN });
    p.bytes[48] = 6; // a sword
    expect(wareHint(world, p, true, 4)).toEqual({ hint: "6 less damage a hit than Kaix's Sword", colour: RED });
    expect(wareHint(world, p, true, 6)).toEqual({ hint: 'Kaix has one readied', colour: undefined });
    p.bytes[48] = 0;
    expect(wareHint(world, p, true, 1).hint).toBe('3 more damage a hit than bare hands');
  });

  it('says what is gained or lost in reach, and leaves a trade white', () => {
    const world = newWorld();
    const p = member(world, 'F', 6, 1); // a sword
    expect(wareHint(world, p, true, 3)).toEqual({ hint: "9 less damage a hit than Kaix's Sword; shoots afar", colour: undefined });
    expect(wareHint(world, p, true, 9)).toEqual({ hint: "9 more damage a hit than Kaix's Sword; shoots afar", colour: GREEN });
    p.bytes[48] = 5; // a bow
    expect(wareHint(world, p, true, 4)).toEqual({ hint: "3 less damage a hit than Kaix's Bow; close up only", colour: RED });
    expect(wareHint(world, p, true, 6)).toEqual({ hint: "3 more damage a hit than Kaix's Bow; close up only", colour: undefined });
  });

  it('weighs armour by how often foes would hit, against what is worn', () => {
    const world = newWorld();
    const p = member(world, 'F', 1, 1); // cloth
    expect(wareHint(world, p, false, 3)).toEqual({ hint: 'Foes would hit Kaix 40% of the time (now 44%)', colour: GREEN });
    p.bytes[40] = 4; // plate
    expect(wareHint(world, p, false, 2)).toEqual({ hint: 'Foes would hit Kaix 42% of the time (now 38%)', colour: RED });
    expect(wareHint(world, p, false, 4)).toEqual({ hint: 'Kaix wears one already', colour: undefined });
  });

  it("names the class that cannot use a ware, in the list's grey", () => {
    const world = newWorld();
    const p = member(world, 'W', 1, 1);
    expect(wareHint(world, p, true, 2)).toEqual({ hint: 'A Wizard cannot ready it', colour: GREY });
    expect(wareHint(world, p, false, 2)).toEqual({ hint: 'A Wizard cannot wear it', colour: GREY });
    p.bytes[23] = 'I'.charCodeAt(0);
    expect(wareHint(world, p, true, 4).hint).toBe('An Illusionist cannot ready it');
  });

  it('fits every weighing whole in the hint, for the longest name, every class and everything readied or worn', () => {
    const world = newWorld();
    const careers = String.fromCharCode(...world.resources.misc.careerTable);
    const cut: string[] = [];
    for (const career of careers) {
      const p = member(world, career, 0, 0);
      p.name = 'Abcdefghijklm'; // 13 letters, the most a name holds
      for (let held = 0; held < 16; held++)
        for (let ware = 1; ware < 15; ware++) {
          p.bytes[48] = held;
          const { hint } = wareHint(world, p, true, ware);
          if (wrapText(hint, 38, HINT_ROWS).join(' ') !== hint) cut.push(hint);
        }
      for (let worn = 0; worn < 8; worn++)
        for (let ware = 1; ware < 7; ware++) {
          p.bytes[40] = worn;
          const { hint } = wareHint(world, p, false, ware);
          if (wrapText(hint, 38, HINT_ROWS).join(' ') !== hint) cut.push(hint);
        }
    }
    expect(cut).toEqual([]);
  });

  it('weighs the Buy list afresh after a ware is readied on the spot, and leaves the Sell list unweighed', async () => {
    const world = newWorld();
    member(world, 'F', 1, 1); // a dagger
    world.party.gold = 500;
    world.party.surfaceX = 0;
    const menus: MenuOption[][] = [];
    const io = new FakeIO(world.resources);
    const choose = io.chooseOption.bind(io);
    io.chooseOption = (options, echo) => {
      menus.push(options);
      return choose(options, echo);
    };
    io.keys = ['N', 'B', 'C', 'Y', Key.Escape]; // buy a mace, ready it, and leave
    await shop(world, io, 3, 0);
    const buys = menus.filter((m) => m.some((o) => o.key === 'C' && o.label.includes('Mace')));
    expect(buys).toHaveLength(2);
    const after = buys[1];
    expect(after.find((o) => o.key === 'C')!.hint).toBe('Kaix has one readied');
    expect(after.find((o) => o.key === 'B')).toMatchObject({ hint: "3 less damage a hit than Kaix's Mace", hintColour: RED });
    // Selling the dagger it put back in the bag: no weighing for buying under the Sell list.
    menus.length = 0;
    io.keys = ['N', 'S', Key.Escape];
    await shop(world, io, 3, 0);
    const sell = menus.find((m) => m.some((o) => o.key === 'B' && o.label.includes('Dagger')))!;
    expect(sell.map((o) => o.hint ?? null)).toEqual(sell.map(() => null));
  });

  it("puts each ware's weighing under the shop's Buy list", async () => {
    const world = newWorld();
    member(world, 'F', 1, 1);
    world.party.gold = 500;
    world.party.surfaceX = 0; // a basic shop
    const menus: MenuOption[][] = [];
    const io = new FakeIO(world.resources);
    const choose = io.chooseOption.bind(io);
    io.chooseOption = (options, echo) => {
      menus.push(options);
      return choose(options, echo);
    };
    io.keys = ['N', 'B', Key.Escape]; // no list, Buy, and leave
    await shop(world, io, 3, 0);
    const buy = menus.find((m) => m.some((o) => o.key === 'C' && o.label.includes('Mace')))!;
    const mace = buy.find((o) => o.key === 'C')!;
    expect(mace.hint).toBe("3 more damage a hit than Kaix's Dagger");
    expect(mace.hintColour).toBe(GREEN);
    expect(buy.find((o) => o.key === 'B')!.hint).toBe('Kaix has one readied');
  });
});
