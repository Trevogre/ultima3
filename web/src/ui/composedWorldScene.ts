import { readWorldCompositionOverrides, type WorldCompositionOverrides } from '../game/worldCompositionOverrides.ts';
import {
  BufferGeometry,
  BoxGeometry,
  Float32BufferAttribute,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  Sphere,
  Vector2,
  Vector3,
  type Camera,
} from 'three';
import { composeWorld, type ComposedWorld, type CompositionOverride, type WorldPlacement } from '../game/worldComposition.ts';
import { landscapeOffset, type Landscape } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import { ENVIRONMENT_VARIANTS, loadEnvironment, type EnvironmentLibrary } from './atelierEnvironment.ts';
import { composedGround, composedHeight, composedGroundColour, structureGround } from './composedGround.ts';

const MAX_INSTANCES = 20000;
const FREQUENCIES = [0.7, 0.43, 19.0, 4.0, 3.0, 2.3, 0.73, 0.24, 0.91, 0.33, 1.7, 16.0, 3.5, 3.1, 7.0, 11.0, 5.0, 7.5, 1.6, 0.6, 0.8];
const FREQUENCY_UNIFORM = `uniform float composedFrequencies[21];`;
const WIND = `float sway=sin(composedTime*1.1+(instanceMatrix[3].x+composedOrigin.x)*composedFrequencies[0]+(instanceMatrix[3].y+composedOrigin.y)*composedFrequencies[1]+position.z*.6)*pow(clamp(position.z/2.8,0.0,1.0),2.0)*.035*composedWind; transformed.xy+=vec2(sway,sway*.36);`;

