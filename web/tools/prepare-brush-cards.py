"""Prepare reviewed brush masks; retain source RGB and leave original sheets untouched."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
graphics=root/'public/graphics'
out=root/'docs/forest-cards'
polygons=[[(1,7),(5,3),(10,0),(23,0),(29,5),(32,10),(29,16),(22,19),(11,19),(4,16),(0,12)],
[(32,20),(36,15),(42,13),(50,13),(57,16),(61,21),(62,27),(58,31),(51,33),(41,33),(35,29),(31,25)],
[(2,38),(7,34),(13,32),(23,32),(29,36),(32,42),(29,47),(23,50),(11,50),(4,47),(0,43)],
[(33,55),(38,51),(44,49),(53,50),(59,54),(62,59),(60,63),(33,63),(31,60)]]
anchors=[[16,19],[46,33],[16,50],[46,63]]
names=['Standard','Nintendo','PC Ultima V','Apple II Color','Apple II Mono','PC EGA','PC CGA','Commodore 64']
review=Image.new('RGB',(620,len(names)*130),'#242424');d=ImageDraw.Draw(review)
records=[]
for row,name in enumerate(names):
 p=next(p for ext in ['png','gif'] if (p:=graphics/f'{name}-Tiles.{ext}').exists())
 sheet=Image.open(p).convert('RGBA');size=sheet.width//12
 tile=sheet.crop((0,2*size,size,3*size));grass=sheet.crop((0,size,size,2*size))
 masks=[]
 if name=='Standard':
  for polygon in polygons:
   mask=Image.new('L',(64,64),0);ImageDraw.Draw(mask).polygon(polygon,fill=255);masks.append(mask)
 else:
  mask=Image.new('L',(size,size),255);pixels=tile.load();background=pixels[0,0][:3]
  queue=[(x,0) for x in range(size)]+[(x,size-1) for x in range(size)]+[(0,y) for y in range(size)]+[(size-1,y) for y in range(size)];seen=set()
  for x,y in queue:
   if (x,y) in seen or not (0<=x<size and 0<=y<size):continue
   seen.add((x,y))
   if pixels[x,y][:3]!=background:continue
   mask.putpixel((x,y),0);queue.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
  masks.append(mask)
 atlas=Image.new('RGBA',(size*len(masks),size));combined=Image.new('RGBA',(size,size))
 for i,mask in enumerate(masks):
  card=tile.copy();card.putalpha(mask)
  assert 0 < sum(a>0 for a in mask.getdata()) < size*size
  assert all(a[:3]==b[:3] for a,b in zip(tile.getdata(),card.getdata()) if b[3])
  atlas.paste(card,(i*size,0));combined=Image.alpha_composite(combined,card)
 target=graphics/f'{name}-BrushCards.png';atlas.save(target)
 d.text((5,row*130+30),name,fill='white')
 check=Image.new('RGBA',(size,size),'#777')
 for x,img in [(185,tile),(325,Image.alpha_composite(check,combined)),(465,Image.alpha_composite(grass,combined))]:review.paste(img.resize((120,120),Image.Resampling.NEAREST),(x,row*130))
 records.append({'set':name,'source':p.name,'sourceSha256':sha256(p.read_bytes()).hexdigest(),'card':target.name,'cardSha256':sha256(target.read_bytes()).hexdigest(),'anchors':anchors if name=='Standard' else None})
review.save(out/'brush-review.png')
(out/'brush-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
