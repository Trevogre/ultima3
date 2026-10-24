import type { CompositionOverride } from './worldComposition.ts';
export type WorldCompositionOverrides = Record<string, Record<string, CompositionOverride>>;

/** Presentation-only addon; it cannot change terrain, movement, discovery or load assets. */
export function readWorldCompositionOverrides(value: unknown): WorldCompositionOverrides {
  const result: WorldCompositionOverrides = {};
  if (!value || typeof value !== 'object' || Reflect.get(value, 'version') !== 1) return result;
  const maps: unknown = Reflect.get(value, 'maps');
  if (!maps || typeof maps !== 'object' || Array.isArray(maps)) return result;
  for (const [mapId, raw] of Object.entries(maps as Record<string, unknown>)) {
    if (!/^\d{1,4}$/.test(mapId) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const cells: Record<string, CompositionOverride> = {};
    for (const [coordinate, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^\d{1,3},\d{1,3}$/.test(coordinate) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const edit: CompositionOverride = {};
      for (const key of ['variant', 'density', 'rotation'] as const) {
        const n: unknown = Reflect.get(entry, key);
        if (typeof n !== 'number' || !Number.isFinite(n)) continue;
        if (key === 'variant') edit.variant = Math.max(0, Math.min(7, Math.round(n)));
        else if (key === 'density') edit.density = Math.max(0, Math.min(2, n));
        else edit.rotation = ((n % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      }
      cells[coordinate] = edit;
    }
    result[mapId] = cells;
  }
  return result;
}
