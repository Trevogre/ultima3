"""Read-only source audit; writes comparison evidence, never modifies tile art.
Run from any directory: python3 web/tools/audit-forests.py
Requires Pillow. No inferred masks are generated or installed.
"""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GRAPHICS = ROOT / 'public' / 'graphics'
OUT = ROOT / 'docs' / 'forest-audit'
SETS = ['Standard', 'Lairware', 'PC VGA', 'Nintendo', 'PC Ultima V', 'PC MCGA',
        'Apple II Color', 'Apple II Mono', 'Macintosh B&W', 'PC EGA', 'PC CGA', 'Commodore 64']

def sheet_file(stem, suffix):
    return next((GRAPHICS / f'{stem}-{suffix}.{ext}' for ext in (['png', 'gif'] if suffix == 'Tiles' else ['gif', 'png'])
                 if (GRAPHICS / f'{stem}-{suffix}.{ext}').exists()), None)

def checker(size):
    image = Image.new('RGBA', size, '#777777')
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 8):
        for x in range(0, size[0], 8):
            if (x // 8 + y // 8) % 2 == 0:
                draw.rectangle((x, y, x + 7, y + 7), fill='#444444')
    return image

OUT.mkdir(parents=True, exist_ok=True)
canvas = Image.new('RGB', (940, 130 + 128 * len(SETS)), '#15191e')
draw = ImageDraw.Draw(canvas)
font_path = '/System/Library/Fonts/Menlo.ttc'
font = ImageFont.truetype(font_path, 15) if Path(font_path).exists() else ImageFont.load_default()
small = ImageFont.truetype(font_path, 12) if Path(font_path).exists() else font

draw.text((20, 16), 'FOREST / GRASS — ORIGINAL TILE PIXELS', font=font, fill='white')
draw.text((20, 43), 'Both sheet frames; checkerboard indicates existing transparency. No cutouts applied.', font=small, fill='#b7c3d0')
for i, title in enumerate(['Grass A', 'Grass B', 'Forest A', 'Forest B']):
    draw.text((230 + 112 * i, 82), title, font=font, fill='white')
draw.text((690, 82), 'Forest alpha / grass match', font=small, fill='white')
results = []
for row, name in enumerate(SETS):
    stem = name.replace('&', '')
    source = sheet_file(stem, 'Tiles')
    if source is None:
        raise FileNotFoundError(name)
    sheet = Image.open(source).convert('RGBA')
    mask = sheet_file(stem, 'Mask')
    if mask:
        sheet.putalpha(ImageChops.invert(Image.open(mask).convert('L')))
    w, h = sheet.width // 12, sheet.height // 16
    y = 116 + row * 128
    draw.text((20, y + 30), name, font=font, fill='white')
    draw.text((20, y + 55), f'{w} x {h} source pixels', font=small, fill='#a7b4c2')
    stats = []
    for frame in [0, 1]:
        grass = sheet.crop((frame * w, h, (frame + 1) * w, 2 * h))
        forest = sheet.crop((frame * w, 3 * h, (frame + 1) * w, 4 * h))
        for col, tile in [(frame, grass), (frame + 2, forest)]:
            preview = tile.resize((96, 96), Image.Resampling.NEAREST)
            canvas.paste(Image.alpha_composite(checker((96, 96)), preview).convert('RGB'), (230 + col * 112, y))
        pixels, ground = list(forest.getdata()), list(grass.getdata())
        transparent = sum(p[3] == 0 for p in pixels)
        same = sum(p[:3] == g[:3] for p, g in zip(pixels, ground))
        stats.append({'frame': frame, 'pixels': w * h, 'transparent_pixels': transparent,
                      'partial_alpha_pixels': sum(0 < p[3] < 255 for p in pixels), 'grass_rgb_matches': same})
        draw.text((690, y + 12 + frame * 30), f'{"AB"[frame]}: {100 * transparent / (w*h):.1f}% / {100 * same / (w*h):.1f}%', font=small, fill='#d4dde6')
    draw.line((20, y + 112, 920, y + 112), fill='#333e4a')
    results.append({'set': name, 'source': source.relative_to(ROOT).as_posix(), 'sha256': sha256(source.read_bytes()).hexdigest(),
                    'mask': mask.relative_to(ROOT).as_posix() if mask else None,
                    'mask_sha256': sha256(mask.read_bytes()).hexdigest() if mask else None, 'frames': stats})
canvas.save(OUT / 'comparison.png')
(OUT / 'measurements.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'Wrote evidence for {len(results)} sets to {OUT}')
