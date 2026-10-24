import {
  Box3,
  Color,
  type Skeleton,
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  type AnimationAction,
  type Material,
  type SkinnedMesh,
} from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { AnimatedModel, ModelAction } from './modelRigs.ts';

const CLIPS: Record<ModelAction, string> = { idle: 'Idle', walk: 'Walk', attack: 'Attack', cast: 'Cast', hit: 'Hit' };

/** Native glTF skeletons and continuous clips behind the game's existing motion interface. */
export class SkinnedModel implements AnimatedModel {
  readonly root = new Group();
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<ModelAction, AnimationAction>();
  private current: ModelAction | null = null;
  private lastTime: number | null = null;
  private readonly materials: Material[] = [];
  private readonly skeletons = new Set<Skeleton>();
  private readonly baseColours = new Map<Material, Color>();
  private daylight: [number, number, number] = [1, 1, 1];
  private poisoned = false;
  constructor(asset: GLTF, scale = 0.5, zUp = true) {
    for (const name of Object.values(CLIPS))
      if (!asset.animations.some((clip) => clip.name === name)) throw new Error(`Skinned model is missing ${name}`);
    const model = clone(asset.scene);
    model.scale.setScalar(scale);
    if (zUp) model.rotation.x = Math.PI / 2;
    this.root.add(model);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Independent materials allow actor tinting. Geometry remains immutable/shared.
      const original = object.material as Material | Material[];
      object.material = Array.isArray(original) ? original.map((m) => m.clone()) : original.clone();
      const owned: Material[] = Array.isArray(object.material) ? (object.material as Material[]) : [object.material as Material];
      this.materials.push(...owned);
      for (const material of owned)
        if ('color' in material && material.color instanceof Color) this.baseColours.set(material, material.color.clone());
      object.castShadow = object.receiveShadow = true;
      if ((object as SkinnedMesh).isSkinnedMesh) {
        object.frustumCulled = false;
        this.skeletons.add((object as SkinnedMesh).skeleton);
      }
    });
    model.updateMatrixWorld(true);
    model.position.z -= new Box3().setFromObject(model).min.z;
    this.mixer = new AnimationMixer(model);
    for (const [state, name] of Object.entries(CLIPS)) {
      const clip = asset.animations.find((c) => c.name === name)!;
      const action = this.mixer.clipAction(clip);
      action.setLoop(state === 'idle' || state === 'walk' ? LoopRepeat : LoopOnce, Infinity);
      action.clampWhenFinished = state !== 'idle' && state !== 'walk';
      this.actions.set(state as ModelAction, action);
    }
  }
  pose(time: number, state: ModelAction, progress: number, phase: number): void {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    const action = this.actions.get(state)!;
    if (state !== this.current) {
      const previous = this.current ? this.actions.get(this.current) : undefined;
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      if (previous) action.crossFadeFrom(previous, 0.12, false);
      this.current = state;
    }
    const duration = action.getClip().duration;
    const target =
      state === 'idle' || state === 'walk'
        ? (((time + phase * duration) % duration) + duration) % duration
        : Math.max(0, Math.min(0.99999, progress)) * duration;
    action.time = Math.max(0, target - dt);
    this.mixer.update(dt);
  }
  setPoisoned(value: boolean): void {
    this.poisoned = value;
    this.tint();
  }
  setDaylight(colour: [number, number, number]): void {
    this.daylight = [...colour];
    this.tint();
  }
  private tint(): void {
    const light = new Color().setRGB(...this.daylight),
      poison = new Color(this.poisoned ? 0x87bd79 : 0xffffff);
    for (const [material, base] of this.baseColours)
      (material as Material & { color: Color }).color.copy(base).multiply(light).multiply(poison);
  }
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    for (const material of this.materials) material.dispose();
    for (const skeleton of this.skeletons) skeleton.dispose();
    this.root.clear();
  }
}
