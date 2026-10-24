import type { EnvironmentLibrary } from './atelierEnvironment.ts';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { hasAtelierCharacter, loadAtelierRanger } from './atelierCharacters.ts';
import { SkinnedModel } from './skinnedModel.ts';
import { ComposedWorldScene } from './composedWorldScene.ts';
import type { OrthographicCamera } from 'three';
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  PlaneGeometry,
  DoubleSide,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { type Landscape, landscapeOffset } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import { hasTerrainModel, modelGroundColour } from './modelAssets.ts';
import { ModelHeadings, type ModelActor } from './modelActors.ts';
import { sunShadow } from './sunShadows.ts';
import type { ModelSet } from './modelSets.ts';
import { ModelPaint, colourPart } from './modelPaint.ts';
import type { AnimatedModel } from './modelRigs.ts';
import { MODEL_ASSET_SETS } from './modelAssetSets.ts';
import { ModelMotion } from './modelAnimation.ts';

/** Separate solid-mesh presentation, sharing only the visibility-filtered map. */
export class ModelScene {
  readonly group = new Group();
  private readonly composed: ComposedWorldScene;
  private ranger: GLTF | null = null;
  private rangerLoading = false;
  private rangerFailed = false;
  private disposed = false;
  private daylight: [number, number, number] = [1, 1, 1];
  get characterStatus(): string {
    if (this.modelSet !== 'Composed') return 'Replacement character art awaits visual approval.';
    return this.rangerFailed
      ? 'Ranger unavailable; prior model retained. Switch sets to retry.'
      : this.rangerLoading
        ? 'Loading rigged ranger…'
        : this.ranger
          ? 'Rigged ranger with five animation states.'
          : 'Authored ranger loads when visible.';
  }
  private layout: 'Tiled' | 'Composed' = 'Tiled';
  private expanded = true;
  get compositionStatus(): string {
    return this.composed.status;
  }
  setLayout(layout: 'Tiled' | 'Composed', expanded: boolean): void {
    if (layout !== this.layout && layout === 'Composed') this.composed.retry();
    this.layout = layout;
    this.expanded = expanded;
  }
  faceCamera(camera: OrthographicCamera, pixelsPerTile: number): void {
    this.composed.faceCamera(camera, pixelsPerTile);
  }
  readonly sun = new DirectionalLight(0xffedc7, 2.0);
  private readonly ambient = new HemisphereLight(0xdce9ee, 0x505b3a, 2.0);
  private readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly paint = new ModelPaint();
  private readonly paintedMaterial = this.paint.material();
  private readonly groundMaterial = this.paint.material(true);
  private modelSet: ModelSet = 'Low-poly';
  private readonly groundPaintSlots = new InstancedBufferAttribute(new Float32Array(4096), 1);
  private readonly actors = new Map<string, { rig: AnimatedModel; motion: ModelMotion; actor: ModelActor }>();
  private actorContext = '';
  private readonly wind: { mesh: InstancedMesh; index: number; x: number; y: number; z: number }[] = [];
  private clock = 0;
  private lastTime: number | null = null;
  private readonly flagGeometry = new PlaneGeometry(0.3, 0.16, 10, 4).rotateX(Math.PI / 2).translate(0.15, 0, 0);
  private readonly flagMaterial = new MeshLambertMaterial({ color: 0x458fda, side: DoubleSide });
  private readonly flags = new InstancedMesh(this.flagGeometry, this.flagMaterial, 4096);
  private sceneryFlags = 0;
  private readonly cliffGeometry = colourPart(new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), 0x8c8e80, 2);
  private readonly cliffs = new InstancedMesh(this.cliffGeometry, this.material, 32);
  private readonly groundGeometry = new BoxGeometry(1, 1, 1);
  private readonly ground = new InstancedMesh(this.groundGeometry, this.groundMaterial, 4096);
  private readonly unknownMaterial = new MeshBasicMaterial({ color: 0 });
  private readonly unknown = new InstancedMesh(this.groundGeometry, this.unknownMaterial, 4096);
  private readonly batches = new Map<number, InstancedMesh>();
  private readonly headings = new ModelHeadings();
  private readonly matrix = new Matrix4();
  private readonly colour = new Color();
  private readonly scale = new Vector3();
  private scenery = new Map<number, number>();
  private gfx: GraphicsSet | null = null;
  private readonly signs = new Map<number, { mesh: InstancedMesh; texture: CanvasTexture; material: MeshLambertMaterial }>();
  private lowered = true;
  shadowEnabled = false;

  constructor(
    private readonly invalidate: () => void = () => {},
    library?: EnvironmentLibrary,
    private readonly loadRanger: () => Promise<GLTF> = loadAtelierRanger,
  ) {
    this.composed = new ComposedWorldScene(invalidate, library);
    this.composed.setFaceted(true);
    this.group.add(this.composed.group);
    this.groundGeometry.setAttribute('paintSlot', this.groundPaintSlots);
    this.group.visible = false;
    this.ambient.position.set(0, 0, 1);
    this.ground.frustumCulled = this.unknown.frustumCulled = false;
    this.ground.receiveShadow = true;
    this.ground.count = this.unknown.count = 0;
    this.sun.position.set(8, -5, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 0.5, far: 100 });
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.bias = -0.0001;
    this.group.add(this.ground, this.unknown, this.ambient, this.sun, this.sun.target);
    this.flags.count = 0;
    this.flags.frustumCulled = false;
    this.flags.castShadow = this.flags.receiveShadow = true;
    this.flagMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.modelTime = this.paint.time;
      shader.vertexShader = `uniform float modelTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nfloat flutter=sin(modelTime*4.0+position.x*22.0+instanceMatrix[3].x); transformed.y+=flutter*0.045*position.x/0.3;transformed.z+=flutter*0.018*position.x/0.3;',
      );
    };
    this.group.add(this.flags);
  }

  get actorCount(): number {
    return this.actors.size;
  }
  setSet(set: ModelSet): void {
    if (set === this.modelSet) return;
    this.modelSet = set;
    this.layout = set === 'Composed' ? 'Composed' : 'Tiled';
    if (set === 'Composed') this.composed.retry();
    this.rangerFailed = false;
    this.composed.setFaceted(set === 'Low-poly');
    this.paint.enable(MODEL_ASSET_SETS[set].painted);
    this.cliffs.material = set !== 'Low-poly' ? this.paintedMaterial : this.material;
    for (const batch of this.batches.values()) {
      this.group.remove(batch);
      batch.geometry.dispose();
      batch.dispose();
    }
    this.batches.clear();
    this.clearSigns();
    this.scenery.clear();
    this.wind.length = 0;
    this.clearActors();
  }
  private requestRanger(): void {
    if (this.ranger || this.rangerLoading || this.rangerFailed || this.disposed) return;
    this.rangerLoading = true;
    void this.loadRanger()
      .then((asset) => {
        if (this.disposed) return;
        this.ranger = asset;
        this.rangerLoading = false;
        // Swap only currently admitted actors, retaining their movement/action clocks.
        if (this.modelSet === 'Composed')
          for (const entry of this.actors.values()) {
            if (!hasAtelierCharacter(entry.actor.shape)) continue;
            const rig = new SkinnedModel(asset);
            rig.root.name = entry.actor.id;
            rig.setPoisoned(!!entry.actor.poisoned);
            rig.setDaylight(this.daylight);
            this.group.remove(entry.rig.root);
            entry.rig.dispose();
            entry.rig = rig;
            this.group.add(rig.root);
          }
        this.poseActors();
        this.invalidate();
      })
      .catch(() => {
        if (this.disposed) return;
        this.rangerLoading = false;
        this.rangerFailed = true;
        this.invalidate();
      });
  }
  private clearActors(): void {
    for (const { rig } of this.actors.values()) {
      this.group.remove(rig.root);
      rig.dispose();
    }
    this.actors.clear();
  }
  private clearSigns(): void {
    for (const sign of this.signs.values()) {
      this.group.remove(sign.mesh);
      sign.texture.dispose();
      sign.material.dispose();
      sign.mesh.geometry.dispose();
      sign.mesh.dispose();
    }
    this.signs.clear();
  }

  private batch(shape: number): InstancedMesh {
    let batch = this.batches.get(shape);
    if (!batch) {
      batch = new InstancedMesh(
        MODEL_ASSET_SETS[this.modelSet].scenery(shape),
        this.modelSet !== 'Low-poly' ? this.paintedMaterial : this.material,
        4096,
      );
      batch.count = 0;
      batch.frustumCulled = false;
      batch.castShadow = batch.receiveShadow = true;
      this.batches.set(shape, batch);
      this.group.add(batch);
    }
    return batch;
  }

  private add(shape: number, x: number, y: number, z = 0, size = 1, yaw = 0, poisoned = false): void {
    const mesh = this.batch(shape);
    if (mesh.count >= 4096) return;
    this.matrix.makeRotationZ(yaw).scale(this.scale.set(size, size, size));
    this.matrix.setPosition(x, y, z);
    mesh.setMatrixAt(mesh.count, this.matrix);
    mesh.setColorAt(mesh.count, this.colour.setHex(poisoned ? 0x65b259 : 0xffffff));
    mesh.count++;
  }

  setLandscape(
    landscape: Landscape | null,
    cells: ViewCell[],
    gfx: GraphicsSet,
    lowered: boolean,
    cliffHosts: ReadonlySet<number> = new Set(),
  ): void {
    this.lowered = lowered;
    const composed = this.layout === 'Composed' && this.composed.set(landscape, cells, lowered, this.expanded, cliffHosts);
    this.composed.group.visible = composed;
    this.cliffs.count = 0;
    this.cliffs.frustumCulled = false;
    this.cliffs.castShadow = this.cliffs.receiveShadow = true;
    if (cliffHosts.size) this.group.add(this.cliffs);
    if (this.gfx !== gfx) {
      this.clearSigns();
      this.gfx = gfx;
    }
    for (const batch of this.batches.values()) batch.count = 0;
    for (const { mesh } of this.signs.values()) mesh.count = 0;
    this.ground.count = this.unknown.count = 0;
    this.flags.count = 0;
    this.wind.length = 0;
    const add = (shape: number, x: number, y: number, index: number) => {
      const z = shape === Shape.Water && lowered ? -0.22 : 0;
      this.matrix.makeScale(1, 1, 0.36 + z).setPosition(x, y, (-0.36 + z) / 2);
      if (shape === Shape.Void) {
        this.unknown.setMatrixAt(this.unknown.count++, this.matrix);
        return;
      }
      if (!composed || shape === Shape.Lava) {
        this.ground.setMatrixAt(this.ground.count, this.matrix);
        this.groundPaintSlots.setX(
          this.ground.count,
          shape === Shape.Water
            ? 1
            : shape === Shape.Grass ||
                shape === Shape.Forest ||
                shape === Shape.Brush ||
                shape === Shape.Town ||
                shape === Shape.Castle ||
                shape === Shape.Shrine
              ? 0
              : shape === Shape.Lava
                ? 4
                : 2,
        );
        this.ground.setColorAt(this.ground.count++, this.colour.setHex(modelGroundColour(shape)));
      }
      if (composed && ([Shape.Forest, Shape.Brush, Shape.Mountains] as number[]).includes(shape) && !cliffHosts.has(index)) return;
      if (shape >= 76 && shape <= 114 && shape !== Shape.Door) this.addSign(shape, x, y, gfx);
      else if (shape !== Shape.ForceField && hasTerrainModel(shape)) {
        if (shape === Shape.Mountains && cliffHosts.has(index) && this.cliffs.count < 32) {
          this.cliffs.setMatrixAt(this.cliffs.count++, this.matrix.makeTranslation(x, y, z));
        } else this.add(shape, x, y, z);
        if (shape === Shape.Forest || shape === Shape.Brush)
          this.wind.push({ mesh: this.batch(shape), index: this.batch(shape).count - 1, x, y, z });
        if (shape === Shape.Town || shape === Shape.Castle)
          this.addFlag(x + (this.modelSet !== 'Low-poly' && shape === Shape.Town ? -0.33 : 0), y + 0.06, 1.25);
      }
    };
    if (landscape) {
      const { side, partyX, partyY, wraps } = landscape;
      landscape.shapes.forEach((shape, i) =>
        add(shape, landscapeOffset(i % side, partyX, side, wraps), -landscapeOffset(Math.floor(i / side), partyY, side, wraps), i),
      );
    } else {
      const side = Math.sqrt(cells.length);
      cells.forEach((cell, i) => add(cell.base, (i % side) - (side - 1) / 2, (side - 1) / 2 - Math.floor(i / side), i));
    }
    this.scenery = new Map([...this.batches].map(([shape, batch]) => [shape, batch.count]));
    this.sceneryFlags = this.flags.count;
    this.groundPaintSlots.needsUpdate = true;
    for (const mesh of [this.ground, this.unknown, ...[...this.signs.values()].map((s) => s.mesh)]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.cliffs.instanceMatrix.needsUpdate = true;
    this.changed();
  }
  private addFlag(x: number, y: number, z: number, size = 1, yaw = 0): void {
    if (this.flags.count >= 4096) return;
    this.matrix
      .makeRotationZ(yaw)
      .scale(this.scale.set(size, size, size))
      .setPosition(x, y, z);
    this.flags.setMatrixAt(this.flags.count++, this.matrix);
    this.flags.instanceMatrix.needsUpdate = true;
  }

  private addSign(shape: number, x: number, y: number, gfx: GraphicsSet): void {
    let sign = this.signs.get(shape);
    if (!sign) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      if (this.modelSet !== 'Low-poly') {
        ctx.fillStyle = '#743c20';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#efcc78';
        ctx.font = 'bold 48px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String.fromCharCode(65 + (shape >> 1) - 38), 32, 34);
        ctx.strokeStyle = '#dfbb6c';
        ctx.strokeRect(1, 1, 62, 62);
      } else gfx.drawShape(ctx, shape, 0, 0, 64);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      const material = new MeshLambertMaterial({ map: texture });
      // Share the plain counter's exact geometry, paint slots and vertex colours.
      // Only its upper face receives the letter; its sides remain counter material.
      const geometry = MODEL_ASSET_SETS[this.modelSet].scenery(Shape.Wall + 4);
      const position = geometry.getAttribute('position'),
        normal = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv') ?? new BufferAttribute(new Float32Array(position.count * 2), 2);
      geometry.setAttribute('uv', uv);
      geometry.clearGroups();
      let start = 0,
        last = -1;
      for (let i = 0; i < position.count; i += 3) {
        const top = normal.getZ(i) > 0.99 && position.getZ(i) > 0.499;
        const slot = top ? 1 : 0;
        if (slot !== last) {
          if (i > start) geometry.addGroup(start, i - start, last);
          start = i;
          last = slot;
        }
        if (top) for (let j = i; j < i + 3; j++) uv.setXY(j, position.getX(j) + 0.5, position.getY(j) + 0.5);
      }
      geometry.addGroup(start, position.count - start, last);
      const mesh = new InstancedMesh(geometry, [this.modelSet !== 'Low-poly' ? this.paintedMaterial : this.material, material], 4096);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      sign = { mesh, material, texture };
      this.signs.set(shape, sign);
      this.group.add(mesh);
    }
    // Functional sign art stays on the top of a solid block, never a billboard.
    this.matrix.makeTranslation(x, y, 0);
    sign.mesh.setMatrixAt(sign.mesh.count++, this.matrix);
  }

  setActors(actors: ModelActor[], context: string, side: number, wraps: boolean): void {
    if (this.actorContext !== context) {
      this.clearActors();
      this.actorContext = context;
    }
    this.headings.begin(context);
    for (const [shape, batch] of this.batches) batch.count = this.scenery.get(shape) ?? 0;
    const visible = new Set(actors.map((a) => a.id));
    for (const [id, entry] of this.actors)
      if (!visible.has(id)) {
        this.group.remove(entry.rig.root);
        entry.rig.dispose();
        this.actors.delete(id);
      }
    this.flags.count = this.sceneryFlags;
    for (const actor of actors) {
      if (this.modelSet === 'Composed' && hasAtelierCharacter(actor.shape)) this.requestRanger();
      let entry = this.actors.get(actor.id);
      const yaw = this.headings.heading(actor, side, wraps);
      if (entry && entry.actor.shape !== actor.shape) {
        this.group.remove(entry.rig.root);
        entry.rig.dispose();
        this.actors.delete(actor.id);
        entry = undefined;
      }
      if (!entry) {
        const rig =
          this.modelSet === 'Composed' && this.ranger && hasAtelierCharacter(actor.shape)
            ? new SkinnedModel(this.ranger)
            : MODEL_ASSET_SETS[this.modelSet].actor(actor.shape, this.modelSet !== 'Low-poly' ? this.paintedMaterial : this.material);
        rig.setDaylight?.(this.daylight);
        rig.root.name = actor.id;
        entry = { rig, motion: new ModelMotion(actor, yaw), actor };
        this.actors.set(actor.id, entry);
        this.group.add(rig.root);
      }
      entry.motion.update(actor, yaw, this.clock, side, wraps);
      entry.actor = actor;
      entry.rig.setPoisoned(!!actor.poisoned);
      if (actor.shape === Shape.Frigate || actor.shape === Shape.Pirate) this.addFlag(actor.x, actor.y, 0.95 * actor.size, actor.size, yaw);
    }
    this.poseActors();
    this.changed();
  }
  trigger(id: string, action: 'attack' | 'cast', yaw?: number): void {
    this.actors.get(id)?.motion.trigger(action, this.clock, yaw);
  }
  private poseActors(): void {
    for (const { rig, motion, actor } of this.actors.values()) {
      const pose = motion.sample(this.clock);
      rig.root.position.set(
        pose.x,
        pose.y,
        this.composed.group.visible
          ? this.composed.supportHeight(pose.x, pose.y, actor.ground)
          : actor.ground === Shape.Water && this.lowered
            ? -0.22
            : 0,
      );
      rig.root.rotation.z = motion.yaw;
      rig.root.scale.setScalar(actor.size);
      rig.pose(this.clock, pose.state, pose.progress, motion.phase);
    }
  }
  animate(time: number, active: boolean): boolean {
    const dt = this.lastTime === null ? 0 : Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (!active || !this.group.visible) return false;
    this.clock += dt;
    this.paint.time.value = this.clock;
    this.poseActors();
    this.composed.animate(this.clock);
    for (const item of this.wind) {
      this.matrix.makeRotationX(Math.sin(this.clock * 1.3 + item.x * 0.7 + item.y) * 0.015).setPosition(item.x, item.y, item.z);
      item.mesh.setMatrixAt(item.index, this.matrix);
      item.mesh.instanceMatrix.needsUpdate = true;
    }
    return this.composed.group.visible || this.ground.count > 0 || this.actors.size > 0;
  }

  private changed(): void {
    for (const mesh of this.batches.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  setDaylight(colour: [number, number, number]): void {
    this.daylight = [...colour];
    for (const { rig } of this.actors.values()) rig.setDaylight?.(colour);
    this.composed.setDaylight(colour);
    this.material.color.setRGB(...colour);
    this.paintedMaterial.color.setRGB(...colour);
    this.flagMaterial.color.setRGB(colour[0] * 0.25, colour[1] * 0.5, colour[2] * 0.85);
    this.groundMaterial.color.setRGB(...colour);
    for (const sign of this.signs.values()) sign.material.color.setRGB(...colour);
  }

  setSun(phase: number, timer: number, enabled: boolean): void {
    const sun = sunShadow(phase, timer);
    this.shadowEnabled = enabled && sun.opacity > 0;
    this.sun.castShadow = this.shadowEnabled;
    this.sun.intensity = enabled ? (sun.opacity / 0.24) * 2 : 2;
    this.sun.position.set(-sun.x * 12, -sun.y * 12, 12);
  }

  dispose(): void {
    this.disposed = true;
    this.composed.dispose();
    this.clearActors();
    this.cliffGeometry.dispose();
    this.cliffs.dispose();
    this.paint.dispose();
    this.paintedMaterial.dispose();
    this.flagGeometry.dispose();
    this.flagMaterial.dispose();
    this.flags.dispose();
    for (const batch of this.batches.values()) {
      batch.geometry.dispose();
      batch.dispose();
    }
    for (const sign of this.signs.values()) {
      sign.mesh.geometry.dispose();
      sign.mesh.dispose();
      sign.texture.dispose();
      sign.material.dispose();
    }
    this.material.dispose();
    this.groundMaterial.dispose();
    this.unknownMaterial.dispose();
    this.groundGeometry.dispose();
    this.ground.dispose();
    this.unknown.dispose();
    this.sun.dispose();
    this.group.clear();
  }
}
