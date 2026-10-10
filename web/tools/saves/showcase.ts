/**
 * showcase.ts
 *
 * Writes the showcase saves (`npm run saves`): exported games, each at one
 * of Ultima III's sights with a party of the level, gear, marks and gold a
 * player would have there, for trying the game, screenshots, video and
 * testing. Each is a new game made by the test harness and brought on, then
 * exported as the title menu's Export does, into ../showcase/ at the
 * repository's root with a README listing them.
 *
 * A save always resumes on the surface (the game saves there), so each
 * stands at a sight's door - a town's, a dungeon's, the castle of Exodus -
 * or aboard a ship, rather than inside.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newWorld } from '../../tests/helpers.ts';
import { exportGame } from '../../src/game/save.ts';
import { World } from '../../src/game/world.ts';
import { PartyShape } from '../../src/game/commands.ts';
import { placeMoongates } from '../../src/game/turn.ts';
import { statLimit } from '../../src/game/interact.ts';
import { MapValue } from '../../src/game/tiles.ts';
import { PlayerOffset } from '../../src/game/player.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'showcase');
/** A fixed export date, so a save made again from the same code is the same file. */
const EXPORTED = '2026-10-10T00:00:00.000Z';

const MARK = { kings: 0x80, snake: 0x40, force: 0x20, fire: 0x10 } as const;
const ALL_CARDS = 0x0f;

/** How far a showcase's party has come. */
interface Party {
  /** The level: hit points a hundred a level, as Lord British grants them (1 to 25); experience a level behind. */
  level: number;
  /** Experience for one more level than Lord British has granted: the L (or blue) status. */
  waiting?: boolean;
  /** 0, the stats a new party has, to 1, each stat at its race's limit (the shrines of Ambrosia). */
  stats?: number;
  /** Weapons and armour, best first: each member readies and wears the first their class can use. */
  weapons: number[];
  armour: number[];
  marks?: number;
  gold: number;
  food?: number;
  keys?: number;
  torches?: number;
  gems?: number;
  powders?: number;
}

/** A showcase: its file, what the README says of it, and how it is made. */
interface Showcase {
  file: string;
  where: string;
  party: string;
  make(world: World): void;
}

/** Bring the new game's party on to `p`: experience, hit points, stats, mana, gear, marks and supplies. */
function bringOn(world: World, p: Party): void {
  world.party.rulesPending = false; // a party under way has answered "Choose Thine Adventure!"
  world.tipsNudged = true; // and has had its first turn, which points to Tips
  const races = world.resources.strings.Races.map((r) => r[0]);
  for (let m = 0; m < world.party.size; m++) {
    const r = world.member(m);
    // Lord British grants a level while experience (in hundreds) is at least the hit points (in hundreds).
    const exp = (p.waiting ? p.level : p.level - 1) * 100;
    r.bytes[30] = Math.floor(exp / 100);
    r.bytes[31] = exp % 100;
    const max = Math.min(2500, p.level * 100);
    r.bytes[28] = Math.floor(max / 256);
    r.bytes[29] = max % 256;
    r.hitPoints = max;
    const race = Math.max(0, races.indexOf(r.race));
    for (let stat = 0; stat < 4; stat++) {
      const now = r.bytes[18 + stat];
      r.bytes[18 + stat] = Math.round(now + (statLimit(race, stat) - now) * (p.stats ?? 0));
    }
    r.mana = manaCap(world, r.classLetter, r.intelligence, r.wisdom);
    r.bytes[PlayerOffset.Marks] = (r.marks & 0x0f) | (p.marks ?? 0);
    for (const [isWeapon, list] of [
      [true, p.weapons],
      [false, p.armour],
    ] as const) {
      const best = list.find((i) => world.canUse(r, isWeapon, i));
      if (best === undefined) continue;
      world.addGear(isWeapon, best);
      world.equip(r, isWeapon, best);
    }
  }
  world.party.gold = p.gold;
  if (p.food !== undefined) world.party.food = p.food;
  world.party.keys = p.keys ?? 0;
  world.party.torches = p.torches ?? 0;
  world.party.gems = p.gems ?? 0;
  world.party.powders = p.powders ?? 0;
}

