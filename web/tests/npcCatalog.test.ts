import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildNpcCatalog, readNpcEdits, editedNpc } from '../src/game/npcCatalog.ts';
import { npcSpeaker } from '../src/game/dialogue.ts';
import { loadTestResources, newWorld } from './helpers.ts';
import { DialogueSpeech, DEFAULT_SPEECH } from '../src/ui/dialogueSpeech.ts';
import { addonEdits } from '../src/ui/npcVoices.ts';
import { MapValue } from '../src/game/tiles.ts';
afterEach(() => vi.unstubAllGlobals());
describe('unique placed NPC catalog', () => {
  it('covers every shipped town/ambrosia monster-table placement exactly once, with original coordinates', () => {
    const resources = loadTestResources(),
      addon = buildNpcCatalog(resources);
    expect(new Set(addon.npcs.map((n) => n.id)).size).toBe(addon.npcs.length);
    let count = 0;
    for (const [id, bytes] of resources.monsters)
      if ((id >= 400 && id <= 411) || id === 421)
        for (let slot = 0; slot < 32; slot++)
          if (bytes[slot]) {
            count++;
            expect(addon.npcs.find((n) => n.id === `npc:${id}:${slot}`)?.origin).toMatchObject({
              x: bytes[64 + slot],
              y: bytes[96 + slot],
              slot,
              mapValue: bytes[slot],
            });
          }
    expect(addon.npcs.filter((n) => n.origin.slot !== null)).toHaveLength(count);
    const guards = addon.npcs.filter((n) => n.role === 'guard');
    expect(guards.length).toBeGreaterThan(20);
    expect(guards.every((n) => n.gender === 'other' && n.genderSource === 'unknown')).toBe(true);
    expect(addon.npcs.some((n) => n.id.startsWith('time-lord:') && n.dialogue[0].source === 'Messages/151')).toBe(true);
    expect(addon.npcs.every((n) => n.expansion.enabled === false)).toBe(true);
  });
  it('keeps a moving guard identity stable and does not conflate guards sharing one sprite/line', () => {
    const world = newWorld();
    world.enterMap(400);
    const guards = Array.from({ length: 32 }, (_, i) => i).filter((i) => world.monsters.type(i) === MapValue.Guard);
    const first = npcSpeaker(world, guards[0]);
    world.monsters.setPosition(guards[0], 12, 13);
    expect(npcSpeaker(world, guards[0])).toEqual(first);
    expect(npcSpeaker(world, guards[1]).id).not.toBe(first.id);
  });
  it('validates imported voice assignments without changing original dialogue or movement data', () => {
    const npc = buildNpcCatalog(loadTestResources()).npcs[0];
    const edits = readNpcEdits({
      [npc.id]: {
        name: 'Sentinel Rowan',
        gender: 'female',
        voice: { pitch: 20, rate: -2, voiceURI: 'local-voice', direction: 'Warm and alert.' },
      },
      'bad-id': { name: 'no' },
    });
    const updated = editedNpc(npc, edits);
    expect(updated.voice).toMatchObject({ pitch: 2, rate: 0.5, voiceURI: 'local-voice' });
    expect(updated.dialogue).toEqual(npc.dialogue);
    expect(updated.origin).toEqual(npc.origin);
    expect(Object.keys(edits)).toEqual([npc.id]);
    expect(addonEdits({ version: 1, npcs: [updated] })[npc.id].name).toBe('Sentinel Rowan');
    expect(() => addonEdits({ version: 2, npcs: [] })).toThrow();
  });
  it('uses a per-placement voice/pitch/rate and live local overrides with gender fallbacks', () => {
    const addon = buildNpcCatalog(loadTestResources()),
      npc = addon.npcs[0];
    const voice = { voiceURI: 'unique', name: 'Unique narrator', lang: 'en-US', localService: true, default: true } as SpeechSynthesisVoice;
    const speak = vi.fn(),
      synth = { getVoices: () => [voice], speak, cancel: vi.fn(), paused: false } as unknown as SpeechSynthesis;
    const player = new DialogueSpeech(synth, (text) => ({ text }) as SpeechSynthesisUtterance);
    player.settings = { ...DEFAULT_SPEECH, enabled: true };
    player.setCatalog(addon);
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ [npc.id]: { voice: { voiceURI: 'unique', pitch: 1.24, rate: 0.88 } } }),
    });
    player.speak('Welcome.', { id: npc.id, gender: 'other' });
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(voice);
    expect(utterance.pitch).toBe(1.24);
    expect(utterance.rate).toBe(0.88);
    player.stop();
  });
});
