import { CanvasTexture, FrontSide, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace } from 'three';
import { Shape } from '../game/tiles.ts';
import type { GraphicsSet } from './graphics.ts';
import type { DungeonFace } from './dungeonEntrances.ts';

/** Tile artwork becomes a fixed cliff-face decal, never a camera-facing card. */
export class DungeonEntranceFaces {
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private readonly geometry = new PlaneGeometry(0.998, 0.998);
  readonly material: MeshBasicMaterial;
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  constructor(inverted: { value: boolean }) {
    this.canvas.width = this.canvas.height = 128;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.material = new MeshBasicMaterial({ map: this.texture, side: FrontSide, depthTest: true, depthWrite: true });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.mapInverted = inverted;
      shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif(mapInverted) gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
      );
    };
    this.mesh = new InstancedMesh(this.geometry, this.material, 32);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 0.3;
  }
  set(faces: DungeonFace[], gfx: GraphicsSet) {
    this.mesh.count = 0;
    this.mesh.visible = faces.length > 0;
    if (!faces.length) return;
    gfx.drawShape(this.canvas.getContext('2d')!, Shape.Dungeon, 0, 0, 128);
    this.texture.needsUpdate = true;
    for (const face of faces.slice(0, 32)) {
      // Map Y points south; scene Y points north. Outward normal faces the entry square.
      this.matrix.makeRotationX(Math.PI / 2);
      this.matrix.premultiply(new Matrix4().makeRotationZ(Math.atan2(-face.dx, -face.dy)));
      this.matrix.setPosition(face.x + face.dx * 0.498, face.y - face.dy * 0.498, 0.5);
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
