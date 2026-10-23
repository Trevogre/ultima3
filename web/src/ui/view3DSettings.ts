export interface View3DSettings {
  enabled: boolean;
  characters: boolean;
  buildings: boolean;
  walls: boolean;
  mountains: boolean;
  distantTerrain: boolean;
  mouseCamera: boolean;
}

export const DEFAULT_3D_SETTINGS: Readonly<View3DSettings> = {
  enabled: true,
  characters: true,
  buildings: true,
  walls: true,
  mountains: true,
  distantTerrain: true,
  mouseCamera: true,
};

/** Old or malformed preferences get defaults; explicit Off choices are preserved. */
export function read3DSettings(value: unknown): View3DSettings {
  const settings = { ...DEFAULT_3D_SETTINGS };
  if (!value || typeof value !== 'object') return settings;
  for (const key of Object.keys(settings) as (keyof View3DSettings)[]) {
    const saved: unknown = Reflect.get(value, key);
    if (typeof saved === 'boolean') settings[key] = saved;
  }
  return settings;
}
