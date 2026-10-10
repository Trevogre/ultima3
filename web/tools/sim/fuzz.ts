/**
 * fuzz.ts (a stress test, run by hand)
 *
 * The game played headless by a careless player, to find crashes, stuck
 * states and impossible situations. Two kinds of run, each from a seed that
 * replays it:
 *   - fights: a random party (levels, hit points, stats, arms, poison)
 *     against a random roaming monster, on Sosaria or in a town, auto combat
 *     on for some; each key auto combat's own some of the time, else a random
 *     step, command or answer;
 *   - travels: a new game started somewhere (Lord British's doorstep, a
 *     town, a castle, a dungeon, Ambrosia, aboard a frigate) and played with
 *     random steps and commands, fights and deaths included.
 * After every key, what must always hold is checked. A crash, a broken rule,
 * or a fight that never ends is reported with the arguments that replay it.
 *
 *   node --import ./tools/node-ts.mjs tools/sim/fuzz.ts [fights=300] [travels=60] [keys=800] [seed=1] [log]
 *   (or npm run fuzz -- fights=50)
 */

import { FakeIO, newWorld } from '../../tests/helpers.ts';
import { Key, type MenuOption } from '../../src/game/io.ts';
import { World } from '../../src/game/world.ts';
import { Location, FOOD_MAX, GOLD_MAX } from '../../src/game/party.ts';
import { MapValue } from '../../src/game/tiles.ts';
import { PartyShape } from '../../src/game/commands.ts';
import { combat } from '../../src/game/combat.ts';
import { autoCombatKeys } from '../../src/game/autocombat.ts';
import { Game } from '../../src/game/game.ts';
import { SPAWN_TYPES } from '../../src/game/monsters.ts';
import { statLimit, OTHER_WORDS } from '../../src/game/interact.ts';
import { startAt, type AtStart } from '../../src/game/devStarts.ts';
import { DungeonCell } from '../../src/game/world.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const arg = (name: string): string | undefined => args.find((a) => a.startsWith(name + '='))?.slice(name.length + 1);
const FIGHTS = Number(arg('fights') ?? 300);
const TRAVELS = Number(arg('travels') ?? 60);
const TRAVEL_KEYS = Number(arg('keys') ?? 800);
const FIRST = Number(arg('seed') ?? 1);
const LOG = args.includes('log');
/** Keys a fight may take before it is called endless (eight foes against a weak party take some hundreds). */
const MOST_KEYS = 20000;

/** A small seeded random of the harness's own, apart from the game's. */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 0x100000000;
  };
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

/** Thrown from the key supply to end a travel run once its keys are spent. */
class Done extends Error {}

/** The fake screen, answering what a player would type: random words and numbers. */
class FuzzIO extends FakeIO {
  constructor(
    world: World,
    private readonly r: () => number,
  ) {
    super(world.resources);
  }
  override async inputText(_max?: number, numbersOnly?: boolean, words?: string[]): Promise<string> {
    if (numbersOnly) return String(Math.floor(this.r() * 120));
    return this.r() < 0.2 ? '' : pick(this.r, words?.length ? words : [...OTHER_WORDS, 'NAME', 'JOB']);
  }
  override async inputTextAt(): Promise<string> {
    return this.inputText(13, false);
  }
  override async allocatePoints(): Promise<number[] | null> {
    return null;
  }
  override async chooseFromList(options: MenuOption[]): Promise<string> {
    return this.r() < 0.1 ? '' : pick(this.r, options).key;
  }
}

/** The keys a careless player presses: mostly steps, then every command letter, answers and cancels. */
const STEPS = [Key.Up, Key.Down, Key.Left, Key.Right];
const OTHERS = [...'ABCDEFGHIJKLMNOPRSTUVWXYZ', ' ', Key.Escape, Key.Pause, '1', '2', '3', '4', '0', Key.Enter];

