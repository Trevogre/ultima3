export interface View3DSettings {
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
}

export const DEFAULT_3D_SETTINGS: Readonly<View3DSettings> = {
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
};

/** Old or malformed preferences get defaults; explicit Off choices are preserved. */
export function read3DSettings(value: unknown): View3DSettings {
  const settings = { ...DEFAULT_3D_SETTINGS };
  if (!value || typeof value !== 'object') return settings;
  for (const key of Object.keys(settings) as (keyof View3DSettings)[]) {
    if (key === 'fixedAngle' || key === 'fixedRotation') continue;
    const saved: unknown = Reflect.get(value, key);
    if (typeof saved === 'boolean') settings[key] = saved;
  }
  const angle: unknown = Reflect.get(value, 'fixedAngle');
  if (typeof angle === 'number' && Number.isFinite(angle) && angle >= 0 && angle <= 70) settings.fixedAngle = angle;
  const rotation: unknown = Reflect.get(value, 'fixedRotation');
  if (typeof rotation === 'number' && Number.isFinite(rotation) && rotation >= 0 && rotation < 360) settings.fixedRotation = rotation;
  return settings;
}
