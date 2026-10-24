import {
  CanvasTexture,
  DoubleSide,
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

/** Short, local, visibility-filtered grass copies. No depth writes or individual shadows. */
export class GrassDepth {
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new PlaneGeometry(1, 1);
  readonly rects = new InstancedBufferAttribute(new Float32Array(8192 * 4), 4);
  readonly mesh: InstancedMesh;
  private patches: { x: number; y: number; patch: GrassPatch }[] = [];
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
    this.mesh = new InstancedMesh(this.geometry, this.material, 8192);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 0.85;
  }
  set(cells: ViewCell[], gfx: GraphicsSet, enabled: boolean) {
    this.mesh.count = 0;
    this.patches = [];
    if (!enabled || !gfx.grass) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(gfx.grass.image, 0, 0);
    this.texture.needsUpdate = true;
    const side = Math.sqrt(cells.length);
    cells.forEach((cell, i) => {
      if (cell.base !== Shape.Grass) return;
      for (const patch of gfx.grass!.patches) {
        if (this.patches.length >= 8192) break;
        this.rects.setXYZW(this.patches.length, patch[4], patch[5], patch[6], patch[7]);
        this.patches.push({
          x: (i % side) - (side - 1) / 2 + patch[0] - 0.5,
          y: (side - 1) / 2 - Math.floor(i / side) + 0.5 - patch[1],
          patch,
        });
      }
    });
    this.mesh.count = this.patches.length;
    this.rects.needsUpdate = true;
  }
  faceCamera(camera: OrthographicCamera, tilt: number, pixelsPerTile: number) {
    this.material.opacity = grassOpacity(tilt, pixelsPerTile);
    this.mesh.visible = this.material.opacity > 0;
    if (!this.mesh.visible) return;
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.patches.forEach(({ x, y, patch }, i) => {
      this.position
        .set(x, y, 0.003)
        .addScaledVector(this.right, (0.5 - patch[8]) * patch[2])
        .addScaledVector(this.up, patch[3] / 2);
      this.scale.set(patch[2], patch[3], 1);
      this.mesh.setMatrixAt(i, this.matrix.compose(this.position, camera.quaternion, this.scale));
    });
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
