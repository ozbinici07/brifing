/* Firebase unit briefing service. All writes are additionally scoped by Firestore Rules. */
(function(){
'use strict';
const C=window.UnitBriefingCore,$=id=>document.getElementById(id),cfg=window.BRIFING_FIREBASE_CONFIG;
const api=()=>window.__personnelFirestore;
const clone=C.copy;
const uid=()=>{try{return JSON.parse(atob(window.token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).user_id;}catch{return '';}};
let profile=null,catalog=null;
const isAdmin=()=>window.authUser?.()?.role==='System Admin';
async function account(){if(!uid())return null;const d=await api().read('unitAccounts/'+uid());profile=d?.data||(window.authUser()?.username==='admin'?{uid:uid(),username:'admin',role:'admin',active:true,editUnits:[],readUnits:[],screens:['*']}:null);if(!profile?.active)throw Error('Bu hesabın birim erişimi etkin değil.');return profile;}
async function listPeriods(){return (await api().list('unitPeriods')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||b.name.localeCompare(a.name,'tr'));}
async function units(){catalog=(await api().read('unitCatalog/main'))?.data||{units:[]};return catalog.units;}
async function schemas(period){const p=await account(),us=await units();return isAdmin()?await api().list('unitPeriods/'+period+'/schemas'):Promise.all([...new Set([...(p.editUnits||[]),...(p.readUnits||[])])].map(id=>api().read('unitPeriods/'+period+'/schemas/'+id).then(d=>d?{id:String(id),...d.data}:null))).then(a=>a.filter(Boolean));}
const decodeTable=t=>({...t,rows:JSON.parse(t.rowsJson||'[]')});
const encodeTable=t=>{const {rows,...rest}=t;return {...rest,rowsJson:JSON.stringify(rows)};};
async function templates(period,schema){return Promise.all(schema.tableIds.map(id=>api().read('unitPeriods/'+period+'/tables/'+id).then(d=>d?.data).then(d=>{if(!d)throw Error('Tablo tanımı eksik.');return decodeTable(d);})));}
async function report(period,unit){return await api().read('unitPeriods/'+period+'/reports/'+unit);}
function nested(payload){if(!payload)return null;const tables={};for(const[k,v]of Object.entries(payload.cells||{})){const i=k.indexOf('!'),id=k.slice(0,i),cell=k.slice(i+1);(tables[id]||={})[cell]=v;}return {tables,source:payload.source,asOf:payload.asOf,notes:payload.notes};}
function flat(payload){if(!payload)return null;return {cells:Object.fromEntries(Object.entries(payload.tables).flatMap(([id,cells])=>Object.entries(cells).map(([k,v])=>[id+'!'+k,v]))),source:payload.source,asOf:payload.asOf,notes:payload.notes};}
async function savePackage(period,unit,command){
 const [s,ts,p]=await Promise.all([api().read('unitPeriods/'+period+'/schemas/'+unit),report(period,unit),account()]);
 if(!s)throw Error('Birim tablo tanımları bulunamadı.');
 const t=await templates(period,s.data),existing=ts?.data;
 const from=existing?{...existing,draft:nested(existing.draft),pending:nested(existing.pending),approved:nested(existing.approved)}:null;
 const next=C.transition(from,{...command,periodId:period,payload:command.payload?nested(command.payload):undefined},{unitId:unit,templates:t,actor:{id:uid(),role:p.role,editUnits:p.editUnits},now:new Date().toISOString()});
 const stored={...next,draft:flat(next.draft),pending:flat(next.pending),approved:flat(next.approved)};
 const root='unitPeriods/'+period;
 const writes=[api().write(root+'/reports/'+unit,stored,ts),api().write(root+'/history/'+crypto.randomUUID(),{unitId:String(unit),actor:uid(),action:command.action,version:next.version,at:new Date().toISOString(),payload:command.action==='approve'?stored.approved:command.action==='return'?{note:command.note}:stored.draft},null)];
 if(command.action==='approve'){const path=root+'/published/'+unit,old=await api().read(path);writes.push(api().write(path,{unitId:String(unit),version:next.approvedVersion,payload:stored.approved},old));}
 await api().commit(writes);
 return stored;
}
async function media(id){const meta=await api().read('unitMedia/'+id);if(!meta)throw Error('Görsel bulunamadı.');const parts=await Promise.all(meta.data.parts.map(i=>api().read('unitMedia/'+id+'/parts/'+i)));return 'data:'+meta.data.mime+';base64,'+parts.map(d=>d.data.payload).join('');}
async function materialize(period,schema,view){
 const p=await account(),canEdit=p.role==='admin'||p.editUnits?.includes(String(schema.unitId));
 const [ts,r]=await Promise.all([templates(period,schema),canEdit?report(period,schema.unitId):api().read('unitPeriods/'+period+'/published/'+schema.unitId)]);
 const payload=!canEdit?r?.data.payload:view==='pending'?r?.data.pending:view==='approved'?r?.data.approved:(r?.data.draft||r?.data.approved);
 const cells=payload?.cells||{};
 return {report:(!canEdit&&r?{...r.data,status:'approved',approved:r.data.payload,draft:r.data.payload}:r?.data)||{version:0,status:'draft',draft:{cells:{},source:'',asOf:'',notes:''}},canEdit,records:await Promise.all(ts.map(async t=>{
  const row=clone(t.rows);for(const[address]of Object.entries(t.fields)){const pt=C.point(address),v=cells[t.id+'!'+address]??null;if(row[pt.row-t.rowOffset]?.[pt.column])row[pt.row-t.rowOffset][pt.column].v=v;}
  return {...t,rows:row,images:await Promise.all((t.mediaIds||[]).map(media))};
 }))};
}
async function createAccount(data){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 if(!/^[a-z][a-z0-9._-]{2,31}$/.test(data.username))throw Error('Kullanıcı adı 3–32 küçük harf/rakam olmalıdır.');
 if(typeof data.password!=='string'||data.password.length<8)throw Error('En az 8 karakterli başlangıç şifresi giriniz.');
 if(await api().read('unitLoginDirectory/'+data.username))throw Error('Kullanıcı adı zaten kullanılıyor.');
 const email=data.username+'@brifingbilgisistemi.firebaseapp.com';
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:data.password,returnSecureToken:false})}),j=await response.json();
 if(!response.ok)throw Error(j.error?.message==='EMAIL_EXISTS'?'Bu kullanıcı için kimlik hesabı zaten var.':'Hesap oluşturulamadı: '+(j.error?.message||response.status));
 const next={uid:j.localId,username:data.username,display:data.display||data.username,role:data.role||'unit',active:true,editUnits:data.editUnits||[],readUnits:data.readUnits||[],screens:data.screens||['units'],mustChange:true};
 const directory={username:next.username,email,display:next.display,unit:'Birimler',role:next.role==='admin'?'System Admin':'Unit User',active:true};
 try{await api().commit([api().write('unitAccounts/'+j.localId,next,null),api().write('unitLoginDirectory/'+next.username,directory,null)]);}catch(e){throw Error('Kimlik hesabı açıldı ancak yetki kaydı tamamlanamadı. Aynı hesabı yeniden oluşturmadan yöneticiden kayıt onarımı isteyiniz. '+e.message);}
 return next;
}
async function updateAccount(data){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');const current=await api().read('unitAccounts/'+data.uid);if(!current)throw Error('Hesap bulunamadı.');
 if(data.uid===uid()&&(data.active===false||data.role!=='admin'))throw Error('Kendi yönetici erişiminizi kaldıramazsınız.');
 const next={...current.data,role:data.role,active:!!data.active,readUnits:data.readUnits||[],editUnits:data.editUnits||[],screens:data.screens||['units']};
 if(!['admin','unit'].includes(next.role))throw Error('Rol geçersiz.');
 const dir=await api().read('unitLoginDirectory/'+next.username),d={...dir.data,active:next.active,role:next.role==='admin'?'System Admin':'Unit User'};
 await api().commit([api().write('unitAccounts/'+data.uid,next,current),api().write('unitLoginDirectory/'+next.username,d,dir)]);
}
async function changePassword(password){
 if(typeof password!=='string'||password.length<8)throw Error('Şifre en az 8 karakter olmalıdır.');
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key='+cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:window.token(),password,returnSecureToken:false})}),j=await r.json();if(!r.ok)throw Error('Şifre değiştirilemedi: '+(j.error?.message||r.status));
 const p=await api().read('unitAccounts/'+uid());if(p)await api().commit([api().write('unitAccounts/'+uid(),{...p.data,mustChange:false},p)]);
}
async function newPeriod(name){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');name=String(name||'').trim();if(name.length<4||name.length>100)throw Error('Dönem adı giriniz.');
 const prior=(await listPeriods())[0];if(!prior)throw Error('Önce başlangıç Excel aktarımını yapınız.');
 const globals=(await window.api('/api/periods')).periods||[],matching=globals.find(p=>p.name===name),id=matching?.folder||window.__brifingExcelParser.periodFolder(name),base='unitPeriods/'+id,old='unitPeriods/'+prior.id;
 if(await api().read(base))throw Error('Bu birim dönemi zaten var.');
 if(!matching){const main='periods/'+id,emptyStaff={teacher:{public:0,private:0,total:0,by_level:[]},manager:{public:0,private:0,total:0,by_level:[]},manager_need:{norm:0,current:0,need:0,by_title:[]}};await api().commit([api().write(main,{folder:id,name,basePeriod:name,latestVersion:'units_empty',active:false,hasStudents:false,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()},null),api().write(main+'/versions/units_empty',{summary:{institution_count:0,active_institutions:0,public_institutions:0,private_institutions:0,basic_students:0,secondary_students:0,total_students:0,teacher_total:0,manager_total:0},staff:emptyStaff,validation:{},fileMeta:[]},null)]);}
 await api().commit([api().write(base,{name,createdAt:new Date().toISOString(),ready:false},null)]);
 const [ss,ts]=await Promise.all([api().list(old+'/schemas'),api().list(old+'/tables')]);
 for(const t of ts)await api().commit([api().write(base+'/tables/'+t.id,t,null)]);
 for(const s of ss){const values=Object.fromEntries(s.keys.map(k=>[k,null]));await api().commit([api().write(base+'/schemas/'+s.unitId,{...s,baseline:values},null),api().write(base+'/reports/'+s.unitId,{unitId:String(s.unitId),periodId:id,version:0,status:'draft',draft:{cells:values,source:'',asOf:'',notes:''},pending:null,approved:null,pendingVersion:null,approvedVersion:null},null)]);}
 const snapshot=await api().read(base);await api().commit([api().write(base,{...snapshot.data,ready:true},snapshot)]);return id;
}

