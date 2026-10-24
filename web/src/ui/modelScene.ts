import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { type Landscape, landscapeOffset } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import type { GraphicsSet } from './graphics.ts';
import { hasTerrainModel, modelGeometry, modelGroundColour } from './modelAssets.ts';
import { ModelHeadings, type ModelActor } from './modelActors.ts';
import { sunShadow } from './sunShadows.ts';

/** Separate solid-mesh presentation, sharing only the visibility-filtered map. */
export class ModelScene {
  readonly group = new Group();
  readonly sun = new DirectionalLight(0xffedc7, 2.0);
  private readonly ambient = new HemisphereLight(0xdce9ee, 0x505b3a, 2.0);
  private readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly groundMaterial = new MeshLambertMaterial({ flatShading: true });
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

  constructor() {
    this.group.visible = false;
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
  }

  private batch(shape: number): InstancedMesh {
    let batch = this.batches.get(shape);
    if (!batch) {
      batch = new InstancedMesh(modelGeometry(shape), this.material, 4096);
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

  setLandscape(landscape: Landscape | null, cells: ViewCell[], gfx: GraphicsSet, lowered: boolean): void {
    this.lowered = lowered;
    if (this.gfx !== gfx) {
      for (const sign of this.signs.values()) {
        this.group.remove(sign.mesh);
        sign.texture.dispose();
        sign.material.dispose();
        sign.mesh.dispose();
      }
      this.signs.clear();
      this.gfx = gfx;
    }
    for (const batch of this.batches.values()) batch.count = 0;
    for (const { mesh } of this.signs.values()) mesh.count = 0;
    this.ground.count = this.unknown.count = 0;
    const add = (shape: number, x: number, y: number) => {
      const z = shape === Shape.Water && lowered ? -0.22 : 0;
      this.matrix.makeScale(1, 1, 0.36 + z).setPosition(x, y, (-0.36 + z) / 2);
      if (shape === Shape.Void) {
        this.unknown.setMatrixAt(this.unknown.count++, this.matrix);
        return;
      }
      this.ground.setMatrixAt(this.ground.count, this.matrix);
      this.ground.setColorAt(this.ground.count++, this.colour.setHex(modelGroundColour(shape)));
      if (shape >= 76 && shape <= 114 && shape !== Shape.Door) this.addSign(shape, x, y, gfx);
      else if (hasTerrainModel(shape)) this.add(shape, x, y, z);
    };
    if (landscape) {
      const { side, partyX, partyY, wraps } = landscape;
      landscape.shapes.forEach((shape, i) =>
        add(shape, landscapeOffset(i % side, partyX, side, wraps), -landscapeOffset(Math.floor(i / side), partyY, side, wraps)),
      );
    } else {
      const side = Math.sqrt(cells.length);
      cells.forEach((cell, i) => add(cell.base, (i % side) - (side - 1) / 2, (side - 1) / 2 - Math.floor(i / side)));
    }
    this.scenery = new Map([...this.batches].map(([shape, batch]) => [shape, batch.count]));
    for (const mesh of [this.ground, this.unknown, ...[...this.signs.values()].map((s) => s.mesh)]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.changed();
  }

  private addSign(shape: number, x: number, y: number, gfx: GraphicsSet): void {
    let sign = this.signs.get(shape);
    if (!sign) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      gfx.drawShape(canvas.getContext('2d')!, shape, 0, 0, 64);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      const material = new MeshLambertMaterial({ map: texture });
      const mesh = new InstancedMesh(
        this.groundGeometry,
        [this.groundMaterial, this.groundMaterial, this.groundMaterial, this.groundMaterial, material, this.groundMaterial],
        4096,
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      sign = { mesh, material, texture };
      this.signs.set(shape, sign);
      this.group.add(mesh);
    }
    // Functional sign art stays on the top of a solid block, never a billboard.
    this.matrix.makeScale(1, 1, 1).setPosition(x, y, 0.5);
    sign.mesh.setMatrixAt(sign.mesh.count++, this.matrix);
  }

  setActors(actors: ModelActor[], context: string, side: number, wraps: boolean): void {
    this.headings.begin(context);
    for (const [shape, batch] of this.batches) batch.count = this.scenery.get(shape) ?? 0;
    for (const actor of actors)
      this.add(
        actor.shape,
        actor.x,
        actor.y,
        actor.ground === Shape.Water && this.lowered ? -0.22 : 0,
        actor.size,
        this.headings.heading(actor, side, wraps),
        actor.poisoned,
      );
    this.changed();
  }

  private changed(): void {
    for (const mesh of this.batches.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  setDaylight(colour: [number, number, number]): void {
    this.material.color.setRGB(...colour);
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
    for (const batch of this.batches.values()) {
      batch.geometry.dispose();
      batch.dispose();
    }
    for (const sign of this.signs.values()) {
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
