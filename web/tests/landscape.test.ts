import { describe, expect, it } from 'vitest';
import { newWorld } from './helpers.ts';
import { buildLandscape, landscapeOffset } from '../src/game/landscape.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { MapValue, Shape } from '../src/game/tiles.ts';
import { recordView } from '../src/game/automap.ts';
import { Location } from '../src/game/party.ts';

function flatWorld() {
  const world = newWorld();
  world.current.tiles.fill(MapValue.Grass);
  world.monsters.bytes.fill(0);
  world.x = world.y = 32;
  return world;
}

describe('whole-map landscape', () => {
  it.each([Location.Town, Location.Castle])('keeps hidden and previously explored rooms black in location %s', (location) => {
    const world = flatWorld();
    world.enterMap(location === Location.Town ? 402 : 400);
    world.party.location = location;
    world.current.tiles.fill(MapValue.Floor);
    world.monsters.bytes.fill(0);
    world.x = world.y = 32;
    for (let y = 0; y < 64; y++) world.putXYVal(MapValue.Wall, 33, y);
    world.putXYVal(MapValue.Town, 40, 32);
    world.autoMap.markSquares(world.current.id, [
      [34, 32],
      [40, 32],
    ]);
    const view = buildViewport(world);
    const landscape = buildLandscape(world, view);
    const visible = new Set<number>();
    view.cells.forEach((cell, i) => {
      const index = (view.originY + Math.floor(i / 11)) * 64 + view.originX + (i % 11);
      if (cell.base !== Shape.Void) visible.add(index);
      else expect(landscape.shapes[index]).toBe(Shape.Void);
    });
    expect(landscape.shapes[32 * 64 + 32]).toBe(Shape.Floor);
    expect(landscape.shapes[32 * 64 + 33]).toBe(Shape.Wall);
    expect(landscape.shapes[32 * 64 + 34]).toBe(Shape.Void);
    expect(landscape.shapes[32 * 64 + 40]).toBe(Shape.Void);
    landscape.shapes.forEach((shape, i) => {
      if (!visible.has(i)) expect(shape).toBe(Shape.Void);
    });
    world.x = 35;
    const moved = buildLandscape(world, buildViewport(world));
    expect(moved.shapes[32 * 64 + 34]).toBe(Shape.Floor);
    expect(moved.shapes[32 * 64 + 32]).toBe(Shape.Void);
  });

  it('hides unexplored terrain without recording it as explored or changing the game', () => {
    const world = flatWorld();
    world.putXYVal(MapValue.Forest, 4, 4);
    const before = world.current.tiles.slice();
    const seen = world.autoMap.toText();
    const land = buildLandscape(world, buildViewport(world));
    expect(land.shapes).toHaveLength(4096);
    expect(land.shapes[4 * 64 + 4]).toBe(Shape.Void);

    expect(world.current.tiles).toEqual(before);
    expect(world.autoMap.toText()).toBe(seen);
    world.autoMap.markSquares(world.current.id, [[4, 4]]);
    expect(buildLandscape(world, buildViewport(world)).shapes[4 * 64 + 4]).toBe(Shape.Forest);
    expect([world.x, world.y]).toEqual([32, 32]);
  });

  it('restores terrain underneath distant monsters instead of revealing them', () => {
    const world = flatWorld();
    world.monsters.setType(0, MapValue.Orc);
    world.monsters.setPosition(0, 3, 4);
    world.monsters.setTileUnder(0, MapValue.Brush);
    world.putXYVal(MapValue.Orc, 3, 4);
    world.putXYVal(MapValue.Frigate, 6, 6);
    world.autoMap.markSquares(world.current.id, [
      [3, 4],
      [6, 6],
    ]);
    const land = buildLandscape(world, buildViewport(world));
    expect(land.shapes[4 * 64 + 3]).toBe(Shape.Brush);
    expect(land.shapes[6 * 64 + 6]).toBe(Shape.Water);
    expect(land.shapes).not.toContain(MapValue.Orc >> 1);
  });

  it('keeps unknown secret locations concealed and retains discovered ones', () => {
    const world = flatWorld();
    world.putXYVal(MapValue.Dungeon, 3, 4);
    world.putXYVal(MapValue.Shrine, 4, 4);
    world.putXYVal(MapValue.MoonGate, 5, 4);
    const view = buildViewport(world);
    const hidden = buildLandscape(world, view);
    expect(hidden.shapes[4 * 64 + 3]).toBe(Shape.Void);
    expect(hidden.shapes[4 * 64 + 4]).toBe(Shape.Void);
    expect(hidden.shapes[4 * 64 + 5]).toBe(Shape.Void);
    world.autoMap.markSquares(world.current.id, [
      [3, 4],
      [4, 4],
      [5, 4],
    ]);
    const known = buildLandscape(world, view);
    expect(known.shapes[4 * 64 + 3]).toBe(Shape.Dungeon);
    expect(known.shapes[4 * 64 + 4]).toBe(Shape.Shrine);
    expect(known.shapes[4 * 64 + 5]).toBe(Shape.Grass); // Previously seeing the grass does not discover a future gate.
  });

  it('reveals known moongates and keeps Dawn hidden when only its forest was seen', () => {
    const world = flatWorld();
    const { locationX, locationY, moonX, moonY } = world.resources.misc;
    const [gx, gy] = [moonX[0], moonY[0]];
    const [dx, dy] = [locationX[8], locationY[8]];
    world.x = (dx + 20) % 64;
    world.y = (dy + 20) % 64;
    world.putXYVal(MapValue.Town, dx, dy);
    world.putXYVal(MapValue.MoonGate, gx, gy);
    world.autoMap.markSquares(world.current.id, [
      [dx, dy],
      [gx, gy],
    ]);
    world.gatesKnown = [0];
    const land = buildLandscape(world, buildViewport(world));
    expect(land.shapes[dy * 64 + dx]).toBe(Shape.Forest);
    expect(land.shapes[gy * 64 + gx]).toBe(Shape.MoonGate);
    world.autoMap.markSquares(408, [[1, 1]]);
    expect(buildLandscape(world, buildViewport(world)).shapes[dy * 64 + dx]).toBe(Shape.Town);
  });

  it('reveals a secret in current sight without revealing the creature behind a mountain', () => {
    const world = flatWorld();
    world.putXYVal(MapValue.Dungeon, 32, 31);
    world.putXYVal(MapValue.Mountains, 33, 32);
    world.monsters.setType(0, MapValue.Orc);
    world.monsters.setPosition(0, 34, 32);
    world.monsters.setTileUnder(0, MapValue.Grass);
    world.putXYVal(MapValue.Orc, 34, 32);
    const view = buildViewport(world);
    expect(buildLandscape(world, view).shapes[31 * 64 + 32]).toBe(Shape.Dungeon);
    expect(view.cells[5 * 11 + 7].base).toBe(Shape.Void);
  });

  it('remembers visible terrain across movement and saved exploration, including wrapping edges', () => {
    const world = flatWorld();
    world.x = world.y = 0;
    const view = buildViewport(world);
    recordView(world, view);
    const saved = world.autoMap.toText();
    const visible = buildLandscape(world, view);
    expect(visible.shapes[63 * 64 + 63]).toBe(Shape.Grass);
    expect(visible.shapes[20 * 64 + 20]).toBe(Shape.Void);
    world.x = world.y = 32;
    world.autoMap.clear();
    world.autoMap.fromText(saved);
    const moved = buildLandscape(world, buildViewport(world));
    expect(moved.shapes[63 * 64 + 63]).toBe(Shape.Grass);
    expect(moved.shapes[32 * 64 + 32]).toBe(Shape.Grass);
    expect(moved.shapes[20 * 64 + 20]).toBe(Shape.Void);
    expect(world.autoMap.toText()).toBe(saved);
  });

  it('places neighbours across the overworld seam next to the party', () => {
    expect(landscapeOffset(63, 0, 64, true)).toBe(-1);
    expect(landscapeOffset(0, 63, 64, true)).toBe(1);
    expect(landscapeOffset(63, 0, 64, false)).toBe(63);
    const offsets = Array.from({ length: 64 }, (_, x) => landscapeOffset(x, 0, 64, true));
    expect(new Set(offsets).size).toBe(64);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBe(63);
  });
});
