import { describe, expect, it, vi } from 'vitest';
import { chooseSpeechVoice, DEFAULT_SPEECH, DialogueSpeech, readSpeechPreferences, spokenText } from '../src/ui/dialogueSpeech.ts';
import { npcSpeaker, shopDialogue } from '../src/game/dialogue.ts';
import { talkTo } from '../src/game/interact.ts';
import { shop } from '../src/game/shops.ts';
import { FakeIO, newWorld } from './helpers.ts';
import { Location } from '../src/game/party.ts';
import { MapValue } from '../src/game/tiles.ts';
const voice = (name: string, lang = 'en-US', localService = true, isDefault = false) =>
  ({ name, lang, localService, default: isDefault, voiceURI: `voice:${name}` }) as SpeechSynthesisVoice;
function engine() {
  const voices: SpeechSynthesisVoice[] = [voice('Samantha'), voice('Daniel', 'en-GB'), voice('System English', 'en-US', true, true)];
  const synth = { getVoices: () => voices, cancel: vi.fn(), speak: vi.fn(), resume: vi.fn(), paused: false };
  const player = new DialogueSpeech(synth as unknown as SpeechSynthesis, (text) => ({ text }) as SpeechSynthesisUtterance);
  return { player, synth, voices };
}
describe('browser NPC speech', () => {
  it('defaults Off, validates preferences and cleans layout without changing meaningful text', () => {
    expect(readSpeechPreferences(null)).toEqual(DEFAULT_SPEECH);
    expect(readSpeechPreferences({ enabled: 'true', maleVoice: 42 })).toEqual(DEFAULT_SPEECH);
    expect(readSpeechPreferences({ enabled: true, femaleVoice: 'voice:mine', level: 4 })).toMatchObject({
      enabled: true,
      femaleVoice: 'voice:mine',
      level: 4,
    });
    expect(spokenText('\nIOLO SINGS:\nHO EYO HE HUM!\n\n')).toBe('Ho eyo he hum!');
    expect(spokenText('\n<SEARCH>\nTHE SHRINES!')).toBe('Search the shrines!');
    expect(spokenText('Pay me: 10 gold.')).toBe('Pay me: 10 gold.');
  });
  it('uses available suitable voices, prefers local voices and honours explicit selections', () => {
    const voices = [voice('Samantha online', 'en-US', false), voice('Samantha'), voice('Daniel'), voice('French', 'fr-FR')];
    expect(chooseSpeechVoice(voices, 'female')?.name).toBe('Samantha');
    expect(chooseSpeechVoice(voices, 'male')?.name).toBe('Daniel');
    expect(chooseSpeechVoice(voices, 'female', 'voice:French')?.lang).toBe('fr-FR');
    expect(chooseSpeechVoice([], 'male')).toBeUndefined();
    expect(chooseSpeechVoice([voice('System English', 'en-US', true, true)], 'female')?.default).toBe(true);
  });
  it('speaks only when enabled, queues one conversation and interrupts old dialogue on a new conversation or mute', () => {
    const { player, synth } = engine(),
      speaker = { id: 'king', gender: 'male' as const };
    player.speak('WELCOME MY CHILD.', speaker);
    expect(synth.speak).not.toHaveBeenCalled();
    player.settings = { ...DEFAULT_SPEECH, enabled: true, level: 5 };
    player.begin(speaker);
    player.speak('WELCOME MY CHILD.', speaker);
    player.speak('EXPERIENCE MORE!', speaker);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    const first = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(first.voice?.name).toBe('Daniel');
    expect(first.volume).toBe(0.5);
    expect(first.pitch).toBe(1);
    const previous = synth.cancel.mock.calls.length;
    player.begin(speaker);
    expect(synth.cancel).toHaveBeenCalledTimes(previous + 1);
    player.muted = true;
    player.speak('No.', speaker);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    player.muted = false;
    player.settings = { ...player.settings, enabled: false };
    player.speak('No.', speaker);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });
  it('loads voices lazily, bounds the queue and handles unsupported browsers, errors and stale callbacks', () => {
    const { player, synth, voices } = engine();
    voices.length = 0;
    player.settings = { ...DEFAULT_SPEECH, enabled: true };
    const speaker = { id: 'npc', gender: 'female' as const };
    player.speak('Hello.', speaker);
    const first = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(first.voice).toBeUndefined();
    voices.push(voice('Samantha'));
    player.speak('Again.', speaker);
    expect((synth.speak.mock.calls[1][0] as SpeechSynthesisUtterance).voice?.name).toBe('Samantha');
    for (let i = 0; i < 10; i++) player.speak('A line.', speaker);
    expect(synth.cancel.mock.calls.length).toBeGreaterThan(1);
    player.stop();
    first.onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent);
    expect(player.status).toBe('');
    player.preview('female');
    const current = synth.speak.mock.calls.at(-1)![0] as SpeechSynthesisUtterance;
    current.onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent);
    expect(player.status).toContain('blocked');
    const absent = new DialogueSpeech(null, null);
    expect(absent.supported).toBe(false);
    expect(() => absent.preview('other')).not.toThrow();
  });
  it('previews the selected voice while speech is Off, but respects global mute', () => {
    const { player, synth } = engine();
    player.preview('female');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance).voice?.name).toBe('Samantha');
    player.muted = true;
    player.preview('female');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });
});
describe('dialogue event routing', () => {
  it('speaks a townsperson once with reviewed character metadata and leaves the printed dialogue unchanged', async () => {
    const w = newWorld();
    w.enterMap(400);
    w.party.location = Location.Castle;
    w.monsters.setType(0, MapValue.Jester);
    w.monsters.setHp(0, 4);
    const io = Object.assign(new FakeIO(w.resources), { beginDialogue: vi.fn(), speakLine: vi.fn() });
    await talkTo(w, io, 0, 0);
    expect(npcSpeaker(w, 0).gender).toBe('female');
    expect(io.beginDialogue).toHaveBeenCalledTimes(1);
    expect(io.speakLine).toHaveBeenCalledTimes(1);
    const text = io.speakLine.mock.calls[0][0] as string;
    expect(io.output).toContain(text);
    w.monsters.setType(0, MapValue.LordBritish);
    expect(npcSpeaker(w, 0).gender).toBe('male');
  });
  it('routes shop prose and purchased rumours, keeping menus, inventory lists and typed keys silent', async () => {
    const w = newWorld(),
      io = Object.assign(new FakeIO(w.resources), { beginDialogue: vi.fn(), speakLine: vi.fn() });
    const wrapped = shopDialogue(w, io, { id: 'shop', gender: 'other' });
    wrapped.printMessage(197);
    wrapped.printMessage(237);
    wrapped.print('Y');
    wrapped.print('Sword 100 gold\n');
    expect(io.speakLine).not.toHaveBeenCalled();
    wrapped.printMessage(185);
    wrapped.print(w.resources.strings.Pub[0]);
    expect(io.speakLine).toHaveBeenCalledTimes(2);
    io.speakLine.mockClear();
    io.inputs = ['0'];
    await shop(w, io, 0, 0);
    expect(io.beginDialogue).toHaveBeenCalledTimes(1);
    expect(io.speakLine.mock.calls.length).toBeGreaterThan(0);
  });
});
