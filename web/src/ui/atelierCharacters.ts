import { SkinnedMesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Shape, classTile } from '../game/tiles.ts';

/** Only the authored ranger is substituted; other careers retain their own identity. */
export function hasAtelierCharacter(shape: number): boolean {
  return shape === Shape.Ranger || shape === classTile(10) * 2;
}

let pending: Promise<GLTF> | null = null;
export function loadAtelierRanger(): Promise<GLTF> {
  pending ??= import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/atelier/ranger.glb`))
    .then((asset) => {
      if (!['Idle', 'Walk', 'Attack', 'Cast', 'Hit'].every((name) => asset.animations.some((clip) => clip.name === name)))
        throw new Error('The ranger export is missing animation clips');
      let skinned = false;
      asset.scene.traverse((object) => {
        if (object instanceof SkinnedMesh) skinned = true;
      });
      if (!skinned) throw new Error('The ranger export is missing its skeleton');
      return asset;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
