/* Build an initial import without network calls or embedding private source data. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./unit-briefing-core.js'):root.UnitBriefingCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.UnitMigration=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const USERNAMES={4:'sivilsavunma',5:'isguvenligi',6:'bilgiislem',7:'insankaynaklari',8:'disiplin',9:'basinhalkla',10:'temelegitim',11:'ortaogretim',12:'strateji',13:'olcmedegerlendirme',14:'ozelogretim',15:'insaatemlak',16:'meslekiteknik',17:'destek',18:'butcetahakkuk',19:'denklik',20:'dinogretimi',21:'yuksekogretim',22:'hayatboyu',23:'meslekigelisim',24:'ozelegitim',25:'yenilikteknoloji',26:'istatistik'};
function build(snapshot,periodId,now){
 if(snapshot?.format!=='brifing-unit-migration-v1'||!/^[a-zA-Z0-9_-]+$/.test(periodId)||!now)throw Error('Başlangıç aktarım dosyası veya dönem geçersiz.');
 if(!/^[a-f0-9]{64}$/.test(snapshot.source?.sha256||''))throw Error('Kaynak dosya özeti eksik.');
 if(!Array.isArray(snapshot.records)||new Set(snapshot.records.map(r=>String(r.id))).size!==snapshot.records.length)throw Error('Yinelenen tablo kimliği.');
 if(!Array.isArray(snapshot.units)||new Set(snapshot.units.map(u=>String(u.id))).size!==snapshot.units.length)throw Error('Yinelenen birim kimliği.');
 const normalized=C.normalizeLegacy(snapshot,[]),units=normalized.units.map(u=>({...u,id:Number(u.id),username:USERNAMES[u.id]||'birim'+u.id}));
 const ids=new Set(units.map(u=>String(u.id))),writes=[],media=new Map(),tables=[];
 if(!units.length||ids.size!==units.length||units.some(u=>!Number.isSafeInteger(u.id)||u.id<1))throw Error('Birim listesi geçersiz veya yineleniyor.');
 const base='unitPeriods/'+periodId,recordIds=new Set();
 for(const original of normalized.records){
  const record=C.copy(original),id=String(record.id);
  if(!/^[a-zA-Z0-9_-]+$/.test(id)||recordIds.has(id))throw Error('Yinelenen veya geçersiz tablo kimliği.');recordIds.add(id);
  const fields=C.fieldsFromRecord(record),assignments=[...new Set(record.links.map(l=>String(l.unit)))].map(unitId=>({unitId,editRanges:record.links.filter(l=>String(l.unit)===unitId).map(l=>l.range)}));
  if(!assignments.length||assignments.some(a=>!ids.has(a.unitId)))throw Error('Tablonun birim ataması eksik: '+id);
  const table={...record,id,fields,assignments,allowedUnits:assignments.map(a=>a.unitId),legacyStatus:record.status,mediaIds:[],images:[]};C.validateTemplate(table);
  for(const address of Object.keys(fields)){
   if(!assignments.some(a=>C.editableAddresses(table,a.unitId).includes(address)))throw Error('Düzenlenebilir hücrenin birimi eksik: '+id+'!'+address);
  }
  for(const reference of record.images||[]){
   const asset=snapshot.assets?.[reference];
   if(!asset||!/^[a-f0-9]{64}$/.test(asset.sha256)||typeof asset.base64!=='string'||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.base64))throw Error('Görsel kaydı eksik veya geçersiz.');
   const mime=/\.png$/i.test(reference)?'image/png':/\.jpe?g$/i.test(reference)?'image/jpeg':/\.webp$/i.test(reference)?'image/webp':null;
   if(!mime)throw Error('Desteklenmeyen görsel türü.');
   const mediaId=asset.sha256;table.mediaIds.push(mediaId);
   if(!media.has(mediaId))media.set(mediaId,{mime,base64:asset.base64,allowedUnits:[]});
   const item=media.get(mediaId);item.allowedUnits=[...new Set([...item.allowedUnits,...table.allowedUnits])];
  }
  tables.push(table);
 }
 for(const [id,item]of media){const parts=[];for(let offset=0;offset<item.base64.length;offset+=240000){const part=String(parts.length);parts.push(part);writes.push({path:'unitMedia/'+id+'/parts/'+part,data:{payload:item.base64.slice(offset,offset+240000)}});}writes.push({path:'unitMedia/'+id,data:{mime:item.mime,parts,allowedUnits:item.allowedUnits}});}
 for(const unit of units){
  const unitId=String(unit.id),linked=tables.filter(t=>t.allowedUnits.includes(unitId)),cells={};
  for(const t of linked)for(const address of C.editableAddresses(t,unitId)){const p=C.point(address),value=t.rows[p.row-t.rowOffset]?.[p.column]?.v??null;cells[t.id+'!'+address]=C.validatePatch(t,unitId,{[address]:value})[address];}
  writes.push({path:base+'/schemas/'+unitId,data:{unitId,keys:Object.keys(cells),tableIds:linked.map(t=>t.id),titles:linked.map(t=>t.title||t.sheet||t.id),titleMap:Object.fromEntries(linked.map(t=>[t.id,t.title||t.sheet||t.id])),tableKeys:Object.fromEntries(linked.map(t=>[t.id,Object.keys(cells).filter(k=>k.startsWith(t.id+'!'))]))}});
  writes.push({path:base+'/importBase/'+unitId,data:{cells,sourceName:snapshot.source.name}});
  writes.push({path:base+'/reports/'+unitId,data:{unitId,periodId,version:0,status:'draft',draft:{cells,source:snapshot.source.name,asOf:now.slice(0,10),notes:''},pending:null,approved:null,pendingVersion:null,approvedVersion:null}});
 }
 for(const t of tables){for(const address of Object.keys(t.fields)){const p=C.point(address);t.rows[p.row-t.rowOffset][p.column].v=null;}const {rows,...data}=t;writes.push({path:base+'/tables/'+t.id,data:{...data,rowsJson:JSON.stringify(rows)}});}
 const warnings=[...(snapshot.warnings||[]),...normalized.warnings];
 const period={name:snapshot.source.period||periodId,createdAt:now,ready:false,locked:false,reviewMode:'table',sourceSha256:snapshot.source.sha256};
 writes.push({path:base+'/migration/audit',data:{at:now,sourceSha256:snapshot.source.sha256,unitCount:units.length,tableCount:tables.length,warnings}});
 return {periodId,period,units,writes,summary:{units:units.length,tables:tables.length,charts:tables.reduce((n,t)=>n+(t.charts||[]).length,0),images:media.size,fields:tables.reduce((n,t)=>n+Object.keys(t.fields).length,0),warnings}};
}
return {build,USERNAMES};
});