/** Authored meshes in neighbour-aware arrangements, never reading the raw game map. */
export class ComposedWorldScene {
  readonly group = new Group();
  private library: EnvironmentLibrary | null = null;
  private loading = false;
  private overrideMaps: WorldCompositionOverrides = {};
  private failed = '';
  private disposed = false;
  private key = '';
  private readonly time = { value: 0 };
  private readonly lowerWater = { value: 1 };
  private readonly frequencies = { value: new Float32Array(FREQUENCIES) };
  private readonly origin = { value: new Vector2() };
  private readonly material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly groundMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  private readonly depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  readonly ground = new Mesh(new BufferGeometry(), this.groundMaterial);
  private readonly foundationGeometry = new BoxGeometry(1, 1, 0.36);
  readonly foundations = new InstancedMesh(this.foundationGeometry, this.groundMaterial, 4096);
  readonly water: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly batches = new Map<string, InstancedMesh>();
  private readonly capacities = new Map<string, number>();
  private placements: (WorldPlacement & { z: number })[] = [];
  private readonly frustum = new Frustum();
  private readonly viewProjection = new Matrix4();
  private readonly matrix = new Matrix4();
  private readonly scale = new Vector3();
  private readonly sphere = new Sphere();
  private readonly focus = new Vector3();
  private readonly viewDirection = new Vector3();
  private currentLandscape: Landscape | null = null;
  private plan: ComposedWorld | null = null;
  private lowered = true;
  private faceted = false;
  constructor(
    private readonly invalidate: () => void = () => {},
    library?: EnvironmentLibrary,
  ) {
    this.library = library ?? null;
    this.foundationGeometry.setAttribute(
      'color',
      new Float32BufferAttribute(new Float32Array(this.foundationGeometry.getAttribute('position').count * 3).fill(1), 3),
    );
    this.group.visible = false;
    this.ground.receiveShadow = true;
    this.groundMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.composedOrigin = this.origin;
      shader.uniforms.composedFrequencies = this.frequencies;
      shader.vertexShader = `varying vec2 paintedGround;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\npaintedGround=position.xy;\n#ifdef USE_INSTANCING\npaintedGround=(instanceMatrix*vec4(position,1.0)).xy;\n#endif',
      );
      shader.fragmentShader =
        `${FREQUENCY_UNIFORM} varying vec2 paintedGround; uniform vec2 composedOrigin;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec2 p=paintedGround+composedOrigin;
        float strokes=sin(p.x*composedFrequencies[2]+p.y*composedFrequencies[3]+sin(p.y*composedFrequencies[4])*2.0+sin(p.x*composedFrequencies[5])*1.4);
        float broad=sin(p.x*composedFrequencies[6]+p.y*composedFrequencies[7])*sin(p.y*composedFrequencies[8]-p.x*composedFrequencies[9]);
        diffuseColor.rgb*=1.0+strokes*.035+broad*.07;`,
        );
    };
    for (const material of [this.material, this.depth])
      material.onBeforeCompile = (shader) => {
        shader.uniforms.composedTime = this.time;
        shader.uniforms.composedOrigin = this.origin;
        shader.uniforms.composedFrequencies = this.frequencies;
        shader.vertexShader =
          `${FREQUENCY_UNIFORM} attribute float composedWind; uniform float composedTime; uniform vec2 composedOrigin;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\n#ifdef USE_INSTANCING\n${WIND}\n#endif`,
          );
      };
    const waterMaterial = new MeshStandardMaterial({
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
      roughness: 0.62,
      metalness: 0.02,
    });
    waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.composedLowered = this.lowerWater;
      shader.uniforms.composedTime = this.time;
      shader.uniforms.composedOrigin = this.origin;
      shader.uniforms.composedFrequencies = this.frequencies;
      shader.vertexShader =
        `${FREQUENCY_UNIFORM} attribute float waterCell; varying float paintedWaterCell; attribute float bedHeight; uniform float composedTime; uniform vec2 composedOrigin; varying vec2 waterWorld; varying float seabed; varying float surface;\n${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        paintedWaterCell=waterCell;waterWorld=position.xy+composedOrigin;seabed=bedHeight;
        transformed.z+=sin(waterWorld.x*composedFrequencies[5]+composedTime*.65)*sin(waterWorld.y*composedFrequencies[10]-composedTime*.45)*.008;surface=transformed.z;`,
        );
      shader.fragmentShader =
        `${FREQUENCY_UNIFORM} uniform float composedLowered; varying float paintedWaterCell; uniform float composedTime; varying vec2 waterWorld; varying float seabed; varying float surface;\n${shader.fragmentShader}`.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        if(composedLowered<.5 && paintedWaterCell<.5) discard;
        float depth=surface-seabed;if(depth<.003) discard;
        vec2 p=waterWorld;float flow=p.x*composedFrequencies[11]+p.y*composedFrequencies[12]+sin(p.y*composedFrequencies[13]+composedTime*.22)*2.1+sin(p.x*composedFrequencies[10])*1.3;
        float brokenStroke=.45+.55*sin(p.x*composedFrequencies[14]+p.y*composedFrequencies[15])*sin(p.y*composedFrequencies[16]);
        float stroke=pow(max(0.0,sin(flow+composedTime*.32)),12.0)*brokenStroke;
        float glint=pow(max(0.0,sin(p.x*composedFrequencies[17]+p.y*composedFrequencies[18]+sin(p.y*composedFrequencies[13]+composedTime*.2))),22.0)*stroke;
        float foam=(1.0-smoothstep(.01,.095,depth))*(.7+.3*sin(flow));
        vec3 c=mix(vec3(.015,.06,.14),vec3(.04,.16,.26),.5+.5*sin(p.x*composedFrequencies[19]+p.y*composedFrequencies[20]));
        c+=vec3(.03,.065,.07)*stroke+vec3(.07,.07,.015)*glint;
        c=mix(c,vec3(.32,.42,.35),foam*.45);diffuseColor.rgb=c*diffuse;`,
        );
    };
    this.water = new Mesh(new BufferGeometry(), waterMaterial);
    this.water.receiveShadow = true;
    this.water.renderOrder = 0.2;
    this.foundations.name = 'composed:foundations';
    this.foundations.count = 0;
    this.foundations.frustumCulled = false;
    this.foundations.castShadow = this.foundations.receiveShadow = true;
    this.group.add(this.ground, this.water, this.foundations);
  }
  get status(): string {
    return this.failed ? `Unavailable: ${this.failed}` : this.library ? 'Ready' : this.loading ? 'Loading authored scenery…' : 'Not loaded';
  }
  setFaceted(faceted: boolean): void {
    if (this.faceted === faceted) return;
    this.faceted = faceted;
    for (const material of [this.material, this.groundMaterial]) {
      material.flatShading = faceted;
      material.needsUpdate = true;
    }
  }
  retry(): void {
    this.failed = '';
  }
  private ensureLoaded(): void {
    if (this.library || this.loading || this.failed) return;
    this.loading = true;
    void Promise.all([
      loadEnvironment(),
      fetch(`${import.meta.env.BASE_URL}data/world-layouts.json`).then(async (response) => {
        if (!response.ok) throw new Error(`World layout addon: HTTP ${response.status}`);
        return readWorldCompositionOverrides(await response.json());
      }),
    ])
      .then(([library, overrides]) => {
        if (this.disposed) return;
        this.library = library;
        this.overrideMaps = overrides;
        this.loading = false;
        this.invalidate();
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        this.failed = error instanceof Error ? error.message : 'Could not load the environment library';
        this.loading = false;
        this.invalidate();
      });
  }
  /** Returns false while loading; the caller keeps its existing tiled scene visible. */
  set(
    landscape: Landscape | null,
    cells: ViewCell[],
    lowered: boolean,
    expanded: boolean,
    exclude: ReadonlySet<number>,
    overrides?: Record<string, CompositionOverride>,
  ): boolean {
    this.ensureLoaded();
    if (!this.library) {
      this.group.visible = false;
      return false;
    }
    const side = landscape?.side ?? Math.sqrt(cells.length);
    const source: Landscape = landscape ?? {
      side,
      shapes: Uint8Array.from(cells, (c) => c.base),
      partyX: (side - 1) / 2,
      partyY: (side - 1) / 2,
      wraps: false,
    };
    const shapes = source.shapes.slice();
    if (!expanded)
      for (let i = 0; i < shapes.length; i++) {
        const dx = landscapeOffset(i % side, source.partyX, side, source.wraps),
          dy = landscapeOffset(Math.floor(i / side), source.partyY, side, source.wraps);
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) shapes[i] = Shape.Void;
      }
    overrides ??= this.overrideMaps[String(source.mapId ?? 0)] ?? {};
    const key = JSON.stringify([
      source.mapId,
      side,
      source.partyX,
      source.partyY,
      source.wraps,
      lowered,
      Array.from(shapes),
      [...exclude],
      overrides,
    ]);
    this.group.visible = true;
    if (key === this.key) return true;
    this.key = key;
    this.currentLandscape = { ...source, shapes };
    const plan = composeWorld(source.mapId ?? 0, shapes, side, overrides, source.wraps);
    this.plan = plan;
    this.lowered = lowered;
    this.lowerWater.value = lowered ? 1 : 0;
    const geometry = composedGround(plan, this.currentLandscape, lowered, exclude);
    this.foundations.count = 0;
    for (const cell of plan.cells) {
      if (!structureGround(cell.terrain) && !exclude.has(cell.index)) continue;
      const x = landscapeOffset(cell.index % side, source.partyX, side, source.wraps),
        y = -landscapeOffset(Math.floor(cell.index / side), source.partyY, side, source.wraps);
      this.matrix.makeTranslation(x, y, -0.18);
      this.foundations.setMatrixAt(this.foundations.count, this.matrix);
      this.foundations.setColorAt(this.foundations.count++, composedGroundColour(cell.terrain));
    }
    this.foundations.instanceMatrix.needsUpdate = true;
    if (this.foundations.instanceColor) this.foundations.instanceColor.needsUpdate = true;
    this.ground.geometry.dispose();
    this.water.geometry.dispose();
    this.ground.geometry = geometry.ground;
    this.water.geometry = geometry.water;
    this.origin.value.set(source.partyX, -source.partyY);
    this.frequencies.value.set(FREQUENCIES.map((f) => (source.wraps ? (Math.round((f * side) / (Math.PI * 2)) * Math.PI * 2) / side : f)));
    this.placements = plan.cells.flatMap((cell) =>
      exclude.has(cell.index)
        ? []
        : cell.placements.map((p) => ({
            ...p,
            z: composedHeight(plan, cell.index, cell.terrain, p.x - (cell.index % side), p.y - Math.floor(cell.index / side), lowered),
          })),
    );
    this.capacities.clear();
    for (const p of this.placements) {
      const base = `${p.kind}-${p.variant % ENVIRONMENT_VARIANTS[p.kind]}`;
      this.capacities.set(base, (this.capacities.get(base) ?? 0) + 1);
    }
    return true;
  }
  supportHeight(x: number, y: number, ground: number): number {
    if (ground === Shape.Water) return this.lowered ? -0.22 : 0;
    if (!this.plan || !this.currentLandscape) return 0;
    const { partyX, partyY, side, wraps, shapes } = this.currentLandscape;
    let wx = x + partyX,
      wy = -y + partyY;
    if (wraps) {
      wx = ((wx % side) + side) % side;
      wy = ((wy % side) + side) % side;
    }
    const col = wraps ? ((Math.round(wx) % side) + side) % side : Math.round(wx),
      row = wraps ? ((Math.round(wy) % side) + side) % side : Math.round(wy);
    if (col < 0 || row < 0 || col >= side || row >= side) return 0;
    const index = row * side + col;
    if (shapes[index] === Shape.Void || structureGround(shapes[index])) return 0;
    return composedHeight(
      this.plan,
      index,
      shapes[index],
      wraps ? landscapeOffset(wx, col, side, true) : wx - col,
      wraps ? landscapeOffset(wy, row, side, true) : wy - row,
      this.lowered,
    );
  }
  private batch(kind: WorldPlacement['kind'], variant: number, low: boolean): InstancedMesh {
    const name = `${kind}-${variant % ENVIRONMENT_VARIANTS[kind]}`;
    const key = low && this.library!.has(`${name}-lod`) ? `${name}-lod` : name;
    const geometry = this.library?.get(key);
    if (!geometry) throw new Error(`Missing authored mesh ${key}`);
    let batch = this.batches.get(key);
    const required = Math.min(MAX_INSTANCES, this.capacities.get(name) ?? 1);
    if (batch && batch.instanceMatrix.count < required) {
      this.group.remove(batch);
      batch.dispose();
      batch = undefined;
    }
    if (!batch) {
      batch = new InstancedMesh(geometry, this.material, required);
      batch.name = `composed:${key}`;
      batch.count = 0;
      batch.frustumCulled = false;
      batch.castShadow = kind !== 'grass' && kind !== 'reed';
      batch.receiveShadow = true;
      batch.customDepthMaterial = this.depth;
      this.batches.set(key, batch);
      this.group.add(batch);
    }
    return batch;
  }
  faceCamera(camera: Camera, pixelsPerTile: number): void {
    if (!this.group.visible || !this.currentLandscape) return;
    for (const batch of this.batches.values()) batch.count = 0;
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    camera.getWorldDirection(this.viewDirection);
    this.focus.setFromMatrixPosition(camera.matrixWorld);
    if (Math.abs(this.viewDirection.z) > 1e-6) this.focus.addScaledVector(this.viewDirection, -this.focus.z / this.viewDirection.z);
    const { side, partyX, partyY, wraps } = this.currentLandscape;
    for (const p of this.placements) {
      if (p.kind === 'grass' && pixelsPerTile < 7) continue;
      const x = landscapeOffset(p.x, partyX, side, wraps),
        y = -landscapeOffset(p.y, partyY, side, wraps);
      const radius = p.kind === 'tree' ? 3.4 : p.kind === 'rock' ? 1.8 : 0.5;
      this.sphere.center.set(x, y, p.z + (p.kind === 'tree' ? 1.2 : 0.2));
      this.sphere.radius = radius;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      const low = this.faceted || pixelsPerTile < 28 || Math.hypot(x - this.focus.x, y - this.focus.y) > 11;
      const batch = this.batch(p.kind, p.variant, low);
      if (batch.count >= batch.instanceMatrix.count) continue;
      const factor = p.kind === 'tree' ? 0.65 : p.kind === 'rock' ? 1.15 : 1;
      this.matrix
        .makeRotationZ(p.rotation)
        .scale(this.scale.setScalar(p.scale * factor))
        .setPosition(x, y, p.z);
      batch.setMatrixAt(batch.count++, this.matrix);
    }
    for (const batch of this.batches.values()) batch.instanceMatrix.needsUpdate = true;
  }
  animate(clock: number): boolean {
    this.time.value = clock;
    return this.group.visible;
  }
  setDaylight(colour: readonly [number, number, number]): void {
    this.material.color.setRGB(...colour);
    this.groundMaterial.color.setRGB(...colour);
    this.water.material.color.setRGB(...colour);
  }
  dispose(): void {
    this.disposed = true;
    this.ground.geometry.dispose();
    this.water.geometry.dispose();
    this.material.dispose();
    this.groundMaterial.dispose();
    this.depth.dispose();
    this.water.material.dispose();
    this.foundationGeometry.dispose();
    this.foundations.dispose();
    for (const batch of this.batches.values()) batch.dispose();
    this.group.clear();
  }
}
