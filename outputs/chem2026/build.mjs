import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const source='C:/Users/OAS-MANUTENCAO1/Desktop/IMPASS0104.00 – Matriz de consumos 2026.xlsx';
const data=JSON.parse(await fs.readFile(`${dir}/curated.json`,'utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const s=wb.worksheets.getItem('quimicos');
const before=await wb.render({sheetName:'quimicos',range:'A5:P10',scale:1.4});
await fs.writeFile(`${dir}/before.png`,new Uint8Array(await before.arrayBuffer()));
const grid=s.getRange('A23:R70');
grid.format.font={name:'Arial',size:10,color:'#222222'};
grid.format.fill='#FFFFFF';
grid.format.wrapText=true;
grid.format.verticalAlignment='center';
grid.format.rowHeight=66;
grid.format.borders={preset:'all',style:'thin',color:'#CCCCCC'};
s.getRange('N:N').format.columnWidth=34;
s.getRange('E:E').format.columnWidth=14;
s.getRange('P:P').format.columnWidth=15;
s.getRange('Q:Q').format.columnWidth=3;
s.getRange('R:R').format.columnWidth=64;
s.getRange('P5:P6').merge();s.getRange('P5').values=[['GHS07\nPonto de exclamação']];
s.getRange('R5:R6').merge();s.getRange('R5').values=[['Fonte FDS / informação por confirmar']];
for(const a of ['P5:P6','R5:R6']){
 s.getRange(a).format.fill='#DFEEDC';
 s.getRange(a).format.font={name:'Arial',size:10,bold:true};
 s.getRange(a).format.wrapText=true;
 s.getRange(a).format.verticalAlignment='center';
 s.getRange(a).format.borders={preset:'all',style:'thin',color:'#888888'};
}
for(let i=0;i<data.length;i++){
 const r=data[i],n=i+23;
 if(n>23)s.getRange(`A${n}:B${n}`).merge();
 s.getRange(`A${n}`).values=[[r.name]];
 const dateParts=r.date?.split(/[./-]/).map(Number);
 if(dateParts?.length===3){
  s.getRange(`E${n}`).values=[[new Date(Date.UTC(dateParts[2],dateParts[1]-1,dateParts[0]))]];
  s.getRange(`E${n}`).setNumberFormat('dd/mm/yyyy');
  s.getRange(`E${n}`).format.wrapText=false;
 }else{
  s.getRange(`E${n}`).values=[[r.path?'Não indicada':'FDS em falta']];
  s.getRange(`E${n}`).format.fill='#FFF0CA';
 }
 s.getRange(`K${n}`).values=[[r.path?(r.hazards.join('; ')||'Sem códigos H/EUH no rótulo'):'Por confirmar']];
 s.getRange(`N${n}`).values=[[r.ler]];
 s.getRange(`R${n}`).values=[[r.source]];
 if(!r.path){for(const col of ['A','K','N','R'])s.getRange(`${col}${n}`).format.fill='#FFF0CA';}
 for(const [p,col] of [[2,'F'],[8,'G'],[6,'H'],[5,'I'],[9,'J'],[7,'P']]){
  const cell=s.getRange(`${col}${n}`);
  cell.format.horizontalAlignment='center';
  if(r.pictograms.includes(p)){
   cell.values=[['X']];cell.format.fill='#FAC090';cell.format.font={name:'Arial',size:11,bold:true,color:'#713800'};
  }else if(!r.path)cell.values=[['?']];
 }
}
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'quimicos!E23:P27',tableMaxRows:5,tableMaxCols:12,maxChars:1500})).ndjson);
for(const [range,name] of [['A23:P28','after'],['K55:R60','details']]){
 const image=await wb.render({sheetName:'quimicos',range,scale:1.5});
 await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await image.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(`${dir}/donor.xlsx`);
console.log('DONOR SAVED');
