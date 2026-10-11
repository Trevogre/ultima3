// How the window comes up (main.cjs): where it was last when it was a window, and whether it was last full screen,
// kept in window.json. It starts full screen unless the player last left it a window; --windowed and --fullscreen on
// the command line say otherwise, and Steam's Game Mode (the SteamDeck or SteamOS environment variables) always has it
// full screen, its screen having no room for a window. The place kept is checked against the screens there are now
// (placeOnScreen): a window last left on a monitor since unplugged, or past the edge of a smaller screen, is put back
// where it can be seen.
const { readFileSync, writeFileSync } = require('node:fs');

/** What window.json holds: the window's last place and size as a window, and whether it was last full screen. */
function readState(file) {
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

/** window.json with `change` made to it; a failure to write is not fatal. */
function writeState(file, change) {
  try {
    writeFileSync(file, JSON.stringify({ ...readState(file), ...change }));
  } catch {
    /* not fatal */
  }
}

/** Whether the window starts full screen, from the command line, the environment and the state kept. */
function startsFullScreen(argv, env, state) {
  if (argv.includes('--windowed')) return false;
  if (argv.includes('--fullscreen')) return true;
  if (env.SteamDeck === '1' || env.SteamOS === '1') return true;
  return state.fullScreen !== false;
}

/** How much of a window's top strip (where it is grabbed to move it) must lie on a screen for its place to stand. */
const GRAB = { height: 32, width: 120 };

/**
 * The window's place and size as kept (`state`: x, y, width, height), fitted to the screens' work areas now (`areas`,
 * each { x, y, width, height }; `primary` the main one's). Its place stands where enough of its top strip lies on one
 * of them, and it opens there no larger than that screen; otherwise it has no place (the system puts it on the main
 * screen) and no larger than the main screen.
 */
function placeOnScreen(state, areas, primary) {
  const number = (v) => typeof v === 'number' && Number.isFinite(v);
  const size = (area) => ({
    ...(number(state.width) ? { width: Math.min(state.width, area.width) } : {}),
    ...(number(state.height) ? { height: Math.min(state.height, area.height) } : {}),
  });
  if (!number(state.x) || !number(state.y)) return size(primary);
  const strip = { x: state.x, y: state.y, width: number(state.width) ? state.width : GRAB.width, height: GRAB.height };
  const overlap = (a) => {
    const w = Math.min(strip.x + strip.width, a.x + a.width) - Math.max(strip.x, a.x);
    const h = Math.min(strip.y + strip.height, a.y + a.height) - Math.max(strip.y, a.y);
    return w >= Math.min(GRAB.width, strip.width) && h >= GRAB.height / 2 ? w * h : 0;
  };
  const best = areas.reduce((found, a) => (overlap(a) > (found ? overlap(found) : 0) ? a : found), null);
  return best ? { x: state.x, y: state.y, ...size(best) } : size(primary);
}

module.exports = { readState, writeState, startsFullScreen, placeOnScreen };
