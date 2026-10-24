import { BoxGeometry, CapsuleGeometry, ConeGeometry, Group, Mesh, SphereGeometry, type BufferGeometry, type Material } from 'three';
import { modelGeometry } from './modelAssets.ts';
import { painterlyGeometry } from './painterlyModels.ts';
import { colourPart } from './modelPaint.ts';
import type { ModelSet } from './modelSets.ts';
import { Shape } from '../game/tiles.ts';

export type ModelAction = 'idle' | 'walk' | 'attack' | 'cast' | 'hit';
export interface AnimatedModel {
  readonly root: Group;
  pose(time: number, state: ModelAction, progress: number, phase: number): void;
  setPoisoned(value: boolean): void;
  dispose(): void;
}
export function humanoidShape(shape: number): boolean {
  const i = shape >> 1;
  return (i >= 16 && i <= 27) || i === 30 || i === 63 || (i >= 64 && i <= 78) || (i >= 80 && i <= 89) || i >= 94;
}

/** Articulated hierarchy: shoulders/elbows, hips/knees, torso and head.
 * These are independent joints, not alternate whole-model animation frames.
 */
export class ModelRig {
  readonly root = new Group();
  readonly torso = new Group();
  readonly head = new Group();
  readonly arms = [new Group(), new Group()];
  readonly elbows = [new Group(), new Group()];
  readonly legs = [new Group(), new Group()];
  readonly knees = [new Group(), new Group()];
  private readonly wings = [new Group(), new Group()];
  private readonly geometries = new Set<BufferGeometry>();
  private readonly human: boolean;
  private poisoned = false;
  private readonly originalColours = new Map<BufferGeometry, Float32Array>();
  constructor(
    readonly shape: number,
    set: ModelSet,
    material: Material,
  ) {
    const smooth = set === 'Van Gogh';
    this.human = humanoidShape(shape);
    const add = (parent: Group, g: BufferGeometry, c: number, slot: number, x = 0, y = 0, z = 0) => {
      this.geometries.add(g);
      const mesh = new Mesh(colourPart(g, c, slot), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const limb = (parent: Group, r: number, h: number, c: number, slot: number, z: number) =>
      add(
        parent,
        smooth ? new CapsuleGeometry(r, Math.max(0.01, h - 2 * r), 4, 12).rotateX(Math.PI / 2) : new BoxGeometry(r * 2, r * 2, h),
        c,
        slot,
        0,
        0,
        z,
      );
    const ellipsoid = (parent: Group, x: number, y: number, z: number, c: number, slot: number, px = 0, py = 0, pz = 0) =>
      add(parent, smooth ? new SphereGeometry(1, 20, 14).scale(x, y, z) : new BoxGeometry(x * 2, y * 2, z * 2), c, slot, px, py, pz);
    if (!this.human) {
      const geometry = smooth ? painterlyGeometry(shape) : modelGeometry(shape);
      this.geometries.add(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      this.torso.add(mesh);
      this.root.add(this.torso);
      if ([58, 184, 186].includes(shape))
        for (let i = 0; i < 2; i++) {
          this.root.add(this.wings[i]);
          this.wings[i].position.set(i ? 0.18 : -0.18, 0.03, 0.5);
          ellipsoid(this.wings[i], 0.35, 0.24, 0.025, 0xb9a357, 6, i ? 0.26 : -0.26, 0, 0);
        }
      return;
    }
    const index = shape >> 1,
      career = index >= 68 && index <= 78 ? index - 68 : index >= 64 && index <= 67 ? index - 64 : index % 11;
    const coats = [0x4d80b8, 0xd9c78f, 0x4268b8, 0x3b9c9a, 0x6e90b4, 0xb97658, 0xb87383, 0x5861ae, 0x648b39, 0x6e943f, 0x579441];
    const skeleton = [50, 168, 170].includes(shape),
      orc = [48, 164, 166].includes(shape),
      demon = [54, 60, 176, 178, 188, 190].includes(shape);
    const skin = skeleton ? 0xe5dcc0 : orc ? 0x89b951 : demon ? 0xc47a55 : 0xebbb82;
    const coat = skeleton ? 0xded4b4 : orc ? 0x6d983e : demon ? 0xa44735 : coats[career];
    const mage = [1, 2, 7, 8, 9].includes(career) && !skeleton && !orc && !demon;
    const jester = index === 17 || index === 74;
    this.root.add(this.torso);
    this.torso.position.z = 0.48;
    if (jester) {
      ellipsoid(this.torso, 0.105, 0.12, 0.19, 0xce4c38, 4, -0.075, 0, 0.15);
      ellipsoid(this.torso, 0.105, 0.12, 0.19, index === 74 ? 0x6e963d : 0x3b80bd, 3, 0.075, 0, 0.15);
    } else ellipsoid(this.torso, 0.185, 0.12, 0.19, coat, 3, 0, 0, 0.15);
    ellipsoid(this.torso, 0.17, 0.118, 0.04, 0x795337, 5, 0, -0.002, 0.015);
    ellipsoid(this.torso, 0.027, 0.015, 0.029, 0xe6bc54, 6, 0, -0.126, 0.015);
    this.torso.add(this.head);
    this.head.position.z = 0.4;
    ellipsoid(this.head, 0.135, 0.118, 0.155, skin, 7, 0, 0, 0.08);
    ellipsoid(this.head, 0.03, 0.045, 0.034, skin, 7, 0, -0.12, 0.06);
    for (const x of [-0.055, 0.055]) {
      ellipsoid(this.head, 0.025, 0.014, 0.02, 0xf2e6c8, 7, x, -0.111, 0.11);
      ellipsoid(this.head, 0.012, 0.01, 0.014, 0x203340, 3, x, -0.126, 0.11);
      ellipsoid(this.head, 0.025, 0.026, 0.045, skin, 7, x < 0 ? -0.138 : 0.138, 0, 0.07);
    }
    if (!skeleton) ellipsoid(this.head, 0.14, 0.125, 0.07, 0xb9873f, 5, 0, 0.01, 0.205);
    if (mage) add(this.head, new ConeGeometry(0.16, 0.3, smooth ? 20 : 5).rotateX(Math.PI / 2), coat, 3, 0, 0, 0.37);
    if (jester)
      for (const side of [-1, 1]) {
        const colour = side < 0 ? 0xc84b3d : 0x397cb4;
        add(
          this.head,
          new ConeGeometry(0.09, 0.23, smooth ? 12 : 4).rotateX(Math.PI / 2).rotateY(side * 0.7),
          colour,
          side < 0 ? 4 : 3,
          side * 0.1,
          0,
          0.27,
        );
        ellipsoid(this.head, 0.025, 0.025, 0.025, 0xe8bf4f, 6, side * 0.18, 0, 0.35);
      }
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1,
        colour = jester ? (i ? (index === 74 ? 0x6e963d : 0x3b80bd) : 0xce4c38) : coat;
      this.root.add(this.legs[i]);
      this.legs[i].position.set(side * 0.1, 0, 0.47);
      limb(this.legs[i], 0.062, 0.22, colour, 3, -0.1);
      this.legs[i].add(this.knees[i]);
      this.knees[i].position.z = -0.21;
      limb(this.knees[i], 0.053, 0.2, colour, 3, -0.09);
      ellipsoid(this.knees[i], 0.068, 0.12, 0.055, 0xb48338, 5, 0, -0.045, -0.2);
      this.torso.add(this.arms[i]);
      this.arms[i].position.set(side * 0.22, 0, 0.27);
      limb(this.arms[i], 0.065, 0.22, colour, 3, -0.1);
      this.arms[i].add(this.elbows[i]);
      this.elbows[i].position.z = -0.2;
      limb(this.elbows[i], 0.048, 0.19, colour, 3, -0.085);
      ellipsoid(this.elbows[i], 0.053, 0.047, 0.057, skin, 7, 0, 0, -0.19);
    }
    if (!jester) {
      if (mage) {
        limb(this.elbows[1], 0.016, 0.72, 0xa97b3d, 5, 0.04);
        ellipsoid(this.elbows[1], 0.06, 0.06, 0.07, 0xe4c04f, 6, 0, 0, 0.42);
      } else {
        ellipsoid(this.elbows[0], 0.135, 0.035, 0.17, career === 10 ? 0xd6aa45 : 0x819fb4, career === 10 ? 6 : 2, 0, -0.075, -0.1);
        add(this.elbows[1], new BoxGeometry(0.035, 0.025, 0.41), 0xdce5d4, 2, 0, -0.025, 0.05);
        add(this.elbows[1], new BoxGeometry(0.15, 0.045, 0.027), 0xd8b24f, 6, 0, -0.025, -0.145);
      }
    }
    if (demon)
      for (let i = 0; i < 2; i++) {
        this.torso.add(this.wings[i]);
        this.wings[i].position.set(i ? 0.15 : -0.15, 0.08, 0.23);
        ellipsoid(this.wings[i], 0.28, 0.035, 0.23, 0x894b43, 4, i ? 0.23 : -0.23, 0, 0.08);
      }
  }
  pose(time: number, state: ModelAction, progress: number, phase: number): void {
    if (!this.human) {
      const mobile = (
        [
          Shape.Horse,
          Shape.Frigate,
          Shape.Pirate,
          Shape.Serpent,
          Shape.ManOWar,
          Shape.SnakeBottom,
          Shape.SnakeTop,
          Shape.Whirlpool,
          58,
          184,
          186,
        ] as number[]
      ).includes(this.shape);
      this.torso.position.z = mobile ? Math.sin(time * 2 + phase) * 0.015 : 0;
      this.torso.rotation.x = mobile ? Math.sin(time + phase) * 0.025 : 0;
      if (this.shape === Shape.Whirlpool) this.torso.rotation.z = time * 0.5;
      this.wings.forEach((w, i) => (w.rotation.y = Math.sin(time * 4 + phase) * (i ? -0.45 : 0.45)));
      return;
    }
    const walk = state === 'walk',
      swing = Math.sin(time * 11 + phase),
      pulse = Math.sin(Math.min(1, progress) * Math.PI);
    this.torso.position.z = 0.48 + Math.sin(time * 2 + phase) * 0.007 + (walk ? Math.abs(swing) * 0.018 : 0);
    this.torso.rotation.set(
      state === 'hit' ? pulse * 0.25 : 0,
      0,
      state === 'attack' ? pulse * 0.16 : Math.sin(time * 0.8 + phase) * 0.025,
    );
    this.head.rotation.set(Math.sin(time * 1.2 + phase) * 0.025, 0, Math.sin(time * 0.7 + phase) * 0.055);
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      this.legs[i].rotation.x = walk ? swing * sign * 0.55 : 0;
      this.knees[i].rotation.x = walk ? Math.max(0, -swing * sign) * 0.7 : 0;
      this.arms[i].rotation.set(walk ? -swing * sign * 0.48 : Math.sin(time * 1.8 + phase + i) * 0.06, sign * 0.06, 0);
      this.elbows[i].rotation.x = -0.14;
      if (state === 'cast') {
        this.arms[i].rotation.x = -2.1 * pulse;
        this.elbows[i].rotation.x = -0.55 * pulse;
      }
    }
    if (state === 'attack') {
      this.arms[1].rotation.x = -1.6 * pulse;
      this.elbows[1].rotation.x = -0.8 * pulse;
    }
    this.wings.forEach((w, i) => (w.rotation.y = Math.sin(time * 3 + phase) * (i ? -0.12 : 0.12)));
  }
  setPoisoned(value: boolean): void {
    if (value === this.poisoned) return;
    this.poisoned = value;
    for (const geometry of this.geometries) {
      const colours = geometry.getAttribute('color');
      if (!colours) continue;
      if (!this.originalColours.has(geometry)) this.originalColours.set(geometry, new Float32Array(colours.array));
      const original = this.originalColours.get(geometry)!;
      for (let i = 0; i < colours.count; i++)
        colours.setXYZ(i, original[i * 3] * (value ? 0.42 : 1), original[i * 3 + 1], original[i * 3 + 2] * (value ? 0.42 : 1));
      colours.needsUpdate = true;
    }
  }
  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.root.clear();
  }
}
