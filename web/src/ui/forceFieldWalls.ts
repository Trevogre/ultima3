import { BoxGeometry, CanvasTexture, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, SRGBColorSpace } from 'three';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import { doorOrientation } from './doorCards.ts';

export const FORCE_FIELD_THICKNESS = 0.08;
/** Animated energy barriers span wall openings and join adjacent field tiles.
 * Their orientation belongs to the map; camera rotation never turns them. */
export class ForceFieldWalls {
  private readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new BoxGeometry(1, FORCE_FIELD_THICKNESS, 1).translate(0, 0, 0.5);
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  constructor(inverted: { value: boolean }) {
    this.canvas.width = this.canvas.height = 64;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    const uv = this.geometry.getAttribute('uv'),
      position = this.geometry.getAttribute('position'),
      normal = this.geometry.getAttribute('normal');
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normal.getY(i)) > 0.5) uv.setXY(i, position.getX(i) + 0.5, position.getZ(i));
      else if (Math.abs(normal.getX(i)) > 0.5) uv.setXY(i, position.getY(i) / FORCE_FIELD_THICKNESS + 0.5, position.getZ(i));
    }
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
    this.mesh.renderOrder = 0.75;
  }
  set(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, enabled: boolean): void {
    this.mesh.visible = enabled;
    this.mesh.count = 0;
    if (!enabled) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    gfx.drawShape(ctx, Shape.ForceField, 0, 0, 64);
    this.texture.needsUpdate = true;
    const shapes =
      landscape?.shapes ??
      cells.map((c) => (c.base === Shape.Void ? Shape.Void : c.overlay === Shape.ForceField ? Shape.ForceField : c.base));
    const side = landscape?.side ?? Math.sqrt(cells.length);
    const at = (x: number, y: number) => {
      if (landscape?.wraps) {
        x = (x + side) % side;
        y = (y + side) % side;
      }
      if (x < 0 || y < 0 || x >= side || y >= side) return Shape.Void;
      const shape = shapes[y * side + x];
      return shape === Shape.ForceField ? Shape.Door : shape;
    };
    shapes.forEach((shape, i) => {
      if (shape !== Shape.ForceField) return;
      const col = i % side,
        row = Math.floor(i / side);
      const x = landscape ? landscapeOffset(col, landscape.partyX, side, landscape.wraps) : col - (side - 1) / 2;
      const y = landscape ? -landscapeOffset(row, landscape.partyY, side, landscape.wraps) : (side - 1) / 2 - row;
      this.matrix.makeRotationZ(doorOrientation(at, col, row)).setPosition(x, y, 0.002);
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
