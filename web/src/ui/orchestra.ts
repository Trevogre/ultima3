import { ORCHESTRA_SAMPLES } from './orchestraSamples.ts';
import type { MusicNote } from './music.ts';

export type MusicStyle = 'Classic' | 'Orchestral';
export function readMusicStyle(value: unknown): MusicStyle {
  return value === 'Orchestral' ? 'Orchestral' : 'Classic';
}

export type OrchestraSample = (typeof ORCHESTRA_SAMPLES)[number];
export interface LoadedSample {
  spec: OrchestraSample;
  buffer: AudioBuffer;
}

/** Many source tunes flatten their parts, so register supplies the arrangement. */
export function orchestralInstrument(note: Pick<MusicNote, 'pitch' | 'part' | 'duration'>): OrchestraSample['instrument'] {
  if (note.pitch < 55) return 'cello';
  if (note.part === 3 || note.duration < 0.18) return 'harp';
  return note.pitch >= 74 ? 'flute' : 'violin';
}

export function nearestSample(note: MusicNote, bank: LoadedSample[]): LoadedSample {
  const instrument = orchestralInstrument(note);
  const candidates = bank.filter((s) => s.spec.instrument === instrument);
  return candidates.reduce((best, sample) =>
    Math.abs(sample.spec.root - note.pitch) < Math.abs(best.spec.root - note.pitch) ? sample : best,
  );
}

export async function loadOrchestra(context: AudioContext, baseUrl: string): Promise<LoadedSample[]> {
  return Promise.all(
    ORCHESTRA_SAMPLES.map(async (spec) => {
      const response = await fetch(`${baseUrl}orchestra/${spec.file}`);
      if (!response.ok) throw new Error(`Orchestra sample: ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!buffer.length || buffer.duration < Math.max(0.1, spec.loopEnd)) throw new Error(`Invalid orchestra sample: ${spec.file}`);
      return { spec, buffer };
    }),
  );
}

// Measured at the first 10 ms RMS window reaching half the first 0.5 s peak.
// Start the sustained recordings at their audible articulation, rather than
// making every sequenced note wait through a bowed/breathed swell. Harp keeps
// its original plucked transient. Offsets are in source seconds, before tuning.
const NOTE_STARTS: Record<OrchestraSample['id'], number> = {
  'violin-low': 0.27,
  'violin-high': 0.28,
  'cello-bass': 0.07,
  'cello-low': 0.17,
  'cello-high': 0.05,
  'flute-low': 0.24,
  'flute-mid': 0.05,
  'flute-high': 0.08,
  'harp-low': 0,
  'harp-high': 0,
};

export function orchestralArticulation(id: OrchestraSample['id'], duration: number) {
  const length = Math.max(0.05, duration);
  const release = Math.min(0.04, length * 0.2);
  return {
    offset: NOTE_STARTS[id],
    attack: 0.005,
    // End just before the next equal-length note, keeping the original rhythm.
    releaseStart: length * 0.94 - release,
    end: length * 0.94,
  };
}
