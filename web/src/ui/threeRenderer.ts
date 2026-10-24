/**
 * Fixed pixel UI plus an independently rendered, party-centred tile board.
 * The original pixel screen remains the source for menus and non-map views,
 * and the fallback on devices without WebGL 2.
 */
import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoToneMapping,
  PCFSoftShadowMap,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { TileMapScene, type ScreenRect } from './tileMapScene.ts';
import { MapCameraControls } from './mapCameraControls.ts';

interface Presentation {
  mapVisible: boolean;
  mapInteractive: boolean;
  mapAnimated?: boolean;
  toolbarVisible?: boolean;
  covers: ScreenRect[];
}

/** Canvas operations which change pixels (state and path operations do not). */
const PIXEL_WRITES = new Set<PropertyKey>([
  'clearRect',
  'drawImage',
  'fill',
  'fillRect',
  'fillText',
  'putImageData',
  'reset',
  'stroke',
  'strokeRect',
  'strokeText',
]);

export class ThreeRenderer {
  readonly context: CanvasRenderingContext2D;
  readonly map: TileMapScene;
  private readonly controls: MapCameraControls | null;
  private readonly surface = document.createElement('canvas');
  private readonly renderer: WebGLRenderer | null;
  private readonly fallback: CanvasRenderingContext2D | null;
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;
  private readonly texture: CanvasTexture;
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private dirty = true;
  private sceneDirty = true;
  private presentationKey = '';
  private lost = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    cell: number,
    side: number,
  ) {
    const { width, height } = canvas;
    this.surface.width = width;
    this.surface.height = height;
    const context = this.surface.getContext('2d');
    if (!context) throw new Error('Could not create the pixel drawing surface');
    context.imageSmoothingEnabled = false;
    // Bind native methods to the real context, and track every pixel write so
    // static menus and paused screens do not upload a full texture every frame.
    const methods = new Map<PropertyKey, unknown>();
    this.context = new Proxy(context, {
      get: (target, key) => {
        const value: unknown = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        if (!methods.has(key)) {
          methods.set(key, (...args: unknown[]): unknown => {
            const result: unknown = Reflect.apply(value, target, args);
            if (PIXEL_WRITES.has(key)) this.dirty = true;
            return result;
          });
        }
        return methods.get(key);
      },
      set: (target, key, value: unknown) => Reflect.set(target, key, value, target),
    });

    this.camera = new OrthographicCamera(0, width, height, 0, 0.1, 10);
    this.camera.position.z = 1;
    this.texture = new CanvasTexture(this.surface);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = NearestFilter;
    this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.geometry = new PlaneGeometry(width, height);
    this.material = new MeshBasicMaterial({ map: this.texture, depthTest: false, depthWrite: false, toneMapped: false });
    const screen = new Mesh(this.geometry, this.material);
    screen.position.set(width / 2, height / 2, 0);
    this.scene.add(screen);
    const inspectionMode = import.meta.env.DEV && new URLSearchParams(location.search).has('freeCamera');
    this.map = new TileMapScene(
      cell,
      side,
      () => {
        this.sceneDirty = true;
      },
      inspectionMode,
    );

    // Keep the same canvas node, CSS scaling, focus and touch behavior. Devices
    // without WebGL 2 (including software-only desktop configurations) can
    // still play using the original pixel output.
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      preserveDrawingBuffer: true, // existing canvas.toBlob()/toDataURL() screenshots
    });
    if (gl) {
      this.renderer = new WebGLRenderer({ canvas, context: gl });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = NoToneMapping;
      this.renderer.autoClear = false;
      this.renderer.shadowMap.type = PCFSoftShadowMap;
      this.controls = new MapCameraControls(canvas, this.map);
      this.fallback = null;
      canvas.addEventListener('webglcontextlost', this.onLost);
      canvas.addEventListener('webglcontextrestored', this.onRestored);
    } else {
      this.renderer = null;
      this.controls = null;
      this.fallback = canvas.getContext('2d');
      if (!this.fallback) throw new Error('Neither WebGL 2 nor Canvas 2D is available');
      this.fallback.imageSmoothingEnabled = false;
      console.warn('WebGL 2 unavailable; using the Canvas 2D display fallback.');
    }
  }

  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
  };

  get supports3D(): boolean {
    return this.renderer !== null;
  }

  private readonly onRestored = (): void => {
    this.lost = false;
    this.dirty = true;
    this.map.changed();
  };

  /** Present after all drawing for a browser frame, including menus and effects. */
  present(presentation: Presentation): void {
    this.map.animate(performance.now(), presentation.mapVisible && (presentation.mapAnimated ?? presentation.mapInteractive));
    const key = JSON.stringify(presentation);
    if (key !== this.presentationKey) {
      this.presentationKey = key;
      this.sceneDirty = true;
    }
    this.controls?.setActive(
      presentation.mapInteractive && !this.lost,
      (presentation.toolbarVisible ?? presentation.mapInteractive) && !this.lost,
    );
    if ((!this.dirty && !this.sceneDirty) || this.lost || this.disposed) return;
    if (this.renderer) {
      if (this.dirty) this.texture.needsUpdate = true;
      const { width, height } = this.canvas;
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setScissorTest(false);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      if (presentation.mapVisible) {
        this.renderer.shadowMap.enabled = this.map.modelShadows;
        const r = this.map.rect;
        this.renderer.setViewport(r.x, height - r.y - r.h, r.w, r.h);
        this.renderer.setScissor(r.x, height - r.y - r.h, r.w, r.h);
        this.renderer.setScissorTest(true);
        this.renderer.clear();
        this.map.prepareSight();
        this.renderer.render(this.map.scene, this.map.camera);
        // Menus and their hints stay in screen space over the transformed map.
        this.renderer.setViewport(0, 0, width, height);
        for (const cover of presentation.covers) {
          this.renderer.setScissor(cover.x, height - cover.y - cover.h, cover.w, cover.h);
          this.renderer.render(this.scene, this.camera);
        }
        this.renderer.setScissorTest(false);
      }
    } else {
      this.fallback!.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.fallback!.drawImage(this.surface, 0, 0);
    }
    this.dirty = false;
    this.sceneDirty = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.controls?.dispose();
    this.map.dispose();
    this.renderer?.dispose();
  }
}