/** The mana a class grows back to (turn.ts ageChars). */
function manaCap(world: World, cls: string, int: number, wis: number): number {
  const careers = world.resources.misc.careerTable;
  const [, cleric, wizard, , paladin, , lark, illusionist, druid, alchemist, ranger] = Array.from({ length: 11 }, (_, i) =>
    String.fromCharCode(careers[i]),
  );
  if (cls === wizard) return int;
  if (cls === cleric) return wis;
  if (cls === druid) return Math.max(int, wis) >> 1;
  if (cls === lark || cls === alchemist) return int >> 1;
  if (cls === paladin || cls === illusionist) return wis >> 1;
  if (cls === ranger) return Math.min(int, wis) >> 1;
  return 0;
}

/** Stand the party on foot on the square of place `index` (misc.locationX/Y), ready to Enter. */
function atPlace(world: World, index: number): void {
  const { locationX, locationY } = world.resources.misc;
  world.x = world.party.surfaceX = locationX[index];
  world.y = world.party.surfaceY = locationY[index];
  world.party.shape = PartyShape.OnFoot;
}

/** Put the party aboard a frigate at (x, y), on water. */
function aboard(world: World, x: number, y: number): void {
  if (world.getXYVal(x, y) !== MapValue.Water) throw new Error(`no water at ${x},${y}`);
  world.x = world.party.surfaceX = x;
  world.y = world.party.surfaceY = y;
  world.party.shape = PartyShape.Frigate;
}

const PLACE = { lordBritish: 0, exodus: 1, lcb: 2, dawn: 8, perinian: 16 };
const EXOTIC_WEAPON = 15;
const EXOTIC_ARMOUR = 7;

