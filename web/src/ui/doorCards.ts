import { BoxGeometry, CanvasTexture, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, SRGBColorSpace } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import type { DoorState } from './doorStates.ts';
import { shorelineUsesBackground } from './terrainDepth.ts';

/** Span the opening between adjacent walls; never take orientation from a camera. */
export function doorOrientation(at: (x: number, y: number) => number, x: number, y: number): number {
  const wall = (shape: number) =>
    shape === Shape.Wall || shape === Shape.Wall + 4 || shape === Shape.Door || shorelineUsesBackground(shape);
  const across = Number(wall(at(x - 1, y))) + Number(wall(at(x + 1, y)));
  const along = Number(wall(at(x, y - 1))) + Number(wall(at(x, y + 1)));
  return along > across ? Math.PI / 2 : 0;
}

export const DOOR_THICKNESS = 0.09;
export const DOOR_SWING_SECONDS = 0.5;
/** Keep the hinge fixed while rotating the leaf, rather than its centre. */
export function doorTransform(x: number, y: number, orientation: number, progress: number): Matrix4 {
  const smooth = progress * progress * (3 - 2 * progress);
  const angle = orientation + (smooth * Math.PI) / 2;
  return new Matrix4()
    .makeRotationZ(angle)
    .setPosition(x - Math.cos(orientation) * 0.5 + Math.cos(angle) * 0.5, y - Math.sin(orientation) * 0.5 + Math.sin(angle) * 0.5, 0.001);
}

