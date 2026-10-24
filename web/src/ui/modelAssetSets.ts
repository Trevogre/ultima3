import type { BufferGeometry, Material } from 'three';
import { modelGeometry } from './modelAssets.ts';
import { painterlyGeometry } from './painterlyModels.ts';
import { ModelRig, type AnimatedModel } from './modelRigs.ts';
import type { ModelSet } from './modelSets.ts';

/** New sets supply geometry and an animation adapter; the scene does not need
 * to know whether an actor uses joint groups or a loaded skinned GLB/mixer.
 */
export interface ModelAssetSet {
  painted: boolean;
  scenery(shape: number): BufferGeometry;
  actor(shape: number, material: Material): AnimatedModel;
}
export const MODEL_ASSET_SETS: Record<ModelSet, ModelAssetSet> = {
  'Low-poly': { painted: false, scenery: modelGeometry, actor: (shape, material) => new ModelRig(shape, 'Low-poly', material) },
  'Van Gogh': { painted: true, scenery: painterlyGeometry, actor: (shape, material) => new ModelRig(shape, 'Van Gogh', material) },
};
