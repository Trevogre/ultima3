import type { GameResources } from '../data/resources.ts';
import { MonsterTable } from './monsterTable.ts';
import { MapValue } from './tiles.ts';
import { speech } from './talk.ts';
import type { VoiceGender } from './dialogue.ts';

export interface NpcLine {
  id: string;
  text: string;
  source: string;
  template?: boolean;
}
export interface NpcVoice {
  voiceURI: string;
  pitch: number;
  rate: number;
  direction: string;
}
export interface NpcRecord {
  id: string;
  mapId: number;
  mapName: string;
  origin: { x: number; y: number; slot: number | null; level?: number; mapValue: number };
  name: string;
  named: boolean;
  role: string;
  gender: VoiceGender;
  genderSource: 'reviewed' | 'unknown' | 'authored';
  pronouns: string;
  voice: NpcVoice;
  dialogue: NpcLine[];
  expansion: { enabled: false; biography: string; instructions: string };
}
export interface NpcAddon {
  version: 1;
  npcs: NpcRecord[];
}
export type NpcEdits = Record<string, { name?: string; gender?: VoiceGender; pronouns?: string; voice?: Partial<NpcVoice> }>;
const NAMED: Record<string, { name: string; gender: VoiceGender }> = {
  '400/3': { name: 'Iolo', gender: 'male' },
  '400/4': { name: 'Gwino', gender: 'female' },
  '400/8': { name: 'Chuckles', gender: 'male' },
  '402/6': { name: 'Dupre', gender: 'male' },
  '402/10': { name: 'Chuckles', gender: 'male' },
  '405/3': { name: 'Jolly Joe', gender: 'male' },
  '405/4': { name: 'Baby Bob', gender: 'male' },
  '406/3': { name: 'Sentri', gender: 'male' },
  '406/4': { name: 'Shamino', gender: 'male' },
};
export function namedNpc(mapId: number, talkIndex: number) {
  return NAMED[`${mapId}/${talkIndex}`];
}
export function npcId(mapId: number, slot: number): string {
  return `npc:${mapId}:${slot}`;
}
/** Stable IDs for text and variations; no platform-dependent random numbers. */
export function textHash(text: string): string {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function npcLine(text: string, source: string, template = false): NpcLine {
  return { id: `line:${textHash(text)}`, text, source, ...(template ? { template: true } : {}) };
}
const ROLE: Record<number, string> = {
  [MapValue.Merchant]: 'merchant',
  [MapValue.Jester]: 'jester',
  [MapValue.Guard]: 'guard',
  [MapValue.LordBritish]: 'king',
  [MapValue.Fighter]: 'fighter',
  [MapValue.Cleric]: 'cleric',
  [MapValue.Wizard]: 'wizard',
  [MapValue.Thief]: 'thief',
};
const LIMITS = { pitch: [0.5, 2], rate: [0.5, 1.5] } as const;
export function readNpcEdits(value: unknown): NpcEdits {
  const out: NpcEdits = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value)) {
    if (!/^(npc:\d+:\d+|time-lord(?::\d+:\d+:\d+:\d+)?)$/.test(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const edit: NpcEdits[string] = {};
    for (const key of ['name', 'pronouns'] as const)
      if (typeof Reflect.get(raw, key) === 'string') edit[key] = (Reflect.get(raw, key) as string).slice(0, 120);
    const gender: unknown = Reflect.get(raw, 'gender');
    if (['male', 'female', 'other'].includes(gender as string)) edit.gender = gender as VoiceGender;
    const voice: unknown = Reflect.get(raw, 'voice');
    if (voice && typeof voice === 'object') {
      edit.voice = {};
      for (const key of ['voiceURI', 'direction'] as const)
        if (typeof Reflect.get(voice, key) === 'string') edit.voice[key] = (Reflect.get(voice, key) as string).slice(0, 1000);
      for (const key of ['pitch', 'rate'] as const) {
        const n: unknown = Reflect.get(voice, key);
        if (typeof n === 'number' && Number.isFinite(n)) edit.voice[key] = Math.max(LIMITS[key][0], Math.min(LIMITS[key][1], n));
      }
    }
    out[id] = edit;
  }
  return out;
}
export function editedNpc(npc: NpcRecord, edits: NpcEdits): NpcRecord {
  const edit = edits[npc.id];
  return {
    ...npc,
    ...edit,
    genderSource: edit?.gender && edit.gender !== npc.gender ? 'authored' : npc.genderSource,
    voice: { ...npc.voice, ...edit?.voice },
  };
}
export function buildNpcCatalog(resources: GameResources): NpcAddon {
  const npcs: NpcRecord[] = [];
  const message = (n: number) => npcLine(resources.strings.Messages[n - 1] ?? '', `Messages/${n}`);
  const voice = (id: string): NpcVoice => {
    const seed = parseInt(textHash(id), 16);
    return {
      voiceURI: '',
      pitch: Math.round((0.94 + (seed % 13) / 100) * 100) / 100,
      rate: Math.round((0.96 + ((seed >>> 8) % 9) / 100) * 100) / 100,
      direction: 'Keep the original line and meaning. Natural, clear delivery; no added words.',
    };
  };
  for (const [mapId, bytes] of resources.monsters) {
    if (!((mapId >= 400 && mapId <= 411) || mapId === 421)) continue;
    const mons = new MonsterTable(bytes),
      talk = resources.talk.get(mapId) ?? new Uint8Array(256);
    for (let slot = 0; slot < 32; slot++) {
      const type = mons.type(slot);
      if (!type) continue;
      const id = npcId(mapId, slot),
        named = type === MapValue.LordBritish ? { name: 'Lord British', gender: 'male' as const } : namedNpc(mapId, mons.talkIndex(slot));
      const mapName = resources.mapNames.get(mapId) ?? String(mapId),
        role = ROLE[type] ?? 'resident';
      let lines: NpcLine[];
      if (type === MapValue.LordBritish) lines = [90, 91, 92, 93, 94, 263].map(message);
      else if (type === MapValue.Merchant) {
        // Shop type depends on the party's approach Y, not the merchant sprite.
        // Catalog the shared conditional prose pool, not menus or stock lists.
        lines = Array.from({ length: 50 }, (_, i) => 185 + i)
          .filter((n) => n !== 197 && (n < 225 || n > 227))
          .map(message);
        for (const table of ['Pub', 'Radrion'])
          resources.strings[table].forEach((text, i) => lines.push(npcLine(text, `${table}/${i + 1}`)));
        lines.push(
          npcLine(
            `${resources.strings.Messages[224]}{partySize}${resources.strings.Messages[225]}{cost}${resources.strings.Messages[226]}`,
            'Horses/price',
            true,
          ),
        );
      } else if (mons.talkIndex(slot)) lines = [npcLine(speech(talk, mons.talkIndex(slot)), `TLKS/${mapId}/${mons.talkIndex(slot)}`)];
      else lines = [89, 262].map(message);
      npcs.push({
        id,
        mapId,
        mapName,
        origin: { x: mons.x(slot), y: mons.y(slot), slot, mapValue: type },
        name: named?.name ?? `${mapName} ${role} ${slot + 1}`,
        named: !!named,
        role,
        gender: named?.gender ?? 'other',
        genderSource: named ? 'reviewed' : 'unknown',
        pronouns: '',
        voice: voice(id),
        dialogue: lines.filter((l) => l.text.trim()),
        expansion: {
          enabled: false,
          biography: '',
          instructions: 'Original dialogue and game facts remain authoritative. No quest, inventory or rule changes.',
        },
      });
    }
  }
  for (const [mapId, raw] of resources.maps) {
    if (mapId < 412 || mapId > 418) continue;
    raw.forEach((cell, i) => {
      if (cell !== 1) return;
      const x = i % 16,
        y = Math.floor(i / 16) % 16,
        level = Math.floor(i / 256),
        id = `time-lord:${mapId}:${level}:${x}:${y}`;
      npcs.push({
        id,
        mapId,
        mapName: resources.mapNames.get(mapId) ?? String(mapId),
        origin: { x, y, slot: null, level, mapValue: cell },
        name: 'Time Lord',
        named: true,
        role: 'oracle',
        gender: 'male',
        genderSource: 'reviewed',
        pronouns: '',
        voice: voice(id),
        dialogue: [message(151)],
        expansion: { enabled: false, biography: '', instructions: 'Preserve the original Time Lord clue and game facts.' },
      });
    });
  }
  return { version: 1, npcs: npcs.sort((a, b) => a.mapId - b.mapId || a.id.localeCompare(b.id)) };
}
