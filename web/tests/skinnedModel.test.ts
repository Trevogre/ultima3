import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Bone, SkinnedMesh, Vector3 } from 'three';
import { SkinnedModel } from '../src/ui/skinnedModel.ts';

async function load(): Promise<GLTF> {
  const bytes = readFileSync(new URL('../public/models/atelier/ranger.glb', import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function bones(model: SkinnedModel): Bone[] {
  const out: Bone[] = [];
  model.root.traverse((o) => {
    if (o instanceof Bone) out.push(o as Bone);
  });
  return out;
}

describe('authored skinned character', () => {
  it('loads the actual GLB, corrects its axes/scale and clones independent skeletons', async () => {
    const asset = await load();
    expect(asset.animations.map((a) => a.name).sort()).toEqual(['Attack', 'Cast', 'Hit', 'Idle', 'Walk']);
    const a = new SkinnedModel(asset),
      b = new SkinnedModel(asset);
    expect(bones(a)).toHaveLength(18);
    expect(bones(a)[0]).not.toBe(bones(b)[0]);
    a.pose(0, 'idle', 0, 0);
    a.root.updateMatrixWorld(true);
    const size = new Box3().setFromObject(a.root).getSize(new Vector3());
    expect(size.z).toBeGreaterThan(0.85);
    expect(size.z).toBeLessThan(0.95);
    const sourceMeshes: SkinnedMesh[] = [];
    asset.scene.traverse((o) => {
      if (o instanceof SkinnedMesh) sourceMeshes.push(o as SkinnedMesh);
    });
    expect(sourceMeshes).toHaveLength(1);
    expect(sourceMeshes[0].geometry.getAttribute('skinWeight').count).toBeGreaterThan(3000);
    a.dispose();
    b.dispose();
  });
  it('deforms joints through every clip and keeps actors independent', async () => {
    const asset = await load(),
      a = new SkinnedModel(asset),
      b = new SkinnedModel(asset);
    b.pose(0, 'idle', 0, 0);
    const original = bones(b).map((bone) => bone.quaternion.toArray());
    for (const state of ['walk', 'attack', 'cast', 'hit'] as const) {
      a.pose(1, state, 0.4, 0);
      a.pose(1.15, state, 0.6, 0);
      expect(bones(a).some((bone, i) => bone.quaternion.toArray().some((n, j) => Math.abs(n - original[i][j]) > 0.005))).toBe(true);
    }
    expect(bones(b).map((bone) => bone.quaternion.toArray())).toEqual(original);
    a.dispose();
    b.dispose();
  });
});
