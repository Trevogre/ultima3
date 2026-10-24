import { describe, expect, it } from 'vitest';
import { CameraMovement } from '../src/ui/cameraMovement.ts';
import { Key } from '../src/game/io.ts';
import { read3DSettings, applyPresentationPreset } from '../src/ui/view3DSettings.ts';
const radians = (d: number) => (d * Math.PI) / 180;

describe('camera-relative WASD', () => {
  it('maps all four view sectors and retains unrelated keys', () => {
    const movement = new CameraMovement();
    for (const [yaw, w, a, s, d] of [
      [0, Key.Up, Key.Left, Key.Down, Key.Right],
      [90, Key.Left, Key.Down, Key.Right, Key.Up],
      [180, Key.Down, Key.Right, Key.Up, Key.Left],
      [270, Key.Right, Key.Up, Key.Left, Key.Down],
    ] as const) {
      movement.update(radians(yaw), true);
      expect(['w', 'a', 's', 'd'].map((k) => movement.key(k))).toEqual([w, a, s, d]);
      expect(movement.key(Key.Up)).toBe(Key.Up);
      expect(movement.key('c')).toBe('c');
    }
  });
  it('uses 51/39 degree switching thresholds, preventing oscillation around 45', () => {
    const movement = new CameraMovement();
    movement.update(0, true);
    for (const yaw of [44, 46, 49, 45, 50.9]) {
      movement.update(radians(yaw), true);
      expect(movement.key('w')).toBe(Key.Up);
    }
    movement.update(radians(51.1), true);
    expect(movement.key('w')).toBe(Key.Left);
    for (const yaw of [49, 45, 41, 39.1]) {
      movement.update(radians(yaw), true);
      expect(movement.key('w')).toBe(Key.Left);
    }
    movement.update(radians(38.9), true);
    expect(movement.key('w')).toBe(Key.Up);
  });
  it('handles the 0/360 seam, large orbit jumps, and disabling/resetting the mode', () => {
    const movement = new CameraMovement();
    movement.update(radians(359), true);
    expect(movement.key('W')).toBe(Key.Up);
    movement.update(radians(-2), true);
    expect(movement.key('w')).toBe(Key.Up);
    movement.update(radians(200), true);
    expect(movement.key('w')).toBe(Key.Down);
    movement.update(0, false);
    expect(movement.key('w')).toBe('w');
    movement.update(radians(90), true);
    expect(movement.key('w')).toBe(Key.Left);
    const prefs = read3DSettings({ cameraRelative: false });
    expect(applyPresentationPreset(prefs, 'Depth').cameraRelative).toBe(false);
  });
});
