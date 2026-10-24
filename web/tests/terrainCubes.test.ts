import { describe, expect, it } from 'vitest';
import { Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { TerrainCubes, terrainCubeGeometry } from '../src/ui/terrainCubes.ts';
import { DEFAULT_3D_SETTINGS } from '../src/ui/view3DSettings.ts';
import { MapValue, Shape } from '../src/game/tiles.ts';
import { buildLandscape } from '../src/game/landscape.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { Location } from '../src/game/party.ts';
import { newWorld } from './helpers.ts';

describe('terrain cubes', () => {
  it('fills one tile above ground, with upright side art and unchanged top art', () => {
    const geometry = terrainCubeGeometry();
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.toArray()).toEqual([-0.5, -0.5, 0]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([0.5, 0.5, 1]);
    const uv = geometry.getAttribute('uv');
    const plane = new PlaneGeometry(1, 1);
    const reference = plane.getAttribute('uv');
    const position = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < position.count; i++) {
      if (normals.getZ(i) !== 0) continue;
      // The top of every side texture follows world Z, not Three's default Y.
      expect(uv.getY(i)).toBe(position.getZ(i));
      const right = normals.getY(i) * position.getX(i) - normals.getX(i) * position.getY(i);
      expect(uv.getX(i)).toBe(right + 0.5);
    }
    // The +Z face matches the original flat tile's XY coordinates and UVs.
    for (let vertex = 0; vertex < 4; vertex++) {
      expect([uv.getX(16 + vertex), uv.getY(16 + vertex)]).toEqual([reference.getX(vertex), reference.getY(vertex)]);
      expect([position.getX(16 + vertex), position.getY(16 + vertex), position.getZ(16 + vertex)]).toEqual([
        plane.getAttribute('position').getX(vertex),
        plane.getAttribute('position').getY(vertex),
        1,
      ]);
    }
    geometry.dispose();
    plane.dispose();
  });

  it('toggles both wall types separately from mountains without extruding buildings or hidden cells', () => {
    const material = new MeshBasicMaterial();
    const cubes = new TerrainCubes(material);
    const cells = [
      Shape.Wall,
      MapValue.Wall2 >> 1,
      Shape.Mountains,
      Shape.Dungeon,
      Shape.Town,
      Shape.Void,
      Shape.Floor,
      Shape.Grass,
      Shape.Void,
    ].map((base) => ({ base }));
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, steppedMountains: false });
    expect(cubes.mesh.count).toBe(3);
    const matrix = new Matrix4();
    cubes.mesh.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([-1, 1, 0]);
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, walls: false, steppedMountains: false });
    expect(cubes.mesh.count).toBe(1);
    expect([cubes.slots.getX(0), cubes.slots.getY(0)]).toEqual([8, 15]);
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, mountains: false });
    expect(cubes.mesh.count).toBe(2);
    cubes.set(null, cells, { ...DEFAULT_3D_SETTINGS, mountains: false, walls: false });
    expect(cubes.mesh.count).toBe(0);
    cubes.dispose();
    material.dispose();
  });

  it('does not create cubes for walls and mountains behind the town visibility mask in either terrain mode', () => {
    const world = newWorld();
    world.enterMap(402);
    world.party.location = Location.Town;
    world.current.tiles.fill(MapValue.Floor);
    world.monsters.bytes.fill(0);
    world.x = world.y = 32;
    for (let y = 0; y < 64; y++) world.putXYVal(MapValue.Wall, 33, y);
    world.putXYVal(MapValue.Mountains, 34, 32);
    world.putXYVal(MapValue.Wall2, 40, 32);
    const view = buildViewport(world);
    const material = new MeshBasicMaterial();
    const cubes = new TerrainCubes(material);
    const expected = view.cells.filter((cell) => cell.base === Shape.Wall).length;
    expect(expected).toBeGreaterThan(0);
    for (const landscape of [null, buildLandscape(world, view)]) {
      cubes.set(landscape, view.cells, DEFAULT_3D_SETTINGS);
      expect(cubes.mesh.count).toBe(expected);
      for (let i = 0; i < cubes.mesh.count; i++) expect(cubes.slots.getX(i)).toBe(Shape.Wall % 16);
    }
    cubes.dispose();
    material.dispose();
  });
});
