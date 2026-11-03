/* Firebase unit briefing service. All writes are additionally scoped by Firestore Rules. */
(function(){
'use strict';
const C=window.UnitBriefingCore,$=id=>document.getElementById(id),cfg=window.BRIFING_FIREBASE_CONFIG;
const api=()=>window.__personnelFirestore;
const clone=C.copy,T=window.UnitTableCore;
const uid=()=>{try{return JSON.parse(atob(window.token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).user_id;}catch{return '';}};
let profile=null,catalog=null;
const isAdmin=()=>window.authUser?.()?.role==='System Admin';
async function account(){if(!uid())return null;const d=await api().read('unitAccounts/'+uid());profile=d?.data||(window.authUser()?.username==='admin'?{uid:uid(),username:'admin',role:'admin',active:true,editUnits:[],readUnits:[],screens:['*']}:null);if(!profile?.active)throw Error('Bu hesabın birim erişimi etkin değil.');return profile;}
async function unitContacts(unitId){unitId=String(unitId);const p=await account();if(!isAdmin()&&![...(p?.editUnits||[]),...(p?.readUnits||[])].includes(unitId))throw Error('Bu birimin iletişim bilgilerine erişim yetkiniz yok.');return await api().read('unitContacts/'+unitId);}
async function saveUnitContacts(unitId,value,version=0){unitId=String(unitId);const p=await account();if(!isAdmin()&&!p?.editUnits?.includes(unitId))throw Error('Bu birimin iletişim bilgilerini düzenleme yetkiniz yok.');const snapshot=await unitContacts(unitId);if((snapshot?.data.version||0)!==version)throw Error('İletişim bilgileri başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyiniz.');const data={unitId,version:version+1,updatedBy:uid(),updatedAt:new Date().toISOString()};for(const role of ['manager','chief','personnel']){const person=value?.[role]||{},name=String(person.name||'').trim(),phone=String(person.phone||'').trim();if(name.length>120||phone.length>40)throw Error('Ad soyad en çok 120, telefon en çok 40 karakter olmalıdır.');data[role]={name,phone};}await api().commit([api().write('unitContacts/'+unitId,data,snapshot)]);return data;}
async function listPeriods(){return (await api().list('unitPeriods')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||b.name.localeCompare(a.name,'tr'));}
async function units(){catalog=(await api().read('unitCatalog/main'))?.data||{units:[]};return catalog.units;}
async function schemas(period){const p=await account(),us=await units();return isAdmin()?await api().list('unitPeriods/'+period+'/schemas'):Promise.all([...new Set([...(p.editUnits||[]),...(p.readUnits||[])])].map(id=>api().read('unitPeriods/'+period+'/schemas/'+id).then(d=>d?{id:String(id),...d.data}:null))).then(a=>a.filter(Boolean));}
const decodeTable=t=>({...t,rows:JSON.parse(t.rowsJson||'[]')});
const encodeTable=t=>{const {rows,...rest}=t;return {...rest,rowsJson:JSON.stringify(rows)};};
async function templates(period,schema){return Promise.all(schema.tableIds.map(id=>api().read('unitPeriods/'+period+'/tables/'+id).then(d=>d?.data).then(d=>{if(!d)throw Error('Tablo tanımı eksik.');return decodeTable(d);})));}
async function report(period,unit){return await api().read('unitPeriods/'+period+'/reports/'+unit);}
function nested(payload){if(!payload)return null;const tables={};for(const[k,v]of Object.entries(payload.cells||{})){const i=k.indexOf('!'),id=k.slice(0,i),cell=k.slice(i+1);(tables[id]||={})[cell]=v;}for(const id of payload.savedTables||[])tables[id]||={};return {tables,source:payload.source,asOf:payload.asOf,notes:payload.notes,savedTables:payload.savedTables||[]};}
function flat(payload){if(!payload)return null;return {cells:Object.fromEntries(Object.entries(payload.tables).flatMap(([id,cells])=>Object.entries(cells).map(([k,v])=>[id+'!'+k,v]))),source:payload.source,asOf:payload.asOf,notes:payload.notes,savedTables:payload.savedTables||[]};}
async function savePackage(period,unit,command){
 const periodSnapshot=await api().read('unitPeriods/'+period);if(periodSnapshot?.data.locked)throw Error('Bu dönem kilitli; geçmiş dönem verileri değiştirilemez.');
 const [s,ts,p]=await Promise.all([api().read('unitPeriods/'+period+'/schemas/'+unit),report(period,unit),account()]);
 if(!s)throw Error('Birim tablo tanımları bulunamadı.');if(s.data.tableKeys&&command.action!=='save-table')throw Error('Bu dönemde onay işlemleri tablo bazındadır.');
 const t=await templates(period,s.data),existing=ts?.data;
 const from=existing?{...existing,draft:nested(existing.draft),pending:nested(existing.pending),approved:nested(existing.approved)}:null;
 const next=C.transition(from,{...command,periodId:period,payload:command.payload?nested(command.payload):undefined},{unitId:unit,templates:t,actor:{id:uid(),role:p.role,editUnits:p.editUnits},now:new Date().toISOString()});
 const stored={...next,draft:flat(next.draft),pending:flat(next.pending),approved:flat(next.approved)};
 const root='unitPeriods/'+period;
 const writes=[api().write(root+'/reports/'+unit,stored,ts),api().write(root+'/history/'+crypto.randomUUID(),{unitId:String(unit),actor:uid(),action:command.action==='save-table'?'save':command.action,version:next.version,at:new Date().toISOString(),payload:command.action==='approve'?stored.approved:command.action==='return'?{note:command.note}:stored.draft},null)];
 if(command.action==='approve'){const path=root+'/published/'+unit,old=await api().read(path);writes.push(api().write(path,{unitId:String(unit),version:next.approvedVersion,payload:stored.approved},old));}
 await api().commit(writes);
 return stored;
}

const reviewId=(unit,id)=>String(unit)+'__'+String(id);
async function tableReviews(period,unit){const p=await account(),root='unitPeriods/'+period;if(unit!==undefined&&!isAdmin()&&!p.editUnits?.includes(String(unit)))return [];const ids=unit!==undefined?[String(unit)]:isAdmin()?null:[...new Set(p.editUnits||[])];if(ids===null)return api().list(root+'/tableReviews');return (await Promise.all(ids.map(id=>api().query?api().query(root,{from:[{collectionId:'tableReviews'}],where:{fieldFilter:{field:{fieldPath:'unitId'},op:'EQUAL',value:{stringValue:id}}}}):api().list(root+'/tableReviews').then(rows=>rows.filter(r=>r.unitId===id))))).flat();}
async function pendingReviews(period){if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');return (await tableReviews(period)).filter(r=>r.pending&&r.status==='pending');}
async function reviewTable(period,unit,id,command){const root='unitPeriods/'+period,[ps,s,r,p,review]=await Promise.all([api().read(root),api().read(root+'/schemas/'+unit),report(period,unit),account(),api().read(root+'/tableReviews/'+reviewId(unit,id))]);if(ps?.data.locked)throw Error('Bu dönem kilitli.');if(!s?.data.tableKeys?.[id])throw Error('Tablo bazlı onay tanımı henüz hazır değil.');if(!r)throw Error('Birim kaydı bulunamadı.');if(command.action==='submit'&&command.reportVersion!==r.data.version)throw Error('Tablo başka bir oturumda değişti. Yenileyiniz.');const draft=T.scope(s.data,String(id),r.data.draft);if(command.action==='submit'){const t=(await api().read(root+'/tables/'+id))?.data;if(!t)throw Error('Tablo tanımı eksik.');C.validatePatch(decodeTable(t),unit,Object.fromEntries(Object.entries(draft.cells).map(([k,v])=>[k.split('!')[1],v])));}const next=T.transition(review?.data,command,{unitId:String(unit),tableId:String(id),periodId:period,actor:{id:uid(),role:p.role,editUnits:p.editUnits},now:new Date().toISOString(),schema:s.data,draft:r.data.draft});const stamps=command.action==='submit'?['updatedAt','submittedAt']:command.action==='approve'?['updatedAt','approvedAt']:['updatedAt'];const writes=[api().write(root+'/tableReviews/'+reviewId(unit,id),next,review,stamps),api().write(root+'/tableReviewHistory/'+crypto.randomUUID(),{unitId:String(unit),tableId:String(id),reviewId:reviewId(unit,id),actor:uid(),action:command.action,version:next.version,at:new Date().toISOString(),payload:command.action==='return'?{note:command.note}:command.action==='approve'?next.approved:next.pending},null,['at'])];if(command.action==='approve'){const master=T.mergeApproved(r.data,next);writes.push(api().write(root+'/reports/'+unit,master,r));const path=root+'/published/'+unit,pub=await api().read(path);writes.push(api().write(path,{...(pub?.data||{}),unitId:String(unit),version:master.approvedVersion,payload:master.approved,tableApprovals:{...(pub?.data.tableApprovals||{}),[id]:next.approvedVersion}},pub));}await api().commit(writes);return next;}
async function directorySummaries(period,ss){const p=await account(),reviews=await tableReviews(period);return Promise.all(ss.map(async s=>{const edit=isAdmin()||p.editUnits?.includes(String(s.unitId)),r=await api().read('unitPeriods/'+period+(edit?'/reports/':'/published/')+s.unitId),data=r?.data,draft=edit?data?.draft:data?.payload,index=Object.fromEntries(reviews.filter(t=>t.unitId===String(s.unitId)).map(t=>[t.tableId,t]));return {unitId:String(s.unitId),progress:C.flatProgress(s,draft),tableStates:Object.fromEntries(s.tableIds.map(id=>[id,edit?T.state(index[id],s,id,draft):data?.tableApprovals?.[id]!==undefined?'approved':'waiting'])),submittedIds:edit?s.tableIds.filter(id=>index[id]?.submittedAt):Object.keys(data?.tableApprovals||{})};}));}

async function media(id){const meta=await api().read('unitMedia/'+id);if(!meta)throw Error('Görsel bulunamadı.');const parts=await Promise.all(meta.data.parts.map(i=>api().read('unitMedia/'+id+'/parts/'+i)));return 'data:'+meta.data.mime+';base64,'+parts.map(d=>d.data.payload).join('');}
async function initialImport(snapshot,targetPeriodId){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 const id=targetPeriodId||'legacy_'+snapshot.source?.sha256?.slice(0,16),root='unitPeriods/'+id;
 const existing=await api().read(root);
 const plan=window.UnitMigration.build(snapshot,id,existing?.data.createdAt||new Date().toISOString());
 if(existing?.data.ready)throw Error('Bu kaynak daha önce aktarıldı. Güncellemeler için Excel karşılaştırmasını kullanınız.');
 if(existing&&existing.data.sourceSha256!==snapshot.source.sha256)throw Error('Aktarım kimliği başka kaynağa ait.');
 const oldCatalog=await api().read('unitCatalog/main');
 if(oldCatalog?.data.units?.length&&!C.equal(oldCatalog.data.units.map(u=>String(u.id)).sort(),plan.units.map(u=>String(u.id)).sort()))throw Error('Mevcut birim listesi farklı. Başlangıç aktarımı mevcut kataloğu değiştiremez.');
 const prior=await api().list(root+'/reports');if(prior.some(r=>r.version!==0))throw Error('Başlangıç aktarımı birim girişlerinin üzerine yazamaz.');
 for(const asset of Object.values(snapshot.assets||{})){
  const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==asset.sha256)throw Error('Görselin dosya özeti uyuşmuyor.');
 }
 await api().commit([api().write(root,plan.period,existing)]);
 for(let i=0;i<plan.writes.length;i+=20){const batch=[];for(const item of plan.writes.slice(i,i+20)){const old=await api().read(item.path);const data=item.path.startsWith('unitMedia/')&&!item.path.includes('/parts/')?{...item.data,allowedUnits:[...new Set([...(old?.data.allowedUnits||[]),...item.data.allowedUnits])]}:item.data;if(old&&C.equal(old.data,data))continue;if(old&&item.path.includes('/reports/'))throw Error('Aktarım taslağı değişmiş; mevcut veri korunarak aktarım durduruldu.');batch.push(api().write(item.path,data,old));}if(batch.length)await api().commit(batch);}
 const latest=await api().read(root),catalogNow=await api().read('unitCatalog/main');
 await api().commit([api().write('unitCatalog/main',{units:plan.units},catalogNow),api().write(root,{...plan.period,ready:true},latest)]);
 return plan;
}
async function setLocked(period,locked){if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');const path='unitPeriods/'+period,old=await api().read(path);if(!old)throw Error('Dönem bulunamadı.');await api().commit([api().write(path,{...old.data,locked:!!locked},old)]);}
async function materialize(period,schema,view){
 const p=await account(),canEdit=p.role==='admin'||p.editUnits?.includes(String(schema.unitId));
 const [ts,r]=await Promise.all([templates(period,schema),canEdit?report(period,schema.unitId):api().read('unitPeriods/'+period+'/published/'+schema.unitId)]);
 const payload=!canEdit?r?.data.payload:view==='pending'?r?.data.pending:view==='approved'?r?.data.approved:(r?.data.draft||r?.data.approved);
 const reviews=schema.tableKeys&&canEdit?await tableReviews(period,schema.unitId):[],reviewIndex=Object.fromEntries(reviews.map(r=>[r.tableId,r]));const cells={...(payload?.cells||{})};if(schema.tableKeys&&view==='pending')for(const r of reviews)if(r.pending)Object.assign(cells,r.pending.cells);
 if(schema.tableKeys&&!canEdit&&r)for(const id of Object.keys(r.data.tableApprovals||{}))reviewIndex[id]={tableId:id,approved:T.scope(schema,id,r.data.payload),approvedVersion:r.data.tableApprovals[id],pending:null};
 return {report:{...((!canEdit&&r?{...r.data,status:'approved',approved:r.data.payload,draft:r.data.payload}:r?.data)||{version:0,status:'draft',draft:{cells:{},source:'',asOf:'',notes:''}}),tableReviews:reviewIndex,tableBased:!!schema.tableKeys},canEdit,records:await Promise.all(ts.map(async t=>{
  const row=clone(t.rows);for(const[address]of Object.entries(t.fields)){const pt=C.point(address),v=Object.prototype.hasOwnProperty.call(cells,t.id+'!'+address)?cells[t.id+'!'+address]:(payload&&!schema.tableKeys&&(view==='approved'||!canEdit)?t.legacyStaticValues?.[address]??null:null);if(row[pt.row-t.rowOffset]?.[pt.column])row[pt.row-t.rowOffset][pt.column].v=v;}
  const layoutRows=clone(t.rows);for(const [address,value]of Object.entries(t.legacyStaticValues||{})){const pt=C.point(address);if(layoutRows[pt.row-t.rowOffset]?.[pt.column])layoutRows[pt.row-t.rowOffset][pt.column].v=value;}return {...t,layoutRows,rows:row,images:await Promise.all((t.mediaIds||[]).map(media))};
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
 const next={uid:j.localId,username:data.username,display:data.display||data.username,role:data.role||'unit',active:true,editUnits:data.editUnits||[],readUnits:data.readUnits||[],screens:data.screens||['units'],mustChange:false};
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
async function saveUnitUserPermissions(ids,unitId,changes,role){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 ids=[...new Set(ids)];if(!ids.length||ids.length>100)throw Error('1–100 kullanıcı seçiniz.');
 const writes=[];
 for(const id of ids){
  const path='unitAccounts/'+id,old=await api().read(path),a=old?.data;
  if(!a||a.replacedBy||![...(a.editUnits||[]),...(a.readUnits||[])].includes(String(unitId)))throw Error('Seçilen kullanıcı bu birime bağlı değil.');
  const next=window.UnitUserPermissions.apply(a,unitId,changes,role);
  if(id===uid()&&next.role!=='admin')throw Error('Kendi yönetici yetkinizi kaldıramazsınız.');
  const dirPath='unitLoginDirectory/'+next.username,dir=await api().read(dirPath);if(!dir)throw Error('Kullanıcı giriş kaydı bulunamadı.');
  writes.push(api().write(path,next,old),api().write(dirPath,{...dir.data,role:next.role==='admin'?'System Admin':'Unit User'},dir));
 }
 await api().commit(writes);return true;
}
async function createUnit(name){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');name=String(name||'').trim();if(name.length<2||name.length>160)throw Error('Birim adı 2–160 karakter olmalıdır.');
 const old=await api().read('unitCatalog/main'),list=old?.data.units||[];
 if(list.some(u=>u.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))throw Error('Bu birim adı zaten kullanılıyor.');
 const id=Math.max(0,...list.map(u=>Number(u.id)))+1,unit={id,name,username:'birim'+id,owner:'',description:''},writes=[api().write('unitCatalog/main',{...(old?.data||{}),units:[...list,unit]},old)];
 for(const p of await listPeriods())if(p.ready&&!p.locked){const base='unitPeriods/'+p.id;writes.push(api().write(base+'/schemas/'+id,{unitId:String(id),keys:[],tableIds:[],titles:[],titleMap:{},tableKeys:{}},null),api().write(base+'/reports/'+id,{unitId:String(id),periodId:p.id,version:0,status:'draft',draft:{cells:{},source:'',asOf:'',notes:''},pending:null,approved:null,pendingVersion:null,approvedVersion:null},null));}
 await api().commit(writes);return unit;
}
async function resetAccountPassword(targetUid,password){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 if(typeof password!=='string'||password.length<8)throw Error('Geçici şifre en az 8 karakter olmalıdır.');
 const path='unitAccounts/'+targetUid,old=await api().read(path);
 if(!old||old.data.role!=='unit'||old.data.replacedBy||targetUid===uid())throw Error('Bu işlem yalnızca güncel birim hesapları için kullanılabilir.');
 const directoryPath='unitLoginDirectory/'+old.data.username,directory=await api().read(directoryPath);
 if(!directory)throw Error('Giriş kaydı bulunamadı.');
 // Spark has no trusted server for privileged Auth updates. Rotate the login identity,
 // then atomically retire the old grants and switch the directory. Never store a password.
 const email=old.data.username+'.'+crypto.randomUUID()+'@brifingbilgisistemi.firebaseapp.com';
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:false})}),j=await response.json();
 if(!response.ok||!j.localId)throw Error('Geçici şifre hazırlanamadı. Daha sonra yeniden deneyiniz.');
 const at=new Date().toISOString(),next={...old.data,uid:j.localId,mustChange:false,passwordResetAt:at};
 await api().commit([
  api().write('unitAccounts/'+j.localId,next,null),
  api().write(path,{...old.data,active:false,replacedBy:j.localId,replacedAt:at},old),
  api().write(directoryPath,{...directory.data,email},directory),
  api().write('unitAccountEvents/'+crypto.randomUUID(),{action:'temporary-password',actor:uid(),username:old.data.username,previousUid:targetUid,uid:j.localId,at},null)
 ]);
 return next;
}
async function changePassword(password,currentPassword){
 if(typeof password!=='string'||password.length<8)throw Error('Şifre en az 8 karakter olmalıdır.');
 if(!currentPassword)throw Error('Mevcut şifrenizi giriniz.');
 const p=await account(),directory=(await api().read('unitLoginDirectory/'+p.username))?.data;
 const email=directory?.email||(p.username==='admin'?'admin@brifingbilgisistemi.firebaseapp.com':null);
 if(!email)throw Error('Giriş kaydı bulunamadı.');
 const signIn=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:currentPassword,returnSecureToken:true})}),auth=await signIn.json();
 if(!signIn.ok||auth.localId!==uid())throw Error('Mevcut şifre doğrulanamadı.');
 window.__updateFirebaseSessionTokens(auth);
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key='+cfg.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:window.token(),password,returnSecureToken:true})}),j=await r.json();if(!r.ok)throw Error('Şifre değiştirilemedi. Lütfen yeniden giriş yapıp deneyiniz.');
 window.__updateFirebaseSessionTokens(j);
 const snapshot=await api().read('unitAccounts/'+uid());if(snapshot?.data.mustChange)await api().commit([api().write('unitAccounts/'+uid(),{...snapshot.data,mustChange:false},snapshot)]);
}
async function newPeriod(name){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');name=String(name||'').trim();if(name.length<4||name.length>100)throw Error('Dönem adı giriniz.');
 const prior=(await listPeriods())[0];if(!prior)throw Error('Önce başlangıç Excel aktarımını yapınız.');
 const globals=(await window.api('/api/periods')).periods||[],matching=globals.find(p=>p.name===name),id=matching?.folder||window.__brifingExcelParser.periodFolder(name),base='unitPeriods/'+id,old='unitPeriods/'+prior.id;
 if(await api().read(base))throw Error('Bu birim dönemi zaten var.');
 if(!matching){const main='periods/'+id,emptyStaff={teacher:{public:0,private:0,total:0,by_level:[]},manager:{public:0,private:0,total:0,by_level:[]},manager_need:{norm:0,current:0,need:0,by_title:[]}};await api().commit([api().write(main,{folder:id,name,basePeriod:name,latestVersion:'units_empty',active:false,hasStudents:false,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()},null),api().write(main+'/versions/units_empty',{summary:{institution_count:0,active_institutions:0,public_institutions:0,private_institutions:0,basic_students:0,secondary_students:0,total_students:0,teacher_total:0,manager_total:0},staff:emptyStaff,validation:{},fileMeta:[]},null)]);}
 await api().commit([api().write(base,{name,createdAt:new Date().toISOString(),ready:false,reviewMode:'table'},null)]);
 const [ss,ts]=await Promise.all([api().list(old+'/schemas'),api().list(old+'/tables')]);
 for(const t of ts)await api().commit([api().write(base+'/tables/'+t.id,t,null)]);
 for(const s of ss){const values=Object.fromEntries(s.keys.map(k=>[k,null]));await api().commit([api().write(base+'/schemas/'+s.unitId,{...s,baseline:values},null),api().write(base+'/reports/'+s.unitId,{unitId:String(s.unitId),periodId:id,version:0,status:'draft',draft:{cells:values,source:'',asOf:'',notes:''},pending:null,approved:null,pendingVersion:null,approvedVersion:null},null)]);}
 const snapshot=await api().read(base);await api().commit([api().write(base,{...snapshot.data,ready:true},snapshot)]);return id;
}

async function saveMapping(period,template){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 if((await api().read('unitPeriods/'+period))?.data.locked)throw Error('Bu dönem kilitli.');
 C.validateTemplate(template);
 const root='unitPeriods/'+period,[all,ss,rs]=await Promise.all([api().list(root+'/tables'),api().list(root+'/schemas'),api().list(root+'/reports')]);
 if(rs.some(r=>r.status==='pending')||(await pendingReviews(period)).some(r=>r.tableId===String(template.id)))throw Error('Eşlemeyi değiştirmeden önce bu tablonun kontrolünü sonuçlandırınız.');
 template={...template,allowedUnits:[...new Set(template.assignments.map(x=>String(x.unitId)))],links:template.assignments.flatMap(a=>a.editRanges.map(range=>({unit:Number(a.unitId),range,label:range==='*'?'Tüm sayfa':range})))};
 const tables=all.map(t=>t.id===template.id?template:decodeTable(t)),us=await units(),writes=[],existingTemplate=await api().read(root+'/tables/'+template.id);
 const priorValues=Object.assign({},...rs.map(r=>r.draft?.cells||{}));
 for(const address of Object.keys(template.fields)){const p=C.point(address),value=template.rows[p.row-template.rowOffset]?.[p.column]?.v;if(value!==null&&value!==undefined)priorValues[template.id+'!'+address]??=value;if(template.rows[p.row-template.rowOffset]?.[p.column])template.rows[p.row-template.rowOffset][p.column].v=null;}
 writes.push(api().write(root+'/tables/'+template.id,encodeTable(template),existingTemplate));
 for(const u of us){
  const unitId=String(u.id),keys=tables.flatMap(t=>C.editableAddresses(t,unitId).map(k=>t.id+'!'+k)),tableIds=tables.filter(t=>t.assignments.some(a=>String(a.unitId)===unitId)).map(t=>t.id),schemaPath=root+'/schemas/'+unitId;
  const oldSchema=await api().read(schemaPath);writes.push(api().write(schemaPath,T.metadata({unitId,tableIds,keys},tables),oldSchema));
  const previous=await report(period,unitId),old=previous?.data||{unitId,periodId:period,version:0,status:'draft',draft:{cells:{},source:'',asOf:'',notes:''},approved:null,approvedVersion:null,pending:null,pendingVersion:null};
  const next={...old,version:old.version+1,status:'draft',draft:{...old.draft,savedTables:(old.draft.savedTables||[]).filter(id=>id!==template.id&&tableIds.includes(id)),cells:Object.fromEntries(keys.map(k=>[k,old.draft?.cells[k]??priorValues[k]??null]))}};
  writes.push(api().write(root+'/reports/'+unitId,next,previous));
  writes.push(api().write(root+'/history/'+crypto.randomUUID(),{unitId,actor:uid(),action:'mapping',version:next.version,at:new Date().toISOString(),payload:old.draft},null));
 }
 for(const id of template.mediaIds||[]){const p='unitMedia/'+id,old=await api().read(p);if(old)writes.push(api().write(p,{...old.data,allowedUnits:[...new Set([...old.data.allowedUnits,...template.allowedUnits])]},old));}
 await api().commit(writes);
}
async function prepareExcel(period,file,Zip,periodName){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 const buffer=await file.arrayBuffer(),workbook=window.XLSX.read(buffer,{type:'array',cellNF:true,cellStyles:true}),root='unitPeriods/'+period;
 const drawingMedia=await window.UnitExcelMedia.read(buffer,Zip,workbook);
 const exists=await api().read(root),prior=exists?null:(await listPeriods()).find(p=>p.ready),readRoot=exists?root:prior?'unitPeriods/'+prior.id:root;
 if(!exists&&!prior)throw Error('Önce başlangıç birim/tablo tanımlarını aktarınız.');
 const [ss,rs]=await Promise.all([api().list(readRoot+'/schemas'),exists?api().list(root+'/reports'):Promise.resolve([])]);
 const tables=await api().list(readRoot+'/tables'),byId=Object.fromEntries(tables.map(t=>[t.id,t])),differences=[],changes=[];
 for(const schema of ss){
  const unitId=schema.unitId,report=rs.find(r=>r.unitId===unitId),base=exists?(await api().read(root+'/importBase/'+unitId))?.data?.cells||{}:{},current=report?.draft?.cells||{},incoming={...base};
  for(const key of schema.keys){const i=key.indexOf('!'),table=byId[key.slice(0,i)],sheet=workbook.Sheets[table.sheet];if(!sheet)continue;const value=sheet[key.slice(i+1)]?.v??null;const address=key.slice(i+1);incoming[key]=C.validatePatch(table,unitId,{[address]:value})[address];}
  const diffs=C.importDifferences(base,current,incoming);differences.push(...diffs.map(d=>({...d,unitId,table:byId[d.key.split('!')[0]]?.title})));
  changes.push({unitId,baseline:incoming,current,version:report?.version||0,diffs});
 }
 const unknown=workbook.SheetNames.filter(name=>!tables.some(t=>t.sheet===name)&&!['Kapak','Anasayfa','Birimler'].includes(name));
 const newTables=unknown.map(sheet=>{
  const ws=workbook.Sheets[sheet],bounds=window.XLSX.utils.decode_range(ws['!ref']||'A1'),rowOffset=/^\d+ /.test(sheet)?4:1,rows=[];
  for(let r=rowOffset-1;r<=bounds.e.r;r++){const row=[];for(let col=0;col<=bounds.e.c;col++){const cell=ws[window.XLSX.utils.encode_cell({r,c:col})];row.push({v:cell?.v??null,f:cell?.z||'General',bold:false,bg:null});}rows.push(row);}
  const record={id:'sheet_'+crypto.randomUUID().replace(/-/g,''),title:String(ws.A3?.v||sheet),sheet,rowOffset,rows,merges:(ws['!merges']||[]).map(window.XLSX.utils.encode_range),images:[],mediaIds:[],charts:[],description:'',owner:'',content:'Excel tablosu',source:true,legacyStatus:'pending'};
  return {...record,charts:drawingMedia[sheet]?.charts||[],importImages:drawingMedia[sheet]?.images||[],fields:C.fieldsFromRecord(record),unitId:''};
 });
 const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return {name:file.name,period,periodName,newPeriodSource:prior?.id||null,differences,changes,newTables,sourceFile:{name:file.name,type:file.type||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:bytes.length,base64:btoa(binary)}};
}
async function applyExcel(plan,choices){
 if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');
 plan=C.copy(plan);
 let periodState=await api().read('unitPeriods/'+plan.period);if(!periodState&&plan.newPeriodSource){if(!plan.periodName)throw Error('Yeni dönem adı eksik.');const id=await newPeriod(plan.periodName);if(id!==plan.period)throw Error('Dönem kimliği uyuşmuyor.');periodState=await api().read('unitPeriods/'+plan.period);}if(periodState?.data.locked)throw Error('Bu dönem kilitli.');
 const root='unitPeriods/'+plan.period,writes=[];
 const extra={},newMedia=new Map();
 for(const table of plan.newTables||[]){
  if(!table.unitId)throw Error('Yeni tabloların birim atamasını seçiniz.');
  const unitId=String(table.unitId),incoming={};for(const address of Object.keys(table.fields)){const p=C.point(address);incoming[table.id+'!'+address]=table.rows[p.row-table.rowOffset]?.[p.column]?.v??null;table.rows[p.row-table.rowOffset][p.column].v=null;}
  const {importImages=[],...clean}=table;
  const t={...clean,mediaIds:importImages.map(image=>image.id),assignments:[{unitId,editRanges:['*']}],allowedUnits:[unitId],links:[{unit:Number(unitId),range:'*',label:'Tüm sayfa'}]};
  C.validateTemplate(t);
  for(const image of importImages){const old=newMedia.get(image.id);if(old)old.allowedUnits.push(unitId);else newMedia.set(image.id,{...image,allowedUnits:[unitId]});}
  writes.push(api().write(root+'/tables/'+t.id,encodeTable(t),null));
  (extra[unitId]||={cells:{},tables:[],titles:{}});extra[unitId].titles[t.id]=t.title||t.sheet;Object.assign(extra[unitId].cells,incoming);extra[unitId].tables.push(t.id);
 }
 for(const image of newMedia.values()){
  const mediaPath='unitMedia/'+image.id,old=await api().read(mediaPath),parts=[];
  for(let offset=0;offset<image.base64.length;offset+=240000){const index=String(parts.length);parts.push(index);const path=mediaPath+'/parts/'+index;writes.push(api().write(path,{payload:image.base64.slice(offset,offset+240000)},await api().read(path)));}
  writes.push(api().write(mediaPath,{mime:image.mime,parts,allowedUnits:[...new Set([...(old?.data.allowedUnits||[]),...image.allowedUnits])]},old));
 }
 for(const item of plan.changes){
  const snapshot=await report(plan.period,item.unitId),old=snapshot?.data;if(!old||old.version!==item.version)throw Error('Önizlemeden sonra birim verisi değişti; Excel’i yeniden inceleyiniz.');
  if(old.status==='pending')throw Error('Kontrol bekleyen paket varken Excel aktarımı yapılamaz.');
  const picked=Object.fromEntries(item.diffs.map(d=>[d.key,choices[item.unitId+'!'+d.key]]));
  let cells=C.applyImport(item.current,item.baseline,item.diffs,picked);
  if(extra[item.unitId]){
   cells={...cells,...extra[item.unitId].cells};item.baseline={...item.baseline,...extra[item.unitId].cells};
   const sp=root+'/schemas/'+item.unitId,oldSchema=await api().read(sp);
   writes.push(api().write(sp,{...oldSchema.data,keys:[...new Set([...oldSchema.data.keys,...Object.keys(extra[item.unitId].cells)])],tableIds:[...oldSchema.data.tableIds,...extra[item.unitId].tables],titles:[...(oldSchema.data.titles||[]),...Object.values(extra[item.unitId].titles)],titleMap:{...(oldSchema.data.titleMap||{}),...extra[item.unitId].titles},tableKeys:{...(oldSchema.data.tableKeys||Object.fromEntries(oldSchema.data.tableIds.map(id=>[id,oldSchema.data.keys.filter(k=>k.startsWith(id+'!'))]))),...Object.fromEntries(extra[item.unitId].tables.map(id=>[id,Object.keys(extra[item.unitId].cells).filter(k=>k.startsWith(id+'!'))]))}},oldSchema));
  }
  const changedTables=new Set(Object.keys(cells).filter(k=>!C.equal(cells[k],old.draft.cells[k]??null)).map(k=>k.split('!')[0]));
  const next={...old,version:old.version+1,status:'draft',draft:{...old.draft,cells,savedTables:(old.draft.savedTables||[]).filter(id=>!changedTables.has(id))}};
  const changed=!C.equal(cells,old.draft.cells)||!!extra[item.unitId];if(changed)writes.push(api().write(root+'/reports/'+item.unitId,next,snapshot));
  const basePath=root+'/importBase/'+item.unitId,base=await api().read(basePath);
  writes.push(api().write(basePath,{cells:item.baseline,sourceName:plan.name},base));
  if(changed)writes.push(api().write(root+'/history/'+crypto.randomUUID(),{unitId:String(item.unitId),actor:uid(),action:'import',version:next.version,at:new Date().toISOString(),payload:{before:old.draft,sourceName:plan.name}},null));
 }
 if(plan.sourceFile){const file=plan.sourceFile,path=root+'/excelFiles/latest',parts=[];for(let i=0;i<file.base64.length;i+=240000){const id=String(parts.length);parts.push(id);const part=path+'/parts/'+id;writes.push(api().write(part,{payload:file.base64.slice(i,i+240000)},await api().read(part)));}const old=await api().read(path);writes.push(api().write(path,{name:file.name,type:file.type,size:file.size,parts,updatedAt:new Date().toISOString()},old));}
 if(writes.length>450)throw Error('Bu dosya tek aktarım sınırını aşıyor. Tabloları daha küçük Excel dosyalarıyla aktarınız.');
 await api().commit(writes);excelSummaryCache.delete(plan.period);
}

const excelSummaryCache=new Map();
async function unitExcelSummary(period){if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');const cached=excelSummaryCache.get(period);if(cached&&cached.scope===uid()&&Date.now()-cached.at<60000)return cached.promise;const promise=Promise.all([sourceExcel(period),api().read('unitPeriods/'+period),api().count('unitPeriods/'+period+'/schemas'),api().count('unitPeriods/'+period+'/tables')]).then(([file,state,unitCount,tableCount])=>({file,unitCount,tableCount,loaded:!!file||!!(state?.data.ready&&state.data.sourceSha256)}));excelSummaryCache.set(period,{promise,at:Date.now(),scope:uid()});try{return await promise;}catch(e){excelSummaryCache.delete(period);throw e;}}
async function sourceExcel(period){if(!isAdmin())throw Error('Yönetici yetkisi gereklidir.');return (await api().read('unitPeriods/'+period+'/excelFiles/latest'))?.data||null;}
async function downloadSourceExcel(period){const file=await sourceExcel(period);if(!file)throw Error('Bu dönemde kaynak birim Excel dosyası yüklenmemiş.');const parts=await Promise.all(file.parts.map(id=>api().read('unitPeriods/'+period+'/excelFiles/latest/parts/'+id)));if(parts.some(p=>!p))throw Error('Excel arşivinde eksik parça var.');const binary=atob(parts.map(p=>p.data.payload).join('')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length!==file.size)throw Error('Dosya boyutu doğrulanamadı.');const url=URL.createObjectURL(new Blob([bytes],{type:file.type})),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

async function pendingNotifications(){if(!isAdmin())return [];const us=await units(),ps=(await listPeriods()).filter(p=>p.ready),out=[];for(const p of ps){const rows=await pendingReviews(p.id),ss=rows.length?await api().list('unitPeriods/'+p.id+'/schemas'):[];for(const r of rows)out.push({id:p.id+'/'+reviewId(r.unitId,r.tableId)+'/'+r.pendingVersion,periodId:p.id,periodName:p.name,unitId:r.unitId,tableId:r.tableId,tableTitle:ss.find(s=>s.unitId===r.unitId)?.titleMap?.[r.tableId]||'Brifing tablosu',unitName:us.find(u=>String(u.id)===r.unitId)?.name||'Birim',at:r.submittedAt});}return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));}

function choosePeriod(id){if(!isAdmin())return;const select=$('periodSelect');if(select&&[...select.options].some(o=>o.value===id)&&select.value!==id){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}}
window.UnitBriefingService={reviewTable,tableReviews,pendingReviews,directorySummaries,invalidateReadSummaries:()=>{excelSummaryCache.clear();window.__UNIT_DIRECTORY_REVISION=(window.__UNIT_DIRECTORY_REVISION||0)+1;},unitContacts,saveUnitContacts,unitExcelSummary,sourceExcel,downloadSourceExcel,pendingNotifications,createUnit,saveUnitUserPermissions,resetAccountPassword,initialImport,setLocked,choosePeriod,saveMapping,prepareExcel,applyExcel,account,isAdmin,uid,units,listPeriods,schemas,templates,report,materialize,savePackage,createAccount,updateAccount,changePassword,newPeriod,adapter:api};
})();

