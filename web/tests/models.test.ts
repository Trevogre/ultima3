import { describe, expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { modelGeometry } from '../src/ui/modelAssets.ts';
import { ModelHeadings, modelActors, type ModelActor } from '../src/ui/modelActors.ts';
import { ModelScene } from '../src/ui/modelScene.ts';
import { applyPresentationPreset, DEFAULT_3D_SETTINGS, presentationPreset, read3DSettings } from '../src/ui/view3DSettings.ts';
import { Shape, MapValue } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { newWorld, savedCopy } from './helpers.ts';

const actor: ModelActor = { id: 'party', shape: 136, x: 0, y: 0, worldX: 63, worldY: 10, size: 1, ground: Shape.Grass };

describe('separate low-poly presentation', () => {
  it('migrates to cards, remembers models and preserves Classic / Depth transitions', () => {
    expect(read3DSettings({}).renderStyle).toBe('Cards');
    expect(read3DSettings({ renderStyle: 'invalid' }).renderStyle).toBe('Cards');
    expect(read3DSettings({ renderStyle: 'Models' }).renderStyle).toBe('Models');
    const models = applyPresentationPreset({ ...DEFAULT_3D_SETTINGS, fixedRotation: 120, fixedAngle: 30 }, 'Models');
    expect(models).toMatchObject({ renderStyle: 'Models', enabled: true, fixedRotation: 120, fixedAngle: 30 });
    expect(presentationPreset(models)).toBe('Models');
    const classic = applyPresentationPreset(models, 'Classic');
    expect(classic.renderStyle).toBe('Models');
    expect(presentationPreset(classic)).toBe('Classic');
    const depth = applyPresentationPreset(classic, 'Depth');
    expect(depth.renderStyle).toBe('Cards');
    expect(presentationPreset(depth)).toBe('Depth');
  });

  it('builds actual bounded 3D geometry for scenery, figures and creature families', () => {
    for (const shape of [
      Shape.Forest,
      Shape.Brush,
      Shape.Mountains,
      Shape.Town,
      Shape.Castle,
      Shape.Dungeon,
      Shape.Horse,
      Shape.Frigate,
      Shape.Wall,
      136,
      140,
      48,
      50,
      58,
      184,
    ]) {
      const geometry = modelGeometry(shape);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new Vector3());
      expect(size.x).toBeGreaterThan(0.1);
      expect(size.y).toBeGreaterThan(0.1);
      expect(size.z).toBeGreaterThan(0.1);
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
      geometry.dispose();
    }
  });

  it('retains heading across redraws, follows map-seam movement and resets on map changes', () => {
    const headings = new ModelHeadings();
    headings.begin('surface');
    expect(headings.heading(actor, 64, true)).toBe(0);
    const east = { ...actor, worldX: 0 };
    expect(headings.heading(east, 64, true)).toBeCloseTo(Math.PI / 2);
    expect(headings.heading(east, 64, true)).toBeCloseTo(Math.PI / 2);
    // A teleport is not a walk; do not infer a new heading from it.
    expect(headings.heading({ ...east, worldX: 20 }, 64, true)).toBeCloseTo(Math.PI / 2);
    expect(headings.heading({ ...east, worldX: 20, worldY: 9 }, 64, true)).toBeCloseTo(Math.PI);
    headings.begin('town');
    expect(headings.heading(east, 64, false)).toBe(0);
  });

  it('selects living visible party members and actors without changing game or exploration state', () => {
    const world = newWorld();
    world.current.tiles.fill(MapValue.Grass);
    world.monsters.bytes.fill(0);
    world.x = 32;
    world.y = 32;
    world.putXYVal(MapValue.Mountains, 32, 31);
    world.monsters.setType(0, MapValue.Orc);
    world.monsters.setTileUnder(0, MapValue.Grass);
    world.monsters.setPosition(0, 32, 30);
    world.putXYVal(MapValue.Orc, 32, 30);
    world.member(1).status = 'D';
    const before = savedCopy(world),
      view = buildViewport(world);
    const actors = modelActors(world, view, 'grid');
    expect(actors.some((a) => a.id === 'monster:0')).toBe(false);
    expect(actors.some((a) => a.id === 'member:1')).toBe(false);
    expect(actors.filter((a) => a.id.startsWith('member:'))).toHaveLength(3);
    expect(actors.filter((a) => a.id.startsWith('member:')).every((a) => a.size === 0.5)).toBe(true);
    expect(savedCopy(world)).toEqual(before);
  });

  it('batches filtered scenery, recesses water, clears stale actors and uses physical sun shadows', () => {
    const scene = new ModelScene();
    const gfx = {} as GraphicsSet;
    scene.setLandscape(null, [{ base: Shape.Void }, { base: Shape.Forest }, { base: Shape.Water }, { base: Shape.Grass }], gfx, true);
    const batches = () => scene.group.children.filter((c): c is InstancedMesh => c instanceof InstancedMesh);
    expect(batches().map((b) => b.count)).toEqual([3, 1, 1]); // ground, opaque unknown, forest
    const matrix = new Matrix4();
    batches()[0].getMatrixAt(1, matrix);
    expect(new Vector3(0, 0, 0.5).applyMatrix4(matrix).z).toBeCloseTo(-0.22);
    scene.setActors([actor], 'surface', 64, true);
    expect(batches().at(-1)!.count).toBe(1);
    scene.setActors([], 'surface', 64, true);
    expect(batches().at(-1)!.count).toBe(0);
    scene.setSun(3, 12, true);
    const morning = scene.sun.position.x;
    expect(scene.shadowEnabled).toBe(true);
    scene.setSun(5, 12, true);
    expect(scene.sun.position.x * morning).toBeLessThan(0);
    scene.setSun(0, 12, true);
    expect(scene.shadowEnabled).toBe(false);
    scene.setSun(4, 12, false);
    expect(scene.shadowEnabled).toBe(false);
    scene.setLandscape(null, [{ base: Shape.Void }], gfx, true);
    expect(batches().every((b) => b === batches()[1] || b.count === 0)).toBe(true);
    scene.dispose();
  });
});
