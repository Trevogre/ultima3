import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, MeshLambertMaterial } from 'three';
import { ModelMotion } from '../src/ui/modelAnimation.ts';
import { ModelRig } from '../src/ui/modelRigs.ts';
import { MODEL_SETS, nextModelSet } from '../src/ui/modelSets.ts';
import { MODEL_ASSET_SETS } from '../src/ui/modelAssetSets.ts';
import { ModelScene } from '../src/ui/modelScene.ts';
import { read3DSettings, applyPresentationPreset } from '../src/ui/view3DSettings.ts';
import { Shape } from '../src/game/tiles.ts';
import type { ModelActor } from '../src/ui/modelActors.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

afterEach(() => vi.unstubAllGlobals());
const actor: ModelActor = { id: 'member:0', shape: 136, x: 0, y: 0, worldX: 63, worldY: 9, size: 1, ground: Shape.Grass };
describe('independent animated 3D sets', () => {
  it('migrates existing model preferences and cycles sets separately from presentation and camera settings', () => {
    expect(read3DSettings({ renderStyle: 'Models' }).modelSet).toBe('Low-poly');
    expect(read3DSettings({ modelSet: 'invalid' }).modelSet).toBe('Low-poly');
    const saved = read3DSettings({ modelSet: 'Van Gogh', fixedAngle: 30, fixedRotation: 120, fixedCamera: false });
    expect(applyPresentationPreset(saved, 'Classic').modelSet).toBe('Van Gogh');
    expect(applyPresentationPreset(saved, 'Depth')).toMatchObject({ modelSet: 'Van Gogh', fixedAngle: 30, fixedRotation: 120 });
    expect(nextModelSet('Low-poly')).toBe('Van Gogh');
    expect(nextModelSet('Van Gogh')).toBe('Composed');
    expect(nextModelSet('Composed')).toBe('Low-poly');
    expect(Object.keys(MODEL_ASSET_SETS)).toEqual([...MODEL_SETS]);
  });
  it('provides fuller, UV-mapped scenery rather than only recolouring the low-poly meshes', () => {
    for (const shape of [Shape.Town, Shape.Castle, Shape.Forest, Shape.Brush, Shape.Mountains]) {
      const simple = MODEL_ASSET_SETS['Low-poly'].scenery(shape),
        painted = MODEL_ASSET_SETS['Van Gogh'].scenery(shape);
      expect(painted.getAttribute('position').count).toBeGreaterThan(simple.getAttribute('position').count);
      for (const attribute of ['normal', 'uv', 'color', 'paintSlot'])
        expect(painted.getAttribute(attribute).count).toBe(painted.getAttribute('position').count);
      expect(Array.from(painted.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      simple.dispose();
      painted.dispose();
    }
  });
  it('interpolates steps, handles wrapping and teleports, and times hit/attack/cast reactions independently of redraws', () => {
    const motion = new ModelMotion(actor, 0);
    expect(motion.sample(0).state).toBe('idle');
    const moved = { ...actor, x: 1, worldX: 0 };
    motion.update(moved, Math.PI / 2, 0, 64, true);
    expect(motion.sample(0.16)).toMatchObject({ state: 'walk', x: 0.5 });
    expect(motion.sample(0.4)).toMatchObject({ state: 'idle', x: 1 });
    motion.trigger('attack', 0.5, Math.PI);
    expect(motion.sample(0.7).state).toBe('attack');
    expect(motion.yaw).toBe(Math.PI);
    motion.trigger('cast', 1);
    expect(motion.sample(1.5).state).toBe('cast');
    expect(motion.sample(1.9).state).toBe('idle');
    motion.update({ ...moved, hit: true }, Math.PI / 2, 2, 64, true);
    expect(motion.sample(2.1).state).toBe('hit');
    motion.update({ ...moved, hit: true }, Math.PI / 2, 2.3, 64, true);
    expect(motion.sample(2.5).state).toBe('idle');
    motion.update({ ...moved, x: 8, worldX: 20 }, 0, 3, 64, true);
    expect(motion.sample(3)).toMatchObject({ state: 'idle', x: 8 });
    motion.update({ ...moved, x: 7, worldX: 20 }, 0, 3.1, 64, true);
    expect(motion.sample(3.1)).toMatchObject({ state: 'idle', x: 7 });
  });
  it('animates real joint hierarchies continuously in both sets, with distinct action poses and stable feet when idle', () => {
    const material = new MeshLambertMaterial({ vertexColors: true });
    for (const set of MODEL_SETS) {
      const rig = new ModelRig(136, set, material);
      expect(rig.arms[0].parent).toBe(rig.torso);
      expect(rig.elbows[0].parent).toBe(rig.arms[0]);
      expect(rig.knees[0].parent).toBe(rig.legs[0]);
      rig.pose(0, 'idle', 1, 0);
      const idle = rig.head.rotation.z;
      rig.pose(0.17, 'idle', 1, 0);
      expect(rig.head.rotation.z).not.toBe(idle);
      expect(rig.legs[0].rotation.x).toBe(0);
      rig.pose(0.17, 'walk', 0.5, 0);
      expect(Math.abs(rig.legs[0].rotation.x)).toBeGreaterThan(0.1);
      rig.pose(0.17, 'attack', 0.5, 0);
      expect(rig.arms[1].rotation.x).toBeLessThan(-1);
      rig.pose(0.17, 'cast', 0.5, 0);
      expect(rig.arms[0].rotation.x).toBeLessThan(-2);
      rig.pose(0.17, 'hit', 0.5, 0);
      expect(rig.torso.rotation.x).toBeCloseTo(0.25);
      rig.dispose();
    }
    material.dispose();
  });
  it('freezes animation while paused, removes hidden rigs, and can rebuild a different set without stale geometry', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) });
    const scene = new ModelScene();
    scene.group.visible = true;
    scene.setLandscape(null, [{ base: Shape.Grass }], {} as GraphicsSet, true);
    scene.setActors([actor], 'map', 64, true);
    scene.animate(1000, true);
    scene.animate(1016, true);
    const root = scene.group.getObjectByName(actor.id)!;
    const pose = () => {
      const values: number[] = [];
      root.traverse((o) => {
        if (o instanceof Group) values.push(...o.position.toArray(), ...(o.rotation.toArray().slice(0, 3) as number[]));
      });
      return values;
    };
    const before = pose();
    scene.animate(2000, false);
    scene.animate(3000, false);
    expect(pose()).toEqual(before);
    scene.animate(3016, true);
    expect(pose()).not.toEqual(before);
    scene.setActors([], 'map', 64, true);
    expect(scene.actorCount).toBe(0);
    expect(scene.group.getObjectByName(actor.id)).toBeUndefined();
    scene.setSet('Van Gogh');
    scene.setLandscape(null, [{ base: Shape.Forest }], {} as GraphicsSet, true);
    scene.setActors([actor], 'map', 64, true);
    expect(scene.actorCount).toBe(1);
    scene.dispose();
  });
});
