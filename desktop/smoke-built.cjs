// Launches the app as electron-builder built it (unpacked, in dist/) with the smoke test's screenshot flag, as smoke.cjs
// does the development copy: proof the packaged app starts and runs the game with its fuses set (its ASAR checked,
// loaded from nothing else). Exits with its status, 0 when the game is running. CI runs it after each build; on Linux
// inside xvfb-run, with ELECTRON_NO_SANDBOX=1 for the runner.
const { spawnSync } = require('node:child_process');
const { existsSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const pkg = require('./package.json');
const dist = join(__dirname, 'dist');
const product = pkg.build.productName;
const exe = (() => {
  if (!existsSync(dist)) return undefined;
  if (process.platform === 'darwin') {
    const dir = readdirSync(dist).find((d) => d.startsWith('mac'));
    return dir && join(dist, dir, `${product}.app`, 'Contents', 'MacOS', product);
  }
  const dir = readdirSync(dist).find((d) => d.endsWith('-unpacked'));
  if (!dir) return undefined;
  const files = readdirSync(join(dist, dir));
  // Windows names the binary for the product; Linux for the package, unless the build names it otherwise.
  const name = process.platform === 'win32' ? `${product}.exe` : files.find((f) => f === pkg.name || f === product);
  return name && join(dist, dir, name);
})();
if (!exe || !existsSync(exe)) {
  console.error(`smoke-built: no built app in ${dist}`);
  process.exit(1);
}
const shot = process.argv[2] ?? join(dist, 'smoke-built.png');
const extra = process.env.ELECTRON_NO_SANDBOX ? ['--no-sandbox'] : [];
rmSync(shot, { force: true });
console.log(`smoke-built: ${exe}`);
// The app quits itself once it has looked (main.cjs, ULTIMA3_SMOKE); a window that never loads is failed here.
const r = spawnSync(exe, ['--windowed', ...extra], { stdio: 'inherit', timeout: 90_000, env: { ...process.env, ULTIMA3_SMOKE: shot } });
if (r.status === 0 && !existsSync(shot)) {
  console.error('smoke-built: no screenshot taken');
  process.exit(1);
}
process.exit(r.status ?? 1);
