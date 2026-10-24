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
import { buildingArt, buildingAnchor } from './billboardArt.ts';
import { addZoomFiltering } from './zoomFiltering.ts';
import type { ZoomFiltering } from './view3DSettings.ts';
import { cardGroundLift } from './cardGroundLift.ts';

/** Native 64px trunk bases, measured in the Standard forest tile. */
export const STANDARD_TREE_ANCHORS = [
  [20, 35],
  [48, 55],
  [18, 63],
] as const;
export const STANDARD_BRUSH_ANCHORS = [
  [16, 19],
  [46, 33],
  [16, 50],
  [46, 63],
] as const;
const MAX_CARDS = 4096 * 4;
const SHAPES = [Shape.Town, Shape.Castle, Shape.Dungeon, Shape.Shrine] as number[];

/** Static building/tree cards use filtered scenery, never the raw secret map. */
export class BuildingBillboards {
  readonly mesh: InstancedMesh;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material: MeshBasicMaterial;
  private readonly slots = new InstancedBufferAttribute(new Float32Array(MAX_CARDS), 1);
  private readonly positions: { x: number; y: number; anchor?: readonly [number, number]; footprint?: number }[] = [];
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly right = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly shapes: number[];
  private readonly filter: ReturnType<typeof addZoomFiltering>;

  constructor(
    inverted: { value: boolean },
    private readonly kind: 'buildings' | 'trees' = 'buildings',
  ) {
    this.shapes = kind === 'trees' ? [Shape.Forest, Shape.Brush] : SHAPES;
    this.canvas.width = 512;
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
      depthWrite: kind === 'buildings',
      side: DoubleSide,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.mapInverted = inverted;
      shader.vertexShader = `attribute float buildingTile;\n${shader.vertexShader}`.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvMapUv.x = (buildingTile + vMapUv.x) / 8.0;',
      );
      shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (mapInverted) gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;',
      );
    };
    this.filter = addZoomFiltering(this.material, this.texture, 8, 1, true);
    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_CARDS);
    this.mesh.frustumCulled = false;
    // Buildings establish scenery depth before vegetation draws. Nearer tree
    // pixels cover buildings; farther tree pixels fail the depth test. Trees
    // do not write depth, so the later actor pass keeps players visible.
    // Opaque terrain cubes still occlude all cards normally.
    this.mesh.renderOrder = kind === 'trees' ? 0.9 : 0.8;
    this.mesh.count = 0;
  }

  set(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, enabled: boolean): void {
    enabled = enabled && (this.kind === 'buildings' || !!gfx.forestCard || !!gfx.brushCards);
    this.positions.length = 0;
    this.mesh.visible = enabled;
    this.mesh.count = 0;
    if (!enabled) return;
    this.ctx.clearRect(0, 0, 512, 64);
    const vegetation = this.kind === 'trees' ? gfx.vegetation : null;
    const separateTrees = this.kind === 'trees' && !!gfx.treeCards;
    if (vegetation) this.ctx.drawImage(vegetation.image, 0, 0, 512, 64);
    else if (separateTrees) this.ctx.drawImage(gfx.treeCards, 0, 0, 192, 64);
    else if (this.kind === 'trees' && gfx.forestCard) this.ctx.drawImage(gfx.forestCard, 0, 0, 64, 64);
    else if (this.kind === 'buildings') SHAPES.forEach((shape, i) => this.ctx.drawImage(buildingArt(gfx, shape), i * 64, 0));
    if (!vegetation && this.kind === 'trees' && gfx.brushCards)
      this.ctx.drawImage(gfx.brushCards, 256, 0, gfx.brushCards.width > 64 ? 256 : 64, 64);
    this.texture.needsUpdate = true;
    const add = (shape: number, x: number, y: number) => {
      if (!this.shapes.includes(shape)) return;
      if (this.kind === 'trees' && ((shape === Shape.Forest && !gfx.forestCard) || (shape === Shape.Brush && !gfx.brushCards))) return;
      const separateBrush = this.kind === 'trees' && shape === Shape.Brush && gfx.brushCards!.width > 64;
      if (vegetation) {
        const brush = shape === Shape.Brush;
        const anchors = brush ? vegetation.layout.brush : vegetation.layout.trees;
        anchors.forEach((anchor, slot) => {
          this.slots.setX(this.positions.length, (brush ? 4 : 0) + slot);
          this.positions.push({
            x: x + anchor[0] / 64 - 0.5,
            y: y + 0.5 - anchor[1] / 64,
            anchor,
            footprint: anchors.length === 1 ? 1 : 0.45,
          });
        });
      } else if ((separateTrees && shape === Shape.Forest) || separateBrush) {
        const anchors = separateBrush ? STANDARD_BRUSH_ANCHORS : STANDARD_TREE_ANCHORS;
        anchors.forEach((anchor, slot) => {
          this.slots.setX(this.positions.length, (separateBrush ? 4 : 0) + slot);
          this.positions.push({ x: x + anchor[0] / 64 - 0.5, y: y + 0.5 - anchor[1] / 64, anchor });
        });
      } else {
        this.slots.setX(this.positions.length, this.kind === 'trees' && shape === Shape.Brush ? 4 : this.shapes.indexOf(shape));
        if (this.kind === 'buildings') {
          const anchor = buildingAnchor(gfx, shape);
          // The visible foundation is the card pivot, but its world position
          // stays at the tile centre as the billboard follows the camera.
          this.positions.push({ x, y, anchor, footprint: 1 });
        } else this.positions.push({ x, y });
      }
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
          this.shapes.includes(cell.base) ? cell.base : (cell.overlay ?? Shape.Void),
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
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.positions.forEach(({ x, y, anchor }, i) => {
      if (anchor) {
        // The source pixel at the trunk base remains on its own ground point,
        // independent of yaw and tilt; transparent padding does not set the foot.
        this.position
          .set(x, y, 0.002)
          .addScaledVector(this.right, 0.5 - anchor[0] / 64)
          .addScaledVector(camera.up, anchor[1] / 64 - 0.5);
      } else this.position.set(x, y, cardGroundLift(1, tilt)).addScaledVector(camera.up, lift);
      this.mesh.setMatrixAt(i, this.matrix.compose(this.position, camera.quaternion, this.scale));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get shadowTexture() {
    return this.texture;
  }

  forEachShadow(visit: (x: number, y: number, slot: number, anchor: [number, number]) => void): void {
    if (this.mesh.visible)
      this.positions.forEach(({ x, y, anchor }, i) =>
        visit(x, y, this.slots.getX(i), anchor ? [anchor[0] / 64, 1 - anchor[1] / 64] : [0.5, 0]),
      );
  }

  setFiltering(mode: ZoomFiltering): void {
    this.filter(mode);
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

  forEachFootprint(visit: (x: number, y: number, size: number) => void): void {
    if (this.mesh.visible) this.positions.forEach(({ x, y, anchor, footprint }) => visit(x, y, footprint ?? (anchor ? 0.45 : 1)));
  }
}
