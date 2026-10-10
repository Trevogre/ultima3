# Developing Ultima III

*The new version lives in the `web` directory. The sources, resources and
Xcode project at the root are the old LairWare build, kept for reference.*

The port is in [`web/`](web/README.md): how to run it, how the code is
organized, data formats and testing. The desktop app is in
[`desktop/`](desktop/README.md), a thin Electron shell around the built
game, with its own notes, and the Android app in
[`mobile/`](mobile/README.md), the same game wrapped with Capacitor.

The art briefs the new figures and dungeon sheets were drawn to are in
[`web/docs/`](web/docs/). The original Macintosh sources and resources are
at the root of the repository, unchanged.

[`showcase/`](showcase/README.md) holds exported games at the game's
sights, for trying it, screenshots and testing: `npm run saves` in `web/`
makes them from a new game brought on by the test harness
(`web/tools/saves/showcase.ts`), which runs under node through
`web/tools/node-ts.mjs`, a loader that compiles the game's TypeScript
(node strips types itself, but not the classes' parameter properties).

Three tools play the game without a person at the keyboard. The fuzzer
(`npm run fuzz` in `web/`, `web/tools/sim/fuzz.ts`) plays it headless at
random - fights with random parties and monsters, and travels from towns,
castles, dungeons, Ambrosia and a frigate - and after every key checks
what must always hold: where the party stands, its hit points, stats and
supplies, a fight's squares, a fight that ends. A failure is reported with
the arguments that replay it (`fights=0 travels=1 seed=N log`). The pilot
(`web/tools/pilot/bot.js`, its [README](web/tools/pilot/README.md)) plays
the development build in a browser with a controller's keys only, and
`web/tools/pilot/shots.mjs` saves its screenshots to `screenshots/`.

The READMEs open with the banner, `promo/banner.jpg`: the wide capsule at
twice its size. It, the logo (`promo/logo.png`), the Steam artwork and the
boot screen are made by `web/tools/key-art.mjs` from the box (see
[its README](web/art/box/README.md)). The two sheets after the banner are
in [`promo/`](promo/): nine screenshots of the Standard experience, and
each of the twelve tile sets at the opening, in one fight and in one
dungeon corridor. The tile-set shots are the game canvas captured through
the debug hook `window.u3` in a development build: each scene is set up
once and redrawn in every set, so a row compares the same moment. The
sheets are laid out on a browser canvas and saved as JPEG.

Inside the app, F11 or Alt+Enter toggles full screen, `--fullscreen` and
`--windowed` on the command line force one or the other, and `--new` and
`--controller` do what the web version's `?new` and `?controller` flags do.
