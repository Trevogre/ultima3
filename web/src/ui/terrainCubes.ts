import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, type MeshBasicMaterial } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { View3DSettings } from './view3DSettings.ts';
import { barrierHeight, MOUNTAIN_STEPS, raisedTerrain, shorelineUsesBackground } from './terrainDepth.ts';

/** One tile wide and deep, standing one tile above the original ground plane. */
export function terrainCubeGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  // Three's box UVs assume Y-up; the map is Z-up. Reorient each vertical
  // face so V follows height and U reads left-to-right from outside.
  for (let i = 0; i < position.count; i++) {
    const nx = normal.getX(i),
      ny = normal.getY(i);
    if (normal.getZ(i) !== 0) continue; // retain the original top/bottom art
    uv.setXY(i, 0.5 + ny * position.getX(i) - nx * position.getY(i), position.getZ(i));
  }
  return geometry;
}

export class TerrainCubes {
  readonly geometry = terrainCubeGeometry();
  readonly slots = new InstancedBufferAttribute(new Float32Array(4096 * 3 * 2), 2);
  readonly backgrounds = new InstancedBufferAttribute(new Float32Array(4096 * 3), 1);
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();

  constructor(material: MeshBasicMaterial) {
    this.geometry.setAttribute('mapTile', this.slots);
    this.geometry.setAttribute('shorelineBackground', this.backgrounds);
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
      if (!raisedTerrain(shape, options)) return;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      const steps =
        shape === Shape.Mountains && options.steppedMountains ? MOUNTAIN_STEPS : [{ width: 1, height: barrierHeight(shape), base: 0 }];
      for (const step of steps) {
        this.matrix.makeScale(step.width, step.width, step.height).setPosition(x, y, step.base);
        this.mesh.setMatrixAt(count, this.matrix);
        this.slots.setXY(count, shape % 16, 15 - Math.floor(shape / 16));
        this.backgrounds.setX(count, shorelineUsesBackground(shape) ? 1 : 0);
        count++;
      }
    });
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.slots.needsUpdate = true;
    this.backgrounds.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
