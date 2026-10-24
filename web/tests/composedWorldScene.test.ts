import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  InstancedMesh,
  Color,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  ShaderLib,
  type Material,
  type WebGLRenderer,
  Vector3,
} from 'three';
import { environmentFromGLTF } from '../src/ui/atelierEnvironment.ts';
import { ComposedWorldScene } from '../src/ui/composedWorldScene.ts';
import { composeWorld } from '../src/game/worldComposition.ts';
import { composedGround, composedHeight } from '../src/ui/composedGround.ts';
import { readWorldCompositionOverrides } from '../src/game/worldCompositionOverrides.ts';
import { DEFAULT_3D_SETTINGS, applyPresentationPreset, read3DSettings } from '../src/ui/view3DSettings.ts';
import { ModelScene } from '../src/ui/modelScene.ts';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { localLandscape, type Landscape } from '../src/game/landscape.ts';

async function library() {
  const bytes = readFileSync(new URL('../public/models/atelier/environment.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return environmentFromGLTF(gltf);
}
function camera() {
  const c = new OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  c.up.set(0, 1, 0);
  c.position.set(0, 0, 20);
  c.lookAt(0, 0, 0);
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}

describe('authored composed scenery', () => {
  it('loads every mesh from the real GLB, with grounded origins, colour, and lighter distant variants', async () => {
    const assets = await library();
    expect(assets.size).toBe(33);
    for (const [name, g] of assets) {
      expect(g.boundingBox!.min.z).toBeCloseTo(0);
      expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      if (name.startsWith('tree-') && !name.endsWith('-lod')) {
        const low = assets.get(name + '-lod')!;
        expect(low.index?.count ?? low.getAttribute('position').count).toBeLessThan(
          (g.index?.count ?? g.getAttribute('position').count) * 0.25,
        );
        expect(g.boundingBox!.max.z).toBeGreaterThan(1.5);
      }
      if (name.startsWith('rock-')) expect(Array.from(g.getAttribute('composedWind').array).every((n) => n === 0)).toBe(true);
    }
  });
  it('migrates the former composed layout into the third set and preserves it through presentation presets', () => {
    for (const value of [{}, { worldLayout: true }, { worldLayout: 'invalid' }]) expect(read3DSettings(value).modelSet).toBe('Low-poly');
    expect(read3DSettings({ worldLayout: 'Composed', modelSet: 'Van Gogh' }).modelSet).toBe('Composed');
    expect(read3DSettings({ modelSet: 'Composed', fixedAngle: 25, fixedRotation: 15 })).toMatchObject({
      modelSet: 'Composed',
      fixedAngle: 25,
      fixedRotation: 15,
    });
    expect(read3DSettings({ modelSet: 'Van Gogh', worldLayout: 'Tiled' }).modelSet).toBe('Van Gogh');
    expect(read3DSettings({ worldLayout: 'Composed' })).not.toHaveProperty('worldLayout');
    for (const preset of ['Classic', 'Depth', 'Models'] as const)
      expect(applyPresentationPreset({ ...DEFAULT_3D_SETTINGS, modelSet: 'Composed' }, preset).modelSet).toBe('Composed');
  });
  it('builds continuous upward-facing known ground, retains lava, and does not fill the unknown map', () => {
    const landscape: Landscape = {
      side: 3,
      partyX: 1,
      partyY: 1,
      wraps: false,
      shapes: Uint8Array.from([
        Shape.Void,
        Shape.Grass,
        Shape.Water,
        Shape.Void,
        Shape.Grass,
        Shape.Water,
        Shape.Void,
        Shape.Lava,
        Shape.Void,
      ]),
    };
    const { ground, water } = composedGround(composeWorld(1, landscape.shapes, 3), landscape, true);
    expect(water.getAttribute('position').count).toBe(4 * 12);
    expect(
      Array.from(ground.getAttribute('normal').array)
        .filter((_, i) => i % 3 === 2)
        .every((n) => n > 0),
    ).toBe(true);
    const p = ground.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getX(i)).toBeGreaterThanOrEqual(-0.5);
    ground.dispose();
    water.dispose();
  });
  it('keeps dry land flat and excludes water crests from land when recession is disabled', () => {
    const landscape: Landscape = { side: 3, partyX: 1, partyY: 1, wraps: false, shapes: new Uint8Array(9).fill(Shape.Grass) };
    landscape.shapes[5] = Shape.Water;
    const plan = composeWorld(1, landscape.shapes, 3);
    const { ground, water } = composedGround(plan, landscape, false);
    const wet = water.getAttribute('waterCell'),
      bed = water.getAttribute('bedHeight');
    for (let i = 0; i < wet.count; i++) if (wet.getX(i) === 0) expect(bed.getX(i)).toBe(0);
    expect(composedHeight(plan, 4, Shape.Grass, 0.49, 0, false)).toBe(0);
    expect(Array.from(wet.array).filter((n) => n === 1)).toHaveLength(12);
    ground.dispose();
    water.dispose();
  });
  it('supports buildings and half-height barriers with solid unlettered foundations', async () => {
    const scene = new ComposedWorldScene(() => {}, await library());
    const shapes = new Uint8Array(9).fill(Shape.Water);
    shapes[3] = 76;
    shapes[4] = Shape.Town;
    shapes[5] = Shape.Wall + 4;
    scene.set({ side: 3, partyX: 1, partyY: 1, wraps: false, shapes }, [], true, true, new Set());
    expect(scene.foundations.count).toBe(3);
    scene.foundations.geometry.computeBoundingBox();
    const bounds = scene.foundations.geometry.boundingBox!,
      matrix = new Matrix4();
    for (let i = 0; i < 3; i++) {
      scene.foundations.getMatrixAt(i, matrix);
      expect(bounds.max.clone().applyMatrix4(matrix).z).toBeCloseTo(0);
      expect(bounds.min.clone().applyMatrix4(matrix).z).toBeLessThan(-0.22);
    }
    expect(scene.supportHeight(0.39, 0, Shape.Grass)).toBe(0);
    const letter = new Color(),
      counter = new Color();
    scene.foundations.getColorAt(0, letter);
    scene.foundations.getColorAt(2, counter);
    expect(letter).toEqual(counter);
    expect(scene.foundations.material.map).toBeNull();
    expect(Array.from(scene.foundations.geometry.getAttribute('color').array).every((n) => n === 1)).toBe(true);
    scene.dispose();
  });
  it('renders only admitted cells, keeps placement stable on redraw and culls low-value grass at distance', async () => {
    const assets = await library(),
      scene = new ComposedWorldScene(() => {}, assets);
    const shapes = new Uint8Array(49).fill(Shape.Void);
    shapes[24] = Shape.Forest;
    shapes[25] = Shape.Grass;
    const landscape: Landscape = { mapId: 400, side: 7, partyX: 3, partyY: 3, wraps: false, shapes };
    scene.set(landscape, [], true, true, new Set());
    scene.faceCamera(camera(), 64);
    const meshes = scene.group.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh);
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(7);
    const matrices = meshes.map((m) => Array.from(m.instanceMatrix.array));
    scene.set(landscape, [], true, true, new Set());
    scene.faceCamera(camera(), 64);
    expect(meshes.map((m) => Array.from(m.instanceMatrix.array))).toEqual(matrices);
    scene.faceCamera(camera(), 5);
    const counts = scene.group.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh);
    expect(counts.filter((m) => m.name.includes('grass')).every((m) => m.count === 0)).toBe(true);
    expect(counts.filter((m) => m.name.includes('tree') && m.count > 0).every((m) => m.name.endsWith('-lod'))).toBe(true);
    scene.dispose();
  });
  it('keeps detailed meshes near a perspective camera away from the map origin', async () => {
    const assets = await library(),
      scene = new ComposedWorldScene(() => {}, assets);
    const shapes = new Uint8Array(4096).fill(Shape.Void);
    shapes[30 * 64 + 20] = Shape.Forest;
    scene.set({ side: 64, partyX: 0, partyY: 0, wraps: false, shapes }, [], true, true, new Set());
    const camera = new PerspectiveCamera(38, 1, 0.1, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(20, -35, 5);
    camera.lookAt(20, -30, 0.5);
    camera.updateProjectionMatrix();
    scene.faceCamera(camera, 64);
    const trees = scene.group.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh && m.count > 0);
    expect(trees.reduce((n, m) => n + m.count, 0)).toBe(5);
    expect(trees.every((m) => !m.name.endsWith('-lod'))).toBe(true);
    scene.dispose();
  });
  it('uses original world coordinates for local-only layouts and obeys authored exclusions/overrides', async () => {
    const assets = await library(),
      scene = new ComposedWorldScene(() => {}, assets);
    const shapes = new Uint8Array(4096).fill(Shape.Void);
    shapes[20 * 64 + 20] = Shape.Forest;
    shapes[20 * 64 + 30] = Shape.Forest;
    const landscape: Landscape = { mapId: 1, side: 64, partyX: 20, partyY: 20, wraps: true, shapes };
    scene.set(landscape, [], true, false, new Set(), { '20,20': { density: 0 } });
    scene.faceCamera(camera(), 64);
    expect(scene.group.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh).reduce((n, m) => n + m.count, 0)).toBe(0);
    scene.set(landscape, [], true, false, new Set());
    scene.faceCamera(camera(), 64);
    const active = scene.group.children.filter((m): m is InstancedMesh => m instanceof InstancedMesh && m.count > 0);
    expect(active.reduce((n, m) => n + m.count, 0)).toBe(5);
    const matrix = new Matrix4();
    for (const m of active)
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, matrix);
        expect(new Vector3().setFromMatrixPosition(matrix).length()).toBeLessThan(1);
      }
    scene.set(landscape, [], true, true, new Set([20 * 64 + 20, 20 * 64 + 30]));
    scene.faceCamera(camera(), 64);
    expect(active.every((m) => m.count === 0)).toBe(true);
    scene.dispose();
  });
  it('replaces the production model ground and old forest meshes, then restores tiled presentation', async () => {
    const assets = await library();
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) });
    const scene = new ModelScene(() => {}, assets);
    try {
      const landscape: Landscape = { side: 3, partyX: 1, partyY: 1, wraps: false, shapes: new Uint8Array(9).fill(Shape.Forest) };
      scene.setSet('Composed');
      scene.setLandscape(landscape, [], {} as GraphicsSet, true);
      scene.faceCamera(camera(), 64);
      expect(scene.group.getObjectByName('composed:tree-0')).toBeDefined();
      const composed = scene.group.children.find((g) => g.getObjectByName('composed:tree-0'))!;
      expect(composed.visible).toBe(true);
      scene.setSet('Van Gogh');
      scene.setLandscape(landscape, [], {} as GraphicsSet, true);
      expect(composed.visible).toBe(false);
    } finally {
      scene.dispose();
      vi.unstubAllGlobals();
    }
  });
  it('plants scenery and actors on the shared ground fan, including a wrapping seam', async () => {
    const assets = await library(),
      scene = new ComposedWorldScene(() => {}, assets);
    const shapes = new Uint8Array(49).fill(Shape.Void);
    shapes[24] = Shape.Grass;
    shapes[25] = Shape.Water;
    const landscape: Landscape = { side: 7, partyX: 3, partyY: 3, wraps: false, shapes };
    scene.set(landscape, [], true, true, new Set());
    scene.faceCamera(camera(), 64);
    const plan = composeWorld(0, shapes, 7);
    expect(scene.supportHeight(0, 0, Shape.Grass)).toBeCloseTo(0);
    expect(scene.supportHeight(0.39, 0, Shape.Grass)).toBeCloseTo(composedHeight(plan, 24, Shape.Grass, 0.39, 0, true));
    expect(scene.supportHeight(0.39, 0, Shape.Grass)).toBeLessThan(0);
    expect(scene.supportHeight(1, 0, Shape.Water)).toBe(-0.22);
    const reed = scene.group.children.find(
      (m): m is InstancedMesh => m instanceof InstancedMesh && m.name.includes('reed') && m.count > 0,
    )!;
    const matrix = new Matrix4();
    reed.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).z).toBeLessThan(0);
    const wrapped: Landscape = { side: 4, partyX: 0, partyY: 0, wraps: true, shapes: new Uint8Array(16).fill(Shape.Grass) };
    wrapped.shapes[12] = Shape.Water;
    wrapped.shapes[15] = Shape.Water;
    scene.set(wrapped, [], true, true, new Set());
    expect(scene.supportHeight(-0.49, 0, Shape.Grass)).toBeCloseTo(scene.supportHeight(-0.51, 0, Shape.Grass), 4);
    scene.dispose();
  });
  it('keeps the local-only limit in map coordinates and masks every distant scenery type', () => {
    const original: Landscape = { side: 64, partyX: 63, partyY: 0, wraps: true, shapes: new Uint8Array(4096).fill(Shape.Castle) };
    const local = localLandscape(original);
    expect(Array.from(local.shapes).filter((s) => s !== Shape.Void)).toHaveLength(121);
    expect(local.shapes[0]).toBe(Shape.Castle);
    expect(local.shapes[20]).toBe(Shape.Void);
    expect(original.shapes[20]).toBe(Shape.Castle);
    expect(local.partyX).toBe(63);
    expect(local.side).toBe(64);
  });
  it('uploads periodic paint/wave/wind frequencies so wrapping the map does not change their phase', async () => {
    const scene = new ComposedWorldScene(() => {}, await library());
    const shapes = new Uint8Array(4096).fill(Shape.Void);
    shapes[0] = Shape.Grass;
    scene.set({ side: 64, partyX: 63, partyY: 0, wraps: true, shapes }, [], true, true, new Set());
    const shader = {
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as Parameters<Material['onBeforeCompile']>[0];
    scene.water.material.onBeforeCompile(shader, {} as WebGLRenderer);
    const frequencies = shader.uniforms.composedFrequencies.value as Float32Array;
    expect(frequencies.length).toBeGreaterThan(0);
    expect(frequencies[0]).not.toBeCloseTo(0.7, 4);
    for (const f of frequencies) expect(Math.sin(1.37 * f)).toBeCloseTo(Math.sin((1.37 + 64) * f), 3);
    expect(shader.vertexShader).toContain('composedFrequencies[');
    expect(shader.fragmentShader).toContain('composedFrequencies[');
    scene.dispose();
  });
  it('validates presentation overrides without admitting terrain edits, scripts or asset URLs', () => {
    const maps = readWorldCompositionOverrides({
      version: 1,
      maps: { '400': { '10,20': { variant: 99, density: -1, rotation: -1, terrain: 0, url: 'bad' }, bad: { density: 1 } }, bad: {} },
    });
    expect(maps['400']['10,20']).toEqual({ variant: 7, density: 0, rotation: Math.PI * 2 - 1 });
    expect(Object.keys(maps)).toEqual(['400']);
    expect(maps['400'].bad).toBeUndefined();
    expect(readWorldCompositionOverrides({ version: 2, maps: {} })).toEqual({});
  });
});