/** A textured solid leaf, hinged in world space and grounded at tile centre. */
export class DoorCards {
  private readonly canvas = document.createElement('canvas');
  private readonly artwork = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new BoxGeometry(1, DOOR_THICKNESS, 1).translate(0, 0, 0.5);
  private readonly edgeCanvas = document.createElement('canvas');
  private readonly edgeTexture: CanvasTexture;
  readonly edgeMaterial: MeshBasicMaterial;
  private readonly poses = new Map<string, { progress: number; target: number; orientation: number }>();
  private entries: { x: number; y: number; pose: { progress: number; target: number; orientation: number } }[] = [];
  private context: object | undefined;
  private lastTime: number | null = null;
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  constructor(inverted: { value: boolean }) {
    const uv = this.geometry.getAttribute('uv');
    const position = this.geometry.getAttribute('position');
    const normal = this.geometry.getAttribute('normal');
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, position.getX(i) + 0.5, position.getZ(i));
      else if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, position.getY(i) / DOOR_THICKNESS + 0.5, position.getZ(i));
    }
    this.canvas.width = this.canvas.height = 64;
    this.artwork.width = this.artwork.height = 64;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
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
      shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif(mapInverted) gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
      );
    };
    this.edgeCanvas.width = 8;
    this.edgeCanvas.height = 64;
    this.edgeTexture = new CanvasTexture(this.edgeCanvas);
    this.edgeTexture.colorSpace = SRGBColorSpace;
    this.edgeTexture.magFilter = this.edgeTexture.minFilter = NearestFilter;
    this.edgeTexture.generateMipmaps = false;
    this.edgeMaterial = this.material.clone();
    this.edgeMaterial.map = this.edgeTexture;
    this.edgeMaterial.transparent = false;
    this.edgeMaterial.alphaTest = 0;
    this.edgeMaterial.onBeforeCompile = this.material.onBeforeCompile.bind(this.material);
    this.edgeMaterial.color.setScalar(0.8);
    this.mesh = new InstancedMesh(
      this.geometry,
      [this.edgeMaterial, this.edgeMaterial, this.material, this.material, this.edgeMaterial, this.edgeMaterial],
      4096,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.8;
  }
  set(
    landscape: Landscape | null,
    cells: ViewCell[],
    gfx: GraphicsSet,
    enabled: boolean,
    doors: DoorState[] = [],
    origin?: { originX: number; originY: number },
    context?: object,
  ): void {
    if (this.context !== context) {
      this.poses.clear();
      this.context = context;
    }
    this.entries = [];
    this.mesh.visible = enabled;
    this.mesh.count = 0;
    if (!enabled) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    const source = this.artwork.getContext('2d', { willReadFrequently: true })!;
    source.imageSmoothingEnabled = false;
    source.clearRect(0, 0, 64, 64);
    gfx.drawShape(source, Shape.Door, 0, 0, 64, { masked: true, card: true });
    const pixels = source.getImageData(0, 0, 64, 64).data;
    let left = 64,
      right = -1,
      top = 64,
      bottom = -1;
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        if (pixels[(y * 64 + x) * 4 + 3] < 8) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    // Transparent padding belongs to the flat tile; the visible leaf must
    // span the opening rather than leave gaps beside the neighbouring walls.
    if (right >= left) ctx.drawImage(this.artwork, left, top, right - left + 1, bottom - top + 1, 0, 0, 64, 64);
    this.texture.needsUpdate = true;
    const edge = this.edgeCanvas.getContext('2d')!;
    edge.imageSmoothingEnabled = false;
    edge.clearRect(0, 0, 8, 64);
    // A narrow strip of the door painting supplies grain for the top and edges.
    edge.drawImage(this.canvas, 30, 16, 4, 48, 0, 0, 8, 64);
    this.edgeTexture.needsUpdate = true;
    const side = landscape?.side ?? Math.sqrt(cells.length);
    const shapes =
      landscape?.shapes ?? cells.map((c) => (c.base === Shape.Void ? Shape.Void : c.overlay === Shape.Door ? Shape.Door : c.base));
    const at = (x: number, y: number) => {
      if (landscape?.wraps) {
        x = (x + side) % side;
        y = (y + side) % side;
      }
      return x < 0 || y < 0 || x >= side || y >= side ? Shape.Void : shapes[y * side + x];
    };
    const states = new Map<number, DoorState>();
    for (const door of doors) {
      let col = landscape ? door.x : door.x - (origin?.originX ?? 0);
      let row = landscape ? door.y : door.y - (origin?.originY ?? 0);
      if (landscape?.wraps) {
        col = (col + side) % side;
        row = (row + side) % side;
      }
      if (col >= 0 && row >= 0 && col < side && row < side && shapes[row * side + col] !== Shape.Void) states.set(row * side + col, door);
    }
    const orientationAt = (x: number, y: number) => (states.has(y * side + x) ? Shape.Door : at(x, y));
    shapes.forEach((shape, i) => {
      if (shape !== Shape.Door && !states.has(i)) return;
      const col = i % side,
        row = Math.floor(i / side);
      const x = landscape ? landscapeOffset(col, landscape.partyX, side, landscape.wraps) : col - (side - 1) / 2;
      const y = landscape ? -landscapeOffset(row, landscape.partyY, side, landscape.wraps) : (side - 1) / 2 - row;
      const state = states.get(i);
      const key = `${state?.x ?? col},${state?.y ?? row}`;
      const target = state?.open ? 1 : 0;
      let pose = this.poses.get(key);
      if (!pose) {
        pose = { progress: target, target, orientation: doorOrientation(orientationAt, col, row) };
        this.poses.set(key, pose);
      }
      pose.target = target;
      if (!target) {
        pose.progress = 0;
        pose.orientation = doorOrientation(orientationAt, col, row);
      }
      this.entries.push({ x, y, pose });
      this.matrix.copy(doorTransform(x, y, pose.orientation, pose.progress));
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  animate(time: number, active: boolean): boolean {
    const dt = this.lastTime === null ? 0 : Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (!active || !this.mesh.visible) return false;
    let changed = false;
    this.entries.forEach(({ x, y, pose }, i) => {
      if (pose.progress === pose.target) return;
      pose.progress = Math.min(pose.target, pose.progress + dt / DOOR_SWING_SECONDS);
      this.mesh.setMatrixAt(i, doorTransform(x, y, pose.orientation, pose.progress));
      changed = true;
    });
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
    return changed;
  }
  setDaylight(colour: [number, number, number]): void {
    this.material.color.setRGB(...colour);
    this.edgeMaterial.color.setRGB(...colour).multiplyScalar(0.8);
  }
  dispose(): void {
    this.edgeTexture.dispose();
    this.edgeMaterial.dispose();
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
