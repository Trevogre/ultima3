/**
 * bootHold.ts
 *
 * The boot screen (index.html's #boot: the box's demon over the canvas) held before the title, at least
 * BOOT_HOLD_MS from when the art arrived - the time the game took to load counts towards it - and cut short by any
 * key, controller button (the game's keyboard queue has both), click or tap. The press that skips it is used up, not
 * passed on to the title. Development starts (?play, ?at=) are not held, and nor is a page whose art never came.
 */

import type { Keyboard } from './input.ts';

/** How long the boot screen is up at least, ms, from when its art arrived. */
export const BOOT_HOLD_MS = 3000;
/** How long to wait for the art itself before giving up on holding it. */
const ART_WAIT_MS = 5000;
/** The key a click or tap gives the waiting hold, to wake it (used up by the hold, never seen by the game). */
const TAP = 'boot-skip';

/** What the hold needs: the clock (ms), how long is left of the hold, and a wait that a press cuts short. */
export interface Hold {
  /** How long the hold still has to run, ms (from the art's arrival). */
  left(): number;
  /** Whether a click or tap came before the hold began. */
  tapped(): boolean;
  /** Wait up to `ms` for a press, using it up: the press, or null after `ms`. */
  wait(ms: number): Promise<string | null>;
}

/** Hold until the time is up or a press comes; how it ended. */
export async function holdFor(hold: Hold): Promise<'time' | 'skipped' | 'none'> {
  const left = hold.left();
  if (left <= 0) return 'none';
  if (hold.tapped()) return 'skipped';
  return (await hold.wait(left)) === null ? 'time' : 'skipped';
}

/**
 * Begin listening for a click or tap as early as possible (the start of the page's code); returns the hold for the
 * boot screen once the game's keyboard is up (`held` false: no hold, only the listening ended).
 */
export function bootHold(): (keyboard: Keyboard, held?: boolean) => Promise<'time' | 'skipped' | 'none'> {
  let tapped = false;
  let holding: Keyboard | null = null;
  const onTap = () => {
    tapped = true;
    if (holding?.waiting) holding.push(TAP);
  };
  window.addEventListener('pointerdown', onTap, true);
  return async (keyboard, held = true) => {
    try {
      if (!held) return 'none';
      const art = document.getElementById('boot') as HTMLImageElement | null;
      if (!art) return 'none';
      if (!art.complete) {
        await Promise.race([
          new Promise((resolve) => {
            art.addEventListener('load', resolve, { once: true });
            art.addEventListener('error', resolve, { once: true });
          }),
          new Promise((resolve) => setTimeout(resolve, ART_WAIT_MS)),
        ]);
      }
      if (!art.complete || art.naturalWidth === 0) return 'none';
      // When it arrived, on the page's clock: the browser's record of fetching it, else now.
      const fetched = performance.getEntriesByName(art.currentSrc)[0] as PerformanceResourceTiming | undefined;
      const arrived = fetched?.responseEnd || performance.now();
      holding = keyboard;
      return await holdFor({
        left: () => BOOT_HOLD_MS - (performance.now() - arrived),
        tapped: () => tapped,
        wait: (ms) => keyboard.nextKeyOrTimeout(ms),
      });
    } finally {
      holding = null;
      window.removeEventListener('pointerdown', onTap, true);
    }
  };
}