/** What must always hold of the party and the place it is in. */
function checkWorld(world: World): string[] {
  const out: string[] = [];
  const size = world.current.size;
  const loc = world.party.location;
  if (!Number.isInteger(world.x) || !Number.isInteger(world.y)) out.push(`position not whole: ${world.x},${world.y}`);
  if (loc !== Location.Combat && (world.x < 0 || world.y < 0 || world.x >= size || world.y >= size))
    out.push(`off the map: ${world.x},${world.y} on a map of ${size}`);
  const p = world.party;
  if (p.gold < 0 || p.gold > GOLD_MAX) out.push(`gold ${p.gold}`);
  if (p.food < 0 || p.food > FOOD_MAX) out.push(`food ${p.food}`);
  for (const [name, n] of [
    ['keys', p.keys],
    ['torches', p.torches],
    ['gems', p.gems],
    ['powders', p.powders],
  ] as const)
    if (n < 0 || n > 99) out.push(`${name} ${n}`);
  for (let m = 0; m < p.size; m++) {
    const r = world.member(m);
    if (!'GPDA'.includes(r.status)) out.push(`member ${m} status "${r.status}"`);
    if (r.hitPoints > r.maxHitPoints) out.push(`member ${m} has ${r.hitPoints} of ${r.maxHitPoints} hit points`);
    if (r.alive && r.hitPoints <= 0) out.push(`member ${m} alive at ${r.hitPoints} hit points`);
    for (const [i, stat] of ['strength', 'dexterity', 'intelligence', 'wisdom'].entries())
      if (r.bytes[18 + i] > 99) out.push(`member ${m} ${stat} ${r.bytes[18 + i]}`);
  }
  if (loc !== Location.Combat && world.combat) out.push('a fight left over outside a fight');
  if (world.onSurface || loc === Location.Ambrosia) {
    const v = world.getXYVal(world.x, world.y);
    const onFoot =
      (v < MapValue.Whirlpool && v !== MapValue.Water && v !== MapValue.Mountains) ||
      ([MapValue.Lava, MapValue.ForceField, MapValue.MoonGate, MapValue.Shrine] as number[]).includes(v);
    if (p.shape === PartyShape.Frigate ? v !== MapValue.Water && v !== MapValue.Whirlpool : !onFoot)
      out.push(`standing on map value ${v} (shape ${p.shape.toString(16)})`);
  }
  if (loc === Location.Dungeon) {
    const d = world.dungeon;
    if (d.level < 0 || d.level > 7) out.push(`dungeon level ${d.level}`);
    // Doors and secret doors are walked through; only a wall stops the party (dungeon.ts).
    if (world.getXYDng(world.x, world.y) === DungeonCell.Wall) out.push(`inside a dungeon wall at ${world.x},${world.y}`);
  }
  return out;
}

/** What must always hold of a fight in progress. */
function checkFight(world: World): string[] {
  const c = world.combat;
  if (!c) return [];
  const out: string[] = [];
  const at = new Map<string, string>();
  const place = (who: string, x: number, y: number) => {
    if (x < 0 || x > 10 || y < 0 || y > 10) out.push(`${who} off the field at ${x},${y}`);
    const k = `${x},${y}`;
    if (at.has(k)) out.push(`${who} on ${at.get(k)}'s square ${k}`);
    at.set(k, who);
  };
  c.members.forEach((m, i) => {
    if (i < world.party.size && world.memberAlive(i)) place(`member ${i}`, m.x, m.y);
  });
  c.monsters.forEach((m, i) => {
    if (m.hp > 0) place(`monster ${i}`, m.x, m.y);
  });
  if (c.activeMember < 0 || c.activeMember > 3) out.push(`active member ${c.activeMember}`);
  return out;
}

/** What travels reached, summed: squares stood on, places entered, fights begun, parties lost. */
const reached = { squares: 0, places: new Set<string>(), fights: 0, deaths: 0 };

interface Outcome {
  kind: 'fight' | 'travel';
  seed: number;
  setup: string;
  end: 'ok' | 'crash' | 'broken' | 'endless';
  broken: string[];
  keys: number;
  error?: string;
  tail?: string;
  /** Where things stood when the first rule broke. */
  firstBreak?: string;
}

/** The state worth reading at a broken rule: the map, the place, the square, the craft, the whirlpool, the turn. */
function snapshot(world: World, keys: number): string {
  const w = world.whirlpool;
  return `key ${keys}: map ${world.current.id}, location ${world.party.location}, at ${world.x},${world.y}, shape ${world.party.shape.toString(16)}, whirlpool ${w.x},${w.y} heading ${w.dx},${w.dy}`;
}

