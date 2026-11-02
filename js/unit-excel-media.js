/* Read OOXML drawings without sending the workbook to a server. */
(function(){
'use strict';
const children=(node,name)=>Array.from(node?.getElementsByTagNameNS('*',name)||[]);
const first=(node,name)=>children(node,name)[0];
const text=(node,name)=>first(node,name)?.textContent||'';
const rid=node=>node?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||node?.getAttribute('r:id');
function resolve(base,target){if(target.startsWith('/'))return target.slice(1);const parts=base.split('/');parts.pop();for(const p of target.split('/')){if(p==='..')parts.pop();else if(p&&p!=='.')parts.push(p);}return parts.join('/');}
async function read(buffer,Zip,workbook){
 const bytes=new Uint8Array(buffer);if(bytes[0]!==0x50||bytes[1]!==0x4b)return {};
 if(!Zip)throw Error('Excel görsellerini okumak için ZIP bileşeni yüklenemedi.');
 const zip=await Zip.loadAsync(buffer),parser=new DOMParser(),out={};
 async function xml(path){const f=zip.file(path);if(!f)return null;const content=await f.async('string');if(content.length>10000000)throw Error('Excel çizim dosyası çok büyük.');const d=parser.parseFromString(content,'application/xml');if(children(d,'parsererror').length)throw Error('Excel çizim tanımı geçersiz.');return d;}
 async function rels(path){const p=path.split('/'),name=p.pop(),doc=await xml(p.join('/')+'/_rels/'+name+'.rels'),result={};for(const r of children(doc,'Relationship'))if(r.getAttribute('TargetMode')!=='External')result[r.getAttribute('Id')]=resolve(path,r.getAttribute('Target'));return result;}
 function chart(doc){
  const plot=first(doc,'plotArea'),type=children(plot,'pieChart').length||children(plot,'doughnutChart').length?'pie':children(plot,'lineChart').length?'line':'bar';
  const title=children(first(doc,'title'),'t').map(t=>t.textContent).join(' ');
  const series=children(plot,'ser').map(s=>{const category=first(s,'cat'),value=first(s,'val')||first(s,'yVal'),tx=first(s,'tx');return {label:text(tx,'v')||text(tx,'t')||'Değer',catRef:text(category,'f'),valRef:text(value,'f'),categories:children(category,'pt').map(p=>text(p,'v')),values:children(value,'pt').map(p=>text(p,'v'))};});
  return {title,type,series};
 }
 const book=await xml('xl/workbook.xml'),bookRels=await rels('xl/workbook.xml');
 const shared=workbook?children(await xml('xl/sharedStrings.xml'),'si').map(si=>children(si,'t').map(t=>t.textContent).join('')):[];
 const correctedSheets={},correctedNames=[];
 for(const sheet of children(book,'sheet')){
  const path=bookRels[rid(sheet)];if(!path)continue;
  const doc=await xml(path),sheetRels=await rels(path),item={images:[],charts:[]};
  if(workbook){
   // DOMParser decodes the OOXML UTF-8 directly; the legacy reader corrupts some Turkish characters.
   const name=sheet.getAttribute('name'),oldName=workbook.SheetNames[correctedNames.length],ws=workbook.Sheets[oldName]||{};
   for(const cell of children(doc,'c')){const address=cell.getAttribute('r'),type=cell.getAttribute('t'),v=text(cell,'v');if(!address)continue;
    const value=type==='s'?shared[Number(v)]??'':type==='inlineStr'?children(first(cell,'is'),'t').map(n=>n.textContent).join(''):type==='str'||type==='e'||type==='d'?v:type==='b'?v==='1':v===''?null:Number(v);
    ws[address]={...(ws[address]||{}),v:value,t:typeof value==='number'?'n':typeof value==='boolean'?'b':'s'};
   }
   correctedNames.push(name);correctedSheets[name]=ws;
  }
  for(const drawing of children(doc,'drawing')){
   const drawingPath=sheetRels[rid(drawing)];if(!drawingPath)continue;
   const drawingDoc=await xml(drawingPath),drawingRels=await rels(drawingPath);
   for(const blip of children(drawingDoc,'blip')){
    const id=blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed')||blip.getAttribute('r:embed'),imagePath=drawingRels[id];
    if(!imagePath)continue;const file=zip.file(imagePath);if(!file)throw Error('Excel görsel dosyası eksik.');
    const ext=imagePath.split('.').pop().toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[ext];
    if(!mime)throw Error('Excel görsel biçimi desteklenmiyor: '+ext+'. PNG veya JPEG olarak kaydediniz.');
    const data=await file.async('uint8array');if(data.length>6000000)throw Error('Excel görseli 6 MB sınırını aşıyor.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
    item.images.push({id:hash,mime,base64:await file.async('base64')});
   }
   for(const node of children(drawingDoc,'chart')){const chartPath=drawingRels[rid(node)];if(chartPath){const doc=await xml(chartPath);if(!doc)throw Error('Excel grafik dosyası eksik.');item.charts.push(chart(doc));}}
  }
  out[sheet.getAttribute('name')]=item;
 }
 if(workbook){workbook.SheetNames=correctedNames;workbook.Sheets=correctedSheets;}
 return out;
}
window.UnitExcelMedia={read};
})();
