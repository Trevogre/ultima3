import type { DialogueSpeaker, VoiceGender } from '../game/dialogue.ts';
import { LEVELS, validLevel } from './sound.ts';
export interface SpeechPreferences {
  enabled: boolean;
  level: number;
  maleVoice: string;
  femaleVoice: string;
  otherVoice: string;
}
export const DEFAULT_SPEECH: Readonly<SpeechPreferences> = {
  enabled: false,
  level: LEVELS,
  maleVoice: '',
  femaleVoice: '',
  otherVoice: '',
};
export function readSpeechPreferences(value: unknown): SpeechPreferences {
  const out = { ...DEFAULT_SPEECH };
  if (!value || typeof value !== 'object') return out;
  out.enabled = Reflect.get(value, 'enabled') === true;
  const level: unknown = Reflect.get(value, 'level');
  if (typeof level === 'number' && Number.isFinite(level)) out.level = validLevel(level);
  for (const key of ['maleVoice', 'femaleVoice', 'otherVoice'] as const) {
    const saved: unknown = Reflect.get(value, key);
    if (typeof saved === 'string') out[key] = saved;
  }
  return out;
}
export function spokenText(text: string): string {
  const printable = [...text]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 && code !== 127) || char === '\n' || char === '\r' || char === '\t';
    })
    .join('');
  let clean = printable
    .replace(/^[\s\n]*[^:\n]{1,35}:[ \t]*\n/, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean === clean.toUpperCase())
    clean = clean
      .toLowerCase()
      .replace(/(^|[.!?]\s+)[a-z]/g, (s) => s.toUpperCase())
      .replace(/\bi\b/g, 'I');
  return clean;
}
const FEMALE = /\b(female|samantha|victoria|karen|moira|tessa|susan|zira|aria|hazel|sonia|salli|joanna|jenny)\b/i;
const MALE = /\b(male|alex|daniel|david|mark|george|james|fred|tom|oliver|guy|ryan|matthew)\b/i;
export function chooseSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  gender: VoiceGender,
  preferred = '',
): SpeechSynthesisVoice | undefined {
  const explicit = preferred ? voices.find((v) => v.voiceURI === preferred) : undefined;
  if (explicit) return explicit;
  const english = voices.filter((v) => /^en(?:-|$)/i.test(v.lang));
  const pool = english.length ? english : [...voices];
  const match = gender === 'female' ? FEMALE : gender === 'male' ? MALE : null;
  const suited = match ? pool.filter((v) => match.test(v.name)) : [];
  const choices = suited.length ? suited : pool;
  return [...choices].sort(
    (a, b) => Number(b.localService) - Number(a.localService) || Number(b.default) - Number(a.default) || a.name.localeCompare(b.name),
  )[0];
}
/** Nonblocking browser speech; no network client, voice downloads or game-clock changes. */
export class DialogueSpeech {
  private prefs = { ...DEFAULT_SPEECH };
  private silenced = false;
  private current = '';
  private queued = 0;
  private generation = 0;
  private held = new Set<SpeechSynthesisUtterance>();
  status = '';
  constructor(
    private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined' ? null : speechSynthesis,
    private readonly utterance: ((text: string) => SpeechSynthesisUtterance) | null = typeof SpeechSynthesisUtterance === 'undefined'
      ? null
      : (text) => new SpeechSynthesisUtterance(text),
  ) {}
  get supported() {
    return !!this.synth && !!this.utterance;
  }
  get settings(): SpeechPreferences {
    return { ...this.prefs };
  }
  set settings(value: SpeechPreferences) {
    this.prefs = readSpeechPreferences(value);
    if (!this.prefs.enabled || this.prefs.level === 0) this.stop();
  }
  get muted() {
    return this.silenced;
  }
  set muted(value: boolean) {
    this.silenced = value;
    if (value) this.stop();
  }
  voices(): SpeechSynthesisVoice[] {
    try {
      return this.synth?.getVoices() ?? [];
    } catch {
      return [];
    }
  }
  label(gender: VoiceGender): string {
    const uri = this.prefs[`${gender}Voice`];
    return uri ? (this.voices().find((v) => v.voiceURI === uri)?.name ?? 'Automatic') : 'Automatic';
  }
  begin(speaker: DialogueSpeaker) {
    this.stop();
    this.current = speaker.id;
  }
  stop() {
    this.generation++;
    this.queued = 0;
    this.current = '';
    this.held.clear();
    try {
      this.synth?.cancel();
    } catch {
      /* browser speech is optional */
    }
  }
  speak(text: string, speaker: DialogueSpeaker, preview = false) {
    if (!this.supported || this.silenced || (!preview && !this.prefs.enabled) || this.prefs.level === 0) return;
    const line = spokenText(text);
    if (!line) return;
    if (this.current !== speaker.id || this.queued >= 8) this.begin(speaker);
    const u = this.utterance!(line);
    const voice = chooseSpeechVoice(this.voices(), speaker.gender, this.prefs[`${speaker.gender}Voice`]);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = 'en-US';
    u.volume = this.prefs.level / LEVELS;
    u.rate = 1;
    u.pitch = 1;
    const generation = this.generation;
    const done = () => {
      if (generation === this.generation) {
        this.queued = Math.max(0, this.queued - 1);
        this.held.delete(u);
      }
    };
    u.onend = done;
    u.onerror = (event) => {
      done();
      if (generation === this.generation)
        this.status =
          event.error === 'not-allowed' ? 'Browser blocked speech; try Preview voice.' : 'Voice unavailable; choose another voice.';
    };
    this.held.add(u);
    this.queued++;
    this.status = '';
    try {
      if (this.synth!.paused) this.synth!.resume();
      this.synth!.speak(u);
    } catch {
      done();
      this.status = 'Speech unavailable in this browser.';
    }
  }
  preview(gender: VoiceGender) {
    const speaker = { id: 'preview', gender };
    this.begin(speaker);
    this.speak('Welcome, traveler. May thy journey be fruitful.', speaker, true);
  }
}
