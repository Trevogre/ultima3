import type { World } from './world.ts';
import type { Viewport } from './viewport.ts';
import { MapValue, Shape, isLetter, mapValueToShape } from './tiles.ts';
import { Location } from './party.ts';
import { marksOn } from './worldMap.ts';

export interface Landscape {
  side: number;
  shapes: Uint8Array;
  partyX: number;
  partyY: number;
  wraps: boolean;
}

/** Explored scenery only. Reading it never expands exploration or exposes distant actors. */
export function buildLandscape(world: World, view: Viewport): Landscape {
  const side = world.mapSize;
  const wraps = world.onSurface || world.party.location === Location.Ambrosia;
  const tiles = world.current.tiles.slice();
  const underActor = world.inTownOrCastle ? MapValue.Floor : MapValue.Grass;
  for (let i = 0; i < 32; i++) {
    if (world.monsters.type(i)) tiles[world.monsters.y(i) * side + world.monsters.x(i)] = world.monsters.tileUnder(i);
  }
  const known = new Set(marksOn(world, { kind: 'map', id: world.current.id }).map((mark) => mark.y * side + mark.x));
  const visible = new Set<number>();
  const { locationX, locationY, moonX, moonY } = world.resources.misc;
  const knownGates = new Set(world.gatesKnown.map((phase) => moonY[phase] * side + moonX[phase]));
  const viewSide = Math.sqrt(view.cells.length);
  view.cells.forEach((cell, i) => {
    if (cell.base === Shape.Void) return;
    const vx = view.originX + (i % viewSide);
    const vy = view.originY + Math.floor(i / viewSide);
    if (!wraps && (vx < 0 || vy < 0 || vx >= side || vy >= side)) return;
    const x = world.constrain(vx);
    const y = world.constrain(vy);
    visible.add(y * side + x);
    known.add(y * side + x);
  });
  const at = (x: number, y: number): number => tiles[world.constrain(y) * side + world.constrain(x)];
  const shapes = Uint8Array.from(tiles, (value, i) => {
    // A town or castle is still governed by the original current line of sight.
    // Exploration history and the distant-terrain option must not expose rooms.
    if (world.inTownOrCastle && !visible.has(i)) return Shape.Void;
    const x = i % side;
    const y = Math.floor(i / side);
    const type = value & 0xfc;
    const explored = world.autoMap.squareSeen(world.current.id, x, y);
    // Charted landmarks are hints on the separate cloth map, not permission
    // to reveal terrain in the game view. Camera movement cannot explore.
    if (!visible.has(i) && !explored) return Shape.Void;
    const discovered = known.has(i) || explored;
    switch (type) {
      case MapValue.Dungeon:
        if (!discovered) return Shape.Mountains;
        break;
      case MapValue.Town:
        if (world.onSurface && x === locationX[8] && y === locationY[8] && !visible.has(i) && !world.autoMap.hasMap(408)) {
          return Shape.Forest; // Seeing this forest earlier does not discover the moon-dependent town.
        }
        if (!discovered) return Shape.Forest; // Dawn is the uncharted town, concealed in forest.
        break;
      case MapValue.Castle:
        if (!discovered) return Shape.Grass;
        break;
      case MapValue.Shrine:
        return discovered ? Shape.Shrine : Shape.Grass;
      case MapValue.MoonGate:
        return visible.has(i) || knownGates.has(i) ? Shape.MoonGate : Shape.Grass;
      case MapValue.Chest: {
        const ground = (value & 3) * 2;
        return ground || Shape.Floor;
      }
      case MapValue.Horse:
      case MapValue.Ranger:
        return Shape.Grass;
      case MapValue.Frigate:
      case MapValue.Whirlpool:
      case MapValue.Serpent:
      case MapValue.ManOWar:
      case MapValue.Pirate:
      case MapValue.Jester:
      case MapValue.SnakeTop:
      case MapValue.SnakeBottom:
        return Shape.Water;
      case MapValue.MagicBall:
      case MapValue.FireBall:
        return mapValueToShape(underActor);
      case MapValue.LetterI: {
        const isText = (v: number) => isLetter(v) && v !== MapValue.LetterI;
        const pastIs = (dx: number): number => {
          let nx = x + dx;
          while (nx > 0 && nx < side - 1 && at(nx, y) === MapValue.LetterI) nx += dx;
          return at(nx, y);
        };
        if (x > 0 && x < side - 1 && y > 0 && !isText(pastIs(-1)) && !isText(pastIs(1)) && !isLetter(at(x, y - 1))) {
          return Shape.Door;
        }
        break;
      }
      default:
        if (type >= MapValue.Merchant && type <= MapValue.Exodus) return mapValueToShape(underActor);
    }
    return mapValueToShape(value);
  });
  return { side, shapes, partyX: world.x, partyY: world.y, wraps };
}

/** Position relative to the party, with the far-away seam of a wrapping map behind it. */
export function landscapeOffset(value: number, party: number, side: number, wraps: boolean): number {
  const d = value - party;
  return wraps ? ((((d + side / 2) % side) + side) % side) - side / 2 : d;
}