async function saveMapping(period,template){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 C.validateTemplate(template);
 const root='unitPeriods/'+period,[all,ss,rs]=await Promise.all([api().list(root+'/tables'),api().list(root+'/schemas'),api().list(root+'/reports')]);
 if(rs.some(r=>r.status==='pending'))throw Error('Eşlemeyi değiştirmeden önce kontrol bekleyen paketleri sonuçlandırınız.');
 template={...template,allowedUnits:[...new Set(template.assignments.map(x=>String(x.unitId)))],links:template.assignments.flatMap(a=>a.editRanges.map(range=>({unit:Number(a.unitId),range,label:range==='*'?'Tüm sayfa':range})))};
 const tables=all.map(t=>t.id===template.id?template:decodeTable(t)),us=await units(),writes=[],existingTemplate=await api().read(root+'/tables/'+template.id);
 const priorValues=Object.assign({},...rs.map(r=>r.draft?.cells||{}));
 for(const address of Object.keys(template.fields)){const p=C.point(address),value=template.rows[p.row-template.rowOffset]?.[p.column]?.v;if(value!==null&&value!==undefined)priorValues[template.id+'!'+address]??=value;if(template.rows[p.row-template.rowOffset]?.[p.column])template.rows[p.row-template.rowOffset][p.column].v=null;}
 writes.push(api().write(root+'/tables/'+template.id,encodeTable(template),existingTemplate));
 for(const u of us){
  const unitId=String(u.id),keys=tables.flatMap(t=>C.editableAddresses(t,unitId).map(k=>t.id+'!'+k)),tableIds=tables.filter(t=>t.assignments.some(a=>String(a.unitId)===unitId)).map(t=>t.id),schemaPath=root+'/schemas/'+unitId;
  const oldSchema=await api().read(schemaPath);writes.push(api().write(schemaPath,{unitId,tableIds,keys},oldSchema));
  const previous=await report(period,unitId),old=previous?.data||{unitId,periodId:period,version:0,status:'draft',draft:{cells:{},source:'',asOf:'',notes:''},approved:null,approvedVersion:null,pending:null,pendingVersion:null};
  const next={...old,version:old.version+1,status:'draft',draft:{...old.draft,cells:Object.fromEntries(keys.map(k=>[k,old.draft?.cells[k]??priorValues[k]??null]))}};
  writes.push(api().write(root+'/reports/'+unitId,next,previous));
  writes.push(api().write(root+'/history/'+crypto.randomUUID(),{unitId,actor:uid(),action:'mapping',version:next.version,at:new Date().toISOString(),payload:old.draft},null));
 }
 for(const id of template.mediaIds||[]){const p='unitMedia/'+id,old=await api().read(p);if(old)writes.push(api().write(p,{...old.data,allowedUnits:[...new Set([...old.data.allowedUnits,...template.allowedUnits])]},old));}
 await api().commit(writes);
}
async function prepareExcel(period,file){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellNF:true,cellStyles:true}),root='unitPeriods/'+period;
 const [ss,rs]=await Promise.all([api().list(root+'/schemas'),api().list(root+'/reports')]);
 const tables=await api().list(root+'/tables'),byId=Object.fromEntries(tables.map(t=>[t.id,t])),differences=[],changes=[];
 for(const schema of ss){
  const unitId=schema.unitId,report=rs.find(r=>r.unitId===unitId),base=(await api().read(root+'/importBase/'+unitId))?.data?.cells||{},current=report?.draft?.cells||{},incoming={...base};
  for(const key of schema.keys){const i=key.indexOf('!'),table=byId[key.slice(0,i)],sheet=workbook.Sheets[table.sheet];if(!sheet)continue;const value=sheet[key.slice(i+1)]?.v??null;const address=key.slice(i+1);incoming[key]=C.validatePatch(table,unitId,{[address]:value})[address];}
  const diffs=C.importDifferences(base,current,incoming);differences.push(...diffs.map(d=>({...d,unitId,table:byId[d.key.split('!')[0]]?.title})));
  changes.push({unitId,baseline:incoming,current,version:report?.version||0,diffs});
 }
 const unknown=workbook.SheetNames.filter(name=>!tables.some(t=>t.sheet===name)&&!['Kapak','Anasayfa','Birimler'].includes(name));
 const newTables=unknown.map(sheet=>{
  const ws=workbook.Sheets[sheet],bounds=window.XLSX.utils.decode_range(ws['!ref']||'A1'),rowOffset=/^\d+ /.test(sheet)?4:1,rows=[];
  for(let r=rowOffset-1;r<=bounds.e.r;r++){const row=[];for(let col=0;col<=bounds.e.c;col++){const cell=ws[window.XLSX.utils.encode_cell({r,c:col})];row.push({v:cell?.v??null,f:cell?.z||'General',bold:false,bg:null});}rows.push(row);}
  const record={id:'sheet_'+crypto.randomUUID().replace(/-/g,''),title:String(ws.A3?.v||sheet),sheet,rowOffset,rows,merges:(ws['!merges']||[]).map(window.XLSX.utils.encode_range),images:[],mediaIds:[],charts:[],description:'',owner:'',content:'Excel tablosu',source:true,legacyStatus:'pending'};
  return {...record,fields:C.fieldsFromRecord(record),unitId:''};
 });
 return {name:file.name,period,differences,changes,newTables};
}
async function applyExcel(plan,choices){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 const root='unitPeriods/'+plan.period,writes=[];
 const extra={};
 for(const table of plan.newTables||[]){
  if(!table.unitId)throw Error('Yeni tabloların birim atamasını seçiniz.');
  const unitId=String(table.unitId),incoming={};for(const address of Object.keys(table.fields)){const p=C.point(address);incoming[table.id+'!'+address]=table.rows[p.row-table.rowOffset]?.[p.column]?.v??null;table.rows[p.row-table.rowOffset][p.column].v=null;}
  const t={...table,assignments:[{unitId,editRanges:['*']}],allowedUnits:[unitId],links:[{unit:Number(unitId),range:'*',label:'Tüm sayfa'}]};
  writes.push(api().write(root+'/tables/'+t.id,encodeTable(t),null));
  (extra[unitId]||={cells:{},tables:[]});Object.assign(extra[unitId].cells,incoming);extra[unitId].tables.push(t.id);
 }
 for(const item of plan.changes){
  const snapshot=await report(plan.period,item.unitId),old=snapshot?.data;if(!old||old.version!==item.version)throw Error('Önizlemeden sonra birim verisi değişti; Excel’i yeniden inceleyiniz.');
  if(old.status==='pending')throw Error('Kontrol bekleyen paket varken Excel aktarımı yapılamaz.');
  const picked=Object.fromEntries(item.diffs.map(d=>[d.key,choices[item.unitId+'!'+d.key]]));
  let cells=C.applyImport(item.current,item.baseline,item.diffs,picked);
  if(extra[item.unitId]){
   cells={...cells,...extra[item.unitId].cells};item.baseline={...item.baseline,...extra[item.unitId].cells};
   const sp=root+'/schemas/'+item.unitId,oldSchema=await api().read(sp);
   writes.push(api().write(sp,{...oldSchema.data,keys:[...new Set([...oldSchema.data.keys,...Object.keys(extra[item.unitId].cells)])],tableIds:[...oldSchema.data.tableIds,...extra[item.unitId].tables]},oldSchema));
  }
  const next={...old,version:old.version+1,status:'draft',draft:{...old.draft,cells}};
  writes.push(api().write(root+'/reports/'+item.unitId,next,snapshot));
  const basePath=root+'/importBase/'+item.unitId,base=await api().read(basePath);
  writes.push(api().write(basePath,{cells:item.baseline,sourceName:plan.name},base));
  writes.push(api().write(root+'/history/'+crypto.randomUUID(),{unitId:String(item.unitId),actor:uid(),action:'import',version:next.version,at:new Date().toISOString(),payload:{before:old.draft,sourceName:plan.name}},null));
 }
 await api().commit(writes);
}

function choosePeriod(id){if(!isAdmin())return;const select=$('periodSelect');if(select&&select.value!==id){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}}
window.UnitBriefingService={choosePeriod,saveMapping,prepareExcel,applyExcel,account,isAdmin,uid,units,listPeriods,schemas,templates,report,materialize,savePackage,createAccount,updateAccount,changePassword,newPeriod,adapter:api};
})();

