/**
 * updates.ts
 *
 * Release updates for the apps, said in the game: where a newer release is
 * out, the title menu offers "Update (x.y.z)", which opens its page to read
 * what changed and download it. The desktop app's main process asks GitHub
 * (desktop/updates.cjs) and hands the answer over (preload.cjs); the Android
 * app's page asks GitHub itself, its version built in (VITE_APP_VERSION,
 * mobile/bundle.cjs), and opens the page by going to it, which Capacitor
 * sends to the system browser. The web version has its service worker's own
 * update ("Update: restart"), and the Flatpak its repository's.
 */

export const RELEASES_PAGE = 'https://github.com/synthwave-pixel/ultima3/releases/latest';
const LATEST_API = 'https://api.github.com/repos/synthwave-pixel/ultima3/releases/latest';

/** A newer release to offer: its version and its page. */
export interface ReleaseOffer {
  version: string;
  url: string;
}

/** What the desktop app's preload (desktop/preload.cjs) lets the page ask. */
export interface NativeUpdates {
  updateOffer(): Promise<ReleaseOffer | null>;
  openRelease(): Promise<void>;
}

/** A released version's numbers (1.0.39, v1.0.39), or null for anything else (a development build's). */
function parts(version: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Whether release `latest` is newer than `current`; never for a version that is not a release's. */
export function isNewer(latest: string, current: string): boolean {
  const [l, c] = [parts(latest), parts(current)];
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) if (l[i] !== c[i]) return l[i] > c[i];
  return false;
}

/** Whether `version` is a release's (x.y.z), so worth comparing; a development build's is not. */
export function isRelease(version: string | undefined): version is string {
  return version !== undefined && parts(version) !== null;
}

/** Ask GitHub for the newest release: an offer where it is newer than `current`, else null (failures too). */
export async function newerRelease(current: string, get: typeof fetch = fetch): Promise<ReleaseOffer | null> {
  try {
    const res = await get(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const latest = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
    const version = typeof latest.tag_name === 'string' ? latest.tag_name.replace(/^v/, '') : '';
    if (!isNewer(version, current)) return null;
    const url = typeof latest.html_url === 'string' && latest.html_url.startsWith('https://github.com/') ? latest.html_url : RELEASES_PAGE;
    return { version, url };
  } catch {
    return null;
  }
}

/** `promise`'s answer, or `fallback` after `ms`: the title is not held up for long by a slow network. */
export function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}
