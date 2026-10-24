import { describe, expect, it } from 'vitest';
import { applyPresentationPreset, DEFAULT_3D_SETTINGS, presentationPreset, read3DSettings } from '../src/ui/view3DSettings.ts';

describe('presentation presets', () => {
  it('derives Classic, Depth and Custom from effective features', () => {
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS })).toBe('Depth');
    expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, enabled: false, buildings: false })).toBe('Classic');
    for (const key of [
      'characters',
      'buildings',
      'walls',
      'mountains',
      'distantTerrain',
      'dayNight',
      'contactShadows',
      'fixedCamera',
      'steppedMountains',
      'recessedWater',
    ] as const)
      expect(presentationPreset({ ...DEFAULT_3D_SETTINGS, [key]: false })).toBe('Custom');
  });

  it('preserves camera angles and mouse preference, without mutating existing preferences', () => {
    const original = { ...DEFAULT_3D_SETTINGS, mouseCamera: false, fixedAngle: 30, fixedRotation: 90, buildings: false };
    const classic = applyPresentationPreset(original, 'Classic');
    expect(classic).toEqual({ ...original, enabled: false });
    const depth = applyPresentationPreset(classic, 'Depth');
    expect(depth).toMatchObject({ fixedAngle: 30, fixedRotation: 90, mouseCamera: false, buildings: true, fixedCamera: true });
    expect(presentationPreset(depth)).toBe('Depth');
    expect(original.buildings).toBe(false);
  });

  it('migrates old preferences without overriding explicit choices', () => {
    const upgraded = read3DSettings({ enabled: true, walls: false, fixedAngle: 20 });
    expect(upgraded).toMatchObject({ walls: false, fixedAngle: 20, contactShadows: true });
    expect(presentationPreset(upgraded)).toBe('Custom');
    expect(read3DSettings({ contactShadows: false }).contactShadows).toBe(false);
  });
});
