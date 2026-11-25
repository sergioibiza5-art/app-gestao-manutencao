import json,re
from pathlib import Path
P=Path(__file__).parent
records=json.loads((P/"extracted.json").read_text(encoding="utf-8"))
for i,r in enumerate(records):
 if not r.get("pages"): continue
 text="\n".join(r["pages"])
 def section(n):
  start=re.search(r"(?m)^\s*(?:SECÇÃO|SEÇÃO|SECTION)\s+"+str(n)+r"\s*[:.]",text)
  if not start:return ""
  rest=text[start.start():]
  end=re.search(r"(?m)^\s*(?:SECÇÃO|SEÇÃO|SECTION)\s+"+str(n+1)+r"\s*[:.]",rest)
  return rest[:end.start()] if end else rest[:14000]
 sec2=section(2);sec13=section(13)
 dates=re.findall(r"(?:Revisão \(data\):|Data de revisão:|Revisto em / versão:|Revision Date:|Revisão:)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})",text[:4000])
 codes=list(dict.fromkeys(re.findall(r"(?<![A-Z])(?:EUH|H)\d{3}[A-Za-z]?",sec2)))
 waste=list(dict.fromkeys(re.findall(r"\b\d{2}[ ]\d{2}[ ]\d{2}\s*\*?|\b\d{6}\s*\*?",sec13)))
 r.update(date=dates[0] if dates else "",hazards=codes,waste=[x.strip() for x in waste],section2=sec2,section13=sec13)
 print(i,r["name"],"DATE",r["date"],"H",codes,"LER",r["waste"])
 if not sec2:print("NO SECTION2")
 if not sec13:print("NO SECTION13")
(P/"review.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
