#!/usr/bin/env python3
"""Pack generated material swatches and rasterize readable native serif lettering.

Pillow required. The original atlas, UI sheets and font files remain untouched.
--font selects a locally installed typeface; no font binary is redistributed.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/generated/van-gogh'
OUT = ROOT / 'public/graphics'
parser = argparse.ArgumentParser()
parser.add_argument('--font', default='/System/Library/Fonts/Supplemental/Georgia Bold.ttf')
args = parser.parse_args()
draft = Image.open(DOC / 'interior-materials-draft.png').convert('RGBA')
w, h = draft.size
materials = Image.new('RGBA', (1024, 1024))
for row in range(2):
    for col in range(2):
        tile = draft.crop((col*w//2, row*h//2, (col+1)*w//2, (row+1)*h//2))
        materials.paste(tile.resize((512, 512), Image.Resampling.LANCZOS), (col*512, row*512))
materials.save(OUT / 'Van Gogh-DungeonMaterials.png')
menu = materials.crop((512,512,1024,1024))
menu.save(OUT / 'Van Gogh-MenuBackground.png')

# Fixed-cell serif glyphs: exact ASCII mapping and baseline, no generated text.
font = ImageFont.truetype(args.font, 40)
letters = Image.new('RGBA', (96*32,32))
for index in range(1,96):
    ch = chr(index+32) if index<95 else '◆'
    glyph = Image.new('L',(64,64)); d=ImageDraw.Draw(glyph)
    length=d.textlength(ch,font=font)
    d.text(((64-length)/2,46),ch,font=font,anchor='ls',fill=255)
    # Keep one baseline and a large lowercase x-height. Compress descenders
    # into their reserved five rows rather than shrinking all the lettering.
    cap_height=-font.getbbox('H',anchor='ls')[1]+3
    shaped=Image.new('L',(64,32))
    shaped.paste(glyph.crop((0,46-cap_height,64,46)).resize((64,26),Image.Resampling.LANCZOS),(0,0))
    shaped.paste(glyph.crop((0,46,64,56)).resize((64,5),Image.Resampling.LANCZOS),(0,26))
    target_width=round(64*min(1,29/max(1,length)))
    shaped=shaped.resize((target_width,32),Image.Resampling.LANCZOS)
    mask=Image.new('L',(32,32));mask.paste(shaped,((32-target_width)//2,0))
    paint = Image.new('RGBA',(32,32))
    for y in range(32):
        for x in range(32):
            # Subtle ivory-gold brush variations, high contrast at small sizes.
            grain=round(5*math.sin(x*.7+y*.4))
            paint.putpixel((x,y),(255,245+grain,211+grain,mask.getpixel((x,y))))
    letters.paste(paint,(index*32,0))
letters.save(OUT / 'Van Gogh-Font.png')

# Preserve functional arrow/map/ladder/moon slots from the established UI.
old=Image.open(OUT / 'Standard-UI.png').convert('RGBA').resize((1024,192),Image.Resampling.NEAREST)
ui=Image.new('RGBA',old.size,(0,0,0,255))
for y in range(64,192):
    for x in range(1024):
        r,g,b,a=old.getpixel((x,y)); light=max(r,g,b)/255
        ui.putpixel((x,y),(round(245*light),round(203*light),round(108*light),a))
# Generated Starry Night impasto material, fitted to the original Piece slots.
# Mirror a swatch so repeated straight pieces meet on identical edge pixels.
starry=Image.open(DOC / 'starry-border-draft.png').convert('RGBA')
sw,sh=starry.size
swatch=starry.crop((int(sw*.17),int(sh*.16),int(sw*.43),int(sh*.42))).resize((32,32),Image.Resampling.LANCZOS)
texture=Image.new('RGBA',(64,64))
texture.paste(swatch,(0,0));texture.paste(ImageOps.mirror(swatch),(32,0))
texture.paste(ImageOps.flip(swatch),(0,32));texture.paste(ImageOps.flip(ImageOps.mirror(swatch)),(32,32))
# One painted golden star supplies junctions/caps, rather than geometric metal.
star=starry.crop((int(sw*.505),int(sh*.035),int(sw*.585),int(sh*.115))).resize((46,46),Image.Resampling.LANCZOS)
star_mask=Image.new('L',(46,46));ImageDraw.Draw(star_mask).ellipse((1,1,44,44),fill=255)
star_mask=star_mask.filter(ImageFilter.GaussianBlur(1))
paths={0:['right','down'],1:['left','right','down'],2:['left','down'],
       3:['up','right','down'],4:['up','right','down','left'],5:['up','left','down'],
       6:['up','right'],7:['up','left','right'],8:['up','left'],9:['left','right'],
       10:['up','down'],11:['right'],12:['left']}
for slot,directions in paths.items():
    tile=Image.new('RGBA',(64,64),(0,0,0,255))
    mask=Image.new('L',(64,64));md=ImageDraw.Draw(mask)
    endpoints={'left':(0,32),'right':(64,32),'up':(32,0),'down':(32,64)}
    for direction in directions:
        band={'left':(0,9,32,54),'right':(32,9,63,54),'up':(9,0,54,32),'down':(9,32,54,63)}[direction]
        md.rectangle(band,fill=255)
    md.ellipse((9,9,54,54),fill=255)
    # Dark blue outer paint grounds the luminous brush strokes against black.
    tile.paste('#14244b',(0,0,64,64),mask.filter(ImageFilter.MaxFilter(3)))
    tile.paste(texture,(0,0),mask)
    if slot not in [9,10]:
        tile.paste(star,(9,9),star_mask)
    ui.paste(tile,(slot*64,0))
ui.save(OUT / 'Van Gogh-UI.png')
files=sorted(OUT.glob('Van Gogh-*.png'))
manifest=json.loads((DOC/'manifest.json').read_text())
manifest['interiorGenerator']='OpenAI built-in image_gen; tools/prepare-van-gogh-interiors.py'
manifest['border']='Generated Starry Night impasto swirls and star junctions; original functional UI slots preserved'
manifest['font']='Rasterized Georgia Bold at 40px with a shared baseline into 32px cells; no font software bundled'
manifest['files']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(DOC/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Packed painted dungeon materials, menu background, font and UI.')
