import { describe, expect, it, vi } from 'vitest';
import { TileMapScene } from '../src/ui/tileMapScene.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { Matrix4, MeshBasicMaterial } from 'three';
import { Shape } from '../src/game/tiles.ts';
import { MOUNTAIN_STEPS, terrainElevation, isCoastalLand, shorelineTexture, shorelineUsesBackground } from '../src/ui/terrainDepth.ts';
import { TerrainCubes } from '../src/ui/terrainCubes.ts';
import { Shoreline } from '../src/ui/shoreline.ts';
import { applyPresentationPreset, DEFAULT_3D_SETTINGS, read3DSettings } from '../src/ui/view3DSettings.ts';
import { newWorld } from './helpers.ts';
import { MapValue } from '../src/game/tiles.ts';
import { Location } from '../src/game/party.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { buildLandscape } from '../src/game/landscape.ts';

describe('optional terrain depth', () => {
  it('loads the selected counter texture for letter sides even without visible plain counters or lowered water', () => {
    const ctx = new Proxy(
      { getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4) }) },
      { get: (obj, key) => (Reflect.get(obj, key) as unknown) ?? (() => {}) },
    );
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    const map = new TileMapScene(16, 3, () => {}),
      drawShape = vi.fn();
    try {
      map.setOptions({ ...DEFAULT_3D_SETTINGS, buildings: false, recessedWater: false });
      const cells = Array.from({ length: 9 }, (_, i) => ({ base: i === 4 ? MapValue.LetterA / 2 : Shape.Floor }));
      map.setLandscape(null, { drawShape } as unknown as GraphicsSet, cells);
      expect(drawShape.mock.calls.some((call) => call[1] === Shape.Wall + 4)).toBe(true);
    } finally {
      map.dispose();
      vi.unstubAllGlobals();
    }
  });
  it('stacks mountain tiers within one tile using the original atlas tile on each tier', () => {
    const material = new MeshBasicMaterial();
    const cubes = new TerrainCubes(material);
    const cells = [{ base: Shape.Mountains }];
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, steppedMountains: true });
    expect(cubes.mesh.count).toBe(3);
    const matrix = new Matrix4();
    MOUNTAIN_STEPS.forEach((step, i) => {
      cubes.mesh.getMatrixAt(i, matrix);
      expect(matrix.elements[0]).toBeCloseTo(step.width);
      expect(matrix.elements[5]).toBeCloseTo(step.width);
      expect(matrix.elements[10]).toBeCloseTo(step.height);
      expect(matrix.elements[14]).toBeCloseTo(step.base);
      expect([cubes.slots.getX(i), cubes.slots.getY(i)]).toEqual([Shape.Mountains, 15]);
    });
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, steppedMountains: false });
    expect(cubes.mesh.count).toBe(1);
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, mountains: false });
    expect(cubes.mesh.count).toBe(0);
    cubes.dispose();
    material.dispose();
  });

  it('lowers only water and restores original heights when disabled', () => {
    expect(terrainElevation(Shape.Water, true)).toBe(-0.2);
    expect(terrainElevation(Shape.Water, false)).toBe(0);
    for (const shape of [Shape.Void, Shape.Grass, Shape.Floor, Shape.Lava, Shape.MoonGate]) expect(terrainElevation(shape, true)).toBe(0);
  });

  it('creates shoreline sides only next to known water, with correct wrapping', () => {
    const shapes = [Shape.Grass, Shape.Void, Shape.Water, Shape.Void, Shape.Void, Shape.Void, Shape.Void, Shape.Void, Shape.Void];
    expect(isCoastalLand(shapes, 3, 0, false)).toBe(false);
    expect(isCoastalLand(shapes, 3, 0, true)).toBe(true);
    expect(isCoastalLand(shapes, 3, 1, false)).toBe(false);
    expect(isCoastalLand(shapes, 3, 2, true)).toBe(false);
    const material = new MeshBasicMaterial();
    const shore = new Shoreline(material);
    const cells = [Shape.Grass, Shape.Water, Shape.Void, Shape.Void].map((base) => ({ base }));
    shore.set(null, cells, true);
    expect(shore.mesh.count).toBe(1);
    expect([shore.slots.getX(0), shore.slots.getY(0)]).toEqual([Shape.Grass, 15]);
    shore.geometry.computeBoundingBox();
    expect(shore.geometry.boundingBox!.min.z).toBeCloseTo(-1);
    expect(shore.geometry.boundingBox!.max.z).toBeCloseTo(0);
    expect(shore.geometry.drawRange).toEqual({ start: 0, count: 24 });
    const positions = shore.geometry.getAttribute('position');
    const uv = shore.geometry.getAttribute('uv');
    for (let i = 0; i < 16; i++) expect(uv.getY(i)).toBeCloseTo(positions.getZ(i) + 1);
    const forestCells = [Shape.Forest, Shape.Water, Shape.Brush, Shape.Water].map((base) => ({ base }));
    shore.set(null, forestCells, true);
    expect(shore.mesh.count).toBe(2);
    for (let i = 0; i < shore.mesh.count; i++) expect([shore.slots.getX(i), shore.slots.getY(i)]).toEqual([Shape.Grass, 15]);
    const signs = [MapValue.LetterA / 2, Shape.Water, Shape.Door, Shape.Water].map((base) => ({ base }));
    shore.set(null, signs, true);
    expect(shore.mesh.count).toBe(2);
    expect(shore.backgrounds.getX(0)).toBe(1);
    expect([shore.slots.getX(0), shore.slots.getY(0)]).toEqual([(Shape.Wall + 4) % 16, 15 - Math.floor((Shape.Wall + 4) / 16)]);
    expect(shorelineTexture(MapValue.LetterA / 2)).toBe(Shape.Wall + 4);
    expect(shore.backgrounds.getX(1)).toBe(0);
    expect(shorelineUsesBackground(MapValue.LetterT / 2)).toBe(true);
    expect(shorelineUsesBackground(Shape.Grass)).toBe(false);
    shore.set(null, cells, false);
    expect(shore.mesh.count).toBe(0);
    shore.dispose();
    material.dispose();
  });

  it('preserves explicit Off preferences and uses cube mountains and recessed water with Depth', () => {
    const off = read3DSettings({ steppedMountains: false, recessedWater: false });
    expect(off).toMatchObject({ steppedMountains: false, recessedWater: false });
    expect(applyPresentationPreset(off, 'Depth')).toMatchObject({ steppedMountains: false, recessedWater: true });
    expect(read3DSettings({})).toMatchObject({ steppedMountains: false, recessedWater: true });
  });

  it('does not derive shorelines from water hidden behind town walls in either terrain mode', () => {
    const world = newWorld();
    world.enterMap(402);
    world.party.location = Location.Town;
    world.current.tiles.fill(MapValue.Floor);
    world.monsters.bytes.fill(0);
    world.x = world.y = 32;
    for (let y = 0; y < 64; y++) {
      world.putXYVal(MapValue.Wall, 33, y);
      world.putXYVal(MapValue.Water, 34, y);
    }
    const view = buildViewport(world);
    const material = new MeshBasicMaterial();
    const shore = new Shoreline(material);
    for (const landscape of [null, buildLandscape(world, view)]) {
      shore.set(landscape, view.cells, true);
      expect(shore.mesh.count).toBe(0);
    }
    shore.dispose();
    material.dispose();
  });
});
