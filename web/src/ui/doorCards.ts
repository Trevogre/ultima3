import { CanvasTexture, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import { shorelineUsesBackground } from './terrainDepth.ts';

/** Span the opening between adjacent walls; never take orientation from a camera. */
export function doorOrientation(at: (x: number, y: number) => number, x: number, y: number): number {
  const wall = (shape: number) =>
    shape === Shape.Wall || shape === Shape.Wall + 4 || shape === Shape.Door || shorelineUsesBackground(shape);
  const across = Number(wall(at(x - 1, y))) + Number(wall(at(x + 1, y)));
  const along = Number(wall(at(x, y - 1))) + Number(wall(at(x, y + 1)));
  return along > across ? Math.PI / 2 : 0;
}

/** A two-sided, tile-wide door plane, centred on its floor and fixed in world space. */
export class DoorCards {
  private readonly canvas = document.createElement('canvas');
  private readonly artwork = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  constructor(inverted: { value: boolean }) {
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
    this.mesh = new InstancedMesh(this.geometry, this.material, 4096);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.8;
  }
  set(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, enabled: boolean): void {
    this.mesh.visible = enabled;
    this.mesh.count = 0;
    if (!enabled) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    const source = this.artwork.getContext('2d', { willReadFrequently: true })!;
    source.imageSmoothingEnabled = false;
    source.clearRect(0, 0, 64, 64);
    gfx.drawShape(source, Shape.Door, 0, 0, 64, { masked: true });
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
    shapes.forEach((shape, i) => {
      if (shape !== Shape.Door) return;
      const col = i % side,
        row = Math.floor(i / side);
      const x = landscape ? landscapeOffset(col, landscape.partyX, side, landscape.wraps) : col - (side - 1) / 2;
      const y = landscape ? -landscapeOffset(row, landscape.partyY, side, landscape.wraps) : (side - 1) / 2 - row;
      this.matrix.makeRotationZ(doorOrientation(at, col, row)).setPosition(x, y, 0.001);
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.mesh.dispose();
  }
}
