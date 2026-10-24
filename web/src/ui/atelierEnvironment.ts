import { BufferGeometry, Mesh, Float32BufferAttribute } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { WorldPlacement } from '../game/worldComposition.ts';

export type EnvironmentLibrary = ReadonlyMap<string, BufferGeometry>;
export const ENVIRONMENT_VARIANTS: Record<WorldPlacement['kind'], number> = { tree: 5, brush: 5, grass: 5, rock: 5, reed: 3 };

/** Only mesh-local geometry is imported; Blender's review-grid translations are staging. */
export function environmentFromGLTF(asset: GLTF): EnvironmentLibrary {
  const library = new Map<string, BufferGeometry>();
  asset.scene.traverse((object) => {
    if (!(object instanceof Mesh) || !/^(tree|brush|grass|rock|reed)-\d+(?:-lod)?$/.test(object.name)) return;
    const geometry = (object.geometry as BufferGeometry).clone().rotateX(Math.PI / 2);
    for (const attribute of ['position', 'normal', 'color'])
      if (!geometry.hasAttribute(attribute)) throw new Error(`${object.name} is missing ${attribute}`);
    geometry.setAttribute(
      'composedWind',
      new Float32BufferAttribute(
        new Float32Array(geometry.getAttribute('position').count).fill(object.name.startsWith('rock-') ? 0 : 1),
        1,
      ),
    );
    geometry.computeBoundingBox();
    geometry.translate(0, 0, -geometry.boundingBox!.min.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    library.set(object.name, geometry);
  });
  for (const [kind, count] of Object.entries(ENVIRONMENT_VARIANTS))
    for (let i = 0; i < count; i++) {
      if (!library.has(`${kind}-${i}`)) throw new Error(`Missing environment asset ${kind}-${i}`);
      if ((kind === 'tree' || kind === 'brush') && !library.has(`${kind}-${i}-lod`)) throw new Error(`Missing distant asset ${kind}-${i}`);
    }
  return library;
}
let pending: Promise<EnvironmentLibrary> | null = null;
export function loadEnvironment(): Promise<EnvironmentLibrary> {
  pending ??= import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/atelier/environment.glb`))
    .then(environmentFromGLTF)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
