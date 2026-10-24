import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
  type OrthographicCamera,
} from 'three';
import type { ModelActor } from './modelActors.ts';
import type { GraphicsSet } from './graphics.ts';
import type { View3DSettings } from './view3DSettings.ts';
import { terrainElevation } from './terrainDepth.ts';
import { cardGroundLift } from './cardGroundLift.ts';
import { confineCard } from './cardClearance.ts';
import { useCharacterCutouts } from './characterMask.ts';

/** Additional sight-admitted figures outside the classic 11×11 composition. */
export class TownSightFigures {
  readonly group = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly entries = new Map<
    string,
    { actor: ModelActor; canvas: HTMLCanvasElement; texture: CanvasTexture; mesh: Mesh<PlaneGeometry, MeshBasicMaterial> }
  >();
  private colour: [number, number, number] = [1, 1, 1];
  constructor(private readonly inverted: { value: boolean }) {}
  set(actors: ModelActor[], gfx: GraphicsSet, options: View3DSettings, tilt: number) {
    const ids = new Set(actors.map((a) => a.id));
    for (const [id, entry] of this.entries)
      if (!ids.has(id)) {
        this.group.remove(entry.mesh);
        entry.texture.dispose();
        entry.mesh.material.dispose();
        this.entries.delete(id);
      }
    for (const actor of actors) {
      let entry = this.entries.get(actor.id);
      if (!entry) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        const material = new MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.01,
          depthTest: true,
          depthWrite: true,
          side: DoubleSide,
          toneMapped: false,
        });
        material.onBeforeCompile = (shader) => {
          shader.uniforms.mapInverted = this.inverted;
          shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\nif(mapInverted) gl_FragColor.rgb=vec3(1.0)-gl_FragColor.rgb;',
          );
        };
        const mesh = new Mesh(this.geometry, material);
        mesh.renderOrder = 1;
        entry = { actor, canvas, texture, mesh };
        this.entries.set(actor.id, entry);
        this.group.add(mesh);
      }
      entry.actor = actor;
      entry.mesh.material.color.setRGB(...this.colour);
      const ctx = entry.canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 64, 64);
      gfx.drawShape(ctx, actor.shape, 0, 0, 64, { masked: true, card: useCharacterCutouts(options.enabled, options.characters, tilt) });
      entry.texture.needsUpdate = true;
    }
  }
  face(camera: OrthographicCamera, tilt: number, options: View3DSettings, solids: ReadonlySet<string>) {
    for (const { actor, mesh } of this.entries.values()) {
      const angle = options.characters ? tilt : 0,
        ground = terrainElevation(actor.ground, options.recessedWater);
      mesh.scale.setScalar(actor.size);
      mesh.quaternion.identity();
      mesh.position.set(actor.x, actor.y, ground + cardGroundLift(actor.size, angle));
      if (options.characters) {
        mesh.quaternion.copy(camera.quaternion);
        mesh.position.addScaledVector(camera.up, (actor.size * Math.sin(angle)) / 2);
        if (angle > 0.001) {
          const right = { x: 1, y: 0 };
          // Camera right is the first column of its world matrix.
          camera.updateMatrixWorld();
          right.x = camera.matrixWorld.elements[0];
          right.y = camera.matrixWorld.elements[1];
          const blocked = (dx: number, dy: number) => solids.has(`${actor.x + dx},${actor.y + dy}`);
          const fit = confineCard(mesh.position, right, camera.up, actor.size, actor.x, actor.y, {
            left: blocked(-1, 0),
            right: blocked(1, 0),
            bottom: blocked(0, -1),
            top: blocked(0, 1),
          });
          mesh.position.x += fit.dx;
          mesh.position.y += fit.dy;
          mesh.position.z = ground + 0.001 + (actor.size * fit.scale * Math.sin(angle)) / 2;
          mesh.scale.setScalar(actor.size * fit.scale);
        }
      }
    }
  }
  setDaylight(colour: [number, number, number]) {
    this.colour = colour;
    for (const e of this.entries.values()) e.mesh.material.color.setRGB(...colour);
  }
  dispose() {
    for (const e of this.entries.values()) {
      e.texture.dispose();
      e.mesh.material.dispose();
    }
    this.entries.clear();
    this.group.clear();
    this.geometry.dispose();
  }
}
