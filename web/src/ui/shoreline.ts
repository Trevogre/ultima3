import { InstancedBufferAttribute, InstancedMesh, Matrix4, type MeshBasicMaterial } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import type { ViewCell } from '../game/viewport.ts';
import { isCoastalLand, shorelineTexture } from './terrainDepth.ts';
import { terrainCubeGeometry } from './terrainCubes.ts';

/** Exposed shoreline sides repeat the neighbouring land tile's own texture. */
export class Shoreline {
  // Full-size upright UVs; the water occludes the submerged part rather than
  // compressing the entire texture into the exposed 0.2-tile strip.
  readonly geometry = terrainCubeGeometry().translate(0, 0, -1);
  readonly slots = new InstancedBufferAttribute(new Float32Array(4096 * 2), 2);
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();

  constructor(material: MeshBasicMaterial) {
    // The four vertical sides only: no coincident top face or invented seabed.
    this.geometry.clearGroups();
    this.geometry.addGroup(0, 24, 0);
    this.geometry.setDrawRange(0, 24);
    this.geometry.setAttribute('mapTile', this.slots);
    this.mesh = new InstancedMesh(this.geometry, material, 4096);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.2;
  }

  set(landscape: Landscape | null, cells: ViewCell[], enabled: boolean): void {
    this.mesh.count = 0;
    if (!enabled) return;
    const shapes = landscape?.shapes ?? cells.map((cell) => cell.base);
    const side = landscape?.side ?? Math.sqrt(cells.length);
    for (let i = 0; i < shapes.length; i++) {
      if (!isCoastalLand(shapes, side, i, landscape?.wraps ?? false)) continue;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      this.mesh.setMatrixAt(this.mesh.count, this.matrix.makeTranslation(x, y, 0));
      const texture = shorelineTexture(shapes[i]);
      this.slots.setXY(this.mesh.count++, texture % 16, 15 - Math.floor(texture / 16));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.slots.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
