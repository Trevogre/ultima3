import type { EnvironmentLibrary } from '../../src/ui/atelierEnvironment.ts';
import type { Mesh, BufferGeometry, MeshStandardMaterial } from 'three';

/** Authoring-only geography scale. Never imported by the playable renderer. */
export const PREVIEW_FIGURE_SCALE = 0.3;
export function worldPreviewLibrary(source: EnvironmentLibrary): EnvironmentLibrary {
  const library = new Map<string, BufferGeometry>();
  for (const [name, geometry] of source) {
    const kind = name.split('-')[0];
    const factor =
      kind === 'tree'
        ? [0.13 / 0.65, 0.13 / 0.65, 0.13 / 0.65]
        : kind === 'rock'
          ? [0.95 / 1.15, 0.95 / 1.15, 1.8 / 1.15]
          : kind === 'brush'
            ? [0.2, 0.2, 0.2]
            : [0.12, 0.12, 0.12];
    const copy = geometry.clone().scale(factor[0], factor[1], factor[2]);
    copy.computeBoundingBox();
    copy.computeBoundingSphere();
    library.set(name, copy);
  }
  return library;
}
export function previewOcean(water: Mesh<BufferGeometry, MeshStandardMaterial>): void {
  const material = water.material,
    compile = material.onBeforeCompile.bind(material);
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.roughness = 0.3;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      'diffuseColor.rgb=c*diffuse;',
      `
      float swell=sin(p.x*composedFrequencies[0]+p.y*composedFrequencies[1]+sin(p.y*composedFrequencies[6])*.8-composedTime*.3);
      float crest=pow(max(0.0,swell),18.0)*(.45+.55*sin(p.x*composedFrequencies[4]-p.y*composedFrequencies[5]));
      c=mix(vec3(.008,.025,.085),vec3(.018,.095,.16),.5+.5*swell);
      c+=vec3(.04,.08,.10)*crest;
      c=mix(c,vec3(.5,.65,.65),foam*.6);
      diffuseColor.rgb=c*diffuse;`,
    );
  };
  material.customProgramCacheKey = () => 'authoring-ocean-v1';
  material.needsUpdate = true;
}