/** A party brought on at random: level, hit points, stats, arms, mana and now and then poison. */
function randomParty(world: World, r: () => number): void {
  const races = world.resources.strings.Races.map((x) => x[0]);
  for (let m = 0; m < world.party.size; m++) {
    const p = world.member(m);
    const level = 1 + Math.floor(r() * 25);
    p.bytes[28] = Math.floor((level * 100) / 256);
    p.bytes[29] = (level * 100) % 256;
    p.bytes[30] = level - 1;
    p.hitPoints = 1 + Math.floor(r() * level * 100);
    const race = Math.max(0, races.indexOf(p.race));
    for (let stat = 0; stat < 4; stat++) p.bytes[18 + stat] = 5 + Math.floor(r() * (statLimit(race, stat) - 4));
    p.mana = Math.floor(r() * 60);
    const weapon = Math.floor(r() * 16);
    if (world.canUse(p, true, weapon)) p.bytes[48] = weapon;
    const armour = Math.floor(r() * 8);
    if (world.canUse(p, false, armour)) p.bytes[40] = armour;
    if (r() < 0.15) p.status = 'P';
  }
  world.party.torches = Math.floor(r() * 10);
  world.party.keys = Math.floor(r() * 5);
  world.party.powders = Math.floor(r() * 3);
  world.party.gems = Math.floor(r() * 3);
}

/** One fight: a random party against a random roaming monster. */
async function fight(seed: number): Promise<Outcome> {
  const r = rng(seed);
  const world = newWorld(seed);
  const io = new FuzzIO(world, r);
  world.monsters.bytes.fill(0);
  randomParty(world, r);
  const inTown = r() < 0.25;
  if (inTown) {
    world.enterMap(402);
    world.party.location = Location.Town;
    world.x = 20;
    world.y = 20;
  }
  world.autoCombat = r() < 0.3;
  const shape = pick(r, SPAWN_TYPES);
  const variant = Math.floor(r() * 3);
  const setup = `${world.resources.strings.Tiles[shape]}${variant ? ` (variant ${variant})` : ''}${inTown ? ' in LCB Towne' : ''}${world.autoCombat ? ', auto combat' : ''}`;
  const broken = new Set<string>();
  let keys = 0;
  let firstBreak: string | undefined;
  io.keyProvider = () => {
    for (const b of [...checkFight(world), ...checkWorld(world)]) broken.add(b);
    if (broken.size && !firstBreak) firstBreak = snapshot(world, keys);
    if (++keys > MOST_KEYS) throw new Done();
    const c = world.combat;
    if (c && r() < 0.5) {
      const plan = autoCombatKeys(world, c.activeMember);
      if (plan.length) {
        io.keys.push(...plan.slice(1));
        return plan[0];
      }
    }
    return r() < 0.5 ? pick(r, STEPS) : pick(r, OTHERS);
  };
  try {
    await combat(world, io, shape, variant);
    for (const b of checkWorld(world)) broken.add(b);
    if (world.combat) broken.add('the fight was over but its state stayed');
  } catch (e) {
    if (e instanceof Done)
      return { kind: 'fight', seed, setup, end: 'endless', broken: [...broken], keys, tail: io.output.slice(-400), firstBreak };
    return {
      kind: 'fight',
      seed,
      setup,
      end: 'crash',
      broken: [...broken],
      keys,
      error: (e as Error).stack,
      tail: io.output.slice(-400),
      firstBreak,
    };
  }
  return {
    kind: 'fight',
    seed,
    setup,
    end: broken.size ? 'broken' : 'ok',
    broken: [...broken],
    keys,
    tail: io.output.slice(-400),
    firstBreak,
  };
}

/** Where a travel run starts: as the development starts put a party. */
const STARTS: { name: string; at: AtStart | null; frigate?: [number, number] }[] = [
  { name: "Lord British's doorstep", at: null },
  { name: 'LCB Towne', at: { kind: 'place', name: 'lcb' } },
  { name: "Lord British's castle", at: { kind: 'place', name: 'lordbritish' } },
  { name: 'Yew', at: { kind: 'place', name: 'yew' } },
  { name: 'the Perinian Depths', at: { kind: 'place', name: 'perinian' } },
  { name: 'Dungeon Doom', at: { kind: 'place', name: 'doom' } },
  { name: 'Ambrosia', at: { kind: 'ambrosia', x: 32, y: 54 } },
  { name: 'a frigate by the castle', at: null, frigate: [45, 16] },
];

