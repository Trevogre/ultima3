#!/usr/bin/env bash
# The features sheet after the README's banner (promo/features.jpg): twelve shots of the Standard experience, three
# across, each with its caption. The shots are the game's canvas (1280 x 768) captured from a development build
# through the window.u3 hook and saved to screenshots/ by tools/pilot/shots.mjs (DEVELOPMENT.md); this lays them out.
# Needs ImageMagick 7 and macOS's Arial. Run from anywhere: bash web/tools/features-sheet.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
shots="$root/screenshots"
out="$root/promo/features.jpg"

# name|caption, in reading order.
panels=(
  "f01-town|Towns: the leader walks with the party in line"
  "f02-combat|Combat with the new figures, in menus or by keyboard"
  "f03-controller|Controller mode: gamepad, touch or keyboard"
  "f04-first-person|Dungeons in first person"
  "f05-small-map|1st person + map: a map beside the view"
  "f06-top-down|Top down: the level round the party"
  "f07-dungeon-map|View map in a dungeon: the whole level"
  "f08-sosaria|View map: Sosaria as the party has seen it"
  "f09-journal|A quest journal with just enough hints"
  "f10-tips|Tips for a new player, not the quest's answers"
  "f11-shop|Shops weigh each ware against your gear"
  "f12-pause|The Pause menu: visuals, gameplay, audio, help"
)

margin=18 gap=12 w=500 h=300 top=50 caption=36 cols=3
rows=$(((${#panels[@]} + cols - 1) / cols))
width=$((margin * 2 + w * cols + gap * (cols - 1)))
height=$((top + rows * (h + caption)))
regular=/System/Library/Fonts/Supplemental/Arial.ttf
bold="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

args=(-size "${width}x${height}" xc:'#111111'
  -font "$bold" -fill white -pointsize 22 -annotate +18+38 'Ultima III: Exodus, the Standard experience')
for i in "${!panels[@]}"; do
  name="${panels[$i]%%|*}"
  text="${panels[$i]#*|}"
  x=$((margin + (i % cols) * (w + gap)))
  y=$((top + (i / cols) * (h + caption)))
  args+=('(' "$shots/$name.png" -resize "${w}x${h}!" ')' -geometry "+$x+$y" -composite
    -font "$regular" -fill '#dddddd' -pointsize 15 -annotate "+$x+$((y + h + 20))" "$text")
done
magick "${args[@]}" -quality 90 -sampling-factor 4:2:0 -strip "$out"
echo "wrote $out (${width}x${height})"
