/**
 * viewport.ts
 *
 * Builds the 11x11 window of shapes that the renderer draws around the
 * party. This is a port of `DrawMap()`, `HideMonsters()` and `ShowMonsters()`
 * from UltimaGraphics.c, reduced to a pure function: it reads the world and
 * returns what to draw, and does no drawing itself.
 *
 * Each cell has a `base` shape (terrain, drawn opaque) and optionally an
 * `overlay` shape (a creature or object, drawn through the transparency
 * mask so the terrain shows around it).
 */

import { World } from './world.ts';
import { Location } from './party.ts';
import { buildSightRegion, type SightRegion } from './sightPolygon.ts';
import { Shape, MapValue, isLetter, monsterVariantShape } from './tiles.ts';

export const VIEW_SIZE = 11;
export const VIEW_CENTRE = 5;
const CENTRE_OFFSET = VIEW_CENTRE * VIEW_SIZE + VIEW_CENTRE; // 60, 0x3C in the C source

export interface ViewCell {
  base: number;
  overlay?: number;
  /** Draw the overlay horizontally flipped (horse facing east). */
  flip?: boolean;
  /** Draw the overlay from its alternate animation frame (the "HIT" balls). */
  altFrame?: boolean;
  /**
   * A hit landing here: the frame 1..3 and the ball shape. The screen draws
   * either the ball's "HIT" tile in place of the overlay, or, with the
   * Standard tiles, an expanding burst over it.
   */
  hit?: { frame: number; shape: number };
  /** The party stands here on foot; the screen may draw the members instead of the overlay figure. */
  party?: boolean;
  /** Member index (0-3) of a follower walking behind the leader here (towns and castles). */
  follower?: number;
}

export interface Viewport {
  cells: ViewCell[];
  /** Map coordinates of the top-left cell. (`stx`, `sty`.) */
  originX: number;
  originY: number;
  /** Optional full-town current sight. Never exploration memory or camera visibility. */
  townSight?: Viewport;
  /** Continuous town boundary used by the enhanced renderer. */
  sightRegion?: SightRegion;
}

/**
 * Step 1 of `DrawMap()`: read the 11x11 block of map values around (x, y)
 * and convert each to a shape. Letters "I" that are not part of a word are
 * drawn as doors.
 */
function fillShapes(world: World, originX: number, originY: number, side = VIEW_SIZE): Uint8Array {
  const shapes = new Uint8Array(side * side);
  let offset = 0;
  for (let ym = originY; ym < originY + side; ym++) {
    for (let xm = originX; xm < originX + side; xm++) {
      const val = world.getXYVal(xm, ym);
      shapes[offset] = monsterVariantShape(val);

      if (val === MapValue.LetterI && xm > 0 && xm < world.mapSize - 1 && ym > 0) {
        // An "I" is a door unless it is part of a sign: a letter to its left,
        // right, or above means it is text. Another "I" never counts, so that
        // two doors side by side do not vouch for each other. The Mac port
        // (UltimaGraphics.c) looked only at the tile immediately beside, which
        // also cost a word ending in "II" its last letter: that letter sees
        // only its twin and turns into a door. Moon's "CAPESSII" is the one
        // sign in the game it spoils. Looking past a run of "I"s first reads
        // the sign correctly and still leaves every real door a door.
        const isText = (v: number) => isLetter(v) && v !== MapValue.LetterI;
        const pastAnyIs = (dx: number): number => {
          let x = xm + dx;
          while (x > 0 && x < world.mapSize - 1 && world.getXYVal(x, ym) === MapValue.LetterI) x += dx;
          return world.getXYVal(x, ym);
        };
        const above = world.getXYVal(xm, ym - 1);
        if (!isText(pastAnyIs(-1)) && !isText(pastAnyIs(1)) && !isLetter(above)) shapes[offset] = Shape.Door;
      }
      offset++;
    }
  }
  return shapes;
}

/**
 * Step 2 of `DrawMap()`: line of sight. Starting from the outermost cells and
 * working inward, trace a path from each cell toward the party. If the path
 * runs into mountains, forest, a wall, or an already-hidden cell, this cell
 * becomes Void. Because hidden cells are written back into the same buffer,
 * anything behind them is hidden in turn.
 *
 * The C code stepped `xt += sign(5 - xt)` for both axes; the sign table
 * `xhide` was reused for y.
 */
function applyLineOfSight(shapes: Uint8Array): void {
  const blocks = (s: number) => s === Shape.Forest || s === Shape.Mountains || s === Shape.Wall || s === Shape.Void;
  const toward = (v: number) => (v < VIEW_CENTRE ? 1 : v > VIEW_CENTRE ? -1 : 0);

  for (let offset = VIEW_SIZE * VIEW_SIZE - 1; offset >= 0; offset--) {
    let xt = offset % VIEW_SIZE;
    let yt = Math.floor(offset / VIEW_SIZE);
    let cursor = offset;
    for (;;) {
      const next = cursor + toward(xt) + toward(yt) * VIEW_SIZE;
      if (next === CENTRE_OFFSET) break; // reached the party: visible
      cursor = next;
      if (blocks(shapes[cursor])) {
        shapes[offset] = Shape.Void;
        break;
      }
      xt += toward(xt);
      yt += toward(yt);
    }
  }
}

