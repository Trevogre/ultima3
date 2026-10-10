# The pilot: a controller-only player

`bot.js` plays the development build with nothing but what a controller
has - the d-pad, A, B, X, Y and the system button - sent as `keydown`
events (arrows, Z X C V and Escape), the path a player's presses take. It
reads the game through the development hook (`window.u3`) to plan: the map,
where the townsfolk stand, which line of a menu the bar is on. It never
writes it.

It is for playing the game to find what a controller cannot do, and for
screenshots. With the dev server running (`npm run dev`), open
`/?play&controller&peek` (`peek`, so nothing it does is saved over a game;
`?play&new` for a new one) and in the console:

    (0, eval)(await (await fetch('/tools/pilot/bot.js')).text())
    await bot.tour(['lcb', 'yew'], true)

`bot.tour(names, shots)` walks to each place's square on Sosaria, goes in,
takes a shot if asked, talks to everyone and walks out again. The rest are
its parts:

- `bot.press(key, n)`: `up` `down` `left` `right` `A` `B` `X` `Y` or
  `pause`, each once the game is waiting for a key.
- `bot.choose(re)`: in the open menu, the line that matches, chosen;
  `bot.command(re)` opens the command menu first.
- `bot.walkTo(x, y)` and `bot.walkUntil(done)`: a shortest path on the
  current map by the game's own rule for where a party may stand, stepped
  and taken again as the townsfolk move. A fight met on the way is fought
  with auto combat (`bot.fight()`, `bot.autoCombat(on)` through the Pause
  menu).
- `bot.enterAt(name)`: a town, castle or dungeon by any start of its name,
  walked to and entered.
- `bot.talkAll()`: everyone in a town or castle walked into once; what they
  said is in `bot.log`.
- `bot.leave()`: out by the nearest edge.
- `bot.shot(name)`: a PNG of the canvas, posted to the screenshot server.

`node web/tools/pilot/shots.mjs` is the screenshot server: it listens on
127.0.0.1:5199 and writes each shot to `screenshots/<name>.png` at the
repository's root, which its own `.gitignore` keeps out of git. Without it
running, a shot is only logged.

Where it stops: its paths take a ship's rule at sea, but only walking has
been tried so far, and it does not yet find its way through a dungeon's
first-person levels. A "Who?" question (walking into Lord British asks who
will speak to him) it answers with the member the game highlights. Fetch
`bot.js` again after editing it (`?v=${Date.now()}` on the URL gets past
the cache).
