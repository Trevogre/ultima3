import { describe, it, expect } from 'vitest';
import { FakeIO, newWorld } from './helpers.ts';
import { parseAt, pickName, slug, startAt, startNames, tileSetAsked } from '../src/game/devStarts.ts';
import { enter, move } from '../src/game/commands.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
import { Key } from '../src/game/io.ts';
import { TILE_SETS } from '../src/ui/help.ts';

describe('development starts', () => {
  it('read the address', () => {
    expect(parseAt('world:44,18')).toEqual({ kind: 'world', x: 44, y: 18 });
    expect(parseAt('ambrosia')).toEqual({ kind: 'ambrosia', x: 32, y: 54 });
    expect(parseAt('ambrosia:11,6')).toEqual({ kind: 'ambrosia', x: 11, y: 6 });
    expect(parseAt('place:yew')).toEqual({ kind: 'place', name: 'yew' });
    expect(parseAt('fight:Man-O-War')).toEqual({ kind: 'fight', name: 'Man-O-War' });
    for (const junk of [null, '', 'town:3', 'world:1']) expect(parseAt(junk)).toBeNull();
  });

  it('match names by their letters, a start of one where it is the only one', () => {
    expect(slug('Dungeon DardinÕs Pit')).toBe('dungeondardinspit');
    const { places, fights } = startNames(newWorld());
    expect(pickName(places, 'lcb')).toBe('LCB Towne');
    expect(pickName(places, 'perinian')).toBe('Dungeon Perinian Depths');
    expect(pickName(places, 'dardinspit')).toBe('Dungeon DardinÕs Pit');
    expect(pickName(places, 'm')).toBeNull(); // Moon, the Montors, Morinia
    for (const name of places) expect(pickName(places, slug(name.replace(/^Dungeon /, '')))).toBe(name); // the /debug links
    for (const name of fights) expect(pickName(fights, slug(name))).toBe(name);
    expect(tileSetAsked('commodore64', TILE_SETS)).toBe('Commodore 64');
    expect(tileSetAsked('pc', TILE_SETS)).toBeNull();
    expect(tileSetAsked(null, TILE_SETS)).toBeNull();
  });

  it('enter a town, Dawn, a castle and a dungeon from their squares, as Enter does', () => {
    for (const [name, entered, id] of [
      ['yew', 'town', 404],
      ['dawn', 'town', 408],
      ['lordbritish', 'castle', 400],
      ['perinian', 'dungeon', 416],
    ] as const) {
      const world = newWorld();
      const io = new FakeIO(world.resources);
      expect(startAt(world, { kind: 'place', name })).toEqual({ key: 'E' });
      expect(enter(world, io), name).toBe(entered);
      expect(world.current.id).toBe(id);
    }
  });

  it('put a monster east of the party, and the step into it is a fight', async () => {
    const world = newWorld();
    world.monsters.bytes.fill(0);
    expect(startAt(world, { kind: 'fight', name: 'orc' })).toEqual({ key: Key.Right });
    expect(await move(world, new FakeIO(world.resources), 'east')).toEqual({ kind: 'monster', dx: 1, dy: 0 });
    expect(world.getXYVal(world.x + 1, world.y)).toBe(MapValue.Orc);
  });

  it('go to Ambrosia, and say why a start is not understood', () => {
    const world = newWorld();
    expect(startAt(world, { kind: 'ambrosia', x: 32, y: 54 })).toEqual({ key: null });
    expect(world.party.location).toBe(Location.Ambrosia);
    expect([world.x, world.y]).toEqual([32, 54]);
    expect(startAt(newWorld(), { kind: 'place', name: 'atlantis' })).toMatch(/no place "atlantis"/);
    expect(startAt(newWorld(), { kind: 'fight', name: 'gazer' })).toMatch(/no monster "gazer"/);
  });
});
