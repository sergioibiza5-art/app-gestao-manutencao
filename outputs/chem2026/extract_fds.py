import json, re, os, unicodedata
from pathlib import Path
from pypdf import PdfReader
ROOT=Path("C:/OneDrive/OneDrive - Oasipor - Medicalwear")
HERE=Path(__file__).parent
products=json.loads((HERE/"products.json").read_text(encoding="utf-8"))
patterns={
1:"FDS_Óleo das bombas de vácuo.PDF",2:"Aquagen 2D Orange Sunset - FDS.PDF",3:"Aquagen DFX Plus FS.PDF",
4:"Aquagen FRE Limpador WC Perfumado - FDS.PDF",5:"AQUAGEN REMOVEX - FDS.pdf",6:"FDS-ANTI-CONGELANTE PURO 5L.PDF",
7:"DINPQ AGORA ALLURE - FDS.pdf",8:"CAR GRASS - FDS.pdf",9:"DESINBAC GRAS - FDS.pdf",10:"00108055 - IGEL REP (Portugués).pdf",
11:"GLADE ABSORVEODORES GEL - FDS.pdf",12:"FICHA SEGURANÇA CELLAQUA CFA (V7)_ECOTERME (2).pdf",
13:"INOVA WC GEL - FDS.pdf",14:"Limpa contactos 3 EM 1 PROFISSIONAL 250ML_fds.pdf",15:"FDS-LMS CONSISTENT PTFE SPRAY 400ML.PDF",
16:"Lubrificante de silicone 3 EM 1 PROFISSIONAL 250ML_fds.pdf",17:"WURTH Lubrificante para empilhador.PDF",
18:"Massa consistente de lítio 3EM1 profissional multiusos 400g_fds.pdf",19:"Massa consistente de lítio em spray 3EM1 profissional 250 ml_fds.pdf",
20:"Massa consistente de lítio 3EM1 profissional tubo 150g_fds.pdf",21:"FDS-MASSA CONSISTENTE IV.PDF",
22:"PRODET GEL P ROSA - FDS.pdf",23:"PRODET LAV MAQ Detergente Máquina Loiça - FDS.pdf",24:"PRODET LAV E - FDS.pdf",
25:"PRODET LVE Limpa Vidros - FDS.pdf",26:"WURTH Produto de limpeza de travões.PDF",27:"WURTH Removedor de ferrugem Rost Off Blue Ice.PDF",
28:"SANITEC BLUE POWER WC GEL - FDS.pdf",29:"SANITEC GREEN POWER WC GEL - FS.pdf",30:"WURTH Silicone líquido em spray.PDF",
31:"WURTH SPRAY MASSA DE SILICONE.PDF",32:"Tensogen Thor Cream - FDS.PDF",33:"Urbadet Desoil - FDS.pdf",
35:"wd40 desengordurante.pdf",36:"wd40 Massa de lítio branco.pdf",37:"wd40 limpa contactos.pdf",38:"wd-40 limpa correntes.pdf",
39:"wd40 Lubrificante de correntes.pdf",40:"wd40 Lubrificante de silicone.pdf",41:"wd40 seco PTFE.pdf",42:"WD-40 massa.pdf",43:"wd40 penetrante.pdf",
44:"Adhesive Release Oil (AR Oil) Safety data sheet.pdf",45:"WURTH Óleo de manutenção Multi Cobra.PDF",
46:"FDS-SPRAY MANUTENÇAO MULTI PLUS NSF.PDF",47:"FDS-OLEO LUBRIFICAÇAO NSF 5L.PDF"
}
def norm(s):return unicodedata.normalize("NFC",s).lower()
files=list((ROOT/"11. Manutenção").rglob("*.pdf"))+list((ROOT/"11. Manutenção").rglob("*.PDF"))+list((ROOT/"9. Produção"/"FT substâncias orgânicas produção_manutenção").glob("*"))
records=[]
for i,p in enumerate(products):
 candidates=sorted(set(x for x in files if norm(x.name)==norm(patterns.get(i,"!"))))
 # Prefer the product's own folder over duplicate safety sheets saved with other products.
 if i==11:candidates.sort(key=lambda x:"GLADE BRISE" not in str(x))
 if i==29:candidates.sort(key=lambda x:"SANITEC GREEN POWER WC GEL/Ficha" not in str(x).replace("\\","/"))
 rec={**p,"index":i,"path":str(candidates[0]) if candidates else None}
 if candidates:
  try:
   reader=PdfReader(candidates[0])
   texts=[p.extract_text() for p in reader.pages]
   full="\n".join(texts)
   rec["pages"]=texts
   (HERE/f"fds-{i:02d}.txt").write_text(full,encoding="utf-8")
  except Exception as e:rec["error"]=str(e)
 records.append(rec)
(HERE/"extracted.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
print("Extracted",sum(bool(x.get("pages")) for x in records),"of",len(records))
for r in records:print(r["index"],r["name"],"OK" if r.get("pages") else r.get("error","MISSING"))
