#!/usr/bin/env python3
"""Normalize generated art into the game's fixed, semantic 12×16 atlas.

Requires Pillow. No historical image is modified. Generated drafts are kept
alongside their prompts so this packing step is repeatable without a provider.
"""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/generated/van-gogh'
OUT = ROOT / 'public/graphics'
N = 128
draft = Image.open(DOC / 'atlas-draft.png').convert('RGBA')
source = Image.open(OUT / 'Standard-Tiles.png').convert('RGBA')
# The image generator expanded the grid. Explicit reviewed seams discard its
# extra right column and bottom rows; never resize a malformed atlas wholesale.
xs = [0, 103, 177, 261, 344, 428, 512, 596, 680, 764, 848, 932, 1016]
ys = [0, 83, 162, 241, 321, 399, 477, 555, 633, 712, 790, 868, 946, 1023, 1100, 1176, 1255]
# Reviewed transparent seams for the shared/class figures. The generated rows
# drift upward near the bottom: a generic row 14 crop clips the ranger's sword
# and includes the whirlpool beneath his feet. Both poses share these bounds.
class_ys = [0,84,165,242,319,399,475,554,631,711,789,865,942,1019,1095,1167]
atlas = Image.new('RGBA', (12*N, 16*N))
for col in range(12):
    for row in range(16):
        top,bottom = class_ys[row:row+2] if col in [8,9] and row<15 else ys[row:row+2]
        cell = draft.crop((xs[col], top, xs[col+1], bottom))
        if col == 3:
            # This generated column's last four pixels belong to the adjacent
            # force field, not the alternate NPC frame. Keep the existing cell
            # dimensions/anchors: clear that gutter before resampling, so its
            # opaque stripe and antialiasing cannot bleed into the NPC atlas.
            cell.paste((0,0,0,0),(79,0,cell.width,cell.height))
        atlas.paste(cell.resize((N, N), Image.Resampling.LANCZOS), (col*N, row*N))

