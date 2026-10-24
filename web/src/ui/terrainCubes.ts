import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, type MeshBasicMaterial } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { MapValue, Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { View3DSettings } from './view3DSettings.ts';
import { MOUNTAIN_STEPS } from './terrainDepth.ts';

/** One tile wide and deep, standing one tile above the original ground plane. */
export function terrainCubeGeometry(): BoxGeometry {
  return new BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
}

export class TerrainCubes {
  readonly geometry = terrainCubeGeometry();
  readonly slots = new InstancedBufferAttribute(new Float32Array(4096 * 3 * 2), 2);
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();

  constructor(material: MeshBasicMaterial) {
    this.geometry.setAttribute('mapTile', this.slots);
    this.mesh = new InstancedMesh(this.geometry, material, 4096 * 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 0.25;
  }

  /** Accept only visibility-filtered shapes, never the raw world map. */
  set(landscape: Landscape | null, cells: ViewCell[], options: View3DSettings): void {
    const shapes = landscape ? landscape.shapes : cells.map((cell) => cell.base);
    const side = landscape?.side ?? Math.sqrt(cells.length);
    let count = 0;
    shapes.forEach((shape, i) => {
      const wall = shape === Shape.Wall || shape === MapValue.Wall2 >> 1;
      if (!(wall && options.walls) && !(shape === Shape.Mountains && options.mountains)) return;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      const steps = shape === Shape.Mountains && options.steppedMountains ? MOUNTAIN_STEPS : [{ width: 1, height: 1, base: 0 }];
      for (const step of steps) {
        this.matrix.makeScale(step.width, step.width, step.height).setPosition(x, y, step.base);
        this.mesh.setMatrixAt(count, this.matrix);
        this.slots.setXY(count, shape % 16, 15 - Math.floor(shape / 16));
        count++;
      }
    });
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.slots.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
