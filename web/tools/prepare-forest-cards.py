"""Build reviewed, set-specific forest cutouts without changing source RGB pixels.
Outputs separate card assets; does not alter the original sheets.
"""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
graphics=root/'public/graphics'
out=root/'docs/forest-cards'
out.mkdir(exist_ok=True,parents=True)
# Hand-traced silhouettes in the original 64-pixel coordinate system.
polygons=[[(0,9),(4,4),(13,0),(25,0),(31,5),(35,12),(33,23),(27,28),(23,29),(23,32),(28,35),(23,37),(15,34),(8,37),(8,34),(12,30),(12,24),(5,24),(1,19)],
[(31,27),(35,23),(45,19),(55,20),(61,25),(63,33),(61,42),(55,46),(50,47),(50,51),(56,55),(51,57),(45,54),(39,56),(39,53),(43,49),(42,45),(35,44),(30,37)],
[(1,48),(5,43),(15,39),(24,40),(31,44),(34,52),(32,59),(28,63),(6,63),(1,58)]]
# These sets were reviewed for a single flat exterior colour. Remove only
# edge-connected exterior pixels, retaining enclosed black/green art details.
flat_sets=['Nintendo','PC Ultima V','Apple II Color','Apple II Mono','PC EGA','PC CGA','Commodore 64']
sets=['Standard','Lairware']+flat_sets
sheet=Image.new('RGB',(720,90+len(sets)*130),'#20262d');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14) if Path('/System/Library/Fonts/Menlo.ttc').exists() else ImageFont.load_default()
d.text((15,15),'REVIEWED FOREST CUTOUTS — ORIGINAL RGB, DERIVED ALPHA',font=font,fill='white')
for x,label in [(215,'Original'),(365,'Cutout'),(515,'Over grass')]:d.text((x,55),label,font=font,fill='white')
manifest=[]
for row,name in enumerate(sets):
 stem=name.replace('&','');p=next(p for ext in ['png','gif'] if (p:=graphics/f'{stem}-Tiles.{ext}').exists())
 source=Image.open(p).convert('RGBA');size=source.width//12
 tile=source.crop((0,3*size,size,4*size));grass=source.crop((0,size,size,2*size))
 mask=Image.new('L',(size,size),255)
 if name in ['Standard','Lairware']:
  mask=Image.new('L',(size,size),0);md=ImageDraw.Draw(mask)
  for polygon in polygons:md.polygon(polygon,fill=255)
 else:
  pixels=tile.load();background=pixels[0,0][:3]
  seen=set();queue=[(x,0) for x in range(size)]+[(x,size-1) for x in range(size)]+[(0,y) for y in range(size)]+[(size-1,y) for y in range(size)]
  for x,y in queue:
   if (x,y) in seen or not (0<=x<size and 0<=y<size):continue
   seen.add((x,y))
   if pixels[x,y][:3]!=background:continue
   mask.putpixel((x,y),0);queue.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  # All silhouette decisions are baked into these separate, reviewed files.
 card=tile.copy();card.putalpha(mask)
 assert all(a[:3]==b[:3] for a,b in zip(tile.getdata(),card.getdata()) if b[3]), "Changed source RGB"
 assert 0 < sum(a>0 for a in mask.getdata()) < size*size, "Not a useful cutout"
 output=graphics/f'{stem}-ForestCard.png';card.save(output)
 if name == 'Standard':
  # Keep each tree in its original 64x64 pixel coordinate system. The
  # renderer anchors these independent planes at the reviewed trunk bases.
  separate=Image.new('RGBA',(192,64))
  anchors=[(20,35),(48,55),(18,63)]
  for i,polygon in enumerate(polygons):
   tree_mask=Image.new('L',(64,64),0)
   ImageDraw.Draw(tree_mask).polygon(polygon,fill=255)
   tree=tile.copy();tree.putalpha(tree_mask)
   separate.paste(tree,(i*64,0))
  separate.save(graphics/'Standard-TreeCards.png')
  (out/'standard-trees.json').write_text(json.dumps({'source':p.name,'atlas':'Standard-TreeCards.png','anchors':anchors},indent=2)+'\n')
 y=85+row*130;d.text((15,y+35),name,font=font,fill='white')
 check=Image.new('RGBA',(size,size),'#888');cd=ImageDraw.Draw(check)
 for cy in range(size):
  for cx in range(size):
   if (cx//4+cy//4)%2==0:cd.point((cx,cy),fill='#444')
 composite=Image.alpha_composite(grass,card)
 for x,image in [(215,tile),(365,Image.alpha_composite(check,card)),(515,composite)]:sheet.paste(image.resize((112,112),Image.Resampling.NEAREST).convert('RGB'),(x,y))
 manifest.append({'set':name,'source':p.name,'sourceSha256':sha256(p.read_bytes()).hexdigest(),'card':output.name,'cardSha256':sha256(output.read_bytes()).hexdigest(),
 'mask':'hand-traced tree/cluster silhouettes' if name in ['Standard','Lairware'] else 'reviewed edge-connected exterior colour',
 'width':size,'height':size,'retainedPixels':sum(a>0 for a in mask.getdata())})
sheet.save(out/'review.png')
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Wrote',len(manifest),'separate forest cards and review evidence')
