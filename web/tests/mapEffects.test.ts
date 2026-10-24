import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshBasicMaterial, CanvasTexture, LinearMipmapLinearFilter, NearestFilter } from 'three';
import { DEFAULT_3D_SETTINGS, read3DSettings, presentationPreset } from '../src/ui/view3DSettings.ts';
import { fogEdges, FogEdges } from '../src/ui/fogEdges.ts';
import { WaterSurface } from '../src/ui/waterSurface.ts';
import { addZoomFiltering } from '../src/ui/zoomFiltering.ts';
import { Shape } from '../src/game/tiles.ts';
import type { GraphicsSet } from '../src/ui/graphics.ts';

afterEach(() => vi.unstubAllGlobals());

function fakeDocument() {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 64, height: 64, getContext: () => ({ imageSmoothingEnabled: false, clearRect() {} }) }),
  });
}

describe('optional map effects', () => {
  it('migrates filtering, preserves Off choices, and derives Custom for overrides', () => {
    expect(read3DSettings({})).toMatchObject({
      zoomFiltering: 'Auto',
      softFog: true,
      terrainShading: true,
      waterHighlights: true,
      alphaWater: false,
    });
    expect(read3DSettings({ zoomFiltering: 'bad', softFog: 0 })).toEqual(DEFAULT_3D_SETTINGS);
    expect(
      read3DSettings({ zoomFiltering: 'Crisp', softFog: false, terrainShading: false, waterHighlights: false, alphaWater: true }),
    ).toMatchObject({ zoomFiltering: 'Crisp', softFog: false, terrainShading: false, waterHighlights: false, alphaWater: true });
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, alphaWater: true })).toBe('Custom');
  });
  it('fades only known tile boundaries, respects wrapping, and has no hidden geometry', () => {
    const shapes = [Shape.Grass, Shape.Void, Shape.Void, Shape.Water];
    expect(fogEdges(shapes, 2, 0, false)).toEqual([1, 1, 1, 1]);
    expect(fogEdges(shapes, 2, 1, false)).toEqual([0, 0, 0, 0]);
    expect(fogEdges([Shape.Grass, Shape.Grass, Shape.Grass, Shape.Grass], 2, 0, true)).toEqual([0, 0, 0, 0]);
    const fog = new FogEdges();
    fog.set(
      null,
      shapes.map((base) => ({ base })),
      true,
      true,
    );
    expect(fog.mesh.count).toBe(2);
    expect(fog.material.depthTest).toBe(true);
    expect(fog.material.depthWrite).toBe(false);
    fog.set(
      null,
      shapes.map((base) => ({ base })),
      false,
      true,
    );
    expect(fog.mesh.count).toBe(0);
    fog.dispose();
  });
  it('switches filtering without changing artwork and isolates shader programs for alpha cutouts', () => {
    const texture = new CanvasTexture({ width: 1024, height: 1024 } as HTMLCanvasElement);
    const material = new MeshBasicMaterial({ map: texture });
    const filter = addZoomFiltering(material, texture, 16, 16);
    filter('Stable');
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(LinearMipmapLinearFilter);
    filter('Crisp');
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(NearestFilter);
    const cutout = new MeshBasicMaterial({ map: texture });
    addZoomFiltering(cutout, texture, 16, 16, true);
    expect(cutout.customProgramCacheKey()).not.toBe(material.customProgramCacheKey());
    cutout.dispose();
    texture.dispose();
    material.dispose();
  });
  it('uses only filtered water and lets submerged opaque shores show through when enabled', () => {
    fakeDocument();
    const water = new WaterSurface({ value: false });
    const drawShape = vi.fn();
    const gfx = { drawShape } as unknown as GraphicsSet;
    const cells = [Shape.Water, Shape.Void, Shape.Grass, Shape.Void].map((base) => ({ base }));
    water.set(null, cells, gfx, { ...DEFAULT_3D_SETTINGS, alphaWater: true });
    expect(water.mesh.count).toBe(1);
    expect(water.material.opacity).toBeCloseTo(0.62);
    expect(water.material.depthWrite).toBe(false);
    expect(water.material.depthTest).toBe(true);
    expect(drawShape).toHaveBeenCalledWith(expect.anything(), Shape.Water, 0, 0, 64);
    water.set(null, cells, gfx, { ...DEFAULT_3D_SETTINGS, alphaWater: false, waterHighlights: false });
    expect(water.material.opacity).toBe(1);
    expect(water.highlights.value).toBe(0);
    water.dispose();
  });
});
