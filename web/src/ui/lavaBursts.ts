import { DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry, type Texture } from 'three';

/** Instanced solid bubbles and ballistic droplets; the painted floor stays intact. */
export class LavaBursts {
  readonly geometry = new SphereGeometry(1, 16, 10);
  readonly material: MeshBasicMaterial;
  readonly mesh: InstancedMesh;
  private readonly data = new InstancedBufferAttribute(new Float32Array(4096 * 8 * 2), 2);
  private readonly matrix = new Matrix4();
  constructor(texture: Texture, time: { value: number }, inverted: { value: boolean }) {
    this.geometry.setAttribute('burstData', this.data);
    this.material = new MeshBasicMaterial({ map: texture, depthTest: true, depthWrite: true, side: DoubleSide, toneMapped: false });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.lavaTime = time;
      shader.uniforms.mapInverted = inverted;
      shader.vertexShader = `attribute vec2 burstData; uniform float lavaTime; varying vec3 bubbleNormal;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        bubbleNormal=normal;
        float seed=burstData.x;
        float kind=burstData.y;
        float cycle=fract(lavaTime*(0.18+seed*0.07)+seed);
        if(kind<0.5){
          float growth=smoothstep(0.02,0.45,cycle)*(1.0-smoothstep(0.51,0.59,cycle));
          transformed*=vec3(0.18,0.18,0.20)*growth;
        }else{
          float t=clamp((cycle-0.55)/0.4,0.0,1.0);
          float alive=step(0.55,cycle)*(1.0-step(0.95,cycle));
          float radius=0.042*(1.0-t)*alive;
          transformed*=vec3(radius,radius,radius*1.5);
          float angle=kind*2.094+seed*6.283;
          transformed.xy+=vec2(cos(angle),sin(angle))*t*0.18*alive;
          transformed.z+=(0.12+0.62*4.0*t*(1.0-t))*alive;
        }
      `,
      );
      shader.fragmentShader = `varying vec3 bubbleNormal; uniform bool mapInverted;\n${shader.fragmentShader}`
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec3 n=normalize(bubbleNormal);
        float light=0.38+0.62*max(0.0,dot(n,normalize(vec3(-0.4,-0.5,1.0))));
        float strokes=0.5+0.5*sin(atan(n.y,n.x)*9.0+n.z*20.0);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.24,0.008),0.25)*light+vec3(0.26,0.075,0.003)*pow(max(0.0,n.z),3.0)*(0.6+strokes*0.4);
      `,
        )
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\nif(mapInverted)gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
        );
    };
    this.mesh = new InstancedMesh(this.geometry, this.material, 4096 * 8);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0.65;
  }
  reset(): void {
    this.mesh.count = 0;
  }
  add(x: number, y: number, worldX: number, worldY: number): void {
    for (let source = 0; source < 2; source++) {
      const hash = (n: number) => {
        const v = Math.sin(worldX * 127.1 + worldY * 311.7 + source * 71.3 + n * 19.7) * 43758.5453;
        return v - Math.floor(v);
      };
      const seed = hash(0),
        px = x + (hash(1) - 0.5) * 0.45,
        py = y + (hash(2) - 0.5) * 0.45;
      for (let kind = 0; kind < 4; kind++) {
        const i = this.mesh.count++;
        this.data.setXY(i, seed, kind);
        this.mesh.setMatrixAt(i, this.matrix.makeTranslation(px, py, 0.003));
      }
    }
  }
  finish(): void {
    this.data.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
