import type { World } from '../game/world.ts';
import type { Viewport } from '../game/viewport.ts';
import { memberShape } from '../game/combat.ts';
import { Shape } from '../game/tiles.ts';

export interface ModelActor {
  id: string;
  shape: number;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  size: number;
  ground: number;
  poisoned?: boolean;
  hit?: boolean;
}

/** Select only figures already admitted by the normal viewport visibility rules. */
export function modelActors(world: World, view: Viewport, style: 'grid' | 'line' | 'symbol'): ModelActor[] {
  const actors: ModelActor[] = [];
  const side = Math.sqrt(view.cells.length);
  view.cells.forEach((cell, index) => {
    if (cell.base === Shape.Void) return;
    const col = index % side,
      row = Math.floor(index / side);
    const x = col - (side - 1) / 2,
      y = (side - 1) / 2 - row;
    const worldX = world.constrain(view.originX + col),
      worldY = world.constrain(view.originY + row);
    const add = (id: string, shape: number, size = 1, dx = 0, dy = 0, poisoned = false) =>
      actors.push({ id, shape, x: x + dx, y: y + dy, worldX, worldY, size, ground: cell.base, poisoned, hit: !!cell.hit });
    const member = (m: number, grid: boolean) => {
      if (world.party.memberSlot(m) < 0 || !world.memberAlive(m)) return;
      const p = world.member(m);
      add(
        `member:${m}`,
        memberShape(world, p.classLetter),
        grid ? 0.5 : 1,
        grid ? (m % 2) * 0.5 - 0.25 : 0,
        grid ? 0.25 - Math.floor(m / 2) * 0.5 : 0,
        p.status === 'P',
      );
    };
    if (cell.follower !== undefined && style === 'line') member(cell.follower, false);
    if (cell.party && style !== 'symbol') {
      if (style === 'grid') for (let m = 0; m < 4; m++) member(m, true);
      else {
        const leader = [0, 1, 2, 3].find((m) => world.party.memberSlot(m) >= 0 && world.memberAlive(m));
        if (leader !== undefined) member(leader, false);
      }
      return;
    }
    if (cell.overlay === undefined) return;
    let id = `object:${worldX}:${worldY}:${cell.overlay}`;
    if (cell.party || (col === (side - 1) / 2 && row === (side - 1) / 2 && !world.combat)) id = 'party';
    else if (world.combat) {
      const member = world.combat.members.findIndex((m) => m.x === col && m.y === row);
      const monster = world.combat.monsters.findIndex((m) => m.hp > 0 && m.x === col && m.y === row);
      if (member >= 0) id = `member:${member}`;
      else if (monster >= 0) id = `monster:${monster}`;
    } else {
      const monster = world.monsters.at(worldX, worldY);
      if (monster >= 0) id = `monster:${monster}`;
    }
    add(id, cell.overlay);
  });
  return actors;
}

/** Visual heading only. Camera rotations and redraws cannot turn a figure. */
export class ModelHeadings {
  private context = '';
  private readonly positions = new Map<string, { x: number; y: number; yaw: number }>();
  begin(context: string): void {
    if (context === this.context) return;
    this.context = context;
    this.positions.clear();
  }
  heading(actor: ModelActor, side: number, wraps: boolean): number {
    const last = this.positions.get(actor.id);
    const delta = (d: number) => (wraps ? ((((d + side / 2) % side) + side) % side) - side / 2 : d);
    const dx = last ? delta(actor.worldX - last.x) : 0,
      dy = last ? delta(actor.worldY - last.y) : 0;
    const yaw = (dx || dy) && Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? Math.atan2(dx, dy) : (last?.yaw ?? 0);
    this.positions.set(actor.id, { x: actor.worldX, y: actor.worldY, yaw });
    return yaw;
  }
}
