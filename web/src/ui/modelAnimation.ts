import type { ModelActor } from './modelActors.ts';
import type { ModelAction } from './modelRigs.ts';

/** A presentation clock/state machine. Movement and actions never write to World. */
export class ModelMotion {
  private last: ModelActor;
  private from: { x: number; y: number };
  private target: { x: number; y: number };
  private walkAt = -Infinity;
  private actionAt = -Infinity;
  private action: ModelAction = 'idle';
  private wasHit = false;
  yaw: number;
  readonly phase: number;
  constructor(actor: ModelActor, yaw: number) {
    this.last = { ...actor };
    this.from = this.target = { x: actor.x, y: actor.y };
    this.yaw = yaw;
    this.phase = [...actor.id].reduce((n, c) => n + c.charCodeAt(0) * 0.17, 0);
  }
  update(actor: ModelActor, yaw: number, clock: number, side: number, wraps: boolean): void {
    const delta = (d: number) => (wraps ? ((((d + side / 2) % side) + side) % side) - side / 2 : d);
    const dx = delta(actor.worldX - this.last.worldX),
      dy = delta(actor.worldY - this.last.worldY);
    if ((dx || dy) && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      this.from = { x: actor.x - dx, y: actor.y + dy };
      this.target = { x: actor.x, y: actor.y };
      this.walkAt = clock;
      this.yaw = yaw;
    } else if (dx || dy || actor.x !== this.target.x || actor.y !== this.target.y) {
      this.from = this.target = { x: actor.x, y: actor.y };
      this.walkAt = -Infinity;
      this.yaw = yaw;
    }
    if (actor.hit && !this.wasHit) this.trigger('hit', clock);
    this.wasHit = !!actor.hit;
    this.last = { ...actor };
  }
  trigger(action: 'attack' | 'cast' | 'hit', clock: number, yaw?: number): void {
    this.action = action;
    this.actionAt = clock;
    if (yaw !== undefined) this.yaw = yaw;
  }
  sample(clock: number): { x: number; y: number; state: ModelAction; progress: number } {
    const walking = Math.max(0, Math.min(1, (clock - this.walkAt) / 0.32)),
      blend = walking * walking * (3 - 2 * walking);
    const duration = this.action === 'cast' ? 0.85 : this.action === 'hit' ? 0.38 : 0.55;
    const actionProgress = (clock - this.actionAt) / duration;
    return {
      x: this.from.x + (this.target.x - this.from.x) * blend,
      y: this.from.y + (this.target.y - this.from.y) * blend,
      state: actionProgress < 1 ? this.action : walking < 1 ? 'walk' : 'idle',
      progress: actionProgress < 1 ? Math.max(0, actionProgress) : walking,
    };
  }
}
