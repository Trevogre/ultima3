import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapCameraControls } from '../src/ui/mapCameraControls.ts';
import type { TileMapScene } from '../src/ui/tileMapScene.ts';
afterEach(() => vi.unstubAllGlobals());
class Element extends EventTarget {
  type = '';
  id = '';
  title = '';
  textContent = '';
  style: Record<string, string> = {};
  attrs = new Map<string, string>();
  width = 1000;
  height = 700;
  children: Element[] = [];
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  append(...elements: Element[]) {
    this.children.push(...elements);
  }
  after() {}
  remove() {}
  focus = vi.fn();
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 700 };
  }
}
describe('map presentation/audio toolbar', () => {
  it('keeps the return-to-3D and audio controls available in Classic and updates accessible state', () => {
    const elements: Element[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const e = new Element();
        elements.push(e);
        return e;
      },
    });
    vi.stubGlobal('window', Object.assign(new EventTarget(), { scrollX: 0, scrollY: 0 }));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const canvas = new Element();
    const map = {
      fixedCamera: true,
      classicView: true,
      audioOn: true,
      musicOn: true,
      effectsOn: false,
      onMusicToggle: vi.fn(),
      onEffectsToggle: vi.fn(),
      inspectionMode: false,
      hasLandscape: false,
      isDefault: true,
      rect: { x: 0, y: 0, w: 500, h: 500 },
      onPresentationToggle: vi.fn(),
      onAudioToggle: vi.fn(),
    } as unknown as TileMapScene;
    const controls = new MapCameraControls(canvas as unknown as HTMLCanvasElement, map);
    controls.setActive(false, true);
    const classic = elements.find((e) => e.id === 'map-classic-toggle')!,
      audio = elements.find((e) => e.id === 'map-audio-toggle')!,
      toolbar = elements.find((e) => e.children.includes(classic))!;
    const music = elements.find((e) => e.id === 'map-music-toggle')!;
    const effects = elements.find((e) => e.id === 'map-effects-toggle')!;
    expect(music.textContent).toBe('Music: On');
    expect(effects.textContent).toBe('FX: Off');
    music.dispatchEvent(new Event('click'));
    expect(map.onMusicToggle).toHaveBeenCalledOnce();
    expect(map.onEffectsToggle).not.toHaveBeenCalled();
    effects.dispatchEvent(new Event('click'));
    expect(map.onEffectsToggle).toHaveBeenCalledOnce();
    expect(toolbar.style.display).toBe('flex');
    expect(classic.textContent).toBe('3D');
    expect(audio.attrs.get('aria-label')).toBe('Mute game audio');
    classic.dispatchEvent(new Event('click'));
    audio.dispatchEvent(new Event('click'));
    expect(map.onPresentationToggle).toHaveBeenCalledOnce();
    expect(map.onAudioToggle).toHaveBeenCalledOnce();
    Object.assign(map, { classicView: false, audioOn: false, musicOn: false, effectsOn: true });
    controls.setActive(true, true);
    expect(classic.textContent).toBe('Classic');
    expect(music.textContent).toBe('Music: Off');
    expect(effects.textContent).toBe('FX: On');
    expect(effects.attrs.get('aria-label')).toContain('master audio is muted');
    expect(audio.attrs.get('aria-label')).toBe('Unmute game audio');
    expect(audio.attrs.get('aria-pressed')).toBe('true');
    controls.setActive(false, false);
    expect(toolbar.style.display).toBe('none');
    controls.dispose();
  });
});
