/* Shared, deterministic unit briefing rules. No network calls or source data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.UnitBriefingCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function fail(message){throw new Error(message);}
function cellAddress(row,column){let name='';for(let c=column+1;c>0;c=Math.floor((c-1)/26))name=String.fromCharCode(65+(c-1)%26)+name;return name+row;}
function point(value){const m=/^([A-Z]+)([1-9]\d*)$/.exec(String(value).replace(/\$/g,'').toUpperCase());if(!m)fail('Geçersiz hücre adresi.');let column=0;for(const c of m[1])column=column*26+c.charCodeAt(0)-64;const row=Number(m[2]);if(row>1048576||column>16384)fail('Hücre adresi Excel sınırlarını aşıyor.');return {row,column:column-1};}
function range(value){if(value==='*')return null;const parts=String(value).split(':');if(parts.length>2)fail('Geçersiz hücre aralığı.');const a=point(parts[0]),b=point(parts[1]||parts[0]);if(a.row>b.row||a.column>b.column)fail('Hücre aralığı ters sıralı.');return {top:a.row,bottom:b.row,left:a.column,right:b.column};}
function contains(selection,address){const r=range(selection),p=point(address);return !r||(p.row>=r.top&&p.row<=r.bottom&&p.column>=r.left&&p.column<=r.right);}
function normalizeLegacy(seed,overlays){
 if(!seed||!Array.isArray(seed.units)||!Array.isArray(seed.records))fail('Eski sistem kaydı geçersiz.');
 const units=new Map(seed.units.map(u=>[String(u.id),copy(u)])),records=new Map(seed.records.map(r=>[String(r.id),copy(r)])),warnings=[];
 for(const entry of overlays||[]){const [kind,id]=entry.key.split(':');const v=entry.value;
  if(kind==='unit'&&units.has(id))Object.assign(units.get(id),copy(v));
  if(kind==='record'){if(records.has(id))Object.assign(records.get(id),copy(v));else if(v.source===false&&Array.isArray(v.rows))records.set(id,copy(v));else warnings.push({code:'orphan-record-overlay',id});}
 }
 const activeUnits=[...units.values()].filter(u=>!u.deleted),ids=new Set(activeUnits.map(u=>String(u.id)));
 const activeRecords=[...records.values()].filter(r=>!r.deleted).map(r=>({...r,links:(r.links||[]).filter(l=>ids.has(String(l.unit)))}));
 for(const r of activeRecords)if(!r.links.length)warnings.push({code:'unassigned-record',id:String(r.id)});
 return {units:activeUnits,records:activeRecords,period:seed.period||'',sourceName:seed.sourceName||'',warnings};
}
function fieldsFromRecord(record){
 const fields={};record.rows.forEach((row,i)=>row.forEach((cell,j)=>{const address=cellAddress(i+(record.rowOffset||1),j);if(typeof cell.v==='number')fields[address]={type:'number',min:0,max:1e12};}));
 const rows=record.rows,offset=record.rowOffset||1;
 for(let i=0;i<rows.length;i++){
  if(typeof rows[i]?.[0]?.v!=='string'||!/^Tablo\s/i.test(rows[i][0].v))continue;
  let header=i+1;while(header<rows.length&&!rows[header].some(c=>c.v!==null&&String(c.v).trim()))header++;
  if(header>=rows.length)continue;
  let end=header+1;while(end<rows.length&&!/^(Tablo\s|Kaynak\s*\/|Kaynak\s*:|Raporlama dönemi)/i.test(String(rows[end]?.[0]?.v||'')))end++;
  const data=rows.slice(header+1,end),labelled=data.some(row=>row[0]?.v!==null&&String(row[0]?.v??'').trim());
  for(let r=header+1;r<end;r++){
   if(labelled&&!rows[r].some(c=>c.v!==null&&String(c.v).trim()))continue;
   for(let c=0;c<rows[header].length;c++){
    const label=rows[header][c]?.v;if(typeof label!=='string'||!label.trim()||c===0&&rows[r][0]?.v!==null&&String(rows[r][0]?.v??'').trim())continue;
    const address=cellAddress(r+offset,c);fields[address]||=/(adet|sayısı|sayisi|miktar|tutar|oran|yüzde|yuzde|ödenek|odenek|toplam)/i.test(label)?{type:'number',min:0,max:1e12}:{type:'text',maxLength:20000};
   }
  }
  i=header;
 }
 return fields;
}
function validateTemplate(template){
 if(!template||!template.id||!template.fields||!Array.isArray(template.assignments))fail('Tablo tanımı eksik.');
 for(const [address,field]of Object.entries(template.fields)){point(address);if(!['number','integer','text','date'].includes(field.type))fail('Alan türü geçersiz.');}
 const owners=new Map();
 for(const assignment of template.assignments){
  if(!assignment.unitId||!Array.isArray(assignment.editRanges))fail('Birim aralıkları eksik.');
  for(const selection of assignment.editRanges)range(selection);
  for(const address of Object.keys(template.fields)){if(assignment.editRanges.some(r=>contains(r,address))){const owner=owners.get(address);if(owner&&owner!==String(assignment.unitId))fail(address+' hücresi birden fazla birime düzenleme için atanamaz.');owners.set(address,String(assignment.unitId));}}
 }
 return template;
}
function editableAddresses(template,unitId){validateTemplate(template);const assignments=template.assignments.filter(a=>String(a.unitId)===String(unitId));return Object.keys(template.fields).filter(k=>assignments.some(a=>a.editRanges.some(r=>contains(r,k))));}
function validateValue(field,value){
 if(value==='-')return '-';
 if(typeof value==='string'&&!value.trim())return null;
 if(value===null||value==='')return null;
 if(field.type==='number'||field.type==='integer'){
  if(typeof value!=='number'||!Number.isFinite(value)||(field.type==='integer'&&!Number.isInteger(value))||value<(field.min??0)||value>(field.max??1e12))fail('Sayısal alan geçersiz.');return value;
 }
 if(typeof value!=='string'||value.length>(field.maxLength||20000))fail('Metin alanı geçersiz.');
 if(field.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))fail('Tarih alanı geçersiz.');
 return value;
}
function validatePatch(template,unitId,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))fail('Hücre verisi geçersiz.');
 const allowed=new Set(editableAddresses(template,unitId)),out={};
 for(const [address,value]of Object.entries(patch)){if(!allowed.has(address))fail('Bu hücre için düzenleme yetkiniz yok: '+address);out[address]=validateValue(template.fields[address],value);}return out;
}
function emptyPeriod(templates,unitId){
 const tables={};for(const t of templates){const addresses=editableAddresses(t,unitId);if(addresses.length)tables[t.id]=Object.fromEntries(addresses.map(k=>[k,null]));}return {tables,source:'',asOf:'',notes:''};
}
function validatePackage(templates,unitId,payload){
 if(!payload||!payload.tables||typeof payload.tables!=='object'||Array.isArray(payload.tables))fail('Birim paketi eksik.');
 const allowed=new Map(templates.filter(t=>t.assignments.some(a=>String(a.unitId)===String(unitId))).map(t=>[String(t.id),t]));
 const tables={};for(const [id,values]of Object.entries(payload.tables)){if(!allowed.has(id))fail('Başka birimin tablosuna veri gönderilemez.');tables[id]=validatePatch(allowed.get(id),unitId,values);}
 for(const [id,t]of allowed){tables[id]||={};for(const address of editableAddresses(t,unitId))if(!(address in tables[id]))tables[id][address]=null;}
 const source=String(payload.source||'').trim(),notes=String(payload.notes||''),asOf=String(payload.asOf||'');
 if(source.length>500||notes.length>10000)fail('Açıklama çok uzun.');
 if(asOf)validateValue({type:'date'},asOf);
 const savedTables=[...new Set((payload.savedTables||[]).map(String))];if(savedTables.some(id=>!allowed.has(id)))fail('Kaydedilen tablo listesi geçersiz.');
 return {tables,source,asOf,notes,savedTables};
}
function flatProgress(schema,payload){const ids=schema?.tableIds||[],saved=new Set(payload?.savedTables||[]),cells=payload?.cells||{};const complete=ids.filter(id=>saved.has(String(id))&&(schema.keys||[]).filter(k=>k.startsWith(id+'!')).every(k=>cells[k]!==null&&cells[k]!==undefined&&String(cells[k]).trim()!==''));return {total:ids.length,saved:complete.length,percent:ids.length?Math.floor(complete.length/ids.length*100):0,complete};}
function transition(existing,command,context){
 const {templates,unitId,actor,now}=context;
 if(!actor||!actor.id||!now)fail('Oturum ve tarih gereklidir.');
 const next=existing?copy(existing):{unitId:String(unitId),periodId:command.periodId,version:0,status:'draft',draft:null,pending:null,approved:null,pendingVersion:null,approvedVersion:null};
 if(next.unitId!==String(unitId)||next.periodId!==command.periodId)fail('Birim veya dönem uyuşmuyor.');
 if(command.version!==next.version)fail('Kayıt başka oturumda değişti.');
 const manager=actor.role==='admin',editor=manager||(actor.editUnits||[]).map(String).includes(String(unitId));
 if(['save','save-table','submit'].includes(command.action)){
  if(!editor)fail('Bu birim için veri giriş yetkiniz yok.');
  const payload=validatePackage(templates,unitId,command.payload);
  if(next.draft)payload.savedTables=payload.savedTables.filter(id=>equal(payload.tables[id],next.draft.tables[id]));
  if(command.action==='save-table'){
   const id=String(command.tableId);if(!(id in payload.tables))fail('Kaydedilecek tablo bu birime bağlı değil.');
   if(Object.values(payload.tables[id]).some(v=>v===null||v===undefined||String(v).trim()===''))fail('Boş hücre bırakmayınız. Veri yoksa - işareti giriniz.');
   if(next.draft){const current=payload.tables[id];payload.tables=copy(next.draft.tables);payload.tables[id]=current;payload.savedTables=(next.draft.savedTables||[]).filter(saved=>saved!==id||equal(next.draft.tables[id],current));}
   payload.savedTables=[...new Set([...payload.savedTables,id])];
  }
  if(command.action==='submit'){
   if(!Object.keys(payload.tables).length||payload.savedTables.length!==Object.keys(payload.tables).length||Object.values(payload.tables).some(c=>Object.values(c).some(v=>v===null||v===undefined||String(v).trim()==='')))fail('Tüm tabloları doldurup kaydediniz. Boş kalması gereken alanlara - işareti giriniz.');
   if(!payload.source||!payload.asOf)fail('Kontrole göndermek için kaynak ve veri tarihi giriniz.');
   if(equal(payload,next.pending||next.approved))fail('Gönderilecek yeni değişiklik bulunmuyor.');
   next.pending=copy(payload);next.pendingVersion=next.version+1;next.status='pending';next.submittedAt=now;next.submittedBy=actor.id;next.reviewNote='';
  }else if(next.status!=='pending')next.status='draft';
  next.draft=payload;next.updatedAt=now;
 }else if(['approve','return'].includes(command.action)){
  if(!manager)fail('Yönetici yetkisi gereklidir.');
  if(next.status!=='pending'||!next.pending||command.pendingVersion!==next.pendingVersion)fail('Kontrol bekleyen sürüm değişti.');
  if(command.action==='approve'){next.approved=copy(next.pending);next.approvedVersion=next.pendingVersion;next.approvedAt=now;next.approvedBy=actor.id;next.status=equal(next.draft,next.pending)?'approved':'draft';next.reviewNote='';}
  else{const note=String(command.note||'').trim();if(!note||note.length>2000)fail('Düzeltme açıklaması gereklidir.');next.reviewNote=note;next.status='returned';}
  next.pending=null;next.pendingVersion=null;
 }else fail('İşlem desteklenmiyor.');
 next.version++;return next;
}
function importDifferences(baseline,current,incoming){
 const result=[],keys=new Set([...Object.keys(baseline||{}),...Object.keys(current||{}),...Object.keys(incoming||{})]);
 for(const key of keys){const b=baseline?.[key]??null,c=current?.[key]??null,i=incoming?.[key]??null;if(equal(c,i))continue;
  const userChanged=!equal(c,b),excelChanged=!equal(i,b);
  result.push({key,baseline:b,current:c,incoming:i,conflict:userChanged&&excelChanged,suggested:userChanged?'keep-current':'use-excel'});
 }return result;
}
function applyImport(current,incoming,differences,choices){
 const out=copy(current);
 for(const diff of differences){const choice=choices[diff.key];if(!['keep-current','use-excel'].includes(choice))fail('Her fark için seçim yapınız: '+diff.key);if(choice==='use-excel')out[diff.key]=copy(incoming[diff.key]??null);}return out;
}
return {flatProgress,copy,equal,cellAddress,point,range,contains,normalizeLegacy,fieldsFromRecord,validateTemplate,editableAddresses,validatePatch,emptyPeriod,validatePackage,transition,importDifferences,applyImport};
});

