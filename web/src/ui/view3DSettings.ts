export type ZoomFiltering = 'Crisp' | 'Stable' | 'Auto';
import { readModelSet, type ModelSet } from './modelSets.ts';

export interface View3DSettings {
  renderStyle: 'Cards' | 'Models';
  modelSet: ModelSet;
  enabled: boolean;
  characters: boolean;
  buildings: boolean;
  walls: boolean;
  mountains: boolean;
  distantTerrain: boolean;
  mouseCamera: boolean;
  fixedCamera: boolean;
  fixedAngle: number;
  fixedRotation: number;
  dayNight: boolean;
  contactShadows: boolean;
  steppedMountains: boolean;
  recessedWater: boolean;
  leftDrag: boolean;
  rightDrag: boolean;
  wheelZoom: boolean;
  menuClicks: boolean;
  treeCards: boolean;
  zoomFiltering: ZoomFiltering;
  softFog: boolean;
  terrainShading: boolean;
  waterHighlights: boolean;
  alphaWater: boolean;
  sunShadows: boolean;
  cameraRelative: boolean;
  grassDepth: boolean;
}

export const DEFAULT_3D_SETTINGS: Readonly<View3DSettings> = {
  renderStyle: 'Cards',
  modelSet: 'Low-poly',
  enabled: true,
  characters: true,
  buildings: true,
  walls: true,
  mountains: true,
  distantTerrain: true,
  mouseCamera: true,
  fixedCamera: true,
  fixedAngle: 45,
  fixedRotation: 5,
  dayNight: true,
  contactShadows: true,
  steppedMountains: false,
  recessedWater: true,
  leftDrag: true,
  rightDrag: true,
  wheelZoom: true,
  menuClicks: true,
  cameraRelative: true,
  treeCards: false,
  zoomFiltering: 'Auto',
  softFog: true,
  terrainShading: true,
  waterHighlights: true,
  alphaWater: false,
  sunShadows: true,
  grassDepth: false,
};

const DEPTH_OPTIONS = {
  renderStyle: 'Cards',
  treeCards: false,
  zoomFiltering: 'Auto',
  softFog: true,
  terrainShading: true,
  waterHighlights: true,
  alphaWater: false,
  sunShadows: true,
  grassDepth: false,
  enabled: true,
  characters: true,
  buildings: true,
  walls: true,
  mountains: true,
  distantTerrain: true,
  fixedCamera: true,
  dayNight: true,
  contactShadows: true,
  steppedMountains: false,
  recessedWater: true,
} as const;

export type PresentationPreset = 'Classic' | 'Depth' | 'Models';

export function useTreeCards(enabled: boolean, tilt: number, hasCutout: boolean): boolean {
  return enabled && hasCutout && tilt > 0.001;
}

/** Presets are derived labels, never a second source of saved display state. */
export function presentationPreset(settings: View3DSettings): PresentationPreset | 'Custom' {
  if (!settings.enabled) return 'Classic';
  if (settings.renderStyle === 'Models') return 'Models';
  return (Object.keys(DEPTH_OPTIONS) as (keyof typeof DEPTH_OPTIONS)[]).every((key) => settings[key] === DEPTH_OPTIONS[key])
    ? 'Depth'
    : 'Custom';
}

export function applyPresentationPreset(settings: View3DSettings, preset: PresentationPreset): View3DSettings {
  if (preset === 'Classic') return { ...settings, enabled: false };
  return { ...settings, ...DEPTH_OPTIONS, renderStyle: preset === 'Models' ? 'Models' : 'Cards' };
}

/** Old or malformed preferences get defaults; explicit Off choices are preserved. */
export function read3DSettings(value: unknown): View3DSettings {
  const settings = { ...DEFAULT_3D_SETTINGS };
  if (!value || typeof value !== 'object') return settings;
  for (const key of Object.keys(settings) as (keyof View3DSettings)[]) {
    if (key === 'fixedAngle' || key === 'fixedRotation' || key === 'zoomFiltering' || key === 'renderStyle' || key === 'modelSet') continue;
    const saved: unknown = Reflect.get(value, key);
    if (typeof saved === 'boolean') settings[key] = saved;
  }
  const filtering: unknown = Reflect.get(value, 'zoomFiltering');
  settings.modelSet = readModelSet(Reflect.get(value, 'modelSet'));
  if (Reflect.get(value, 'renderStyle') === 'Models') settings.renderStyle = 'Models';
  if (filtering === 'Crisp' || filtering === 'Stable' || filtering === 'Auto') settings.zoomFiltering = filtering;
  const angle: unknown = Reflect.get(value, 'fixedAngle');
  if (typeof angle === 'number' && Number.isFinite(angle) && angle >= 0 && angle <= 70) settings.fixedAngle = angle;
  const rotation: unknown = Reflect.get(value, 'fixedRotation');
  if (typeof rotation === 'number' && Number.isFinite(rotation) && rotation >= 0 && rotation < 360) settings.fixedRotation = rotation;
  return settings;
}
