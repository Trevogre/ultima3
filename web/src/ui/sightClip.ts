import { CanvasTexture, LinearFilter, Material, Mesh, MeshDepthMaterial, Object3D, RGBADepthPacking, Vector4 } from 'three';
import type { SightRegion } from '../game/sightPolygon.ts';

/** Append inside main, including custom shaders with helper functions after main. */
function inMain(source: string, code: string): string {
  const start = source.indexOf('{', source.search(/void\s+main\s*\(/));
  let depth = 1,
    end = start + 1;
  for (; end < source.length && depth; end++) {
    if (source[end] === '{') depth++;
    else if (source[end] === '}') depth--;
  }
  return source.slice(0, end - 1) + code + '\n' + source.slice(end - 1);
}

export function clipSightShader(vertex: string, fragment: string, depth = false): [string, string] {
  // Standard shaders use the final deformed/skinned vertex. Sun silhouettes
  // project their geometry themselves, so use the resulting ground position.
  const point = vertex.includes('#include <project_vertex>')
    ? 'vec4(transformed,1.0)'
    : vertex.includes('varying vec2 groundPosition')
      ? 'vec4(groundPosition,0.004,1.0)'
      : 'vec4(position,1.0)';
  const instanced = vertex.includes('varying vec2 groundPosition')
    ? ''
    : '\n#ifdef USE_INSTANCING\nsightPoint=instanceMatrix*sightPoint;\n#endif\n';
  vertex =
    'varying vec2 sightPosition;\n' + inMain(vertex, `\nvec4 sightPoint=${point};${instanced}\nsightPosition=(modelMatrix*sightPoint).xy;`);
  fragment =
    'uniform sampler2D sightMask; uniform vec4 sightGrid; varying vec2 sightPosition;\n' +
    inMain(
      fragment,
      `
    if(sightGrid.w>0.5){
      vec2 sightUV=(sightPosition-sightGrid.xy)/sightGrid.z;
      if(any(lessThan(sightUV,vec2(0.0)))||any(greaterThan(sightUV,vec2(1.0)))) discard;
      float sightCoverage=texture2D(sightMask,sightUV).r;
      if(sightCoverage<0.01) discard;
      ${depth ? '' : 'gl_FragColor.rgb*=sightCoverage;'}
    }`,
    );
  return [vertex, fragment];
}

/** One world-space boundary for every render layer, independent of orbit/zoom. */
export class SightClip {
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  readonly grid = { value: new Vector4(0, 0, 1, 0) };
  private readonly patched = new WeakSet<Material>();
  private readonly depths = new Set<MeshDepthMaterial>();
  private key = '';
  constructor() {
    this.canvas.width = this.canvas.height = 2048;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
  }
  set(region?: SightRegion): void {
    this.grid.value.w = region ? 1 : 0;
    if (!region) return;
    const { side, eye, polygon, surfaces } = region;
    this.grid.value.set(-eye.x - 0.5, eye.y - side + 0.5, side, 1);
    const key = JSON.stringify([side, polygon, surfaces]);
    if (this.key === key) return;
    this.key = key;
    const ctx = this.canvas.getContext('2d')!,
      scale = this.canvas.width / side;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    polygon.forEach((p, i) => {
      if (i) ctx.lineTo((p.x + 0.5) * scale, (p.y + 0.5) * scale);
      else ctx.moveTo((p.x + 0.5) * scale, (p.y + 0.5) * scale);
    });
    ctx.closePath();
    ctx.fill();
    // Exposed solid surfaces stay intact; nothing behind these cells is admitted.
    for (const i of surfaces) ctx.fillRect((i % side) * scale, Math.floor(i / side) * scale, scale, scale);
    this.texture.needsUpdate = true;
  }
  private patch(material: Material, depth = false): void {
    if (this.patched.has(material)) return;
    this.patched.add(material);
    const compile = material.onBeforeCompile.bind(material),
      cache = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      shader.uniforms.sightMask = { value: this.texture };
      shader.uniforms.sightGrid = this.grid;
      [shader.vertexShader, shader.fragmentShader] = clipSightShader(shader.vertexShader, shader.fragmentShader, depth);
    };
    material.customProgramCacheKey = () => cache + ':continuous-sight-v1';
    material.needsUpdate = true;
  }
  /** New actor, door, light and effect materials participate before their first draw. */
  apply(root: Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const surface: unknown = object.material;
      const materials: unknown[] = Array.isArray(surface) ? surface : [surface];
      for (const material of materials) if (material instanceof Material) this.patch(material as Material);
      if (object.castShadow && !object.customDepthMaterial) {
        const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
        object.customDepthMaterial = depth;
        this.depths.add(depth);
      }
      if (object.customDepthMaterial) this.patch(object.customDepthMaterial, true);
    });
  }
  dispose(): void {
    this.texture.dispose();
    for (const depth of this.depths) depth.dispose();
  }
}
