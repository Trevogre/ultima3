import {
  CanvasTexture,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
} from 'three';
import type { GraphicsSet } from './graphics.ts';
import { type Landscape, landscapeOffset } from '../game/landscape.ts';
import { Shape } from '../game/tiles.ts';
import type { ViewCell } from '../game/viewport.ts';
import { battlefieldZoom, mapCameraTarget, minimumMapZoom } from './mapCameraBounds.ts';
import { DEFAULT_3D_SETTINGS, useTreeCards, type View3DSettings } from './view3DSettings.ts';
import { buildingGround, isBuilding } from './billboardArt.ts';
import { BuildingBillboards } from './buildingBillboards.ts';
import { TerrainCubes } from './terrainCubes.ts';
import { Shoreline } from './shoreline.ts';
import { shorelineTexture, terrainElevation } from './terrainDepth.ts';
import { castsContactShadow, ContactShadows } from './contactShadows.ts';
import { useCharacterCutouts } from './characterMask.ts';
import { addZoomFiltering } from './zoomFiltering.ts';
import { FogEdges } from './fogEdges.ts';
import { CameraMovement } from './cameraMovement.ts';
import { GrassDepth } from './grassDepth.ts';
import { SunShadows } from './sunShadows.ts';
import { WaterSurface } from './waterSurface.ts';
import { cardGroundLift } from './cardGroundLift.ts';

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Batched whole-map scenery plus local terrain and visibility-limited actor quads. */
export class TileMapScene {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  readonly rect: ScreenRect;
  readonly terrainContext: CanvasRenderingContext2D;
  readonly actorContext: CanvasRenderingContext2D;
  readonly sunActorContext: CanvasRenderingContext2D;
  private readonly sunShadows: SunShadows;
  readonly effectContext: CanvasRenderingContext2D;
  private characterCutouts = false;
  private readonly movement = new CameraMovement();
  private readonly grass = new GrassDepth();
  private readonly filters: ReturnType<typeof addZoomFiltering>[] = [];
  private readonly shading = { value: 1 };
  private readonly fog = new FogEdges();
  private readonly water: WaterSurface;
  private options: View3DSettings = { ...DEFAULT_3D_SETTINGS };
  private readonly actorCards: { mesh: Mesh; x: number; y: number; size: number }[] = [];
  private readonly partyCards: { mesh: Mesh; x: number; y: number; size: number }[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly geometries: PlaneGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly inverted = { value: false };
  private readonly buildings = new BuildingBillboards(this.inverted);
  private readonly trees = new BuildingBillboards(this.inverted, 'trees');
  private treeMode = false;
  private readonly localTerrain = new Group();
  private readonly shadows = new ContactShadows();
  private shadowCells: ViewCell[] = [];
  private readonly landscapeCanvas = document.createElement('canvas');
  private readonly landscapeContext: CanvasRenderingContext2D;
  private readonly landscapeMesh: InstancedMesh;
  private readonly landscapeTexture: CanvasTexture;
  private readonly cubes: TerrainCubes;
  private readonly shoreline: Shoreline;
  private readonly groundEffects: Mesh[] = [];
  private readonly landscapeSlots = new InstancedBufferAttribute(new Float32Array(4096 * 2), 2);
  private readonly matrix = new Matrix4();
  private readonly visibleSide: number;
  private fitX = 0;
  private fitY = 0;
  private landscapeSide = 0;
  yaw = (DEFAULT_3D_SETTINGS.fixedRotation * Math.PI) / 180;
  tilt = (DEFAULT_3D_SETTINGS.fixedAngle * Math.PI) / 180;
  zoom = 1;
  private combat = false;
  private explorationZoom = 1;
  onCameraModeToggle: (() => void) | null = null;
  onCardModeChange: (() => void) | null = null;

  constructor(
    cell: number,
    side: number,
    private readonly invalidate: () => void,
    readonly inspectionMode = false,
  ) {
    this.visibleSide = side;
    const size = side * 2 * cell;
    this.rect = { x: cell, y: cell, w: size, h: size };
    const contexts = [false, true, true].map((transparent, layer) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      // Screen drawing helpers can use their existing screen pixel coordinates.
      ctx.translate(-cell, -cell);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = texture.magFilter = NearestFilter;
      texture.generateMipmaps = false;
      this.textures.push(texture);
      const material = new MeshBasicMaterial({
        map: texture,
        transparent,
        depthTest: layer !== 2,
        depthWrite: layer !== 2,
        alphaTest: layer === 1 ? 0.01 : 0,
        toneMapped: false,
        side: DoubleSide,
      });
      // The original spell flash inverts display colours, after colour conversion.
      material.onBeforeCompile = (shader) => {
        shader.uniforms.mapInverted = this.inverted;
        shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\nif (mapInverted) gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;',
        );
      };
      if (layer !== 2) this.filters.push(addZoomFiltering(material, texture, side, side, layer === 1));
      this.materials.push(material);
      return ctx;
    });
    [this.terrainContext, this.actorContext, this.effectContext] = contexts;
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        const geometry = new PlaneGeometry(1, 1);
        const uv = geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / side, (side - row - 1 + uv.getY(i)) / side);
        this.geometries.push(geometry);
        this.materials.forEach((material, layer) => {
          const tile = new Mesh(geometry, material);
          tile.position.set(col - (side - 1) / 2, (side - 1) / 2 - row, 0);
          tile.renderOrder = layer === 2 ? 0.5 : layer;
          if (layer === 0) this.localTerrain.add(tile);
          else {
            this.scene.add(tile);
            if (layer === 1) this.actorCards.push({ mesh: tile, x: tile.position.x, y: tile.position.y, size: 1 });
            else this.groundEffects.push(tile);
          }
        });
      }
    }
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = size;
    this.sunActorContext = shadowCanvas.getContext('2d')!;
    this.sunActorContext.imageSmoothingEnabled = false;
    this.sunActorContext.translate(-cell, -cell);
    const shadowTexture = new CanvasTexture(shadowCanvas);
    shadowTexture.minFilter = shadowTexture.magFilter = NearestFilter;
    shadowTexture.generateMipmaps = false;
    this.textures.push(shadowTexture);
    this.sunShadows = new SunShadows(shadowTexture, this.buildings.shadowTexture, this.trees.shadowTexture);
    this.scene.add(this.sunShadows.actors.mesh, this.sunShadows.buildings.mesh, this.sunShadows.trees.mesh);
    this.scene.add(this.localTerrain);
    this.scene.add(this.shadows.mesh);
    for (let i = 0; i < 4; i++) {
      const geometry = new PlaneGeometry(0.5, 0.5);
      const uv = geometry.getAttribute('uv');
      for (let n = 0; n < uv.count; n++)
        uv.setXY(
          n,
          ((side - 1) / 2 + (i % 2) / 2 + uv.getX(n) / 2) / side,
          ((side - 1) / 2 + (1 - Math.floor(i / 2)) / 2 + uv.getY(n) / 2) / side,
        );
      this.geometries.push(geometry);
      const mesh = new Mesh(geometry, this.materials[1]);
      mesh.renderOrder = 1;
      mesh.visible = false;
      this.scene.add(mesh);
      this.partyCards.push({ mesh, x: (i % 2) / 2 - 0.25, y: 0.25 - Math.floor(i / 2) / 2, size: 0.5 });
    }
    this.scene.add(this.buildings.mesh);
    this.scene.add(this.trees.mesh);
    this.landscapeCanvas.width = this.landscapeCanvas.height = 1024;
    this.landscapeContext = this.landscapeCanvas.getContext('2d')!;
    this.landscapeContext.imageSmoothingEnabled = false;
    this.landscapeTexture = new CanvasTexture(this.landscapeCanvas);
    this.landscapeTexture.colorSpace = SRGBColorSpace;
    this.landscapeTexture.minFilter = this.landscapeTexture.magFilter = NearestFilter;
    this.landscapeTexture.generateMipmaps = false;
    this.textures.push(this.landscapeTexture);
    const ground = new PlaneGeometry(1, 1);
    ground.setAttribute('mapTile', this.landscapeSlots);
    const scenery = new MeshBasicMaterial({
      map: this.landscapeTexture,
      depthTest: true,
      depthWrite: true,
      side: DoubleSide,
      toneMapped: false,
    });
    scenery.onBeforeCompile = (shader) => {
      shader.uniforms.mapInverted = this.inverted;
      shader.vertexShader = `attribute vec2 mapTile;\nattribute float shorelineBackground;\n${shader.vertexShader}`.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvMapUv = (mapTile + mix(vMapUv, vec2(0.5 / 64.0, 63.5 / 64.0), shorelineBackground)) / 16.0;',
      );
      shader.fragmentShader = `uniform bool mapInverted;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (mapInverted) gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;',
      );
    };
    const originalSceneryShader = scenery.onBeforeCompile.bind(scenery);
    scenery.onBeforeCompile = function (shader, renderer) {
      originalSceneryShader(shader, renderer);
      shader.uniforms.terrainShading = thisShading;
      shader.vertexShader = `varying vec3 terrainNormal;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nterrainNormal=normal;',
      );
      shader.fragmentShader = `uniform float terrainShading; varying vec3 terrainNormal;\n${shader.fragmentShader}`.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat faceShade=clamp(0.88+0.12*terrainNormal.z-0.05*terrainNormal.x+0.04*terrainNormal.y,0.78,1.0);\ndiffuseColor.rgb *= mix(1.0,faceShade,terrainShading);',
      );
    };
    const thisShading = this.shading;
    this.filters.push(addZoomFiltering(scenery, this.landscapeTexture, 16, 16));
    this.materials.push(scenery);
    this.geometries.push(ground);
    this.landscapeMesh = new InstancedMesh(ground, scenery, 4096);
    this.landscapeMesh.frustumCulled = false;
    this.landscapeMesh.renderOrder = -1;
    this.landscapeMesh.visible = false;
    this.scene.add(this.landscapeMesh);
    this.cubes = new TerrainCubes(scenery);
    this.scene.add(this.cubes.mesh);
    this.shoreline = new Shoreline(scenery);
    this.scene.add(this.shoreline.mesh);
    this.water = new WaterSurface(this.inverted);
    this.scene.add(this.water.mesh);
    this.scene.add(this.fog.mesh, this.grass.mesh);
    this.camera = new OrthographicCamera(-side / 2, side / 2, side / 2, -side / 2, 0.1, 500);
    this.updateCamera();
  }

  /** Batch the entire landscape in one draw call, using a small animated tile atlas. */
  setLandscape(landscape: Landscape | null, gfx: GraphicsSet, cells: ViewCell[]): void {
    this.grass.set(cells, gfx, this.options.grassDepth);
    this.water.set(landscape, cells, gfx, this.options);
    this.fog.set(landscape, cells, this.options.softFog, this.options.recessedWater);
    this.trees.set(landscape, cells, gfx, this.treeCardsActive);
    if (this.options.contactShadows) this.trees.forEachFootprint((x, y, size) => this.shadows.add(x, y, size));
    this.buildings.set(landscape, cells, gfx, this.options.buildings);
    if (this.options.contactShadows && this.options.buildings) this.buildings.forEachFootprint((x, y) => this.shadows.add(x, y, 1));
    this.cubes.set(landscape, cells, this.options);
    this.shoreline.set(landscape, cells, this.options.recessedWater);
    this.sunShadows.setGround(landscape, cells);
    if (this.sunShadows.active) {
      this.buildings.forEachShadow((x, y, slot, anchor) => this.sunShadows.buildings.add(x, y, 1, [slot / 8, 0, 1 / 8, 1], anchor));
      this.trees.forEachShadow((x, y, slot, anchor) => this.sunShadows.trees.add(x, y, 1, [slot / 8, 0, 1 / 8, 1], anchor));
    }
    this.landscapeMesh.visible = !!landscape;
    // Preserve exact local floors. The landscape supplies either distant
    // outdoor scenery or black tiles from the town/castle visibility mask.
    this.localTerrain.children.forEach((tile, i) => {
      tile.visible = cells[i].base !== Shape.Water && (!landscape || cells[i].base !== Shape.Void);
      tile.position.z = terrainElevation(cells[i].base, this.options.recessedWater);
      this.groundEffects[i].position.z = tile.position.z + 0.003;
    });
    // Both local-only and expanded modes use the same tile atlas for cube faces.
    const shapes = landscape?.shapes ?? cells.map((cell) => cell.base);
    const ctx = this.landscapeContext;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 1024);
    const atlasShapes = new Set(shapes);
    // Shore sides can need grass even when all visible land is forest.
    if (this.options.recessedWater) for (const shape of shapes) atlasShapes.add(shorelineTexture(shape));
    for (const shape of atlasShapes) {
      if (shape === Shape.Void) continue; // hidden cells are solid black in every tile set
      const x = (shape % 16) * 64;
      const y = Math.floor(shape / 16) * 64;
      if (this.forestGround(shape, gfx) !== shape) gfx.drawShape(ctx, Shape.Grass, x, y, 64);
      else if (this.options.buildings && isBuilding(shape)) gfx.drawShape(ctx, buildingGround(shape), x, y, 64);
      else if (shape === Shape.Shrine || shape === Shape.Door) {
        gfx.drawShape(ctx, shape === Shape.Door ? Shape.Floor : Shape.Grass, x, y, 64);
        gfx.drawShape(ctx, shape, x, y, 64, { masked: true });
      } else gfx.drawShape(ctx, shape, x, y, 64);
    }
    this.landscapeTexture.needsUpdate = true;
    if (!landscape) {
      if (this.landscapeSide) {
        this.landscapeSide = 0;
        this.fitX = this.fitY = 0;
        if (!this.combat) this.zoom = Math.max(0.65, this.zoom);
      }
      this.updateCamera();
      this.buildings.faceCamera(this.camera, this.tilt);
      this.trees.faceCamera(this.camera, this.tilt);
      return;
    }
    const { side, partyX, partyY, wraps } = landscape;
    for (let i = 0; i < shapes.length; i++) {
      const x = landscapeOffset(i % side, partyX, side, wraps);
      const y = -landscapeOffset(Math.floor(i / side), partyY, side, wraps);
      if (shapes[i] === Shape.Water) this.matrix.makeScale(0, 0, 0).setPosition(x, y, 0);
      else this.matrix.makeTranslation(x, y, terrainElevation(shapes[i], this.options.recessedWater));
      this.landscapeMesh.setMatrixAt(i, this.matrix);
      this.landscapeSlots.setXY(i, shapes[i] % 16, 15 - Math.floor(shapes[i] / 16));
    }
    this.landscapeMesh.count = shapes.length;
    this.landscapeMesh.instanceMatrix.needsUpdate = true;
    this.landscapeSlots.needsUpdate = true;
    this.landscapeSide = side;
    this.fitX = wraps ? -0.5 : (side - 1) / 2 - partyX;
    this.fitY = wraps ? 0.5 : partyY - (side - 1) / 2;
    this.updateCamera();
  }

  setOptions(options: View3DSettings): void {
    const changedMode = options.fixedCamera !== this.options.fixedCamera;
    const changedAngle = options.fixedAngle !== this.options.fixedAngle;
    const changedRotation = options.fixedRotation !== this.options.fixedRotation;
    this.options = { ...options };
    this.filters.forEach((filter) => filter(options.zoomFiltering));
    this.buildings.setFiltering(options.zoomFiltering);
    this.trees.setFiltering(options.zoomFiltering);
    this.shading.value = options.terrainShading ? 1 : 0;
    if (changedMode && options.fixedCamera) this.reset();
    else {
      if (changedRotation && options.fixedCamera) this.yaw = (options.fixedRotation * Math.PI) / 180;
      if (changedAngle && options.fixedCamera) this.tilt = (options.fixedAngle * Math.PI) / 180;
      this.updateCamera();
    }
  }

  setActorLayout(cells: ViewCell[], partyGrid: boolean): void {
    this.shadowCells = cells;
    const centre = Math.floor(cells.length / 2);
    const split = this.options.characters && partyGrid && !!cells[centre].party;
    this.actorCards.forEach(({ mesh }, i) => {
      mesh.visible = i !== centre || !split;
    });
    this.partyCards.forEach(({ mesh }) => {
      mesh.visible = split;
    });
    this.grass.faceCamera(this.camera, this.tilt, (this.rect.w / this.visibleSide) * this.zoom);
    this.faceActors();
  }

  get hasLandscape(): boolean {
    return this.landscapeSide > 0;
  }

  setCombat(combat: boolean): void {
    if (combat === this.combat) return;
    this.combat = combat;
    if (combat) {
      this.explorationZoom = this.zoom;
      this.zoom = battlefieldZoom(this.visibleSide, this.yaw, this.tilt);
    } else this.zoom = this.explorationZoom;
    if (combat) this.updateCamera();
  }

  private get minZoom(): number {
    if (this.combat) return battlefieldZoom(this.visibleSide, this.yaw, this.tilt);
    if (this.inspectionMode) return this.landscapeSide ? this.visibleSide / (this.landscapeSide * 1.6) : 0.65;
    return minimumMapZoom(this.visibleSide, this.landscapeSide || this.visibleSide, this.yaw, this.tilt);
  }

  fit(): void {
    this.zoom = this.minZoom;
    this.updateCamera();
  }

  beginFrame(): void {
    this.shadows.reset();
    this.sunShadows.reset();
    const { x, y, w, h } = this.rect;
    this.terrainContext.fillStyle = '#000';
    this.terrainContext.fillRect(x, y, w, h);
    this.actorContext.clearRect(x, y, w, h);
    this.effectContext.clearRect(x, y, w, h);
    this.sunActorContext.clearRect(x, y, w, h);
    this.inverted.value = false;
    this.changed();
  }

  changed(): void {
    for (const texture of this.textures) texture.needsUpdate = true;
    this.invalidate();
  }

  invert(): void {
    this.inverted.value = !this.inverted.value;
    this.invalidate();
  }

  /** Tint only the map; menus, status text and the moon indicators stay bright. */
  setDaylight(colour: [number, number, number]): void {
    for (const material of this.materials) material.color.setRGB(...colour);
    this.buildings.setDaylight(colour);
    this.trees.setDaylight(colour);
    this.water.material.color.setRGB(...colour);
    this.grass.setDaylight(colour);
    this.invalidate();
  }

  setSun(phase: number, timer: number, outdoors: boolean): void {
    this.sunShadows.setSun(phase, timer, outdoors && this.options.sunShadows);
  }

  /** Called only after actual visible card artwork has been drawn. */
  addActorShadow(x: number, y: number, size: number, shape: number): void {
    if (!this.options.characters) return;
    const tile = this.rect.w / this.visibleSide;
    const col = (x - this.rect.x) / tile;
    const row = (y - this.rect.y) / tile;
    const ground = this.shadowCells[Math.floor(row) * this.visibleSide + Math.floor(col)]?.base ?? Shape.Void;
    if (!castsContactShadow(shape, ground)) return;
    const footX = col + size / tile / 2 - this.visibleSide / 2;
    const footY = this.visibleSide / 2 - row - size / tile / 2;
    if (this.options.contactShadows) this.shadows.add(footX, footY, size / tile);
    if (this.sunShadows.active) {
      const canvasSize = this.actorContext.canvas.width;
      this.sunShadows.actors.add(
        footX,
        footY,
        size / tile,
        [(x - this.rect.x) / canvasSize, 1 - (y - this.rect.y + size) / canvasSize, size / canvasSize, size / canvasSize],
        [0.5, 0],
      );
    }
  }

  orbit(dx: number, dy: number): void {
    if (this.options.fixedCamera) return;
    this.yaw = (this.yaw + dx * 0.006) % (Math.PI * 2);
    this.tilt = Math.max(0, Math.min((70 * Math.PI) / 180, this.tilt + dy * 0.006));
    this.updateCamera();
  }

  zoomBy(delta: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(2.5, this.zoom * Math.exp(-delta * 0.001)));
    this.updateCamera();
  }

  reset(): void {
    this.yaw = this.options.fixedCamera ? (this.options.fixedRotation * Math.PI) / 180 : 0;
    this.tilt = this.options.fixedCamera ? (this.options.fixedAngle * Math.PI) / 180 : 0;
    this.zoom = 1;
    this.updateCamera();
  }

  get isDefault(): boolean {
    const yaw = this.options.fixedCamera ? (this.options.fixedRotation * Math.PI) / 180 : 0;
    const tilt = this.options.fixedCamera ? (this.options.fixedAngle * Math.PI) / 180 : 0;
    return this.yaw === yaw && this.tilt === tilt && this.zoom === 1;
  }

  get fixedCamera(): boolean {
    return this.options.fixedCamera;
  }

  get mouseOptions(): Pick<View3DSettings, 'leftDrag' | 'rightDrag' | 'wheelZoom'> {
    return this.options;
  }

  get characterCutoutsActive(): boolean {
    return useCharacterCutouts(this.options.enabled, this.options.characters, this.tilt);
  }

  private get treeCardsActive(): boolean {
    return useTreeCards(this.options.treeCards, this.tilt, true);
  }

  forestGround(shape: number, gfx: GraphicsSet): number {
    const hasCutout = shape === Shape.Forest ? !!gfx.forestCard : shape === Shape.Brush && !!gfx.brushCards;
    return useTreeCards(this.options.treeCards, this.tilt, hasCutout) ? Shape.Grass : shape;
  }

  movementKey(key: string): string {
    return this.movement.key(key);
  }

  private updateCamera(): void {
    this.movement.update(this.yaw, this.options.enabled && !this.options.fixedCamera && this.options.cameraRelative);
    if (this.treeMode !== this.treeCardsActive || this.characterCutouts !== this.characterCutoutsActive) {
      this.treeMode = this.treeCardsActive;
      this.characterCutouts = this.characterCutoutsActive;
      this.onCardModeChange?.();
    }
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const st = Math.sin(this.tilt);
    const ct = Math.cos(this.tilt);
    // Gameplay keeps the entire ground footprint inside the map. Only the
    // development inspection camera can pull back beyond its edges.
    this.zoom = Math.max(this.minZoom, this.zoom);
    const fit = Math.max(0, Math.min(1, (0.5 - this.zoom) / (0.5 - this.minZoom)));
    const target = this.combat
      ? { x: 0, y: 0 }
      : this.inspectionMode
        ? { x: this.fitX * fit, y: this.fitY * fit }
        : mapCameraTarget(this.visibleSide, this.landscapeSide || this.visibleSide, this.yaw, this.tilt, this.zoom, this.fitX, this.fitY);
    const { x, y } = target;
    this.camera.position.set(x + 150 * s * st, y - 150 * c * st, 150 * ct);
    this.camera.up.set(-s * ct, c * ct, st);
    this.camera.lookAt(x, y, 0);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.grass.faceCamera(this.camera, this.tilt, (this.rect.w / this.visibleSide) * this.zoom);
    this.faceActors();
    this.buildings.faceCamera(this.camera, this.tilt);
    this.trees.faceCamera(this.camera, this.tilt);
    this.invalidate();
  }

  private faceActors(): void {
    for (const card of [...this.actorCards, ...this.partyCards]) {
      const col = Math.floor(card.x + this.visibleSide / 2);
      const row = Math.floor(this.visibleSide / 2 - card.y);
      const base = this.shadowCells[row * this.visibleSide + col]?.base ?? Shape.Void;
      const ground = terrainElevation(base, this.options.recessedWater);
      card.mesh.position.set(card.x, card.y, ground + cardGroundLift(card.size, this.options.characters ? this.tilt : 0));
      if (this.options.characters) {
        card.mesh.quaternion.copy(this.camera.quaternion);
        card.mesh.position.addScaledVector(this.camera.up, (card.size * Math.sin(this.tilt)) / 2);
      } else card.mesh.quaternion.identity();
    }
  }

  animate(time: number, active: boolean): void {
    if (active && this.options.waterHighlights && this.water.mesh.count > 0) {
      this.water.time.value = time / 1000;
      this.invalidate();
    }
  }

  dispose(): void {
    this.grass.dispose();
    this.sunShadows.dispose();
    this.water.dispose();
    this.fog.dispose();
    for (const texture of this.textures) texture.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.buildings.dispose();
    this.trees.dispose();
    this.shadows.dispose();
    this.landscapeMesh.dispose();
    this.cubes.dispose();
    this.shoreline.dispose();
    this.scene.clear();
  }
}
