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
} from 'three';
import type { GraphicsSet } from './graphics.ts';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { View3DSettings } from './view3DSettings.ts';

import { LavaBursts } from './lavaBursts.ts';
import { addZoomFiltering } from './zoomFiltering.ts';

export function isPaintedLava(gfx: Pick<GraphicsSet, 'tiles'>): boolean {
  return (gfx.tiles?.src ?? '').replaceAll('%20', ' ').includes('/Van Gogh-Tiles.png');
}

/** Painted lava plus procedural impasto bubbles; no source-art replacement. */
export class LavaSurface {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  readonly texture: CanvasTexture;
  readonly material: MeshBasicMaterial;
  readonly geometry = new PlaneGeometry(1, 1);
  readonly mesh: InstancedMesh;
  private readonly seeds = new InstancedBufferAttribute(new Float32Array(4096 * 2), 2);
  readonly time = { value: 0 };
  readonly bursts: LavaBursts;
  get activeCount(): number {
    return this.mesh.count + this.bursts.mesh.count;
  }

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
    this.geometry.setAttribute('lavaCell', this.seeds);
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: DoubleSide,
      toneMapped: false,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.lavaTime = this.time;
      shader.uniforms.mapInverted = inverted;
      shader.vertexShader =
        `attribute vec2 lavaCell; varying vec2 lavaWorldCell; varying vec2 lavaPosition;\n${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nlavaWorldCell=lavaCell; lavaPosition=(instanceMatrix*vec4(position,1.0)).xy;',
        );
      shader.fragmentShader =
        `uniform float lavaTime; uniform bool mapInverted; varying vec2 lavaWorldCell; varying vec2 lavaPosition;\n${shader.fragmentShader}`
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
              vec2 tile=lavaWorldCell;
              vec2 local=fract(lavaPosition+0.5);
              float seed=fract(sin(dot(tile,vec2(127.1,311.7)))*43758.5453);
              for(int i=0;i<3;i++) {
                float fi=float(i);
                float hash=fract(sin(seed*91.3+fi*31.7)*43758.5453);
                float cycle=fract(lavaTime*(0.19+hash*0.08)+hash+fi*0.31);
                vec2 centre=vec2(0.2)+vec2(fract(hash*7.13),fract(hash*19.71))*0.6;
                float radius=mix(0.025,0.15,smoothstep(0.0,0.82,cycle));
                vec2 p=(local-centre)/radius;
                float r=length(p);
                float theta=atan(p.y,p.x);
                float brush=0.85+0.15*sin(theta*11.0+r*21.0-lavaTime*1.3);
                float fade=smoothstep(0.0,0.15,cycle)*(1.0-smoothstep(0.78,1.0,cycle));
                float dome=(1.0-smoothstep(0.7,1.0,r))*fade;
                float ring=(1.0-smoothstep(0.045,0.17,abs(r-0.86+0.035*sin(theta*7.0))))*fade;
                float swirl=(1.0-smoothstep(0.08,0.22,abs(sin(theta*1.6+r*8.0-cycle*5.0))))*dome;
                float crescent=pow(max(0.0,1.0-length(p-vec2(-0.28,0.28))),2.0)*dome;
                diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*0.55+vec3(0.3,0.035,0.002),dome*0.6);
                diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.36,0.035),swirl*0.4*brush);
                diffuseColor.rgb+=vec3(0.5,0.24,0.025)*(ring*0.65+cos(theta-2.2)*ring*0.2+crescent*0.8)*brush;
              }`,
          )
          .replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\nif(mapInverted) gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
          );
    };
    this.bursts = new LavaBursts(this.texture, this.time, inverted);
    this.filter = addZoomFiltering(this.material, this.texture, 1, 1);
    this.mesh = new InstancedMesh(this.geometry, this.material, 4096);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.4;
  }
  set(
    landscape: Landscape | null,
    cells: ViewCell[],
    gfx: GraphicsSet,
    options: View3DSettings,
    origin?: { originX: number; originY: number },
  ) {
    this.ctx.clearRect(0, 0, 64, 64);
    gfx.drawShape(this.ctx, Shape.Lava, 0, 0, 64);
    this.texture.needsUpdate = true;
    this.filter(options.zoomFiltering);
    this.mesh.count = 0;
    this.bursts.reset();
    if (!options.enabled || options.renderStyle !== 'Cards' || !options.lavaBubbles || !isPaintedLava(gfx)) return;
    const shapes = landscape?.shapes ?? cells.map((c) => c.base),
      side = landscape?.side ?? Math.sqrt(cells.length);
    shapes.forEach((shape, i) => {
      if (shape !== Shape.Lava) return;
      const x = landscape ? landscapeOffset(i % side, landscape.partyX, side, landscape.wraps) : (i % side) - (side - 1) / 2;
      const y = landscape
        ? -landscapeOffset(Math.floor(i / side), landscape.partyY, side, landscape.wraps)
        : (side - 1) / 2 - Math.floor(i / side);
      if (options.lavaStyle === 'Rising') {
        this.bursts.add(
          x,
          y,
          (i % side) + (landscape ? 0 : (origin?.originX ?? 0)),
          Math.floor(i / side) + (landscape ? 0 : (origin?.originY ?? 0)),
        );
        return;
      }
      this.seeds.setXY(
        this.mesh.count,
        (i % side) + (landscape ? 0 : (origin?.originX ?? 0)),
        Math.floor(i / side) + (landscape ? 0 : (origin?.originY ?? 0)),
      );
      this.mesh.setMatrixAt(this.mesh.count++, this.matrix.makeTranslation(x, y, 0.002));
    });
    this.bursts.finish();
    this.seeds.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.bursts.dispose();
    this.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
