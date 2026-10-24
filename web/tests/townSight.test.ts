import { afterEach, describe, expect, it, vi } from 'vitest';
import { townSightMask } from '../src/game/townSight.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { buildLandscape } from '../src/game/landscape.ts';
import { recordView } from '../src/game/automap.ts';
import { Location } from '../src/game/party.ts';
import { MapValue, Shape } from '../src/game/tiles.ts';
import { newWorld } from './helpers.ts';
import { read3DSettings, DEFAULT_3D_SETTINGS, applyPresentationPreset } from '../src/ui/view3DSettings.ts';
import { townSightActors } from '../src/ui/modelActors.ts';
import { TownSightFigures } from '../src/ui/townSightFigures.ts';
import { OrthographicCamera } from 'three';
import type { GraphicsSet } from '../src/ui/graphics.ts';

afterEach(() => vi.unstubAllGlobals());
function town(location: number = Location.Town) {
  const w = newWorld();
  w.enterMap(location === Location.Castle ? 400 : 402);
  w.party.location = location;
  w.current.tiles.fill(MapValue.Wall);
  w.monsters.bytes.fill(0);
  w.x = 10;
  w.y = 20;
  return w;
}
describe('optional town sightlines', () => {
  it('migrates to Classic, remembers the option and preserves it across presentation presets', () => {
    expect(read3DSettings({}).townSightlines).toBe(false);
    expect(read3DSettings({ townSightlines: 'yes' }).townSightlines).toBe(false);
    const options = { ...DEFAULT_3D_SETTINGS, townSightlines: true };
    for (const preset of ['Classic', 'Depth', 'Models'] as const)
      expect(applyPresentationPreset(options, preset).townSightlines).toBe(true);
  });
  it.each([Location.Town, Location.Castle])('sees an unobstructed oblique hall and restores Classic exactly in location %s', (location) => {
    const w = town(location);
    for (const [x, y] of [
      [10, 20],
      [11, 20],
      [11, 21],
      [12, 21],
      [13, 21],
      [13, 22],
      [14, 22],
    ])
      w.putXYVal(MapValue.Floor, x, y);
    const original = buildViewport(w),
      index = (22 - original.originY) * 11 + 14 - original.originX;
    expect(original.cells[index].base).toBe(Shape.Void);
    const bytes = w.current.tiles.slice();
    w.townSightlines = true;
    expect(buildViewport(w).cells[index].base).toBe(Shape.Floor);
    expect(w.current.tiles).toEqual(bytes);
    w.townSightlines = false;
    expect(buildViewport(w)).toEqual(original);
  });
  it('sees down a long hall, including NPCs beyond the old window, but not beyond a closed door or around a bend', () => {
    const w = town();
    for (let x = 8; x <= 40; x++) w.putXYVal(MapValue.Floor, x, 20);
    for (let y = 10; y < 20; y++) w.putXYVal(MapValue.Floor, 40, y);
    w.townSightlines = true;
    w.monsters.setType(0, MapValue.Guard);
    w.monsters.setPosition(0, 30, 20);
    w.monsters.setTileUnder(0, MapValue.Floor);
    w.putXYVal(MapValue.Guard, 30, 20);
    let view = buildViewport(w),
      wide = view.townSight!;
    expect(wide.cells[20 * 64 + 30].overlay).toBe(MapValue.Guard >> 1);
    expect(wide.cells[19 * 64 + 35].base).toBe(Shape.Wall);
    expect(townSightActors(w, view)?.find((a) => a.id === 'monster:0')).toMatchObject({ x: 20, y: 0, worldX: 30, worldY: 20 });
    expect(wide.cells[12 * 64 + 40].base).toBe(Shape.Void);
    expect(buildLandscape(w, view).shapes[20 * 64 + 35]).toBe(Shape.Floor);
    w.putXYVal(MapValue.LetterI, 20, 20);
    view = buildViewport(w);
    wide = view.townSight!;
    expect(wide.cells[20 * 64 + 20].overlay).toBe(Shape.Door);
    expect(wide.cells[20 * 64 + 21].base).toBe(Shape.Void);
    expect(townSightActors(w, view)?.find((a) => a.id === 'monster:0')).toBeUndefined();
    expect(buildLandscape(w, view).shapes[20 * 64 + 30]).toBe(Shape.Void);
  });
  it('records actual distant sight on the map, keeps hidden rooms hidden after walking away and never wraps town edges', () => {
    const w = town();
    for (let x = 1; x < 50; x++) w.putXYVal(MapValue.Floor, x, 20);
    w.townSightlines = true;
    recordView(w, buildViewport(w));
    expect(w.autoMap.squareSeen(w.current.id, 35, 20)).toBe(true);
    expect(w.autoMap.squareSeen(w.current.id, 35, 22)).toBe(false);
    w.putXYVal(MapValue.Wall, 15, 20);
    expect(buildLandscape(w, buildViewport(w)).shapes[20 * 64 + 35]).toBe(Shape.Void);
    w.x = 1;
    expect(buildViewport(w).cells[0].base).toBe(Shape.Void);
  });
  it('sees over low counters and sign barriers while forest and mountains stop sight', () => {
    const w = town();
    for (let x = 8; x <= 35; x++) w.putXYVal(MapValue.Floor, x, 20);
    w.putXYVal(MapValue.Wall2, 15, 20);
    w.putXYVal(MapValue.LetterA, 16, 20);
    w.townSightlines = true;
    expect(buildViewport(w).townSight!.cells[20 * 64 + 25].base).toBe(Shape.Floor);
    for (const obstacle of [MapValue.Forest, MapValue.Mountains]) {
      w.putXYVal(obstacle, 18, 20);
      expect(buildViewport(w).townSight!.cells[20 * 64 + 25].base).toBe(Shape.Void);
    }
  });
  it('does not change overworld visibility when enabled', () => {
    const w = newWorld(),
      before = buildViewport(w);
    w.townSightlines = true;
    expect(buildViewport(w)).toEqual(before);
  });
  it('shows opaque faces but blocks walls and diagonal corner leaks symmetrically', () => {
    const blocked = (x: number, y: number) => x === 3 || y === 3;
    const mask = townSightMask(8, 1, 1, blocked);
    expect(mask[1 * 8 + 3]).toBe(1);
    expect(mask[1 * 8 + 4]).toBe(0);
    expect(mask[4 * 8 + 4]).toBe(0);
    const corner = townSightMask(5, 1, 1, (x, y) => x === 2 && y === 1);
    expect(corner[2 * 5 + 2]).toBe(0);
    const open = townSightMask(8, 4, 4, () => false);
    expect(open.every((v) => v === 1)).toBe(true);
  });
  it('removes hidden distant figures immediately and depth-tests admitted cards', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {} }) }) });
    const figures = new TownSightFigures({ value: false }),
      gfx = { drawShape() {} } as unknown as GraphicsSet;
    const actor = { id: 'monster:0', shape: MapValue.Guard >> 1, x: 12, y: 0, worldX: 22, worldY: 20, size: 1, ground: Shape.Floor };
    figures.set([actor], gfx, DEFAULT_3D_SETTINGS, Math.PI / 4);
    expect(figures.group.children).toHaveLength(1);
    const camera = new OrthographicCamera(-5, 5, 5, -5, 0.1, 500);
    camera.position.set(0, -10, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    figures.face(camera, Math.PI / 4, DEFAULT_3D_SETTINGS, new Set());
    expect(figures.group.children[0].position.z).toBeGreaterThan(0);
    figures.set([], gfx, DEFAULT_3D_SETTINGS, Math.PI / 4);
    expect(figures.group.children).toHaveLength(0);
    figures.dispose();
  });
});
