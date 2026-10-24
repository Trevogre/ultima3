import { AdditiveBlending, DataTexture, DoubleSide, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat } from 'three';
import { Shape } from '../game/tiles.ts';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import type { ViewCell } from '../game/viewport.ts';
import { raisedTerrain, barrierHeight } from './terrainDepth.ts';
import type { View3DSettings } from './view3DSettings.ts';

export const WINDOW_RADIUS = 3.5;
const SIZE = 64;
/** Moonlit nights get warm windows; a disabled day/night tint gives zero. */
export function windowNight(colour: readonly number[]): number {
  return Math.max(0, Math.min(1, (0.78 - colour[0]) / 0.43));
}

/** Trace from a raised window to a ground receiver. Hidden cells also block light. */
export function windowSpill(dx: number, dy: number, at: (x: number, y: number) => number, options: View3DSettings): number {
  const distance = Math.hypot(dx, dy);
  if (distance >= WINDOW_RADIUS || [Shape.Void, Shape.Water].includes(at(dx, dy) as never)) return 0;
  let transmission = 1;
  const steps = Math.ceil(distance * 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps,
      x = dx * t,
      y = dy * t;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;
    const shape = at(x, y);
    if (shape === Shape.Void || (raisedTerrain(shape, options) && barrierHeight(shape) > 0.65 * (1 - t))) return 0;
    // Retain broad, soft vegetation shadows without treating grass as a blocker.
    if ((shape === Shape.Forest || shape === Shape.Brush) && Math.hypot(x - Math.round(x), y - Math.round(y)) < 0.22) transmission = 0.12;
  }
  return transmission * Math.pow(1 - distance / WINDOW_RADIUS, 2);
}

/** Small light pools use only the already visibility-filtered scenery. */
export class WindowLights {
  readonly group = new Group();
  private readonly geometry = new PlaneGeometry(WINDOW_RADIUS * 2, WINDOW_RADIUS * 2);
  private readonly pools: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  private strength = 0;
  private lastLayout = '';
  setNight(strength: number): void {
    this.strength = strength;
    for (const pool of this.pools) pool.material.opacity = strength * 0.4;
    this.group.visible = strength > 0;
  }
  set(landscape: Landscape | null, cells: ViewCell[], options: View3DSettings, enabled: boolean): void {
    const shapes = landscape?.shapes ?? cells.map((c) => c.base);
    const side = landscape?.side ?? Math.sqrt(cells.length);
    const wrap = landscape?.wraps ?? false;
    const key = enabled
      ? `${side}:${landscape?.partyX}:${landscape?.partyY}:${wrap}:${options.walls}:${options.mountains}:${Array.from(shapes).join(',')}`
      : 'off';
    if (key === this.lastLayout) return;
    this.lastLayout = key;
    this.clear();
    if (!enabled) return;
    const at = (x: number, y: number) => {
      x = Math.round(x);
      y = Math.round(y);
      if (!wrap && (x < 0 || y < 0 || x >= side || y >= side)) return Shape.Void;
      return shapes[((y + side) % side) * side + ((x + side) % side)];
    };
    shapes.forEach((shape, index) => {
      if (shape !== Shape.Town && shape !== Shape.Castle) return;
      const col = index % side,
        row = Math.floor(index / side);
      const pixels = new Uint8Array(SIZE * SIZE * 4);
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const dx = ((x + 0.5) / SIZE - 0.5) * WINDOW_RADIUS * 2;
          const dy = ((y + 0.5) / SIZE - 0.5) * WINDOW_RADIUS * 2;
          const value = windowSpill(dx, dy, (rx, ry) => at(col + rx, row + ry), options);
          const i = (y * SIZE + x) * 4;
          pixels.set([255, 156, 55, Math.round(value * 255)], i);
        }
      const texture = new DataTexture(pixels, SIZE, SIZE, RGBAFormat);
      texture.minFilter = texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        blending: AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        opacity: this.strength * 0.4,
      });
      const pool = new Mesh(this.geometry, material);
      const px = landscape?.partyX ?? (side - 1) / 2,
        py = landscape?.partyY ?? (side - 1) / 2;
      pool.position.set(landscapeOffset(col, px, side, wrap), -landscapeOffset(row, py, side, wrap), 0.006);
      // Texture Y is map south; ground Y is north.
      pool.scale.y = -1;
      pool.renderOrder = 0.6;
      this.pools.push(pool);
      this.group.add(pool);
    });
  }
  private clear(): void {
    for (const pool of this.pools) {
      pool.material.map?.dispose();
      pool.material.dispose();
    }
    this.pools.length = 0;
    this.group.clear();
  }
  dispose(): void {
    this.clear();
    this.geometry.dispose();
  }
}