/**
 * Step 3: decide which cells get a masked overlay. Mirrors the surface and
 * town branch of `HideMonsters()` / `ShowMonsters()`. Monsters are not part
 * of the map bytes in the viewport buffer... except that they are: the map
 * stores a monster's value in place of the terrain and remembers the terrain
 * in the monster table. So to draw terrain under a monster we look up the
 * monster's `tileUnder`. Other objects (chests, horses, ships) encode or
 * imply their background.
 */
function applyOverlays(
  world: World,
  shapes: Uint8Array,
  originX: number,
  originY: number,
  side = VIEW_SIZE,
  partyX = VIEW_CENTRE,
  partyY = VIEW_CENTRE,
): ViewCell[] {
  const cells: ViewCell[] = Array.from(shapes, (s) => ({ base: s }));
  const monsters = world.monsters;
  const isBall = (s: number) => s >= Shape.MagicBall && s <= Shape.FireBall;

  // Creatures from the monster table.
  for (let i = 0; i < 32; i++) {
    if (monsters.type(i) === 0) continue;
    let xm = monsters.x(i) - originX;
    let ym = monsters.y(i) - originY;
    if (world.onSurface) {
      xm = world.constrain(xm);
      ym = world.constrain(ym);
    }
    if (xm < 0 || xm >= side || ym < 0 || ym >= side) continue;
    const offset = ym * side + xm;
    const s = shapes[offset];
    if (s === Shape.Void || isBall(s)) continue;
    cells[offset] = { base: monsters.tileUnder(i) >> 1, overlay: s };
  }

  // Objects whose background is implied.
  for (let offset = 0; offset < cells.length; offset++) {
    const cell = cells[offset];
    if (cell.overlay !== undefined) continue;
    const xm = offset % side;
    const ym = Math.floor(offset / side);
    const s = cell.base;
    switch (s) {
      case Shape.Jester: // Jester in Lord British's castle stands on water
      case Shape.SnakeBottom:
      case Shape.SnakeTop:
      case Shape.Frigate:
      case Shape.Whirlpool:
      case Shape.Serpent: // the sea creatures are table entries with water under them; a stray value still sits on water
      case Shape.ManOWar:
      case Shape.Pirate:
        cells[offset] = { base: Shape.Water, overlay: s };
        break;
      case Shape.Horse:
        cells[offset] = { base: Shape.Grass, overlay: s };
        break;
      case Shape.Shrine:
        // Ambrosia's shrines sit on whatever is to their left.
        cells[offset] = { base: world.getXYVal(originX + xm - 1, originY + ym) >> 1, overlay: s };
        break;
      case Shape.Chest: {
        // A chest's low two map bits say what it sits on: 0 floor, else grass/brush/forest.
        const under = (world.getXYVal(originX + xm, originY + ym) & 0x3) * 2;
        cells[offset] = { base: under === 0 ? Shape.Floor : under, overlay: Shape.Chest };
        break;
      }
      case Shape.Door: {
        // Draw a door over the terrain to its left (or grass if that is not terrain).
        const mon = monsters.at(originX + xm - 1, originY + ym);
        let neighbour = mon >= 0 ? monsters.tileUnder(mon) >> 1 : world.getXYVal(originX + xm - 1, originY + ym) >> 1;
        if (neighbour > Shape.Floor) neighbour = Shape.Grass;
        cells[offset] = { base: neighbour, overlay: Shape.Door };
        break;
      }
      default:
        break;
    }
  }

  // The party itself, unless a spell ball is being drawn over it.
  if (world.party.location !== Location.Combat) {
    const centre = cells[partyY * side + partyX];
    if (!isBall(centre.overlay ?? centre.base)) {
      centre.overlay = world.party.shape;
      centre.flip = world.party.shape === Shape.Horse && world.horseFacingEast;
      centre.party = world.party.shape === 0x7e; // on foot (the ranger figure)
      if (centre.party) markFollowers(world, cells, originX + partyX, originY + partyY, side, partyX, partyY);
    }
  }
  return cells;
}

/**
 * The combat arena: the 11x11 arena shapes with monsters and members drawn
 * over the terrain they stand on. Mirrors the combat branch of
 * `HideMonsters()` / `ShowMonsters()`.
 */
