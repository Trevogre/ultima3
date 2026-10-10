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

The two sheets the README opens with are in [`promo/`](promo/): nine
screenshots of the Standard experience, and each of the twelve tile sets
at the opening, in one fight and in one dungeon corridor. The tile-set shots
are the game canvas captured through the debug hook `window.u3` in a
development build: each scene is set up once and redrawn in every set, so
a row compares the same moment. The sheets are laid out on a browser canvas
and saved as JPEG.

Inside the app, F11 or Alt+Enter toggles full screen, `--fullscreen` and
`--windowed` on the command line force one or the other, and `--new` and
`--controller` do what the web version's `?new` and `?controller` flags do.
