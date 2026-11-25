"""Apply artifact-authored cells while preserving Excel rich-image package parts."""
from pathlib import Path
from copy import deepcopy
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
import json
P=Path(__file__).parent
source=Path('C:/Users/OAS-MANUTENCAO1/Desktop/IMPASS0104.00 – Matriz de consumos 2026.xlsx')
out=P/'Matriz de consumos 2026 - preenchida.xlsx'
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
q=lambda n:'{'+ns['s']+'}'+n
with ZipFile(source) as original,ZipFile(P/'donor.xlsx') as donor:
 target='xl/worksheets/sheet7.xml'
 r=E.fromstring(original.read(target));d=E.fromstring(donor.read(target))
 styles=E.fromstring(original.read('xl/styles.xml'));ds=E.fromstring(donor.read('xl/styles.xml'))
 maps={}
 for kind in ['fonts','fills','borders']:
  dst=styles.find('s:'+kind,ns);src=ds.find('s:'+kind,ns)
  maps[kind]={}
  for i,node in enumerate(src):
   maps[kind][i]=len(dst);dst.append(deepcopy(node))
  dst.set('count',str(len(dst)))
 nums=styles.find('s:numFmts',ns)
 if nums is None:nums=E.Element(q('numFmts'));styles.insert(0,nums)
 maps['numFmts']={}
 nextid=max([163]+[int(n.get('numFmtId')) for n in nums])+1
 for node in ds.find('s:numFmts',ns):
  old=int(node.get('numFmtId'));copy=deepcopy(node);copy.set('numFmtId',str(nextid));maps['numFmts'][old]=nextid;nextid+=1;nums.append(copy)
 nums.set('count',str(len(nums)))
 def xf(copy):
  for key,kind in [('fontId','fonts'),('fillId','fills'),('borderId','borders'),('numFmtId','numFmts')]:
   if key in copy.attrib:
    old=int(copy.get(key));copy.set(key,str(maps[kind].get(old,old)))
  return copy
 for kind in ['cellStyleXfs','cellXfs']:
  dst=styles.find('s:'+kind,ns);maps[kind]={}
  for i,node in enumerate(ds.find('s:'+kind,ns)):
   copy=xf(deepcopy(node))
   if 'xfId' in copy.attrib:copy.set('xfId',str(maps['cellStyleXfs'][int(copy.get('xfId'))]))
   maps[kind][i]=len(dst);dst.append(copy)
  dst.set('count',str(len(dst)))
 shared=[]
 if 'xl/sharedStrings.xml' in donor.namelist():
  shared=list(E.fromstring(donor.read('xl/sharedStrings.xml')))
 def cell(node):
  copy=deepcopy(node)
  if 's' in copy.attrib:copy.set('s',str(maps['cellXfs'][int(copy.get('s'))]))
  if copy.get('t')=='s':
   idx=int(copy.find('s:v',ns).text);si=shared[idx]
   for c in list(copy):copy.remove(c)
   copy.set('t','inlineStr');inline=E.SubElement(copy,q('is'))
   for c in si:inline.append(deepcopy(c))
  return copy
 rd=r.find('s:sheetData',ns);dd=d.find('s:sheetData',ns)
 for row in list(rd):
  if int(row.get('r'))>=23:rd.remove(row)
 for row in dd:
  n=int(row.get('r'))
  if n>=23:
   new=E.Element(q('row'),dict(row.attrib))
   for c in row:new.append(cell(c))
   rd.append(new)
  elif n in [5,6]:
   existing=next(x for x in rd if x.get('r')==str(n))
   for c in row:
    if c.get('r') in [f'P{n}',f'R{n}']:
     for old in list(existing):
      if old.get('r')==c.get('r'):existing.remove(old)
     existing.append(cell(c))
 # Extend the table without rewriting any unrelated merges or image metadata.
 merges=r.find('s:mergeCells',ns)
 for addr in ['P5:P6','R5:R6']+[f'A{n}:B{n}' for n in range(24,71)]:
  E.SubElement(merges,q('mergeCell'),ref=addr)
 merges.set('count',str(len(merges)))
 cols=r.find('s:cols',ns)
 for col,width in [(5,14),(14,34),(16,15),(17,3),(18,64)]:
  existing=next((x for x in cols if int(x.get('min'))==col and int(x.get('max'))==col),None)
  if existing is None:existing=E.SubElement(cols,q('col'),min=str(col),max=str(col))
  existing.set('width',str(width));existing.set('customWidth','1')
 cols[:]=sorted(cols,key=lambda c:int(c.get('min')))
 r.find('s:dimension',ns).set('ref','A1:R70')
 changed={target:E.tostring(r,encoding='UTF-8',xml_declaration=True,standalone=True),'xl/styles.xml':E.tostring(styles,encoding='UTF-8',xml_declaration=True,standalone=True)}
 with ZipFile(out,'w',ZIP_DEFLATED) as z:
  for item in original.infolist():z.writestr(deepcopy(item),changed.get(item.filename,original.read(item.filename)))
 with ZipFile(out) as z:
  assert set(z.namelist())==set(original.namelist())
  for name in original.namelist():
   if name not in changed:assert z.read(name)==original.read(name),name
  assert z.testzip() is None
 print('Saved:',out.resolve())
 print('Preserved all',len(original.namelist())-len(changed),'other package parts byte-for-byte, including all rich-cell images.')
