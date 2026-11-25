import json,re
from pathlib import Path
P=Path(__file__).parent
data=json.loads((P/'review.json').read_text(encoding='utf-8'))
pictos={1:[],2:[7],3:[5,9],4:[7],5:[5],6:[8,7],7:[2],8:[5],9:[7,9],10:[7],11:[],12:[5],13:[5],14:[2,7,9],15:[2],16:[2,7],17:[2,7],18:[],19:[2,7,9],20:[],21:[],22:[],23:[5],24:[7],25:[],26:[2,7,9],27:[2,7],28:[5],29:[],30:[2,7],31:[2,7,9],32:[],33:[5],35:[2,7],36:[2,7,9],37:[2,7,9],38:[2,7],39:[2,7,9],40:[2,7],41:[2,7,9],42:[2,7],43:[2,7,9],44:[],45:[2,7],46:[2],47:[]}
for i,r in enumerate(data):
 r['pictograms']=pictos.get(i,[])
 if not r.get('pages'):
  r.update(hazards=[],date='',ler='FDS não localizada',source='Pendente: FDS não localizada; classificação e eliminação por confirmar.')
  continue
 text='\n'.join(r['pages'])
 def section(n):
  pat=r'(?m)^\s*(?:SECÇÃO|SEÇÃO|SECTION)\s+'+str(n)+r'(?=\s|[:.])'
  m=re.search(pat,text)
  if not m:return ''
  rest=text[m.start():]
  end=re.search(r'(?m)^\s*(?:SECÇÃO|SEÇÃO|SECTION)\s+'+str(n+1)+r'(?=\s|[:.])',rest)
  return rest[:end.start()] if end else rest
 s2=section(2);s13=section(13)
 assert s2 and s13,i
 m=re.search(r'2\.2\.?\s+(?:Elementos|Label)',s2,re.I)
 assert m,i
 label=s2[m.end():]
 end=re.search(r'2\.3\s',label)
 if end:label=label[:end.start()]
 r['hazards']=list(dict.fromkeys(re.findall(r'(?<![A-Z])(?:EUH\d{3}|H\d{3}(?:[dDfF]{1,2})?)(?!\d)',label)))
 if i==12:r['hazards']=['H314']
 dates=re.findall(r'(?:Revisão \(data\):|Data de revisão:?|Revisto em / versão:|Revision Date:|Revisão:)\s*(\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4})',text[:6000],re.I)
 if not dates:dates=re.findall(r'(?:Emissão:|Ficha de Segurança de)\s*(\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4})',text[:6000],re.I)
 r['date']=re.sub(r'\s','',dates[0]) if dates else ''
 codes=[];pack=[]
 for line in s13.splitlines():
  match=re.match(r'\s*(\d{2})[^\S\n]+(\d{2})[^\S\n]+(\d{2})(\s*\*)?',line)
  if match:
   code=' '.join(match.group(j) for j in [1,2,3])+('*' if match.group(4) else '')
   target=pack if match.group(1)=='15' else codes
   if code not in target:target.append(code)
 r['ler']=('Produto: '+ '; '.join(codes) if codes else 'Produto: não indicado na secção 13')+ ('\nEmbalagem: '+ '; '.join(pack) if pack else '')
 r['source']=Path(r['path']).name+' | Secções 2.2 e 13.'
 if not r['date']:r['source']+=' Data não indicada no documento.'
 if i in [39,41]:r['source']+=' Usada a FDS local do produto; ligação repetida na aplicação a confirmar.'
 if i in [14,15,16,35,36,37,38,39,40,41,42,43]:r['source']+=' Códigos LER transcritos como apresentados na FDS.'
 print(i,r['date'],r['hazards'],r['ler'])
(P/'curated.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
