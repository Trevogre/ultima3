import { describe, expect, it } from 'vitest';
import { Matrix4, MeshBasicMaterial } from 'three';
import { castsContactShadow, ContactShadows, shadowPixels } from '../src/ui/contactShadows.ts';
import { Shape } from '../src/game/tiles.ts';

describe('contact shadows', () => {
  it('allows land actors but excludes empty cells, effects, terrain and waterborne sprites', () => {
    for (const shape of [Shape.Chest, Shape.Horse, Shape.Ranger, 0x20, 0x30, 0x80, 0x9c, 0xa0, 0xbe])
      expect(castsContactShadow(shape, Shape.Grass)).toBe(true);
    for (const shape of [
      Shape.Void,
      Shape.Forest,
      Shape.Whirlpool,
      Shape.Frigate,
      Shape.Pirate,
      Shape.Serpent,
      Shape.ManOWar,
      Shape.MagicBall,
      Shape.FireBall,
      Shape.Door,
    ])
      expect(castsContactShadow(shape, Shape.Grass)).toBe(false);
    expect(castsContactShadow(Shape.Ranger, Shape.Water)).toBe(false);
    expect(castsContactShadow(Shape.Ranger, Shape.Void)).toBe(false);
  });

  it('uses neutral procedural pixels fading to transparency, capped at 40 percent opacity', () => {
    const pixels = shadowPixels();
    expect(pixels[3]).toBe(0);
    expect(pixels[(32 * 64 + 32) * 4 + 3]).toBeGreaterThan(95);
    for (let i = 0; i < pixels.length; i += 4) {
      expect([...pixels.slice(i, i + 3)]).toEqual([0, 0, 0]);
      expect(pixels[i + 3]).toBeLessThanOrEqual(102);
    }
  });

  it('scales party footprints and keeps depth-tested ground planes without writing depth', () => {
    const shadows = new ContactShadows();
    const material = shadows.mesh.material as MeshBasicMaterial;
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.color.getHex()).toBe(0xffffff);
    shadows.add(2, -3, 0.5);
    const matrix = new Matrix4();
    shadows.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeCloseTo(0.475);
    expect(matrix.elements[5]).toBeCloseTo(0.3);
    expect(matrix.elements[12]).toBe(2);
    expect(matrix.elements[13]).toBe(-3);
    expect(matrix.elements[14]).toBeCloseTo(0.002);
    shadows.reset();
    expect(shadows.mesh.count).toBe(0);
    shadows.dispose();
  });
});
