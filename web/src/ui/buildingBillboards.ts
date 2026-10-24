import {
  CanvasTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { type Landscape, landscapeOffset } from '../game/landscape.ts';
import type { ViewCell } from '../game/viewport.ts';
import { Shape } from '../game/tiles.ts';
import type { GraphicsSet } from './graphics.ts';
import { buildingArt, isBuilding } from './billboardArt.ts';
import { cardGroundLift } from './cardGroundLift.ts';

const SHAPES = [Shape.Town, Shape.Castle, Shape.Dungeon, Shape.Shrine] as number[];

/** Static landmarks use the same discovered scenery data as the ground, never the raw secret map. */
export class BuildingBillboards {
  readonly mesh: InstancedMesh;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material: MeshBasicMaterial;
  private readonly slots = new InstancedBufferAttribute(new Float32Array(4096), 1);
  private readonly positions: { x: number; y: number }[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);

  constructor(inverted: { value: boolean }) {
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.geometry.setAttribute('buildingTile', this.slots);
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: true,
      side: DoubleSide,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.mapInverted = inverted;
      shader.vertexShader = `attribute float buildingTile;\n${shader.vertexShader}`.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvMapUv.x = (buildingTile + vMapUv.x) / 4.0;',
      );
      shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (mapInverted) gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;',
      );
    };
    this.mesh = new InstancedMesh(this.geometry, this.material, 4096);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
  }

  set(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, enabled: boolean): void {
    this.positions.length = 0;
    this.mesh.visible = enabled;
    this.mesh.count = 0;
    if (!enabled) return;
    this.ctx.clearRect(0, 0, 256, 64);
    SHAPES.forEach((shape, i) => this.ctx.drawImage(buildingArt(gfx, shape), i * 64, 0));
    this.texture.needsUpdate = true;
    const add = (shape: number, x: number, y: number) => {
      if (!isBuilding(shape)) return;
      this.slots.setX(this.positions.length, SHAPES.indexOf(shape));
      this.positions.push({ x, y });
    };
    if (landscape) {
      const { side, partyX, partyY, wraps } = landscape;
      landscape.shapes.forEach((shape, i) =>
        add(shape, landscapeOffset(i % side, partyX, side, wraps), -landscapeOffset(Math.floor(i / side), partyY, side, wraps)),
      );
    } else {
      const side = Math.sqrt(cells.length);
      cells.forEach((cell, i) =>
        add(
          isBuilding(cell.base) ? cell.base : (cell.overlay ?? Shape.Void),
          (i % side) - (side - 1) / 2,
          (side - 1) / 2 - Math.floor(i / side),
        ),
      );
    }
    this.mesh.count = this.positions.length;
    this.slots.needsUpdate = true;
  }

  faceCamera(camera: OrthographicCamera, tilt: number): void {
    const lift = Math.sin(tilt) / 2;
    this.positions.forEach(({ x, y }, i) => {
      this.position.set(x, y, cardGroundLift(1, tilt)).addScaledVector(camera.up, lift);
      this.mesh.setMatrixAt(i, this.matrix.compose(this.position, camera.quaternion, this.scale));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.mesh.dispose();
  }

  setDaylight(colour: [number, number, number]): void {
    this.material.color.setRGB(...colour);
  }
}
