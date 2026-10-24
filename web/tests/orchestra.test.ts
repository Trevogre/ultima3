import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ORCHESTRA_SAMPLES } from '../src/ui/orchestraSamples.ts';
import { orchestralInstrument, nearestSample, orchestralArticulation, readMusicStyle } from '../src/ui/orchestra.ts';
import { MusicPlayer } from '../src/ui/music.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const asset = (name: string) => readFileSync(new URL(`../public/music/orchestra/${name}`, import.meta.url));

describe('offline orchestral bank', () => {
  it('skips sustained swells, preserves plucked attacks and separates notes within their original duration', () => {
    for (const spec of ORCHESTRA_SAMPLES) {
      for (const duration of [0.01, 0.1, 0.25, 1, 4]) {
        const a = orchestralArticulation(spec.id, duration);
        expect(a.attack).toBeLessThan(a.releaseStart);
        expect(a.releaseStart).toBeLessThan(a.end);
        expect(a.end).toBeLessThan(Math.max(0.05, duration));
        expect(a.offset).toBeGreaterThanOrEqual(0);
        if (spec.loopEnd) expect(a.offset).toBeLessThan(spec.loopStart);
        else expect(a.offset).toBe(0);
      }
    }
    expect(orchestralArticulation('violin-high', 0.25).offset).toBe(0.28);
  });
  it('bundles valid PCM samples, provenance hashes and the full CC0 license', () => {
    const manifest = JSON.parse(asset('manifest.json').toString()) as { license: string; samples: { id: string; sha256: string }[] };
    expect(manifest.license).toBe('CC0-1.0');
    expect(asset('LICENSE.txt').toString()).toContain('CC0 1.0 Universal');
    expect(asset('CREDITS.txt').toString()).toContain('Versilian Studios');
    for (const spec of ORCHESTRA_SAMPLES) {
      const wav = asset(spec.file);
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wav.readUInt16LE(22)).toBe(1);
      expect(wav.readUInt32LE(24)).toBe(22050);
      expect(wav.readUInt16LE(34)).toBe(16);
      const duration = wav.readUInt32LE(40) / 44100;
      expect(duration).toBeGreaterThanOrEqual(spec.loopEnd || 0.5);
      expect(spec.loopStart).toBeLessThan(spec.loopEnd || 1);
      expect(createHash('sha256').update(wav).digest('hex')).toBe(manifest.samples.find((s) => s.id === spec.id)!.sha256);
    }
  });

  it('keeps Classic as the default and selects instruments and nearest recorded pitches', () => {
    expect(readMusicStyle(undefined)).toBe('Classic');
    expect(readMusicStyle('invalid')).toBe('Classic');
    expect(readMusicStyle('Orchestral')).toBe('Orchestral');
    const note = { pitch: 48, part: 0, duration: 1, time: 0, volume: 64 };
    expect(orchestralInstrument(note)).toBe('cello');
    expect(orchestralInstrument({ ...note, pitch: 65 })).toBe('violin');
    expect(orchestralInstrument({ ...note, pitch: 80 })).toBe('flute');
    expect(orchestralInstrument({ ...note, pitch: 65, part: 3 })).toBe('harp');
    const bank = ORCHESTRA_SAMPLES.map((spec) => ({ spec, buffer: {} as AudioBuffer }));
    expect(nearestSample({ ...note, pitch: 73, duration: 0.1 }, bank).spec.id).toBe('harp-high');
  });
});

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
}
class Source {
  frequency = new Param();
  playbackRate = new Param();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  buffer: unknown = null;
  type = '';
  stopped = false;
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  offset = 0;
  start(_at: number, offset = 0) {
    this.offset = offset;
  }
  stop() {
    this.stopped = true;
  }
}
class FakeContext {
  static last: FakeContext;
  currentTime = 0;
  state = 'running';
  destination = {};
  voices: Source[] = [];
  oscillators: Source[] = [];
  constructor() {
    FakeContext.last = this;
  }
  createGain() {
    return { gain: new Param(), connect() {}, disconnect() {} };
  }
  createBufferSource() {
    const source = new Source();
    this.voices.push(source);
    return source;
  }
  createOscillator() {
    const source = new Source();
    this.oscillators.push(source);
    return source;
  }
  decodeAudioData() {
    return Promise.resolve({ length: 66150, duration: 3.5 });
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

function setup(failSamples = false) {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeContext);
  const fetcher = vi.fn(async (url: string) => {
    if (failSamples && url.includes('orchestra')) throw new Error('missing sample');
    const file = readFileSync(new URL(`../public/${url}`, import.meta.url));
    return { ok: true, arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) };
  });
  vi.stubGlobal('fetch', fetcher);
  return { player: new MusicPlayer(), fetcher };
}

describe('sampled playback lifecycle', () => {
  it('loads no sample bank in Classic mode', async () => {
    const { player, fetcher } = setup();
    player.play(1);
    player.unlock();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher.mock.calls.every(([url]) => !url.includes('orchestra'))).toBe(true);
    expect(FakeContext.last.oscillators.length).toBeGreaterThan(0);
    player.enabled = false;
  });

  it('plays local samples, holds on pause, stops old voices on style changes and honours Off', async () => {
    const { player } = setup();
    player.style = 'Orchestral';
    player.play(1);
    player.unlock();
    await vi.advanceTimersByTimeAsync(1);
    const ctx = FakeContext.last;
    expect(ctx.voices.length).toBeGreaterThan(0);
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.voices.some((v) => v.loop && v.offset > 0)).toBe(true);
    expect(ctx.voices.some((v) => v.loop && v.loopStart === 0.88)).toBe(true);
    player.pause();
    expect(ctx.state).toBe('suspended');
    player.resume();
    expect(ctx.state).toBe('running');
    player.style = 'Classic';
    expect(ctx.voices.every((v) => v.stopped)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    player.level = 0;
    expect(player.active).toBe(0);
    player.enabled = false;
  });

  it('falls back to Classic on sample failure and never starts a stale sample load after switching', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { player } = setup(true);
    player.style = 'Orchestral';
    player.play(1);
    player.unlock();
    await vi.advanceTimersByTimeAsync(1);
    expect(player.styleHint).toContain('playing Classic');
    expect(FakeContext.last.oscillators.length).toBeGreaterThan(0);
    expect(warning).toHaveBeenCalledTimes(1);
    player.enabled = false;
    const next = setup();
    next.player.style = 'Orchestral';
    next.player.play(1);
    next.player.unlock();
    next.player.style = 'Classic';
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeContext.last.voices).toHaveLength(0);
    next.player.enabled = false;
  });
});
