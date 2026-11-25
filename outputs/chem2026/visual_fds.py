import json,re
from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
P=Path(__file__).parent
data=json.loads((P/'review.json').read_text(encoding='utf-8'))
panels=[]
for i,r in enumerate(data):
 if not r.get('path'):continue
 doc=pdfium.PdfDocument(r['path'])
 found=False
 for n in range(min(3,len(doc))):
  page=doc[n];tp=page.get_textpage();txt=tp.get_text_range()
  hit=re.search(r'2\.2\.?\s+(?:Elementos|Label)',txt,re.I)
  if not hit:continue
  box=tp.get_charbox(hit.start());w,h=page.get_size()
  y=max(0,h-box[3]-8)
  im=page.render(scale=1.4).to_pil().convert('RGB')
  im=im.crop((0,int(y*1.4),im.width,min(im.height,int((y+250)*1.4))))
  if i in [1,12,15]:
   full=page.render(scale=1.5).to_pil();full.save(P/f'special-{i}-{n}.png')
   if i==15 and n+1<len(doc):doc[n+1].render(scale=1.5).to_pil().save(P/'special-15-next.png')
  im.thumbnail((590,250))
  panel=Image.new('RGB',(600,285),'white');d=ImageDraw.Draw(panel)
  d.text((5,3),f'{i:02d} {r["name"][:65]} p{n+1}',fill='black')
  panel.paste(im,(0,27));panels.append(panel);found=True;break
 if not found: print('NO PICTO PANEL',i)
for b in range(0,len(panels),8):
 ims=panels[b:b+8];out=Image.new('RGB',(1200,285*((len(ims)+1)//2)), '#aaaaaa')
 for j,im in enumerate(ims):out.paste(im,((j%2)*600,(j//2)*285))
 out.save(P/f'pictos-{b//8}.jpg',quality=90)
