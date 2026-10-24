import {
  CanvasTexture,
  DoubleSide,
  Frustum,
  Sphere,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type OrthographicCamera,
} from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import type { GrassPatch } from './grassLayouts.ts';

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function grassOpacity(tilt: number, pixelsPerTile: number) {
  return smooth(0.08, 0.45, tilt) * smooth(24, 48, pixelsPerTile) * 0.8;
}

export const GRASS_CARD_BUDGET = 32768;

/** Short, explored, camera-visible grass copies. No depth writes or individual shadows. */
export class GrassDepth {
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new PlaneGeometry(1, 1);
  readonly rects = new InstancedBufferAttribute(new Float32Array(GRASS_CARD_BUDGET * 4), 4);
  readonly mesh: InstancedMesh;
  private tiles: { x: number; y: number }[] = [];
  private patches: readonly GrassPatch[] = [];
  private frustum = new Frustum();
  private viewProjection = new Matrix4();
  private bounds = new Sphere(new Vector3(), 0.9);
  private matrix = new Matrix4();
  private position = new Vector3();
  private scale = new Vector3();
  private right = new Vector3();
  private up = new Vector3();
  constructor() {
    this.canvas.width = this.canvas.height = 64;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute vec4 grassRect;\n${shader.vertexShader}`.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvMapUv=grassRect.xy+vMapUv*grassRect.zw;',
      );
    };
    this.geometry.setAttribute('grassRect', this.rects);
    this.mesh = new InstancedMesh(this.geometry, this.material, GRASS_CARD_BUDGET);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 0.85;
  }
  set(cells: ViewCell[], gfx: GraphicsSet, enabled: boolean, landscape: Landscape | null = null) {
    this.mesh.count = 0;
    this.tiles = [];
    this.patches = enabled && gfx.grass ? gfx.grass.patches : [];
    if (!this.patches.length || !gfx.grass) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(gfx.grass.image, 0, 0);
    this.texture.needsUpdate = true;
    const shapes = landscape?.shapes ?? cells.map((cell) => cell.base);
    const side = landscape?.side ?? Math.sqrt(cells.length);
    shapes.forEach((shape, i) => {
      if (shape !== Shape.Grass) return;
      this.tiles.push({
        x: landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2,
        y: landscape
          ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
          : (side - 1) / 2 - Math.floor(i / side),
      });
    });
  }
  faceCamera(camera: OrthographicCamera, tilt: number, pixelsPerTile: number) {
    this.mesh.count = 0;
    this.material.opacity = grassOpacity(tilt, pixelsPerTile);
    this.mesh.visible = this.material.opacity > 0 && this.patches.length > 0;
    if (!this.mesh.visible) return;
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const visible = this.tiles.filter((tile) => {
      this.bounds.center.set(tile.x, tile.y, 0.06);
      return this.frustum.intersectsSphere(this.bounds);
    });
    // Share the budget across every visible tile instead of cutting the map
    // off after the first N instances. At normal zoom all native marks fit.
    const perTile = Math.min(this.patches.length, Math.floor(GRASS_CARD_BUDGET / Math.max(1, visible.length)));
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (const tile of visible) {
      for (let mark = 0; mark < perTile; mark++) {
        const patch = this.patches[Math.floor((mark * this.patches.length) / perTile)];
        this.rects.setXYZW(this.mesh.count, patch[4], patch[5], patch[6], patch[7]);
        this.position
          .set(tile.x + patch[0] - 0.5, tile.y + 0.5 - patch[1], 0.003)
          .addScaledVector(this.right, (0.5 - patch[8]) * patch[2])
          .addScaledVector(this.up, patch[3] / 2);
        this.scale.set(patch[2], patch[3], 1);
        this.mesh.setMatrixAt(this.mesh.count++, this.matrix.compose(this.position, camera.quaternion, this.scale));
      }
    }
    this.rects.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  setDaylight(colour: [number, number, number]) {
    this.material.color.setRGB(...colour);
  }
  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
