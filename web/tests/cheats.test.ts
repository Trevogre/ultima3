import { describe, it, expect } from 'vitest';
import { newWorld, FakeIO } from './helpers.ts';
import { CHEATS } from '../src/game/cheats.ts';
import { Location } from '../src/game/party.ts';
import { MapId } from '../src/data/resources.ts';
import { knownWords } from '../src/game/journal.ts';

const cheat = (key: string) => CHEATS.find((c) => c.key === key)!;

describe('cheats', () => {
  it('restores everyone, adds gold and torches', async () => {
    const world = newWorld();
    const io = new FakeIO(world.resources);
    world.member(0).status = 'D';
    world.member(1).status = 'P';
    world.member(1).hitPoints = 3;
    await cheat('R').apply(world, io);
    expect(world.member(0).status).toBe('G');
    expect(world.member(1).status).toBe('G');
    expect(world.member(1).hitPoints).toBe(world.member(1).maxHitPoints);
    const gold = world.party.gold;
    await cheat('G').apply(world, io);
    expect(world.party.gold).toBe(gold + 100);
    const food = world.party.food;
    await cheat('F').apply(world, io);
    expect(world.party.food).toBe(food + 100);
    await cheat('T').apply(world, io);
    expect(world.party.torches).toBe(5);
    await cheat('M').apply(world, io);
    expect(world.party.gems).toBe(10);
    await cheat('K').apply(world, io);
    expect(world.party.keys).toBe(5);
  });

  it('adds a word for Other, as if heard: only one Other offers, and once', async () => {
    const world = newWorld();
    const io = new FakeIO(world.resources);
    io.inputs = ['evocare'];
    expect(await cheat('W').apply(world, io)).toBe('Known now: EVOCARE. Other offers it from now on.');
    expect(knownWords(world)).toEqual(['EVOCARE']);
    expect(io.output).toContain('Journal updated');
    io.inputs = ['EVOCARE'];
    expect(await cheat('W').apply(world, io)).toBe('EVOCARE is known already.');
    io.inputs = ['SCREAM'];
    expect(await cheat('W').apply(world, io)).toBe('Other offers no word SCREAM.');
    io.inputs = [''];
    expect(await cheat('W').apply(world, io)).toBe('No word added.');
    expect(knownWords(world)).toEqual(['EVOCARE']);
  });

  it('raises every level: a hundred experience and a hundred hit points each, healed to the new maximum', async () => {
    const world = newWorld();
    const io = new FakeIO(world.resources);
    const p = world.member(0);
    const level = p.level;
    const max = p.maxHitPoints;
    p.hitPoints = 5;
    await cheat('L').apply(world, io);
    expect(p.level).toBe(level + 1);
    expect(p.maxHitPoints).toBe(max + 100);
    expect(p.hitPoints).toBe(max + 100);
    expect(world.member(3).maxHitPoints).toBe(max + 100);
  });

  it('goes home from a town, and asks a dungeon to end', async () => {
    const world = newWorld();
    const io = new FakeIO(world.resources);
    world.returnX = 10;
    world.returnY = 11;
    world.enterMap(MapId.FirstTown);
    world.party.location = Location.Town;
    await cheat('H').apply(world, io);
    expect(world.party.location).toBe(Location.Sosaria);
    expect([world.x, world.y]).toEqual([42, 20]);

    world.enterDungeon(MapId.FirstDungeon);
    world.party.location = Location.Dungeon;
    world.dungeon.exit = false;
    expect(cheat('X').available(world)).toBe(true);
    await cheat('X').apply(world, io);
    expect(world.dungeon.exit).toBe(true);
    world.party.location = Location.Sosaria;
    expect(cheat('X').available(world)).toBe(false);
  });
});
