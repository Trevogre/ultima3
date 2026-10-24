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
