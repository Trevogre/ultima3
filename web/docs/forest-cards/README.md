# Reviewed forest cards

![Original tiles, derived cutouts, and cutouts over grass](review.png)

Enable **Settings / Pause → 3D Settings → Trees: Cards** (G). It defaults off;
turning it on is an individual Custom presentation override. A straight-down
view uses the original forest tile. Angled views use the selected set’s grass
under a separate transparent tree card. Players draw in front of tree cards;
opaque mountains and walls still occlude them. Only already-visible scenery
is used, including contact shadows when enabled.

Supported: Standard, Lairware, Nintendo, PC Ultima V, Apple II Color,
Apple II Mono, PC EGA, PC CGA, and Commodore 64.
PC VGA and Macintosh B&W remain flat because their foreground/background
boundaries are ambiguous. PC MCGA remains flat pending a separate mask review.
There is no fallback to another set’s tree artwork.

`python3 web/tools/prepare-forest-cards.py` regenerates the assets and this
comparison. Standard and Lairware use traced silhouettes; the other supported
sets use individually reviewed edge-connected exterior colours. Enclosed
matching-colour details are retained. These decisions are baked into separate
`*-ForestCard.png` files, never applied as a runtime segmentation algorithm.

All retained RGB pixels come directly from the original populated A frame;
only alpha changes. No trunks, foliage, or missing pixels are reconstructed.
The original sheets are unchanged. The generator asserts retained RGB equality
and useful transparency. `manifest.json` records source and output SHA-256 hashes,
mask decisions, dimensions, and retained pixel counts. Forest B cells are not
used, matching the game’s existing non-animated forest rendering.

## Individual Standard trees

Standard uses `Standard-TreeCards.png`: three independent 64×64 transparent
frames, one for each traced silhouette. Their native pixel bases are (20,35),
(48,55), and (18,63), with the origin at the source tile’s top left. Each base
maps to that position within the ground tile, and stays fixed as the camera
rotates or tilts. Each card retains the source pixel scale and colours. No
missing foliage is filled in; the bottom tree remains clipped at the original
tile boundary. Other sets keep their reviewed cluster cards.

Each tree gets a smaller contact shadow at its own base. Players remain in
front. Straight-down views continue to use the untouched original tile.