def put(index, frame, im):
    atlas.paste(im, ((index//16*2+frame)*N, index%16*N))

def get(index, frame=0):
    x, y = (index//16*2+frame)*N, index%16*N
    return atlas.crop((x,y,x+N,y+N))

# The whirlpool pair also uses equal 88px columns in this generated row.
# Generic atlas seams included the next vortex and the serpent row below it.
for frame in range(2):
    whirlpool=draft.crop((frame*88,941,(frame+1)*88,1018))
    whirlpool=whirlpool.resize((N,N),Image.Resampling.LANCZOS)
    whirlpool.putalpha(255)
    put(12,frame,whirlpool)

# Both ship rows use equal 88px cells rather than the general column seams.
# Reuse one complete painting per ship: generated alternate hulls/masts differ.
# Only existing red flag-cloth strokes move; no boat geometry or water shifts.
ship_specs = {11: (0,862,88,940), 15: (0,1172,88,1248)}
for index,crop in ship_specs.items():
    base=draft.crop(crop).resize((N,N),Image.Resampling.LANCZOS)
    alternate=base.copy()
    def red_flag(pixel):
        r,g,b,a=pixel
        return a>0 and r>150 and r>g*1.8 and r>b*1.7
    for y in range(26):
        for x in range(82,124):
            sy=max(0,min(25,y+round(2*math.sin((x-82)*0.22+0.8))))
            if red_flag(base.getpixel((x,y))) and red_flag(base.getpixel((x,sy))):
                alternate.putpixel((x,y),base.getpixel((x,sy)))
    put(index,0,base);put(index,1,alternate)

# Trim the draft's thin grid rules from continuous terrain. The unused second
# water/floor frames must remain terrain too, rather than generated empty art.
for index in [0,1,4,8,32,33,35,37]:
    for frame in range(2):
        im=get(index,frame).crop((2,2,N-2,N-2)).resize((N,N),Image.Resampling.LANCZOS)
        if index in [0,8] and frame==1: im=get(index,0)
        im.putalpha(255)
        put(index,frame,im)

# Restore intentionally blank slots; they must not show invented subjects.
for index in [31, 36, 79]:
    for frame in range(2):
        put(index, frame, Image.new('RGBA', (N,N), (0,0,0,255) if index==36 else (0,0,0,0)))

# Reject disconnected horizontal remnants from the neighbouring generated row.
# Do not trim the figure's bounding box: feet, swords and hats retain placement.
for index in [*range(16,31),*range(63,79),*range(80,96)]:
    for frame in range(2):
        tile=get(index,frame); px=tile.load(); seen=set()
        for yy in range(N):
            for xx in range(N):
                if (xx,yy) in seen or px[xx,yy][3]<8: continue
                component=[(xx,yy)];seen.add((xx,yy))
                for x,y in component:
                    for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                        if 0<=nx<N and 0<=ny<N and (nx,ny) not in seen and px[nx,ny][3]>=8:
                            seen.add((nx,ny));component.append((nx,ny))
                x0=min(x for x,y in component);x1=max(x for x,y in component)
                y0=min(y for x,y in component);y1=max(y for x,y in component)
                if x1-x0>N*0.8 and y1-y0<N*0.08 and (y0<3 or y1>N-4):
                    for x,y in component: px[x,y]=(0,0,0,0)
        put(index,frame,tile)

# Keep the jester's red/blue costume, torso, head and feet identical. The
# generated alternate changed both anatomy and which leg wore each colour.
# Animate only the existing raised red hand/forearm with a two-pixel wave.
jester=get(17,0)
jester.putalpha(jester.getchannel('A').point(lambda alpha: 0 if alpha<8 else alpha))
put(17,0,jester)
wave=jester.copy()
for x in range(36):
    offset=round(2*(1-x/36))
    for y in range(18,56):
        wave.putpixel((x,y),jester.getpixel((x,y+offset)))
put(17,1,wave)

# Exact historical A–T glyphs and the alternate I/door are functional game
# symbols. Repaint their gold strokes over generated wood instead of accepting
# the generator's misspelled letters. The alternate I remains its painted door.
wood = draft.crop((350, 405, 500, 450)).resize((N,N), Image.Resampling.LANCZOS)
gold = Image.new('RGBA',(N,N))
gp, wp = gold.load(), wood.load()
for y in range(N):
    for x in range(N):
        r,g,b,a = wp[x,y]
        gp[x,y] = (min(255,185+r//4), min(245,140+g//3), 65+b//3,255)
for index in range(38,58):
    for frame in range(2):
        if index==46 and frame==1: continue
        sx, sy = (index//16*2+frame)*64, index%16*64
        original = source.crop((sx,sy,sx+64,sy+64))
        mask = original.convert('RGB').convert('L').point(lambda v: 255 if v>155 else 0).resize((N,N),Image.Resampling.NEAREST)
        tile = wood.copy()
        tile.paste(gold,(0,0),mask)
        put(index,frame,tile)

# A separate generation supplies seven cutouts. Its object bounds are packed
# back into the original native positions, preserving each visible trunk base.
veg = Image.open(DOC / 'vegetation-draft.png').convert('RGBA')
native = Image.open(OUT / 'Standard-VegetationCards.png').convert('RGBA')
regions = [(0,0,400,400),(620,130,970,490),(970,300,1320,535),None,
           (0,620,310,855),(610,620,930,860),(950,690,1220,887),(1470,620,1774,860)]
cards = Image.new('RGBA',(8*N,N))
for slot, region in enumerate(regions):
    if region is None: continue
    im = veg.crop(region)
    box = im.getchannel('A').getbbox()
    if box is None: raise ValueError(f'Empty generated vegetation slot {slot}')
    im = im.crop(box)
    target = native.crop((slot*64,0,slot*64+64,64)).getchannel('A').getbbox()
    x0,y0,x1,y1 = [v*2 for v in target]
    im = im.resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
    cards.alpha_composite(im,(slot*N+x0,y0))
cards.save(OUT / 'Van Gogh-VegetationCards.png')
trees = Image.new('RGBA',(3*N,N)); brush = Image.new('RGBA',(4*N,N))
forest = Image.new('RGBA',(N,N)); bushes = Image.new('RGBA',(N,N))
for i in range(3):
    im=cards.crop((i*N,0,(i+1)*N,N)); trees.alpha_composite(im,(i*N,0)); forest.alpha_composite(im)
for i in range(4):
    im=cards.crop(((i+4)*N,0,(i+5)*N,N)); brush.alpha_composite(im,(i*N,0)); bushes.alpha_composite(im)
trees.save(OUT / 'Van Gogh-TreeCards.png')
brush.save(OUT / 'Van Gogh-BrushCards.png')
forest.save(OUT / 'Van Gogh-ForestCard.png')
for index, plants in [(2,bushes),(3,forest)]:
    for frame in range(2):
        tile=get(1,frame); tile.alpha_composite(plants); put(index,frame,tile)

# These generated rows have their own seams, unlike the rest of the draft.
# Use ONE complete painting per subject. Only the flag cloth may animate.
building_specs = {
    6: {'crop': (0,477,88,550), 'flag': (45,0,92,24),
        'outline': [(15,35),(36,35),(36,0),(45,0),(45,35),(60,35),(60,61),(93,16),(97,16),(125,62),(125,127),(15,127)]},
    7: {'crop': (0,552,88,628), 'flag': (66,0,107,25),
        'outline': [(10,23),(59,23),(59,0),(68,0),(68,23),(124,23),(124,127),(10,127)]},
}
building_masks = {}
for index,spec in building_specs.items():
    base=draft.crop(spec['crop']).resize((N,N),Image.Resampling.LANCZOS)
    base.putalpha(255)
    alternate=base.copy()
    x0,y0,x1,y1=spec['flag']
    def blue(pixel):
        r,g,b,a=pixel
        return b>100 and b>g*1.08 and b>r*1.4
    # Move existing paint strokes within the blue cloth. Architecture, pole,
    # silhouette and backdrop remain byte-identical; no second castle painting.
    for y in range(y0,y1):
        for x in range(x0,x1):
            sy=max(y0,min(y1-1,y+round(3*math.sin((x-x0)*0.18+0.9))))
            if blue(base.getpixel((x,y))) and blue(base.getpixel((x,sy))):
                alternate.putpixel((x,y),base.getpixel((x,sy)))
    put(index,0,base);put(index,1,alternate)
    # Reviewed generous silhouettes, not colour removal: blue windows and cool
    # stone edges belong to the building. The surrounding paint stays on ground.
    mask=Image.new('L',(N,N)); painter=ImageDraw.Draw(mask)
    painter.polygon(spec['outline'],fill=255)
    painter.rectangle((x0,y0,x1-1,y1-1),fill=255)
    building_masks[index]=mask
# Reviewed chest silhouettes for angled cards only. Keep the complete painted
# tile in the classic atlas; this derived sheet changes alpha, never RGB paint.
chest_cards=Image.new('RGBA',(2*N,N))
chest_outlines=[
    [(14,53),(33,26),(82,26),(102,53),(102,116),(97,119),(16,119),(13,115)],
    [(0,44),(17,26),(87,26),(91,28),(113,53),(113,112),(109,117),(88,120),(0,118)],
]
for frame,outline in enumerate(chest_outlines):
    tile=get(9,frame)
    mask=Image.new('L',(N,N)); ImageDraw.Draw(mask).polygon(outline,fill=255)
    tile.putalpha(ImageChops.multiply(tile.getchannel('A'),mask))
    chest_cards.paste(tile,(frame*N,0))
chest_cards.save(OUT / 'Van Gogh-ChestCards.png')

# The door's visible front occupies only this reviewed rectangle. Exclude
# the neighboring letter remnant, blue side jamb and bottom grid rule.
# Keep native pixels in the derived card; DoorCards fits it to the opening.
get(46,1).crop((30,0,104,120)).save(OUT / 'Van Gogh-DoorCard.png')
atlas.save(OUT / 'Van Gogh-Tiles.png')

# Buildings get explicit cutouts: the new painted grass is not pixel-identical
# to the separate grass tile, so the historical background matcher cannot work.
building_cards=Image.new('RGBA',(8*N,N))
building_grounds=Image.new('RGBA',(8*N,N))
for slot,index in enumerate([6,7,5,62]):
    for frame in range(2):
        tile=get(index,frame)
        if index in [6,7]:
            mask=building_masks[index]
            ground=tile.copy()
            ground.paste(get(1,0),(0,0),mask)
            tile.putalpha(mask)
        elif index==5:
            # Reviewed cave arch region, excluding the surrounding mountain.
            mask=Image.new('L',(N,N)); d=ImageDraw.Draw(mask)
            d.ellipse((18,44,91,150),fill=255)
            tile.putalpha(mask)
            ground=get(4,0)
        else:
            ground=get(1,0)
        building_cards.alpha_composite(tile,((slot+frame*4)*N,0))
        building_grounds.alpha_composite(ground,((slot+frame*4)*N,0))
building_cards.save(OUT / 'Van Gogh-BuildingCards.png')
building_grounds.save(OUT / 'Van Gogh-BuildingGrounds.png')

# Side-by-side production review: flat frame A/B, then card A/B over backdrop.
building_review=Image.new('RGBA',(4*256,2*280),'#777777')
for row,index in enumerate([6,7]):
    for frame in range(2):
        building_review.alpha_composite(get(index,frame).resize((256,256)),(frame*256,row*280+24))
        card=building_cards.crop(((row+frame*4)*N,0,(row+frame*4+1)*N,N))
        building_review.alpha_composite(card.resize((256,256)),((2+frame)*256,row*280+24))
ImageDraw.Draw(building_review).text((8,4),'Town / castle: flat A, flat B, card A, card B',fill='white')
building_review.convert('RGB').save(DOC/'building-review.png')

# Neutral background inspection sheet makes alpha holes visible in review.
review=Image.new('RGBA',atlas.size,'#777777'); review.alpha_composite(atlas)
review.convert('RGB').save(DOC / 'atlas-review.jpg',quality=90)
files = sorted(OUT.glob('Van Gogh-*.png'))
manifest = {**(json.loads((DOC/'manifest.json').read_text()) if (DOC/'manifest.json').exists() else {}),
            'generator':'OpenAI built-in image_gen', 'normalizer':'tools/prepare-van-gogh.py',
            'tileSize':N, 'columns':12,'rows':16,'artMode':'Expanded art, opt-in',
            'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
(DOC / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Packed {len(files)} Van Gogh assets; original sheets unchanged.')