function buildCombatViewport(world: World): Viewport {
  const c = world.combat!;
  const cells: ViewCell[] = Array.from(c.tiles, (s) => ({ base: s }));
  for (const m of c.monsters) {
    if (m.hp <= 0) continue;
    cells[m.y * VIEW_SIZE + m.x] = { base: m.tileUnder, overlay: m.shape };
  }
  c.members.forEach((p) => {
    if (p.x > 10 || p.y > 10) return;
    cells[p.y * VIEW_SIZE + p.x] = { base: p.tileUnder, overlay: p.shape };
  });
  return { cells, originX: 0, originY: 0 };
}

/**
 * In a town or castle the living members after the leader walk in a line
 * on the squares the leader came through (`world.trail`). Squares hidden
 * by line of sight, or off the view, show nothing.
 */
function markFollowers(
  world: World,
  cells: ViewCell[],
  x: number,
  y: number,
  viewSide = VIEW_SIZE,
  centreX = VIEW_CENTRE,
  centreY = VIEW_CENTRE,
): void {
  const living = [0, 1, 2, 3].filter((m) => world.party.memberSlot(m) >= 0 && world.memberAlive(m));
  const size = world.mapSize;
  const wrap = (d: number) => ((((d + size / 2) % size) + size) % size) - size / 2; // shortest way round a wrapping map
  world.trail.forEach((pos, i) => {
    const member = living[i + 1];
    if (member === undefined) return;
    const ddx = wrap(pos.x - x);
    const ddy = wrap(pos.y - y);
    if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) return; // a moongate or whirlpool left this square behind
    const vx = ddx + centreX;
    const vy = ddy + centreY;
    if (vx < 0 || vx >= viewSide || vy < 0 || vy >= viewSide) return;
    const cell = cells[vy * viewSide + vx];
    if (cell.base === Shape.Void) return;
    cell.follower = member;
  });
}

/** Build the viewport centred on the party (or the arena during combat). */
export function buildViewport(world: World, x = world.x, y = world.y): Viewport {
  let view: Viewport;
  if (world.combat) {
    view = buildCombatViewport(world);
  } else if (world.townSightlines && world.inTownOrCastle) {
    const side = world.mapSize;
    const shapes = fillShapes(world, 0, 0, side);
    const blockers = shapes.slice();
    for (let i = 0; i < 32; i++)
      if (world.monsters.type(i)) blockers[world.monsters.y(i) * side + world.monsters.x(i)] = world.monsters.tileUnder(i) >> 1;
    const blocked = (cx: number, cy: number) => {
      if (cx < 0 || cy < 0 || cx >= side || cy >= side) return true;
      const shape = blockers[cy * side + cx];
      return shape === Shape.Wall || shape === Shape.Door || shape === Shape.Forest || shape === Shape.Mountains || shape === Shape.Void;
    };
    const sightRegion = buildSightRegion(side, x, y, blocked);
    const visible = sightRegion.visible;
    shapes.forEach((_, i) => {
      if (!visible[i]) shapes[i] = Shape.Void;
    });
    const townSight: Viewport = { cells: applyOverlays(world, shapes, 0, 0, side, x, y), originX: 0, originY: 0 };
    const originX = x - VIEW_CENTRE,
      originY = y - VIEW_CENTRE;
    const cells = Array.from({ length: VIEW_SIZE * VIEW_SIZE }, (_, i): ViewCell => {
      const cx = originX + (i % VIEW_SIZE),
        cy = originY + Math.floor(i / VIEW_SIZE);
      return cx < 0 || cy < 0 || cx >= side || cy >= side ? { base: Shape.Void } : { ...townSight.cells[cy * side + cx] };
    });
    view = { cells, originX, originY, townSight, sightRegion };
  } else {
    const shapes = fillShapes(world, x - VIEW_CENTRE, y - VIEW_CENTRE);
    applyLineOfSight(shapes);
    const originX = x - VIEW_CENTRE;
    const originY = y - VIEW_CENTRE;
    view = { cells: applyOverlays(world, shapes, originX, originY), originX, originY };
  }

  // A spell ball or cannon shot in flight is drawn over whatever is there.
  const ball = world.ball;
  if (ball) {
    let vx = ball.x - view.originX;
    let vy = ball.y - view.originY;
    if (!world.combat && world.onSurface) {
      vx = world.constrain(vx);
      vy = world.constrain(vy);
    }
    if (vx >= 0 && vx < VIEW_SIZE && vy >= 0 && vy < VIEW_SIZE) {
      const cell = view.cells[vy * VIEW_SIZE + vx];
      view.cells[vy * VIEW_SIZE + vx] = ball.hit
        ? { ...cell, hit: { frame: ball.hit, shape: ball.shape } }
        : { base: cell.base, overlay: ball.shape };
      if (view.townSight && ball.x >= 0 && ball.y >= 0 && ball.x < world.mapSize && ball.y < world.mapSize)
        view.townSight.cells[ball.y * world.mapSize + ball.x] = view.cells[vy * VIEW_SIZE + vx];
    }
  }
  return view;
}
