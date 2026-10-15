import { describe, it, expect } from 'vitest';
import { newWorld, savedCopy } from './helpers.ts';
import {
  serialize,
  restore,
  exportGame,
  parseExport,
  restoreExported,
  localSave,
  LEGACY_AUTOMAP_KEY,
  SAVE_KEY,
  EXPORT_FORMAT,
} from '../src/game/save.ts';
import { MapId } from '../src/data/resources.ts';
import { MapValue } from '../src/game/tiles.ts';
import { Location } from '../src/game/party.ts';
import { World } from '../src/game/world.ts';

describe('save and restore', () => {
  it('round-trips the party, roster, surface map and position', () => {
    const a = newWorld();
    a.x = 10;
    a.y = 11;
    a.member(0).gold = 999;
    a.putXYVal(MapValue.Frigate, 3, 4);
    a.moonPhase = [2, 6];
    a.windDirection = 3;

    const data = savedCopy(a);
    const b = new World(a.resources);
    expect(restore(b, data)).toBe(true);

    expect(b.x).toBe(10);
    expect(b.y).toBe(11);
    expect(b.member(0).gold).toBe(999);
    expect(b.member(0).name).toBe(a.member(0).name);
    expect(b.getXYVal(3, 4)).toBe(MapValue.Frigate);
    expect(b.moonPhase).toEqual([2, 6]);
    expect(b.windDirection).toBe(3);
    expect(b.party.location).toBe(Location.Sosaria);
  });

  it('saves a game in a town as the surface square it was entered from', () => {
    const a = newWorld();
    a.returnX = 46;
    a.returnY = 19;
    a.party.location = Location.Town;
    a.enterMap(402);
    a.x = 5;
    a.y = 32;
    const b = new World(a.resources);
    expect(restore(b, serialize(a))).toBe(true);
    expect(b.party.location).toBe(Location.Sosaria);
    expect(b.x).toBe(46);
    expect(b.y).toBe(19);
    expect(b.current).toBe(b.surface);
  });

  it('rejects data from another version', () => {
    const a = newWorld();
    const data = serialize(a);
    data.version = 99;
    expect(restore(new World(a.resources), data)).toBe(false);
  });
});

describe('save migration', () => {
  it("pools a version 2 save's member bags into the party's, keeping items in hand", () => {
    const a = newWorld();
    a.member(0).bytes[48 + 6] = 2; // two swords in the old per-member bag ...
    a.member(0).bytes[48] = 6; // ... one in hand
    a.member(1).bytes[40 + 3] = 1; // chain, not worn
    const data = savedCopy(a);
    data.version = 2;
    const b = new World(a.resources);
    expect(restore(b, data)).toBe(true);
    expect(b.party.weapons(6)).toBe(1);
    expect(b.member(0).bytes[48]).toBe(6);
    expect(b.member(0).bytes[48 + 6]).toBe(0);
    expect(b.party.armour(3)).toBe(1);
  });

  it("pools a version 3 save's gems, keys, powders and torches", () => {
    const a = newWorld();
    a.member(0).bytes[37] = 2; // gems
    a.member(1).bytes[38] = 1; // a key
    a.member(2).torches = 4;
    const data = savedCopy(a);
    data.version = 3;
    const b = new World(a.resources);
    expect(restore(b, data)).toBe(true);
    expect(b.party.gems).toBe(2);
    expect(b.party.keys).toBe(1);
    expect(b.party.torches).toBe(4);
    expect(b.member(2).torches).toBe(0);
  });
});

describe('the map, saved with the game', () => {
  it('is what the saved party had seen: restored with it, in place of the map the world had', () => {
    const world = newWorld();
    world.autoMap.markSquares(MapId.Sosaria, [[10, 10]]);
    world.autoMap.mark(412, 0, 3, 3);
    world.autoMap.visit('shrine:1,2');
    const data = savedCopy(world);
    world.autoMap.markSquares(MapId.Sosaria, [[40, 40]]); // seen after the save
    const other = newWorld();
    other.autoMap.markSquares(MapId.Sosaria, [[1, 1]]); // another game's
    expect(restore(other, data)).toBe(true);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 10, 10)).toBe(true);
    expect(other.autoMap.isSeen(412, 0, 3, 3)).toBe(true);
    expect(other.autoMap.visited('shrine:1,2')).toBe(true);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 40, 40)).toBe(false);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 1, 1)).toBe(false);
  });

  it('comes from where the browser kept it apart, for a save from before, until the next save takes it in', () => {
    const store = new Map<string, string>();
    const was = (globalThis as { localStorage?: Storage }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      const old = newWorld();
      old.autoMap.markSquares(MapId.Sosaria, [[7, 8]]);
      const data = savedCopy(old);
      store.set(LEGACY_AUTOMAP_KEY, data.automap!);
      delete data.automap;
      store.set(SAVE_KEY, JSON.stringify(data));
      const world = newWorld();
      expect(localSave.read(world)).toBe(true);
      expect(world.autoMap.squareSeen(MapId.Sosaria, 7, 8)).toBe(true);
      expect(localSave.write(world)).toBe(true);
      expect(store.has(LEGACY_AUTOMAP_KEY)).toBe(false);
      expect((JSON.parse(store.get(SAVE_KEY)!) as { automap?: string }).automap).toContain('map:420');
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = was;
    }
  });
});

describe('export and import', () => {
  it('carries the save, the map within it, through text and back', () => {
    const world = newWorld();
    world.party.gold = 4321;
    world.x = 12;
    world.y = 34;
    world.autoMap.markSquares(MapId.Sosaria, [[12, 34]]);
    const parsed = parseExport(exportGame(world));
    expect(parsed.automap).toBe(parsed.save.automap); // beside the save too, for a version from before it held it
    const other = newWorld();
    other.autoMap.markSquares(MapId.Sosaria, [[1, 1]]);
    expect(restoreExported(other, parsed)).toBe(true);
    expect(other.party.gold).toBe(4321);
    expect([other.x, other.y]).toEqual([12, 34]);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 12, 34)).toBe(true);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 1, 1)).toBe(false);
  });

  it('takes the map from beside the save in an older export, and none where there is neither', () => {
    const world = newWorld();
    world.autoMap.markSquares(MapId.Sosaria, [[5, 6]]);
    const map = world.autoMap.toText();
    const save = savedCopy(world);
    delete save.automap;
    const other = newWorld();
    expect(restoreExported(other, { save, automap: map })).toBe(true);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 5, 6)).toBe(true);
    expect(restoreExported(other, { save, automap: null })).toBe(true);
    expect(other.autoMap.squareSeen(MapId.Sosaria, 5, 6)).toBe(false);
  });

  it('refuses text that is not an exported game, with a short reason', () => {
    expect(() => parseExport('hello')).toThrow('not JSON');
    expect(() => parseExport('{"game":"other","format":1}')).toThrow('not an Ultima III game');
    expect(() => parseExport(JSON.stringify({ game: 'ultima3', format: EXPORT_FORMAT + 1, save: {} }))).toThrow('newer');
    expect(() => parseExport(JSON.stringify({ game: 'ultima3', format: EXPORT_FORMAT, save: { version: 1 } }))).toThrow('incomplete');
  });
});
