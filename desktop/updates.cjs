// Release updates for the desktop app (main.cjs): it asks GitHub for the newest release as it starts, and where that
// is newer than this copy the game's title menu offers it as "Update (x.y.z)", which opens the release page in the
// system browser to read what changed and download it. Nothing is downloaded or installed here. Not looked for:
//   - in the Flatpak, which flatpak keeps up to date from the site's repository;
//   - under Steam's Game Mode (gamescope), where a browser would open over the game;
//   - in a copy run unpackaged or built locally (a development version), or with --no-update-check.
// A failure to ask (offline, GitHub down) is only logged. ULTIMA3_RELEASES_API points the question elsewhere, to test.

const LATEST_API = 'https://api.github.com/repos/synthwave-pixel/ultima3/releases/latest';
const RELEASES_PAGE = 'https://github.com/synthwave-pixel/ultima3/releases/latest';

/** Whether this copy should look for a newer release (see above). */
function shouldCheck({ packaged, env, argv, version, gamescope }) {
  if (!packaged || argv.includes('--no-update-check')) return false;
  if (env.FLATPAK_ID || env.container === 'flatpak') return false;
  if (gamescope) return false;
  return /^\d+\.\d+\.\d+$/.test(version);
}

/** A released version's numbers (1.0.39, v1.0.39), or null for anything else. */
function parts(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Whether release `latest` is newer than `current`. */
function isNewer(latest, current) {
  const [l, c] = [parts(latest), parts(current)];
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) if (l[i] !== c[i]) return l[i] > c[i];
  return false;
}

/** The newest release where it is newer than `current`: { version, url }, or null. */
async function newerRelease(current, get = fetch, api = process.env.ULTIMA3_RELEASES_API || LATEST_API) {
  try {
    const res = await get(api, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const latest = await res.json();
    const version = String(latest.tag_name ?? '').replace(/^v/, '');
    if (!isNewer(version, current)) return null;
    const url = typeof latest.html_url === 'string' && latest.html_url.startsWith('https://github.com/') ? latest.html_url : RELEASES_PAGE;
    return { version, url };
  } catch (e) {
    console.warn('update check:', e?.message ?? e);
    return null;
  }
}

module.exports = { shouldCheck, isNewer, newerRelease, RELEASES_PAGE };