const SHOWCASES: Showcase[] = [
  {
    file: '01-new-game',
    where: "Beside Lord British's castle: a new game, as it starts (the rules are asked at Journey onward)",
    party: 'as the game starts',
    make: () => {},
  },
  {
    file: '02-lord-british',
    where: "On Lord British's castle: Enter, and walk into the king for the level waiting",
    party: 'a level waiting, leather, 800 gold',
    make: (w) => {
      bringOn(w, { level: 1, waiting: true, weapons: [2, 1], armour: [2, 1], gold: 800 });
      atPlace(w, PLACE.lordBritish);
    },
  },
  {
    file: '03-britain',
    where: 'On the town of Britain (LCB Towne): Enter, with gold for its shops',
    party: 'level 2, 2500 gold',
    make: (w) => {
      bringOn(w, { level: 2, weapons: [2, 1], armour: [2, 1], gold: 2500 });
      atPlace(w, PLACE.lcb);
    },
  },
  {
    file: '04-perinian-depths',
    where: 'At the door of the Perinian Depths, north of Britain, torches in the pack',
    party: 'level 3, chain and swords, 20 torches',
    make: (w) => {
      bringOn(w, { level: 3, weapons: [6, 4, 2, 1], armour: [3, 2, 1], gold: 1200, torches: 20, keys: 2 });
      atPlace(w, PLACE.perinian);
    },
  },
  {
    file: '05-frigate',
    where: "Aboard a frigate just north of Lord British's castle",
    party: 'level 4, the Mark of Kings',
    make: (w) => {
      bringOn(w, { level: 4, weapons: [6, 4, 2, 1], armour: [3, 2, 1], marks: MARK.kings, gold: 2000, torches: 10, keys: 2 });
      aboard(w, 45, 16);
    },
  },
  {
    file: '06-dawn',
    where: 'On the town of Dawn, both moons new: Enter, and buy the best arms in Sosaria',
    party: 'level 6, 9000 gold',
    make: (w) => {
      bringOn(w, { level: 6, weapons: [6, 4, 2, 1], armour: [3, 2, 1], marks: MARK.kings, gold: 9000, torches: 10, keys: 4 });
      w.moonPhase = [0, 0];
      placeMoongates(w);
      atPlace(w, PLACE.dawn);
    },
  },
  {
    file: '07-whirlpool',
    where: "Aboard a frigate in the whirlpool's path: it takes the ship to Ambrosia in a few turns",
    party: 'level 8, +2 arms, 9000 gold and 10 keys for the shrines',
    make: (w) => {
      bringOn(w, { level: 8, weapons: [10, 9, 8, 6, 2], armour: [6, 5, 3, 2], marks: MARK.kings, gold: 9000, keys: 10, torches: 10 });
      const { x, y, dx, dy } = w.whirlpool;
      aboard(w, w.constrain(x + dx), w.constrain(y + dy));
    },
  },
  {
    file: '08-serpent',
    where: 'Aboard a frigate below the great serpent: EVOCARE (Other or Yell) to cross',
    party: 'level 20, stats raised, exotics, every mark and card',
    make: (w) => {
      bringOn(w, {
        level: 20,
        stats: 0.8,
        weapons: [EXOTIC_WEAPON],
        armour: [EXOTIC_ARMOUR],
        marks: MARK.kings | MARK.snake | MARK.force | MARK.fire,
        gold: 5000,
        keys: 5,
        torches: 10,
        powders: 5,
      });
      for (let m = 0; m < w.party.size; m++) w.member(m).bytes[PlayerOffset.Marks] |= ALL_CARDS;
      aboard(w, 10, 59);
    },
  },
  {
    file: '09-exodus',
    where: 'On the castle of Exodus, past the serpent: Enter, for the end of the game',
    party: 'level 25, stats at their limits, exotics, every mark and card',
    make: (w) => {
      bringOn(w, {
        level: 25,
        stats: 1,
        weapons: [EXOTIC_WEAPON],
        armour: [EXOTIC_ARMOUR],
        marks: MARK.kings | MARK.snake | MARK.force | MARK.fire,
        gold: 5000,
        keys: 5,
        torches: 10,
        powders: 9,
      });
      for (let m = 0; m < w.party.size; m++) w.member(m).bytes[PlayerOffset.Marks] |= ALL_CARDS;
      atPlace(w, PLACE.exodus);
    },
  },
];

const README = (rows: string) => `# Showcase saves

Saved games at some of Ultima III's sights, each with a party of the level,
gear, marks and gold a player would have there. They are for trying the game
out, taking screenshots and video, and testing.

**To play one:** download its \`.json\` file, then on the title screen choose
**Import game → From a file** and pick it, then **Journey onward**.
**Importing replaces the game in progress**, its party and roster with it:
export yours first (**Export game**) to come back to it. The settings are
the browser's own and do not change.

The game saves on the surface, so each stands at a sight's door - Enter
goes in - or aboard a ship.

| File | Where | The party |
|---|---|---|
${rows}

They are made by \`npm run saves\` in \`web/\`; the places and parties are in
\`web/tools/saves/showcase.ts\`.
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const rows: string[] = [];
for (const s of SHOWCASES) {
  const world = newWorld();
  s.make(world);
  const exported = JSON.parse(exportGame(world, null)) as { exported: string };
  exported.exported = EXPORTED;
  writeFileSync(join(OUT, `${s.file}.json`), JSON.stringify(exported) + '\n');
  rows.push(`| [${s.file}](${s.file}.json) | ${s.where} | ${s.party} |`);
  console.log(`${s.file}: (${world.x}, ${world.y}) ${s.party}`);
}
writeFileSync(join(OUT, 'README.md'), README(rows.join('\n')));
console.log(`${SHOWCASES.length} saves in ${OUT}`);
