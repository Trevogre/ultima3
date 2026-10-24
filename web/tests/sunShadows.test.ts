import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector2, Vector3, Texture } from 'three';
import { SunShadows, sunShadow } from '../src/ui/sunShadows.ts';
import { Shape } from '../src/game/tiles.ts';
import { DEFAULT_3D_SETTINGS, read3DSettings, presentationPreset } from '../src/ui/view3DSettings.ts';

describe('world-space sun shadows', () => {
  it('casts west in the morning and east in the afternoon, with the shortest shadow at noon', () => {
    const morning = sunShadow(3, 12),
      noon = sunShadow(4, 12),
      afternoon = sunShadow(5, 12);
    expect(morning.x).toBeLessThan(0);
    expect(afternoon.x).toBeGreaterThan(0);
    expect(noon.x).toBeCloseTo(0);
    expect(morning.y).toBeGreaterThan(0);
    expect(Math.hypot(morning.x, morning.y)).toBeGreaterThan(Math.hypot(noon.x, noon.y));
    expect(afternoon.x).toBeCloseTo(-morning.x);
  });
  it('fades through sunrise/sunset, vanishes at night and repeats without unbounded lengths', () => {
    expect(sunShadow(0, 12).opacity).toBe(0);
    expect(sunShadow(2, 12).opacity).toBe(0);
    expect(sunShadow(6, 12).opacity).toBe(0);
    expect(sunShadow(2, 11).opacity).toBeGreaterThan(0);
    expect(sunShadow(2, 11).opacity).toBeLessThan(sunShadow(3, 12).opacity);
    for (let turn = 0; turn < 96; turn++) {
      const sun = sunShadow(Math.floor(turn / 12), 12 - (turn % 12));
      expect(Math.hypot(sun.x, sun.y)).toBeLessThanOrEqual(3.00001);
      expect(sunShadow(Math.floor(turn / 12) + 8, 12 - (turn % 12))).toEqual(sun);
    }
  });
  it('projects the actual card plane, collapsing edge-on silhouettes without rotating the sun', () => {
    const texture = new Texture();
    const shadows = new SunShadows(texture, texture, texture);
    shadows.setSun(3, 12, true);
    const sun = shadows.uniforms.sunOffset.value.clone();
    const up = new Vector3(-sun.x, -sun.y, 1).normalize();
    const right = new Vector3(up.y, -up.x, 0).normalize();
    const normal = new Vector3().crossVectors(right, up);
    const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal));
    shadows.faceCards(rotation, Math.asin(up.z), new Quaternion());
    expect(shadows.buildings.cardUp.value.toArray()).toEqual([0, 1, 0]);
    expect(shadows.trees.cardUp.value.distanceTo(up)).toBeCloseTo(0);
    const project = (axis: Vector3) => new Vector2(axis.x + sun.x * axis.z, axis.y + sun.y * axis.z);
    expect(project(shadows.uniforms.cardUp.value).length()).toBeCloseTo(0);
    expect(shadows.uniforms.sunOffset.value.toArray()).toEqual(sun.toArray());
    shadows.faceCards(new Quaternion(), 0);
    const across = project(shadows.uniforms.cardRight.value),
      upwards = project(shadows.uniforms.cardUp.value);
    expect(Math.abs(across.x * upwards.y - across.y * upwards.x)).toBeGreaterThan(0.1);
    expect(shadows.uniforms.sunOffset.value.toArray()).toEqual(sun.toArray());
    shadows.dispose();
    texture.dispose();
  });

  it('clips receivers to filtered known land and retains independent contact shadows', () => {
    const texture = new Texture();
    const shadows = new SunShadows(texture, texture, texture);
    shadows.setGround(
      null,
      [Shape.Grass, Shape.Void, Shape.Water, Shape.Forest].map((base) => ({ base })),
    );
    const pixels = shadows.uniforms.knownGround.value.image.data as Uint8Array;
    expect([pixels[0], pixels[4], pixels[8], pixels[12]]).toEqual([255, 0, 0, 255]);
    shadows.setSun(3, 12, true);
    shadows.actors.add(1, 2, 0.5, [0, 0, 0.5, 0.5], [0.5, 0]);
    expect(shadows.actors.mesh.count).toBe(1);
    expect(shadows.actors.material.depthTest).toBe(true);
    expect(shadows.actors.material.depthWrite).toBe(false);
    expect(shadows.actors.mesh.renderOrder).toBeLessThan(0.8);
    shadows.setSun(0, 12, true);
    expect(shadows.actors.mesh.visible).toBe(false);
    shadows.setSun(4, 12, false);
    expect(shadows.active).toBe(false);
    shadows.reset();
    expect(shadows.actors.mesh.count).toBe(0);
    shadows.dispose();
    texture.dispose();
    expect(read3DSettings({ sunShadows: false, contactShadows: true })).toMatchObject({ sunShadows: false, contactShadows: true });
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, sunShadows: false })).toBe('Custom');
  });
});
