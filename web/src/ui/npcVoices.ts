import { buildNpcCatalog, editedNpc, readNpcEdits, type NpcAddon, type NpcEdits, type NpcRecord } from '../game/npcCatalog.ts';
import type { GameResources } from '../data/resources.ts';
export const NPC_VOICES_KEY = 'ultima3.npc-voices.v1';
export function loadNpcEdits(): NpcEdits {
  try {
    return readNpcEdits(JSON.parse(localStorage.getItem(NPC_VOICES_KEY) ?? '{}'));
  } catch {
    return {};
  }
}
export function saveNpcEdits(edits: NpcEdits): boolean {
  try {
    localStorage.setItem(NPC_VOICES_KEY, JSON.stringify(readNpcEdits(edits)));
    return true;
  } catch {
    return false;
  }
}
export function addonEdits(value: unknown): NpcEdits {
  if (!value || typeof value !== 'object' || Reflect.get(value, 'version') !== 1 || !Array.isArray(Reflect.get(value, 'npcs')))
    throw new Error('Expected a version 1 NPC addon.');
  const raw: Record<string, unknown> = {};
  for (const npc of Reflect.get(value, 'npcs') as unknown[])
    if (npc && typeof npc === 'object' && typeof Reflect.get(npc, 'id') === 'string') raw[Reflect.get(npc, 'id') as string] = npc;
  return readNpcEdits(raw);
}
export async function loadNpcAddon(resources: GameResources): Promise<NpcAddon> {
  const original = buildNpcCatalog(resources);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/npc-addon.json`);
    if (!response.ok) return original;
    const edits = addonEdits(await response.json());
    return { version: 1, npcs: original.npcs.map((npc) => editedNpc(npc, edits)) };
  } catch {
    return original;
  }
}
export function resolveNpc(npcs: ReadonlyMap<string, NpcRecord>, id: string): NpcRecord | undefined {
  const npc = npcs.get(id);
  return npc ? editedNpc(npc, loadNpcEdits()) : undefined;
}
