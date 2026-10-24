import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Bone, SkinnedMesh, Vector3, MeshStandardMaterial } from 'three';
import { SkinnedModel } from '../src/ui/skinnedModel.ts';
import { ModelScene } from '../src/ui/modelScene.ts';
import { hasAtelierCharacter } from '../src/ui/atelierCharacters.ts';
import { Shape, classTile } from '../src/game/tiles.ts';
import type { ModelActor } from '../src/ui/modelActors.ts';

afterEach(() => vi.unstubAllGlobals());

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
  it('combines daylight and poison without changing shared source materials', async () => {
    const asset = await load(),
      a = new SkinnedModel(asset),
      b = new SkinnedModel(asset);
    const material = (rig: SkinnedModel) => {
      let found: MeshStandardMaterial | undefined;
      rig.root.traverse((o) => {
        if (o instanceof SkinnedMesh) found = o.material as MeshStandardMaterial;
      });
      return found!;
    };
    const original = material(a).color.clone();
    a.setDaylight([0.2, 0.3, 0.5]);
    a.setPoisoned(true);
    expect(material(a).color.g).toBeLessThan(original.g * 0.3);
    a.setPoisoned(false);
    expect(material(a).color.toArray()).toEqual([original.r * 0.2, original.g * 0.3, original.b * 0.5]);
    expect(material(b).color).toEqual(original);
    a.dispose();
    b.dispose();
  });
  it('replaces only the authored career in the live scene and preserves motion during async loading', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}) }) });
    const asset = await load();
    let ready!: (asset: GLTF) => void;
    const loader = vi.fn(
      () =>
        new Promise<GLTF>((resolve) => {
          ready = resolve;
        }),
    );
    const invalidate = vi.fn(),
      scene = new ModelScene(invalidate, undefined, loader);
    const ranger: ModelActor = {
      id: 'member:0',
      shape: classTile(10) * 2,
      x: 0,
      y: 0,
      worldX: 10,
      worldY: 10,
      size: 1,
      ground: Shape.Grass,
    };
    const wizard = { ...ranger, id: 'member:1', shape: 140, x: 1 };
    scene.setSet('Van Gogh');
    scene.setActors([ranger, wizard], 'town', 64, false);
    expect(loader).not.toHaveBeenCalled(); // Rejected prototype art never replaces the in-game model automatically.
    scene.setSet('Composed');
    scene.group.visible = true;
    scene.setActors([ranger, wizard], 'town', 64, false);
    scene.setActors([{ ...ranger, x: 1, worldX: 11 }, wizard], 'town', 64, false);
    scene.animate(0, true);
    scene.animate(100, true);
    const before = scene.group.getObjectByName(ranger.id)!.position.clone();
    ready(asset);
    await Promise.resolve();
    await Promise.resolve();
    const root = scene.group.getObjectByName(ranger.id)!;
    let skinned = 0;
    root.traverse((o) => {
      if (o instanceof SkinnedMesh) skinned++;
    });
    expect(skinned).toBe(1);
    expect(root.position).toEqual(before);
    let wizardSkinned = 0;
    scene.group.getObjectByName(wizard.id)!.traverse((o) => {
      if (o instanceof SkinnedMesh) wizardSkinned++;
    });
    expect(wizardSkinned).toBe(0);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);
    scene.trigger(ranger.id, 'cast');
    scene.animate(200, true);
    expect(scene.characterStatus).toContain('five animation');
    scene.setActors([], 'town', 64, false);
    expect(scene.actorCount).toBe(0);
    expect(scene.group.getObjectByName(ranger.id)).toBeUndefined();
    scene.dispose();
  });
  it('does not resurrect hidden actors or switch other careers when a load completes late', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}) }) });
    const asset = await load();
    let ready!: (asset: GLTF) => void;
    const invalidate = vi.fn(),
      scene = new ModelScene(
        invalidate,
        undefined,
        () =>
          new Promise<GLTF>((resolve) => {
            ready = resolve;
          }),
      );
    const ranger: ModelActor = { id: 'party', shape: Shape.Ranger, x: 0, y: 0, worldX: 10, worldY: 10, size: 1, ground: Shape.Grass };
    scene.setSet('Van Gogh');
    scene.setSet('Composed');
    scene.setActors([ranger], 'map', 64, true);
    scene.setActors([], 'map', 64, true);
    scene.dispose();
    ready(asset);
    await Promise.resolve();
    await Promise.resolve();
    expect(scene.group.children).toHaveLength(0);
    expect(invalidate).not.toHaveBeenCalled();
    expect(hasAtelierCharacter(Shape.Ranger)).toBe(true);
    expect(hasAtelierCharacter(classTile(10) * 2)).toBe(true);
    for (let career = 0; career < 10; career++) expect(hasAtelierCharacter(classTile(career) * 2)).toBe(false);
  });
});