/** One travel: a new game from a start, played for a while with random keys. */
async function travel(seed: number): Promise<Outcome> {
  const r = rng(seed);
  const world = newWorld(seed);
  const io = new FuzzIO(world, r);
  world.party.rulesPending = false;
  world.tipsNudged = true;
  if (r() < 0.5) randomParty(world, r);
  const start = pick(r, STARTS);
  if (start.at) {
    const placed = startAt(world, start.at);
    if (typeof placed === 'string') throw new Error(placed);
    if (placed.key) io.keys.push(placed.key);
  }
  if (start.frigate) {
    world.x = world.party.surfaceX = start.frigate[0];
    world.y = world.party.surfaceY = start.frigate[1];
    world.party.shape = PartyShape.Frigate;
  }
  world.autoCombat = r() < 0.5;
  const broken = new Set<string>();
  let keys = 0;
  const squares = new Set<string>();
  let inFight = false;
  let firstBreak: string | undefined;
  io.keyProvider = () => {
    for (const b of [...checkFight(world), ...checkWorld(world)]) broken.add(b);
    if (broken.size && !firstBreak) firstBreak = snapshot(world, keys);
    if (++keys > TRAVEL_KEYS) throw new Done();
    squares.add(`${world.current.id}:${world.x},${world.y}`);
    reached.places.add(world.resources.mapNames.get(world.current.id) ?? String(world.current.id));
    if (!!world.combat !== inFight) {
      inFight = !!world.combat;
      if (inFight) reached.fights++;
    }
    if (world.resurrecting) reached.deaths++;
    const c = world.combat;
    if (c && r() < 0.6) {
      const plan = autoCombatKeys(world, c.activeMember);
      if (plan.length) {
        io.keys.push(...plan.slice(1));
        return plan[0];
      }
    }
    return r() < 0.7
      ? pick(r, STEPS)
      : pick(
          r,
          OTHERS.filter((k) => k !== 'Q'),
        );
  };
  try {
    await new Game(world, io).run();
  } catch (e) {
    reached.squares += squares.size;
    if (!(e instanceof Done))
      return {
        kind: 'travel',
        seed,
        setup: start.name,
        end: 'crash',
        broken: [...broken],
        keys,
        error: (e as Error).stack,
        tail: io.output.slice(-400),
        firstBreak,
      };
  }
  return {
    kind: 'travel',
    seed,
    setup: start.name,
    end: broken.size ? 'broken' : 'ok',
    broken: [...broken],
    keys,
    tail: io.output.slice(-400),
    firstBreak,
  };
}

const outcomes: Outcome[] = [];
const started = Date.now();
for (let i = 0; i < FIGHTS; i++) outcomes.push(await fight(FIRST + i));
for (let i = 0; i < TRAVELS; i++) outcomes.push(await travel(FIRST + i));
const seconds = ((Date.now() - started) / 1000).toFixed(1);

const failed = outcomes.filter((o) => o.end !== 'ok');
const count = (kind: Outcome['kind']) => outcomes.filter((o) => o.kind === kind);
console.log(
  `${count('fight').length} fights, ${count('travel').length} travels, ${outcomes.reduce((n, o) => n + o.keys, 0)} keys in ${seconds}s: ` +
    `${failed.length} failed (${['crash', 'broken', 'endless'].map((e) => `${outcomes.filter((o) => o.end === e).length} ${e}`).join(', ')})`,
);
if (TRAVELS)
  console.log(
    `travels reached ${reached.squares} squares, ${reached.fights} fights and ${reached.deaths} lost parties, in: ${[...reached.places].sort().join(', ')}`,
  );
for (const o of failed) {
  const replay = o.kind === 'fight' ? `fights=1 travels=0 seed=${o.seed}` : `fights=0 travels=1 seed=${o.seed}`;
  console.log(`\n${o.kind} ${o.seed} (${o.setup}): ${o.end} after ${o.keys} keys - replay with ${replay} log`);
  for (const b of o.broken) console.log(`  broke: ${b}`);
  if (o.firstBreak) console.log(`  first broken at ${o.firstBreak}`);
  if (o.error)
    console.log(
      `  ${o.error
        .split('\n')
        .slice(0, LOG ? 12 : 3)
        .join('\n  ')}`,
    );
  if (LOG && o.tail) console.log(`  last output:\n${o.tail.replace(/^/gm, '    | ')}`);
}
process.exitCode = failed.length ? 1 : 0;
