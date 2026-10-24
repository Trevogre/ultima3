import {
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Texture,
} from 'three';
import { Shape } from '../game/tiles.ts';
import type { Landscape } from '../game/landscape.ts';
import type { ViewCell } from '../game/viewport.ts';

/** Same 96-turn cycle as daylight. East is +X; north is +Y. No camera input. */
export function sunShadow(phase: number, timer: number) {
  const turn = (((phase * 12 + 12 - timer) % 96) + 96) % 96;
  const angle = ((turn - 48) * Math.PI) / 48;
  const elevation = Math.cos(angle);
  if (elevation <= 0.00001) return { x: 0, y: 0, opacity: 0 };
  const x = Math.sin(angle) / Math.max(0.12, elevation);
  const y = 0.25 / Math.max(0.12, elevation);
  const limit = Math.min(1, 3 / Math.hypot(x, y));
  const fade = Math.min(1, elevation / 0.22);
  return { x: x * limit, y: y * limit, opacity: 0.24 * fade * fade * (3 - 2 * fade) };
}

/** Each batch samples an existing card atlas; source textures are never owned or modified. */
class ShadowBatch {
  readonly geometry = new PlaneGeometry(1, 1);
  readonly feet = new InstancedBufferAttribute(new Float32Array(16384 * 3), 3);
  readonly rectangles = new InstancedBufferAttribute(new Float32Array(16384 * 4), 4);
  readonly anchors = new InstancedBufferAttribute(new Float32Array(16384 * 2), 2);
  readonly material: ShaderMaterial;
  readonly mesh: InstancedMesh;
  constructor(texture: Texture, uniforms: SunShadows['uniforms']) {
    this.geometry.setAttribute('shadowFoot', this.feet);
    this.geometry.setAttribute('shadowRect', this.rectangles);
    this.geometry.setAttribute('shadowAnchor', this.anchors);
    this.material = new ShaderMaterial({
      uniforms: { ...uniforms, silhouette: { value: texture } },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      vertexShader: `attribute vec3 shadowFoot; attribute vec4 shadowRect; attribute vec2 shadowAnchor;
        uniform vec2 sunOffset; varying vec2 sourceUV; varying vec2 groundPosition;
        void main(){
          sourceUV=shadowRect.xy+uv*shadowRect.zw;
          float height=(uv.y-shadowAnchor.y)*shadowFoot.z;
          vec2 across=normalize(vec2(sunOffset.y,-sunOffset.x)+vec2(0.00001,0.0));
          groundPosition=shadowFoot.xy+across*(uv.x-shadowAnchor.x)*shadowFoot.z+sunOffset*height;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(groundPosition,0.004,1.0);
        }`,
      fragmentShader: `uniform sampler2D silhouette; uniform sampler2D knownGround;
        uniform vec4 groundGrid; uniform float groundWrap; uniform float sunOpacity;
        varying vec2 sourceUV; varying vec2 groundPosition;
        void main(){
          vec2 cell=floor(vec2(groundPosition.x,-groundPosition.y)+0.5)+groundGrid.xy;
          float side=groundGrid.z;
          if(groundWrap<0.5 && (cell.x<0.0||cell.y<0.0||cell.x>=side||cell.y>=side)) discard;
          cell=mod(mod(cell,side)+side,side);
          if(texture2D(knownGround,(cell+0.5)/side).r<0.5) discard;
          float a=textureLod(silhouette,sourceUV,0.0).a*sunOpacity;
          if(a<0.001) discard;
          gl_FragColor=vec4(0.0,0.0,0.0,a);
        }`,
    });
    this.mesh = new InstancedMesh(this.geometry, this.material, 16384);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 0.7;
  }
  add(x: number, y: number, size: number, rect: [number, number, number, number], anchor: [number, number]) {
    if (this.mesh.count >= 16384) return;
    const i = this.mesh.count++;
    this.feet.setXYZ(i, x, y, size);
    this.rectangles.setXYZW(i, ...rect);
    this.anchors.setXY(i, ...anchor);
    this.feet.needsUpdate = this.rectangles.needsUpdate = this.anchors.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

export class SunShadows {
  private ground = new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat);
  readonly uniforms = {
    sunOffset: { value: new Vector2(0, 0.25) },
    sunOpacity: { value: 0 },
    knownGround: { value: this.ground },
    groundGrid: { value: new Vector4(0, 0, 1, 0) },
    groundWrap: { value: 0 },
  };
  readonly actors: ShadowBatch;
  readonly buildings: ShadowBatch;
  readonly trees: ShadowBatch;
  private enabled = false;
  constructor(actors: Texture, buildings: Texture, trees: Texture) {
    this.ground.minFilter = this.ground.magFilter = NearestFilter;
    this.actors = new ShadowBatch(actors, this.uniforms);
    this.buildings = new ShadowBatch(buildings, this.uniforms);
    this.trees = new ShadowBatch(trees, this.uniforms);
  }
  reset() {
    this.actors.mesh.count = this.buildings.mesh.count = this.trees.mesh.count = 0;
  }
  setSun(phase: number, timer: number, enabled: boolean) {
    this.enabled = enabled;
    const sun = sunShadow(phase, timer);
    this.uniforms.sunOffset.value.set(sun.x, sun.y);
    this.uniforms.sunOpacity.value = enabled ? sun.opacity : 0;
    for (const batch of [this.actors, this.buildings, this.trees]) batch.mesh.visible = enabled && sun.opacity > 0;
  }
  setGround(landscape: Landscape | null, cells: ViewCell[]) {
    const shapes = landscape?.shapes ?? cells.map((c) => c.base),
      side = landscape?.side ?? Math.sqrt(cells.length);
    const data = new Uint8Array(side * side * 4);
    shapes.forEach((s, i) => {
      data[i * 4] = s !== Shape.Void && s !== Shape.Water ? 255 : 0;
      data[i * 4 + 3] = 255;
    });
    this.ground.image = { data, width: side, height: side };
    this.ground.needsUpdate = true;
    this.uniforms.groundGrid.value.set(landscape?.partyX ?? (side - 1) / 2, landscape?.partyY ?? (side - 1) / 2, side, 0);
    this.uniforms.groundWrap.value = landscape?.wraps ? 1 : 0;
  }
  get active() {
    return this.enabled && this.uniforms.sunOpacity.value > 0;
  }
  dispose() {
    this.ground.dispose();
    this.actors.dispose();
    this.buildings.dispose();
    this.trees.dispose();
  }
}
