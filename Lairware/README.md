# LairWare's Ultima III

The Macintosh Ultima III this port grew from: LairWare's remake of the
1983 game as it was released in 2025 (MIT licence, see
[`LICENSE`](../LICENSE)), kept for reference with its history. Here are
the C sources (`Sources/`), the game's data, art, sounds and music
(`Resources/`, `Images/`, `Cursors/`) and the Xcode project. Nothing in
it has changed but the cloth map's picture (`Images/SosariaMap.jpg`),
removed when the port's own map replaced it.

Nothing here is built or loaded by the game. The port in
[`web/`](../web/README.md) has its own copies of the data, made once by
`web/tools/extract-resources.ts` and worked on since, and its code names
the routines it follows (`UltimaDngn.c`, `DrawMiniDng()` and so on). The
desktop and Android apps wrap the port.
