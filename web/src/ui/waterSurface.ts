import { CanvasTexture, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace } from 'three';
import type { GraphicsSet } from './graphics.ts';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { View3DSettings } from './view3DSettings.ts';
import { terrainElevation } from './terrainDepth.ts';
import { addZoomFiltering } from './zoomFiltering.ts';

/** A separate water pass lets opaque shore blocks remain visible below its surface. */
export class WaterSurface {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new PlaneGeometry(1, 1);
  readonly mesh: InstancedMesh;
  readonly time = { value: 0 };
  readonly highlights = { value: 0 };
  private matrix = new Matrix4();
  private filter: ReturnType<typeof addZoomFiltering>;
  constructor(inverted: { value: boolean }) {
    this.canvas.width = this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.waterTime = this.time;
      shader.uniforms.waterHighlights = this.highlights;
      shader.uniforms.mapInverted = inverted;
      shader.vertexShader = `varying vec2 waterPosition;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nwaterPosition=(instanceMatrix*vec4(position,1.0)).xy;',
      );
      shader.fragmentShader =
        `uniform float waterTime; uniform float waterHighlights; uniform bool mapInverted; varying vec2 waterPosition;\n${shader.fragmentShader}`
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\nfloat ripple=pow(max(0.0,sin(dot(waterPosition,vec2(3.0,5.0))+waterTime*0.7)*sin(dot(waterPosition,vec2(-4.0,2.0))-waterTime*0.4)),8.0);\ndiffuseColor.rgb += vec3(ripple*0.045*waterHighlights);',
          )
          .replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\nif(mapInverted) gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
          );
    };
    this.filter = addZoomFiltering(this.material, this.texture, 1, 1);
    this.mesh = new InstancedMesh(this.geometry, this.material, 4096);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.4;
  }
  set(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, options: View3DSettings) {
    this.ctx.clearRect(0, 0, 64, 64);
    gfx.drawShape(this.ctx, Shape.Water, 0, 0, 64);
    this.texture.needsUpdate = true;
    this.filter(options.zoomFiltering);
    this.material.opacity = options.alphaWater ? 0.62 : 1;
    this.highlights.value = options.waterHighlights ? 1 : 0;
    this.mesh.count = 0;
    const shapes = landscape?.shapes ?? cells.map((c) => c.base),
      side = landscape?.side ?? Math.sqrt(cells.length);
    shapes.forEach((shape, i) => {
      if (shape !== Shape.Water) return;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix.makeTranslation(x, y, terrainElevation(shape, options.recessedWater)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
