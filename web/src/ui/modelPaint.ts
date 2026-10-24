import {
  BufferAttribute,
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { loadImage } from './graphics.ts';

/** A small material palette sampled from the generated art, not whole sprite cards. */
export class ModelPaint {
  readonly texture: CanvasTexture;
  readonly enabled = { value: 0 };
  readonly time = { value: 0 };
  private disposed = false;
  private loaded = false;
  private requested = false;
  private started = false;
  private readonly canvas: HTMLCanvasElement;
  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = 576;
    canvas.height = 64;
    this.canvas = canvas;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearMipmapLinearFilter;
  }
  enable(value: boolean): void {
    this.requested = value;
    this.enabled.value = value && this.loaded ? 1 : 0;
    if (!value || this.started) return;
    this.started = true;
    void loadImage(`${import.meta.env.BASE_URL}graphics/Van Gogh-Tiles.png`)
      .then((image) => {
        if (this.disposed) return;
        const ctx = this.canvas.getContext('2d')!;
        const samples = [
          [0, 128, 128, 128],
          [0, 0, 128, 128],
          [18, 7 * 128 + 50, 26, 26],
          [8 * 128 + 45, 6 * 128 + 48, 25, 24],
          [88, 6 * 128 + 38, 18, 20],
          [5 * 128 + 24, 14 * 128 + 32, 30, 45],
          [8 * 128 + 10, 14 * 128 + 50, 20, 24],
          [8 * 128 + 52, 14 * 128 + 14, 16, 19],
          [12, 3 * 128 + 10, 45, 28],
        ];
        samples.forEach(([x, y, w, h], slot) => ctx.drawImage(image, x, y, w, h, slot * 64, 0, 64, 64));
        this.texture.needsUpdate = true;
        this.loaded = true;
        this.enabled.value = this.requested ? 1 : 0;
      })
      .catch(() => {
        /* Vertex colours remain a complete offline fallback. */
      });
  }
  material(ground = false): MeshLambertMaterial {
    const material = new MeshLambertMaterial({ vertexColors: !ground, flatShading: false });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.modelPaint = { value: this.texture };
      shader.uniforms.modelPaintEnabled = this.enabled;
      shader.uniforms.modelTime = this.time;
      shader.vertexShader =
        `attribute float paintSlot; varying vec2 modelPaintUV; varying float modelPaintSlot; varying vec3 modelPoint;\n${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nmodelPaintUV=uv;modelPaintSlot=paintSlot;modelPoint=position;',
        );
      shader.fragmentShader =
        `uniform sampler2D modelPaint;uniform float modelPaintEnabled;uniform float modelTime; varying vec2 modelPaintUV;varying float modelPaintSlot;varying vec3 modelPoint;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if(modelPaintEnabled>0.5){
            vec2 paintUV=modelPaintUV;
            ${ground ? 'if(modelPaintSlot>0.5 && modelPaintSlot<1.5) paintUV=fract(paintUV+vec2(sin(modelTime*0.35)*0.035,modelTime*0.012));' : ''}
            vec3 paint=texture2D(modelPaint,vec2((modelPaintSlot+clamp(paintUV.x,0.01,0.99))/9.0,clamp(paintUV.y,0.01,0.99))).rgb;
            ${ground ? 'diffuseColor.rgb=paint*diffuse;' : 'float grain=dot(paint,vec3(0.2126,0.7152,0.0722));diffuseColor.rgb*=0.72+grain*0.8;if(modelPaintSlot>7.5) diffuseColor.rgb=mix(diffuseColor.rgb,paint*diffuse,0.72);'}
          }
          ${ground ? 'if(modelPaintSlot>0.5 && modelPaintSlot<1.5) diffuseColor.rgb*=0.96+0.04*sin(modelTime*2.0+modelPoint.x*18.0+modelPoint.y*11.0);' : ''}`,
        );
    };
    return material;
  }
  dispose(): void {
    this.disposed = true;
    this.texture.dispose();
  }
}

/** Give each mesh part its own paint swatch while preserving actual UV topology. */
export function colourPart(geometry: BufferGeometry, colour: number, slot: number): BufferGeometry {
  const count = geometry.getAttribute('position').count,
    c = new Color(colour),
    rgb = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) rgb.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new BufferAttribute(rgb, 3));
  geometry.setAttribute('paintSlot', new BufferAttribute(new Float32Array(count).fill(slot), 1));
  return geometry;
}
