Van Gogh — first expanded-art tile set

Select Settings > Visuals > Tiles > Van Gogh, or cycle to it with F6.
For standing plants, enable Trees/brush in 3D Settings. This set is opt-in;
Standard remains the default. Original historical sheets are unchanged.

Generated with the built-in OpenAI image_gen tool. prompt.txt records the
atlas request; vegetation-prompt.txt records the plant request. The input
was the complete Standard atlas plus four comparison boards covering all
96 semantic tiles across all twelve existing sets. sources.json hashes the
historical inputs. Draft outputs remain here for inspection and repacking.

The generator did not respect the requested atlas dimensions. Rather than
ship that grid, tools/prepare-van-gogh.py explicitly crops reviewed cell
boundaries, discards extra generated rows/columns, restores blank cells,
and repaints the exact functional A–T glyphs over generated wood. It exports
a canonical 1536×2048 RGBA atlas (128-pixel tiles, two frames per subject).
The functional alternate I/door and spell HIT symbols retain their slots.

Trees and brush came from a second generation. Seven independent cutouts
are fitted to native source bounds and trunk anchors, then composed over
the new grass to form the flat tiles. Cards and overhead art therefore use
the same pixels. Town and castle use corrected row-specific source crops,
one static painting per building, and flag-cloth-only animation. Reviewed
silhouette envelopes preserve blue windows and shaded stone; no colour
key removes building detail. BuildingGrounds preserves the original painted
surroundings on the ground beneath the card. The covered foundation uses
this set's existing grass, rather than removing the surrounding painting.
Characters use the atlas's own alpha. building-review.png compares both
flat and standing frames. Tests check the shipped PNG pixels directly.
The whirlpool row uses two equal 88×77 source crops, preventing unequal
animation scaling and bleed from the neighbouring vortex and serpent row.
The alternate NPC column clears the neighbouring force-field gutter before
resampling, preserving figure placement without opaque animation-edge lines.
The jester reuses one fixed outfit and pose, with only a small raised-hand
wave; head, torso and feet stay fixed and the red/blue legs never swap sides.
Class figures use their own reviewed row seams. In particular the ranger
(the second starter party member) ends before the extra whirlpool row;
neighbouring sprites cannot appear below his feet in either animation pose.

This is a first art pass, not a claim that every generated silhouette is
final. UI, font and first-person dungeon art currently use the existing
Standard fallback. There is no separate Van Gogh grass-card extraction or
new full-screen scene art in this increment. These files are expanded art;
they do not enter the preservation-only masks for historical tile sets.

Repack locally: python3 tools/prepare-van-gogh.py (Pillow required), then
npm run graphics-index. manifest.json records shipped file hashes.
