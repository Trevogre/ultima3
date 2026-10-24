import { describe, expect, it, vi } from 'vitest';
import { buildSightRegion, sightArea, sightTile } from '../src/game/sightPolygon.ts';
import { clipSightShader, SightClip } from '../src/ui/sightClip.ts';
import { buildViewport } from '../src/game/viewport.ts';
import { townSightActors } from '../src/ui/modelActors.ts';
import { MapValue, Shape } from '../src/game/tiles.ts';
import { Location } from '../src/game/party.ts';
import { newWorld } from './helpers.ts';
import { BoxGeometry, Mesh, MeshBasicMaterial, Scene, ShaderLib } from 'three';

describe('continuous sight boundary', () => {
  it('retains partially visible tiles instead of making a square staircase', () => {
    const r = buildSightRegion(12, 2, 2, (x, y) => x === 5 && y === 4);
    expect(sightArea(sightTile(r.polygon, 6, 4))).toBeCloseTo(0.2142857, 5);
    expect(r.visible[4 * 12 + 6]).toBe(1);
    expect(sightArea(sightTile(r.polygon, 6, 5))).toBeLessThan(1e-6);
    expect(r.visible[5 * 12 + 6]).toBe(0);
    expect(r.surfaces).toEqual([4 * 12 + 5]);
  });
  it('covers open maps, stops at closed doors and recalculates when they open', () => {
    const closed = buildSightRegion(16, 3, 8, (x, y) => y !== 8 || x === 7);
    expect(closed.visible[8 * 16 + 12]).toBe(0);
    const open = buildSightRegion(16, 3, 8, (_, y) => y !== 8);
    expect(open.visible[8 * 16 + 12]).toBe(1);
    const empty = buildSightRegion(16, 3, 8, () => false);
    expect(empty.visible.every(Boolean)).toBe(true);
    expect(sightArea(empty.polygon)).toBeCloseTo(256);
  });
  it('does not see through touching diagonal blockers or reveal a hidden room', () => {
    const region = buildSightRegion(10, 3, 3, (x, y) => (x === 4 && y === 3) || (x === 3 && y === 4));
    expect(region.visible[4 * 10 + 4]).toBe(0);
    expect(sightArea(sightTile(region.polygon, 4, 4))).toBeLessThan(1e-8);
  });
  it('admits the visible portion of an NPC whose centre is occluded, and rejects fully hidden actors', () => {
    const world = newWorld();
    world.enterMap(402);
    world.party.location = Location.Town;
    world.current.tiles.fill(MapValue.Floor);
    world.monsters.bytes.fill(0);
    world.x = 2;
    world.y = 2;
    world.townSightlines = true;
    world.putXYVal(MapValue.Wall, 5, 4);
    for (const [i, x, y] of [
      [0, 6, 4],
      [1, 6, 5],
    ]) {
      world.monsters.setType(i, MapValue.Guard);
      world.monsters.setPosition(i, x, y);
      world.monsters.setTileUnder(i, MapValue.Floor);
      world.putXYVal(MapValue.Guard, x, y);
    }
    const view = buildViewport(world),
      actors = townSightActors(world, view)!;
    expect(view.townSight!.cells[4 * 64 + 6].overlay).toBe(MapValue.Guard >> 1);
    expect(view.townSight!.cells[5 * 64 + 6].base).toBe(Shape.Void);
    expect(actors.some((a) => a.id === 'monster:0')).toBe(true);
    expect(actors.some((a) => a.id === 'monster:1')).toBe(false);
    expect(sightArea(sightTile(view.sightRegion!.polygon, 6, 4))).toBeLessThan(1);
    world.townSightlines = false;
    expect(buildViewport(world).sightRegion).toBeUndefined();
  });
  it('clips final instanced, skinned and custom projected shadow geometry in world coordinates', () => {
    for (const shader of [ShaderLib.basic, ShaderLib.lambert, ShaderLib.depth]) {
      const [vertex, fragment] = clipSightShader(shader.vertexShader, shader.fragmentShader);
      expect(vertex).toContain('vec4 sightPoint=vec4(transformed,1.0)');
      expect(vertex).toContain('sightPoint=instanceMatrix*sightPoint');
      expect(vertex).toContain('sightPosition=(modelMatrix*sightPoint).xy');
      expect(fragment).toContain('if(sightCoverage<0.01) discard');
    }
    const [vertex] = clipSightShader(
      'varying vec2 groundPosition; void main(){groundPosition=vec2(0.0);gl_Position=vec4(0.0);}',
      'void main(){gl_FragColor=vec4(1.0);}',
    );
    expect(vertex).toContain('vec4(groundPosition,0.004,1.0)');
    expect(vertex).not.toContain('instanceMatrix');
    const [, depth] = clipSightShader(ShaderLib.depth.vertexShader, ShaderLib.depth.fragmentShader, true);
    expect(depth).not.toContain('gl_FragColor.rgb*=');
  });
  it('shares a mask across materials, keeps shader variants distinct, and disables cleanly', () => {
    const ctx = { fillRect: vi.fn(), beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {} };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
    try {
      const clip = new SightClip(),
        scene = new Scene();
      const a = new MeshBasicMaterial(),
        b = new MeshBasicMaterial();
      a.customProgramCacheKey = () => 'variant-a';
      b.customProgramCacheKey = () => 'variant-b';
      const mesh = new Mesh(new BoxGeometry(), [a, b]);
      mesh.castShadow = true;
      scene.add(mesh);
      clip.apply(scene);
      expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
      expect(mesh.customDepthMaterial).toBeDefined();
      const region = buildSightRegion(8, 3, 4, () => false);
      clip.set(region);
      expect(clip.grid.value.toArray()).toEqual([-3.5, -3.5, 8, 1]);
      const writes = ctx.fillRect.mock.calls.length;
      clip.set(region);
      expect(ctx.fillRect).toHaveBeenCalledTimes(writes);
      clip.set();
      expect(clip.grid.value.w).toBe(0);
      clip.dispose();
      mesh.geometry.dispose();
      a.dispose();
      b.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
