/* Firestore and Firebase Authentication adapter for the existing V3 UI. */
(function(){
'use strict';
const cfg=window.BRIFING_FIREBASE_CONFIG;
if(!cfg?.apiKey||!cfg?.projectId) throw new Error('Firebase yapılandırması bulunamadı.');
const base=`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
let viewedFolder='';
let profiles=[
 {username:'admin',display:'Yönetici',unit:'Yönetici',role:'System Admin',email:'admin@brifingbilgisistemi.firebaseapp.com'},
 {username:'personel.hizmetleri',display:'PERSONEL HİZMETLERİ ŞUBESİ',unit:'PERSONEL HİZMETLERİ ŞUBESİ',role:'Unit User',email:'personel.hizmetleri.v3@brifingbilgisistemi.firebaseapp.com'}
];
const $=id=>document.getElementById(id), now=()=>new Date().toISOString();
const enc=s=>encodeURIComponent(s);
function session(){try{return JSON.parse(sessionStorage.getItem('brifing_firebase_session')||'null')}catch(_){return null}}
// Cache only published snapshots and short-lived period metadata, never mutable unit drafts or permissions.
const readCache=new Map();let quotaRetryAt=0;
function clearReadCache(){readCache.clear();window.AssistantData?.clear();}
function readScope(){const s=session();return JSON.stringify([s?.uid,s?.username,s?.role,s?.account]);}
async function memoRead(key,ttl,load){const k=readScope()+'|'+key,old=readCache.get(k);if(old&&Date.now()<old.until)return old.promise;const entry={until:Date.now()+ttl,promise:null};entry.promise=Promise.resolve().then(load).catch(e=>{if(readCache.get(k)===entry)readCache.delete(k);throw e;});readCache.set(k,entry);if(readCache.size>16)readCache.delete(readCache.keys().next().value);return entry.promise;}
function firestoreError(data,status){const raw=data?.error?.message||'Firebase isteği başarısız ('+status+').';if(data?.error?.status==='RESOURCE_EXHAUSTED'||/quota exceeded/i.test(raw)){quotaRetryAt=Date.now()+60000;return new Error('Firebase günlük kullanım kotası doldu. Kayıtlarınız silinmedi. Ücretsiz kota yenilendiğinde tekrar deneyiniz.');}return new Error(raw);}
function checkQuota(){if(Date.now()<quotaRetryAt)throw new Error('Firebase günlük kullanım kotası doldu. Kayıtlarınız silinmedi. Ücretsiz kota yenilendiğinde tekrar deneyiniz.');}
function rememberedSession(){try{return JSON.parse(localStorage.getItem('brifing_remembered_login')||'null')}catch{return null}}
function saveSession(v){try{if(v&&$('rememberUsername')?.checked){localStorage.setItem('brifing_remembered_login',JSON.stringify({username:v.username,uid:v.uid,refreshToken:v.refreshToken}));localStorage.setItem('brifing_remember_username',v.username);}else localStorage.removeItem('brifing_remembered_login');}catch{}if(v)sessionStorage.setItem('brifing_firebase_session',JSON.stringify(v));else sessionStorage.removeItem('brifing_firebase_session');window.__BRIFING_SESSION=v?{username:v.username,display:v.display,unit:v.unit,role:v.role,must_change:false}:null;}
window.__updateFirebaseSessionTokens=function(data){const current=session();if(!current||data.localId!==current.uid||!data.idToken||!data.refreshToken)throw Error('Şifre oturumu doğrulanamadı.');saveSession({...current,idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:Date.now()+Number(data.expiresIn||3600)*1000});};
function authHeaders(){const s=session();if(!s?.idToken)throw new Error('Oturum süresi doldu. Yeniden giriş yapın.');return {Authorization:'Bearer '+s.idToken};}
async function authCall(action,body){const res=await fetch(`https://identitytoolkit.googleapis.com/v1/${action}?key=${cfg.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(authError(j.error?.message));return j;}
function authError(code){const m={OPERATION_NOT_ALLOWED:'Firebase Authentication içinde E-posta/Şifre sağlayıcısı etkin değil.',EMAIL_NOT_FOUND:'Kullanıcı adı veya şifre hatalı.',INVALID_PASSWORD:'Kullanıcı adı veya şifre hatalı.',INVALID_LOGIN_CREDENTIALS:'Kullanıcı adı veya şifre hatalı.',USER_DISABLED:'Bu kullanıcı devre dışı bırakılmış.',TOO_MANY_ATTEMPTS_TRY_LATER:'Çok sayıda başarısız giriş. Bir süre sonra tekrar deneyin.',NETWORK_REQUEST_FAILED:'Firebase kimlik doğrulama sunucusuna ulaşılamadı.'};return m[code]||`Firebase kimlik doğrulaması başarısız: ${code||'bilinmeyen hata'}`;}
async function refresh(signal){const s=session();if(!s?.refreshToken)return false;const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${cfg.apiKey}`,{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken})});if(!r.ok){saveSession(null);return false}const j=await r.json();saveSession({...s,idToken:j.id_token,refreshToken:j.refresh_token,expiresAt:Date.now()+Number(j.expires_in||3600)*1000});return true;}
async function request(url,opts={}){if(url.startsWith(base))checkQuota();let headers={...(opts.headers||{})};if(!url.includes('identitytoolkit')&&!url.includes('securetoken'))Object.assign(headers,authHeaders());let res=await fetch(url,{...opts,headers});if(res.status===401&&await refresh(opts.signal)){headers={...(opts.headers||{}),...authHeaders()};res=await fetch(url,{...opts,headers});}let data=await res.json().catch(()=>({}));if(!res.ok)throw firestoreError(data,res.status);return data;}
function fv(v){if(v===null||v===undefined)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(fv)}};if(typeof v==='object'){const fields={};for(const [k,x] of Object.entries(v))fields[k]=fv(x);return {mapValue:{fields}}}return {stringValue:String(v)}}
function uv(v){if(!v)return null;if('timestampValue'in v)return v.timestampValue;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;if('arrayValue'in v)return (v.arrayValue.values||[]).map(uv);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,uv(x)]));return null}
function decodeDoc(d){return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,uv(v)]))}
async function getDoc(path){checkQuota();const r=await fetch(`${base}/${path}`,{headers:authHeaders()});if(r.status===404)return null;const d=await r.json().catch(()=>({}));if(!r.ok)throw firestoreError(d,r.status);return decodeDoc(d)}
async function putDoc(path,obj){const fields={};for(const [k,v] of Object.entries(obj))fields[k]=fv(v);const mask=Object.keys(obj).map(k=>'updateMask.fieldPaths='+enc(k)).join('&');await request(`${base}/${path}?${mask}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})});clearReadCache();window.UnitBriefingService?.invalidateReadSummaries?.();}
async function listDocs(path){let token='',out=[];do{const u=new URL(`${base}/${path}`);u.searchParams.set('pageSize','1000');if(token)u.searchParams.set('pageToken',token);const d=await request(u.toString());out.push(...(d.documents||[]).map(x=>({id:x.name.split('/').pop(),...decodeDoc(x)})));token=d.nextPageToken||''}while(token);return out}
const sortPeriods=(a,b)=>String(b.name).localeCompare(String(a.name),'tr');
async function periods(){return memoRead('periods',30000,async()=>(await listDocs('periods')).map(p=>({...p,folder:p.folder||p.id})).sort(sortPeriods))}
async function activePeriod(){return (await periods()).find(x=>x.active)||null}
async function viewedPeriod(){const ps=await periods();return ps.find(p=>p.folder===viewedFolder)||ps.find(p=>p.active)||null;}
async function readVersionUncached(p){if(!p?.latestVersion)return {institutions:[],basic:[],secondary:[],staff:{teacher:{public:0,private:0,total:0,by_level:[]},manager:{public:0,private:0,total:0,by_level:[]},manager_need:{norm:0,current:0,need:0,by_title:[]}},summary:{}};const root=`periods/${enc(p.folder)}/versions/${enc(p.latestVersion)}`;const meta=await getDoc(root);if(!meta)throw new Error(`Firestore dönem verisi eksik: ${p.name}`);const chunks=await listDocs(root+'/chunks');const result={};for(const kind of ['basic','secondary','institutions','staff']){const cs=chunks.filter(x=>x.kind===kind).sort((a,b)=>a.index-b.index);if(kind==='staff'){result[kind]=cs.length?JSON.parse(cs.map(x=>x.payload).join('')):meta.staff||{};}else result[kind]=cs.flatMap(x=>JSON.parse(x.payload||'[]'));}result.summary=meta.summary||{};result.validation=meta.validation||{};await window.enrichStudentBranches?.(p,result,()=>fileRecords(p));return result}
async function readVersion(p){if(!p?.latestVersion)return emptyData();const result=await memoRead('version/'+p.folder+'/'+p.latestVersion,600000,()=>readVersionUncached(p));return JSON.parse(JSON.stringify(result));}
function emptyData(){return {institutions:[],basic:[],secondary:[],staff:{teacher:{public:0,private:0,total:0,by_level:[]},manager:{public:0,private:0,total:0,by_level:[]},manager_need:{norm:0,current:0,need:0,by_title:[]}},summary:{institution_count:0,active_institutions:0,public_institutions:0,private_institutions:0,basic_students:0,secondary_students:0,total_students:0,teacher_total:0,manager_total:0}}}
function normalizeSecondary(rows){return (rows||[]).map(r=>{const g=[...(r.grade_students||[])];const kindergarten=Number(r.kindergarten_students??g[0]??0);g[0]=0;return {...r,kindergarten_students:kindergarten,grade_students:g,students:g.reduce((a,x)=>a+Number(x||0),0)}})}
async function publish(folder,name,basePeriod,data,files,active,category){const id=`v_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,root=`periods/${enc(folder)}/versions/${enc(id)}`;const normalized={...data,secondary:normalizeSecondary(data.secondary||[])};const summary=window.__brifingExcelParser.buildData(normalized).summary;const chunks=[];for(const kind of ['basic','secondary','institutions']){const rows=normalized[kind]||[];for(let i=0;i<rows.length;i+=100)chunks.push({kind,index:i/100,payload:JSON.stringify(rows.slice(i,i+100))});}chunks.push({kind:'staff',index:0,payload:JSON.stringify(normalized.staff||{})});
 await putDoc(root,{createdAt:now(),summary,validation:normalized.validation||{},recordCounts:{basic:normalized.basic.length,secondary:normalized.secondary.length,institutions:normalized.institutions.length},excludedKindergarten:normalized.secondary.reduce((a,r)=>a+Number(r.kindergarten_students||0),0)});
 for(const c of chunks)await putDoc(root+'/chunks/'+c.kind+'_'+String(c.index).padStart(5,'0'),c);
 // Files are written into the immutable version before the period's published pointer moves.
 const fileMeta=[];for(let i=0;i<files.length;i++){const f=files[i],bytes=new Uint8Array(await f.blob.arrayBuffer()),chunkSize=250000,parts=[];for(let o=0,j=0;o<bytes.length;o+=chunkSize,j++){let binary='';for(const b of bytes.subarray(o,Math.min(o+chunkSize,bytes.length)))binary+=String.fromCharCode(b);const payload=btoa(binary);await putDoc(root+'/files/'+i+'_'+j,{index:j,payload});parts.push(j)}fileMeta.push({id:String(i),category:f.category,kind:f.kind||null,name:f.name,type:f.type||'application/octet-stream',size:bytes.length,hash:f.hash||await fileHash(f.blob),uploadedAt:f.uploadedAt||now(),parts});}
 await putDoc(root,{fileMeta,updatedAt:now()});const p={folder,name,basePeriod,latestVersion:id,active:!!active,hasStudents:normalized.basic.length>0||normalized.secondary.length>0,updatedAt:now(),createdAt:now()};await putDoc('periods/'+enc(folder),p);return {...p,data:normalized,summary};}
async function fileHash(f){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')}
async function upload(fd){
 if(session()?.role!=='System Admin')throw new Error('Yönetici girişi gerekli.');
 const period=String(fd.get('period')||'').trim(),category=String(fd.get('category')||''),mode=String(fd.get('mode')||'replace');
 const files=[...fd.values()].filter(f=>f instanceof File&&f.name);
 if(!period||!['students','institutions','staff'].includes(category)||!files.length)throw new Error('Dönem, veri türü ve Excel dosyası seçiniz.');
 if(files.some(f=>! /\.(xls|xlsx)$/i.test(f.name)))throw new Error('Yalnızca .xls ve .xlsx dosyaları yüklenebilir.');
 const all=await periods();let current=all.find(x=>x.folder===period||x.name===period);
 const existing=current?await fileRecords(current):[];
 const hashes=await Promise.all(files.map(fileHash));
 for(let i=0;i<files.length;i++)for(const old of existing)if(old.category===category&&(old.hash||await fileHash(old.blob))===hashes[i])throw new Error('Bu dosya/dönem zaten mevcut.');
 let folder=current?.folder||window.__brifingExcelParser.periodFolder(period),name=current?.name||period;
 const parsed=await window.__brifingExcelParser.parseUploaded(category,files);
 const kindOf=f=>f.kind||(f.category==='students'?(/orta|secondary/i.test(f.name)?'secondary':/temel|basic/i.test(f.name)?'basic':null):f.category);
 if(current&&(mode==='new'||existing.some(f=>f.category===category&&(category!=='students'||parsed.fileKinds.includes(kindOf(f)))))){folder+='__'+Date.now();name=period+' - '+new Date().toLocaleDateString('tr-TR');current=null;}
 const prior=current?await readVersion(current):emptyData(),data={...prior,staff:prior.staff||emptyData().staff};
 if(category==='students'){data.validation={...prior.validation};if(parsed.basic){data.basic=parsed.basic.rows;data.validation.basic_total=parsed.basic.total;}if(parsed.secondary){data.secondary=normalizeSecondary(parsed.secondary.rows);data.validation.secondary_total=parsed.secondary.total;}}
 else if(category==='institutions')data.institutions=parsed.institutions;else data.staff=parsed.staff;
 const newFiles=(current?existing:[]).filter(x=>x.category!==category||(category==='students'&&!parsed.fileKinds.includes(kindOf(x))));
 files.forEach((f,i)=>newFiles.push({category,kind:category==='students'?parsed.fileKinds[i]:category==='institutions'?'institutions':'staff',name:f.name,type:f.type,blob:f,hash:hashes[i],uploadedAt:now()}));
 const active=!!current?.active||!all.some(p=>p.active);
 const result=await publish(folder,name,period,data,newFiles,active,category);
 if(active){viewedFolder=folder;localStorage.setItem('brifing_active_period',folder);window.__BRIFING_CURRENT=result;}
 return {ok:true,period:name,folder,category,files:files.map(f=>f.name),message:'Excel verileri ve orijinal dosyalar bu döneme kaydedildi.',active_changed:active};
}
async function commit(writes){await request(base+':commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes})});clearReadCache();}
function activeWrite(p,active){return {update:{name:base.replace('https://firestore.googleapis.com/v1/','')+'/periods/'+p.folder,fields:{active:fv(active)}},updateMask:{fieldPaths:['active']},currentDocument:{exists:true}};}
async function selectPeriod(folder,activate=false){const ps=await periods(),p=ps.find(x=>x.folder===folder);if(!p||activate&&!p.latestVersion)throw new Error('Bu dönem için veri bulunmuyor.');if(activate){await readVersion(p);await commit(ps.map(x=>activeWrite(x,x.folder===folder)));}viewedFolder=folder;return {ok:true,period:p.name,folder};}
async function deletePeriod(folder){
 if(session()?.role!=='System Admin')throw new Error('Yönetici girişi gerekli.');
 const ps=await periods(),p=ps.find(x=>x.folder===folder);if(!p?.latestVersion)throw new Error('Silinecek dönem bulunamadı veya boş.');
 const prefix='periods/'+enc(folder),paths=[];
 for(const v of await listDocs(prefix+'/versions')){const root=prefix+'/versions/'+enc(v.id);for(const collection of ['chunks','files'])for(const d of await listDocs(root+'/'+collection))paths.push(root+'/'+collection+'/'+enc(d.id));paths.push(root);}
 // Delete only descendants of the exact selected period. Keep its pointer until descendants are removed.
 for(let i=0;i<paths.length;i+=400)await commit(paths.slice(i,i+400).map(path=>({delete:base.replace('https://firestore.googleapis.com/v1/','')+'/'+path})));
 const replacement=p.active?ps.find(x=>x.folder!==folder&&x.latestVersion):null;
 const writes=[{delete:base.replace('https://firestore.googleapis.com/v1/','')+'/'+prefix}];
 if(p.active)writes.push(...ps.filter(x=>x.folder!==folder).map(x=>activeWrite(x,x.folder===replacement?.folder)));
 await commit(writes);if(p.active){if(replacement)localStorage.setItem('brifing_active_period',replacement.folder);else localStorage.removeItem('brifing_active_period');}return {ok:true};
}
async function deleteFile(ref,expectedName){
 if(session()?.role!=='System Admin')throw new Error('Yönetici girişi gerekli.');
 const [folder,index]=decodeURIComponent(ref).split('::'),p=(await periods()).find(x=>x.folder===folder);
 if(!p?.latestVersion)throw new Error('Dönem bulunamadı.');
 const root=`periods/${enc(p.folder)}/versions/${enc(p.latestVersion)}`,meta=await getDoc(root),file=meta?.fileMeta?.[Number(index)];
 if(!file||file.name!==expectedName)throw new Error('Dosya listesi değişti. Sayfayı yenileyip tekrar deneyiniz.');
 const kind=file.category==='students'?(file.kind||(/orta|secondary/i.test(file.name)?'secondary':/temel|basic/i.test(file.name)?'basic':null)):file.category==='institutions'?'institutions':file.category==='staff'?'staff':null;
 if(!kind)throw new Error('Dosyanın veri türü belirlenemedi; hiçbir veri silinmedi.');
 const data=await readVersion(p);data[kind]=kind==='staff'?emptyData().staff:[];
 if(kind==='basic'||kind==='secondary')data.validation={...data.validation,[kind+'_total']:0};
 const summary=window.__brifingExcelParser.buildData(data).summary;
 const prefix=base.replace('https://firestore.googleapis.com/v1/','');
 const writes=[];
 for(const d of await listDocs(root+'/chunks'))if(d.kind===kind)writes.push({delete:prefix+'/'+root+'/chunks/'+enc(d.id)});
 for(const part of file.parts||[])writes.push({delete:prefix+'/'+root+'/files/'+file.id+'_'+part});
 const updates={fileMeta:meta.fileMeta.filter((_,i)=>i!==Number(index)),summary,validation:data.validation||{},recordCounts:{basic:data.basic.length,secondary:data.secondary.length,institutions:data.institutions.length},updatedAt:now()};
 writes.push({update:{name:prefix+'/'+root,fields:Object.fromEntries(Object.entries(updates).map(([k,v])=>[k,fv(v)]))},updateMask:{fieldPaths:Object.keys(updates)},currentDocument:{exists:true}});
 const periodUpdate={hasStudents:data.basic.length>0||data.secondary.length>0,updatedAt:now()};
 writes.push({update:{name:prefix+'/periods/'+enc(p.folder),fields:Object.fromEntries(Object.entries(periodUpdate).map(([k,v])=>[k,fv(v)]))},updateMask:{fieldPaths:Object.keys(periodUpdate)},currentDocument:{exists:true}});
 if(writes.length>500)throw new Error('Dosya tek işlemde güvenle silinemeyecek kadar büyük; hiçbir veri silinmedi.');
 await commit(writes);return {ok:true,period:p.name};
}
async function fileRecords(p){if(!p?.latestVersion)return [];const root=`periods/${enc(p.folder)}/versions/${enc(p.latestVersion)}`,meta=await getDoc(root),files=meta?.fileMeta||[];if(!files.length)return [];const parts=await listDocs(root+'/files');return files.map(f=>{const docs=parts.filter(x=>x.id.startsWith(f.id+'_')).sort((a,b)=>a.index-b.index);const bin=docs.map(x=>atob(x.payload)).join('');const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return {...f,blob:new Blob([bytes],{type:f.type})}})}
async function migrateLegacy(){if(!indexedDB.databases)return;const existing=await periods();if(existing.length)return;const known=await indexedDB.databases();if(!known.some(x=>x.name==='BrifingBilgiSistemi_HTML_V3_PERSONEL'))return;const old=await new Promise((resolve,reject)=>{const req=indexedDB.open('BrifingBilgiSistemi_HTML_V3_PERSONEL',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('periods')){db.close();resolve([]);return}const tx=db.transaction('periods','readonly'),r=tx.objectStore('periods').getAll();r.onsuccess=()=>{db.close();resolve(r.result||[])};r.onerror=()=>{db.close();reject(r.error)}}});for(const p of old){if(!p?.folder||!p.data)continue;const files=(p.files||[]).map(f=>{if(f.blob)return f;const b64=String(f.data||'').replace(/^data:[^,]*,/,'');if(!b64)throw new Error(`Eski dönem kaynak dosyası eksik: ${f.name}`);const bin=atob(b64),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return {...f,blob:new Blob([bytes],{type:f.type||'application/octet-stream'})}});await publish(p.folder,p.name||p.folder,p.basePeriod||p.name||p.folder,{...p.data,secondary:normalizeSecondary(p.data.secondary||[])},files,!!p.active,'migration')}if(old.length)localStorage.setItem('brifing_legacy_migration','complete')}
function periodOrdinal(name){const s=String(name||'');const months={'ocak':1,'şubat':2,'mart':3,'nisan':4,'mayıs':5,'haziran':6,'temmuz':7,'ağustos':8,'eylül':9,'ekim':10,'kasım':11,'aralık':12},d=s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/),m=s.toLocaleLowerCase('tr-TR').match(/(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{4})/);if(d)return Number(d[3])*100+Number(d[2]);if(m)return Number(m[2])*100+months[m[1]];return 0}
function serializePeriods(ps,selectedFolder=''){const nowDate=new Date(),today=nowDate.getFullYear()*100+nowDate.getMonth()+1,selected=selectedFolder||ps.find(p=>p.active)?.folder||'';return ps.map(p=>{const ord=periodOrdinal(p.name),isSelected=p.folder===selected,group=isSelected?'active':ord&&ord<today?'past':'future';return {...p,folder:p.folder,name:p.name,status:isSelected?'Aktif':'Arşiv',_group:group,has_students:p.hasStudents,updated_at:p.updatedAt}})}
async function apiClient(url,opts={}){const u=new URL(url,location.href),path=u.pathname,method=(opts.method||'GET').toUpperCase();if(path.startsWith('/api/personnel/'))return window.__personnelCloudApi(url,opts);if(path==='/api/users'||path==='/api/admin/users')return {users:profiles.map(({email,...x})=>x)};if(path==='/api/health')return {ok:true,version:'Firebase-Firestore'};if(path==='/api/login'){const body=typeof opts.body==='string'?JSON.parse(opts.body):{};const profile=profiles.find(x=>x.username===body.username);if(!profile||body.unit&&body.unit!==profile.unit)throw new Error('Kullanıcı adı veya şifre hatalı.');const j=await authCall('accounts:signInWithPassword',{email:profile.email,password:String(body.password||''),returnSecureToken:true});let s={...profile,uid:j.localId,idToken:j.idToken,refreshToken:j.refreshToken,expiresAt:Date.now()+Number(j.expiresIn||3600)*1000};saveSession(s);const account=await getDoc('unitAccounts/'+j.localId);if(profile.username!=='admin'&&(!account||!account.active)){saveSession(null);throw new Error('Bu hesap için etkin birim yetkisi bulunamadı.');}s={...s,account,role:profile.username==='admin'||account?.role==='admin'?'System Admin':'Unit User'};saveSession(s);if(profile.username==='admin')await migrateLegacy();const {idToken,refreshToken,expiresAt,email,...publicProfile}=s;return {ok:true,token:idToken,...publicProfile,must_change:false};}
 if(session()?.role==='Unit User'&&path==='/api/data'&&!session()?.account?.screens?.some(p=>['overview','institutions','students','teachers','managers'].includes(p)))return emptyData();if(session()?.role==='Unit User'&&!['/api/data','/api/periods','/api/upload-periods','/api/institutions','/api/select-period'].includes(path))throw new Error('Bu işlem için yönetici yetkisi gereklidir.'); if(path==='/api/data'){const p=await viewedPeriod();if(!p){window.__BRIFING_CURRENT=null;return emptyData();}window.__BRIFING_CURRENT=p;return await readVersion(p)}
 if(path==='/api/periods'){const ps=await periods(),selected=await activePeriod();return {periods:serializePeriods(ps,selected?.folder||''),active:selected?.name||'',activeFolder:selected?.folder||'',selectedFolder:ps.some(p=>p.folder===viewedFolder)?viewedFolder:selected?.folder||''}}
 if(path==='/api/upload-periods'){const ps=await periods();return {periods:serializePeriods(ps),active:ps.find(x=>x.active)?.name||''}}
 if(path==='/api/select-period')return selectPeriod(u.searchParams.get('folder'));
 if(path==='/api/activate-period'&&method==='POST')return selectPeriod(JSON.parse(opts.body).folder,true);
 if(path==='/api/delete-file'&&method==='POST'){const b=JSON.parse(opts.body);return deleteFile(b.ref,b.name);}
 if(path==='/api/delete-period'&&method==='POST')return deletePeriod(JSON.parse(opts.body).folder);
 if(path==='/api/refresh'&&method==='POST'){clearReadCache();return await apiClient('/api/data');}
 if(path==='/api/institutions'){const d=await apiClient('/api/data'),q=u.searchParams,fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('tr-TR');const term=fold(q.get('q')),district=q.get('district'),type=q.get('type'),pub=q.get('public'),status=q.get('status');const rows=(d.institutions||[]).filter(x=>(!term||fold([x.name,x.type,x.district,x.code].join(' ')).includes(term))&&(!district||fold(district)==='tumu'||fold(x.district)===fold(district))&&(!type||fold(type)==='tumu'||fold(x.type)===fold(type))&&(!pub||fold(pub)==='tumu'||fold(x.status_type)===fold(pub))&&(!status||fold(status)==='tumu'||fold(x.status)===fold(status)));return {total:rows.length,rows:rows.slice(0,2000)}}
 if(path==='/api/units')return {units:[{no:1,display:'PERSONEL HİZMETLERİ ŞUBESİ',username:'personel.hizmetleri',role:'Unit User',status:'Aktif'}]};
 if(path==='/api/data-files'){
   const selected=u.searchParams.get('period'),all=await periods();
   const base=all.find(x=>x.folder===selected||x.name===selected)||(selected?null:await activePeriod());
   if(!base)return {ok:true,period:'',folder:'',files:[],uploadedCategories:{students:false,institutions:false,staff:false}};
   const related=[base];
   const uploadedCategories={students:false,institutions:false,staff:false},files=[];
   for(const p of related){
     const meta=p.latestVersion?await getDoc(`periods/${enc(p.folder)}/versions/${enc(p.latestVersion)}`):null,fs=meta?.fileMeta||[],summary=meta?.summary||{},counts=meta?.recordCounts||{};
     uploadedCategories.students ||= !!p.hasStudents||Number(counts.basic||summary.basic_students||0)>0||Number(counts.secondary||summary.secondary_students||0)>0;
     uploadedCategories.institutions ||= Number(counts.institutions||summary.institution_count||0)>0;
     uploadedCategories.staff ||= Number(summary.teacher_total||meta?.staff?.teacher?.total||0)>0||Number(summary.manager_total||meta?.staff?.manager?.total||0)>0;
     for(let i=0;i<fs.length;i++){
       const f=fs[i];if(f.category in uploadedCategories)uploadedCategories[f.category]=true;
       files.push({name:f.name,category:f.category,label:f.category==='students'?'Öğrenci Bilgileri':f.category==='institutions'?'Okul/Kurum Bilgileri':'Yönetici/Öğretmen Bilgileri',updated_at:f.uploadedAt||p.updatedAt,record_count:f.category==='students'?( /orta|secondary/i.test(f.name)?summary.secondary_students:summary.basic_students):f.category==='institutions'?(counts.institutions||summary.institution_count||0):(summary.teacher_total||meta?.staff?.teacher?.total||0)+(summary.manager_total||meta?.staff?.manager?.total||0),size:f.size,relative:p.folder+'::'+i,version:p.folder===base.folder?'Güncel':p.name});
     }
   }
   const unitExcel=window.UnitBriefingService?.isAdmin()?await window.UnitBriefingService.unitExcelSummary(base.folder):null;uploadedCategories.units=!!unitExcel?.loaded;return {ok:true,period:base.name,folder:base.folder,uploadedCategories,files,unitExcel};
 }
 if(path==='/api/upload'&&method==='POST')return await upload(opts.body);
 if(path==='/api/admin/reset-password')throw new Error('Yönetici şifre sıfırlamayı Firebase Authentication yönetici konsolundan yapmalıdır.');
 if(path==='/api/change-password')throw new Error('Şifre değişikliği Firebase Authentication hesabı üzerinden yapılmalıdır.');
 throw new Error('İşlem desteklenmiyor: '+path)}
window.__personnelFirestore={
 read:async path=>{checkQuota();let r=await fetch(base+'/'+path,{headers:authHeaders()});if(r.status===401&&await refresh())r=await fetch(base+'/'+path,{headers:authHeaders()});if(r.status===404)return null;const doc=await r.json();if(!r.ok)throw firestoreError(doc,r.status);return {data:decodeDoc(doc),updateTime:doc.updateTime,fields:doc.fields};},
 list:listDocs,
 count:async path=>{const cut=path.lastIndexOf('/'),parent=cut<0?'':path.slice(0,cut),collectionId=path.slice(cut+1);const rows=await request(base+(parent?'/'+parent:'')+':runAggregationQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredAggregationQuery:{structuredQuery:{from:[{collectionId}]},aggregations:[{count:{},alias:'total'}]}})});return Number(rows[0]?.result?.aggregateFields?.total?.integerValue||0);},
 query:async(path,structuredQuery)=>(await request(base+(path?'/'+path:'')+':runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery})})).filter(x=>x.document).map(x=>({id:x.document.name.split('/').pop(),...decodeDoc(x.document)})),
 write:(path,data,snapshot,stamps=[])=>({update:{name:base.replace('https://firestore.googleapis.com/v1/','')+'/'+path,fields:Object.fromEntries(Object.entries(data).filter(([k])=>!stamps.includes(k)).map(([k,v])=>[k,snapshot?.fields?.[k]?.timestampValue && v===snapshot.data[k]?snapshot.fields[k]:['updated_at','submitted_at','approved_at'].includes(k)&&typeof v==='string'?{timestampValue:v}:fv(v)]))},currentDocument:snapshot?{updateTime:snapshot.updateTime}:{exists:false},...(stamps.length?{updateTransforms:stamps.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})}),
 commit:async writes=>{try{await commit(writes)}catch(e){if(/precondition|ABORTED|FAILED_PRECONDITION/i.test(e.message))throw new Error('Bilgiler başka bir oturumda değişti. Yenileyip tekrar kontrol ediniz.');throw e;}}
};
let auditStart, signingOut = false;
const auditPath = id => 'userSessionAudit/' + id;
async function writeSessionAudit(writes) {
  await request(base + ':commit', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({writes}), signal: AbortSignal.timeout(2500)
  });
}
function startSessionAudit() {
  const current = session();
  if (!current || current.auditId) return;
  const auditId = crypto.randomUUID();
  saveSession({...current, auditId});
  const username = current.account?.username || current.username;
  const write = window.__personnelFirestore.write(auditPath(auditId),
    {uid:current.uid, username}, null, ['signedInAt']);
  auditStart = writeSessionAudit([write]).catch(() => {
    // Authentication is available even when the history write cannot be saved.
  });
}
async function finishSessionAudit() {
  const current = session();
  if (!current?.auditId) return;
  await auditStart;
  if (session()?.auditId !== current.auditId) return;
  const document = base.replace('https://firestore.googleapis.com/v1/', '') + '/' + auditPath(current.auditId);
  await writeSessionAudit([{transform:{document,fieldTransforms:[{fieldPath:'signedOutAt',setToServerValue:'REQUEST_TIME'}]},currentDocument:{exists:true}}]);
}
if(session()?.idToken?.startsWith('local-unit-'))saveSession(null);
window.__brifingApiClient=apiClient;window.api=apiClient;window.apiClient=apiClient;window.token=()=>session()?.idToken||'';window.authUser=()=>{const s=session();return s?{username:s.username,display:s.display,unit:s.unit,role:s.role,account:s.account,uid:s.uid}:null};window.initAuth=function(){const u=window.authUser();if(!u){window.forceLogin();return} $('login').classList.remove('show');$('sessionUser').textContent=u.display+' · '+u.unit};window.forceLogin=()=>{$('login').classList.add('show')};window.__firebaseLogout=async()=>{
 if(signingOut)return;
 signingOut=true;
 const button=$('logoutBtn');if(button)button.disabled=true;
 try{await finishSessionAudit();}catch{}finally{
  auditStart=null;viewedFolder='';clearReadCache();saveSession(null);window.forceLogin();
  signingOut=false;if(button)button.disabled=false;
 }
};window.logout=window.__firebaseLogout;
window.loadUsers=async function(){const directory=await fetch(base+'/unitLoginDirectory?pageSize=1000').then(async r=>{if(!r.ok)throw Error('Kullanıcı listesi okunamadı.');return r.json()});profiles=[profiles[0],...(directory.documents||[]).map(decodeDoc).filter(p=>p.active&&p.username!=='admin')];const sel=$('loginUserSelect');window.USERS=profiles.map(({email,...u})=>u);window.__setBrifingUsers?.(window.USERS);if(!sel)return;sel.innerHTML='<option value="">Kullanıcı seçiniz</option>'+window.USERS.map(u=>`<option value="${u.username}">${u.username}</option>`).join('');sel.onchange=()=>{const u=window.USERS.find(x=>x.username===sel.value);$('loginUser').value=u?.username||'';$('selectedUnit').style.display=u?'block':'none';$('selectedUnit').textContent=u?`Birim: ${u.unit} · Rol: ${u.role}`:''}}
async function resumeRemembered(saved){try{const response=await fetch(`https://securetoken.googleapis.com/v1/token?key=${cfg.apiKey}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refreshToken})});if(!response.ok)throw Error('Hatırlanan oturum sona erdi. Şifrenizi girerek yeniden giriş yapınız.');const data=await response.json();if(data.user_id!==saved.uid)throw Error('Hatırlanan hesap doğrulanamadı.');const lookup=await authCall('accounts:lookup',{idToken:data.id_token}),identity=lookup.users?.[0],profile=profiles.find(p=>p.username===saved.username&&p.email===identity?.email);if(!profile||identity.localId!==saved.uid)throw Error('Bu kullanıcı için kayıtlı oturum geçerli değil.');let current={...profile,uid:saved.uid,idToken:data.id_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};saveSession(current);const account=await getDoc('unitAccounts/'+saved.uid);if(profile.username!=='admin'&&(!account||!account.active))throw Error('Bu hesabın erişimi kapatılmış. Yöneticinizle iletişime geçiniz.');current={...current,account,role:profile.username==='admin'||account?.role==='admin'?'System Admin':'Unit User'};saveSession(current);return current;}catch(e){saveSession(null);throw e;}}
window.login=async function(){const username=($('loginUser').value||$('loginUserSelect').value).trim().toLocaleLowerCase('tr'),password=$('loginPass').value,remembered=rememberedSession(),canResume=$('rememberUsername').checked&&remembered?.username===username&&!!remembered.refreshToken;if(!username||!password&&!canResume){$('loginMsg').textContent='Kullanıcıyı ve şifreyi seçiniz/giriniz.';return}try{$('loginMsg').textContent='Sisteme bağlanıp giriş yapılıyor...';let r;if(!password&&canResume){r=await resumeRemembered(remembered);}else r=await apiClient('/api/login',{method:'POST',body:JSON.stringify({username,password,unit:window.USERS?.find(x=>x.username===username)?.unit||''})});viewedFolder='';$('sessionUser').textContent=r.display+' · '+r.unit;await load();await loadTopPeriodSelect();$('login').classList.remove('show');$('loginPass').value='';$('loginMsg').textContent='';startSessionAudit();show('overview')}catch(e){$('loginMsg').textContent='Giriş hatası: '+e.message}};
window.downloadExcelFile=async function(ref){const button=document.activeElement;try{if(button?.tagName==='BUTTON'){button.disabled=true;button.textContent='İndiriliyor...';}const [folder,index]=decodeURIComponent(ref).split('::');const p=(await periods()).find(x=>x.folder===folder);if(!p)throw new Error('Dönem bulunamadı.');const root=`periods/${enc(p.folder)}/versions/${enc(p.latestVersion)}`,meta=await getDoc(root),f=meta?.fileMeta?.[Number(index)];if(!f)throw new Error('Kaynak Excel dosyası bulunamadı.');const parts=await Promise.all(f.parts.map(i=>getDoc(root+'/files/'+f.id+'_'+i)));if(parts.some(x=>!x?.payload))throw new Error('Excel arşivinde eksik parça var.');const bin=parts.map(x=>atob(x.payload)).join(''),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));if(bytes.length!==f.size)throw new Error('Excel dosya boyutu doğrulanamadı.');const blob=new Blob([bytes],{type:f.type||'application/octet-stream'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}catch(e){alert('Dosya indirilemedi: '+e.message);}finally{if(button?.tagName==='BUTTON'){button.disabled=false;button.textContent='⬇ İndir';}}};
function zipStore(items){const enc=new TextEncoder(),crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0},w=(a,p,n)=>{a[p]=n&255;a[p+1]=(n>>>8)&255;a[p+2]=(n>>>16)&255;a[p+3]=(n>>>24)&255};return (async()=>{const locals=[],centrals=[];let offset=0;for(const it of items){const data=new Uint8Array(await it.blob.arrayBuffer()),name=enc.encode(it.name),sum=crc(data),h=new Uint8Array(30+name.length);w(h,0,0x04034b50);h[4]=20;w(h,14,sum);w(h,18,data.length);w(h,22,data.length);h[26]=name.length&255;h[27]=name.length>>>8;h.set(name,30);locals.push(h,data);const c=new Uint8Array(46+name.length);w(c,0,0x02014b50);c[4]=20;c[5]=20;w(c,16,sum);w(c,20,data.length);w(c,24,data.length);c[28]=name.length&255;c[29]=name.length>>>8;w(c,42,offset);c.set(name,46);centrals.push(c);offset+=h.length+data.length}const cd=centrals.reduce((a,x)=>a+x.length,0),out=new Uint8Array(offset+cd+22);let p=0;for(const x of locals){out.set(x,p);p+=x.length}const cdo=p;for(const x of centrals){out.set(x,p);p+=x.length}w(out,p,0x06054b50);out[p+8]=items.length&255;out[p+9]=items.length>>>8;out[p+10]=items.length&255;out[p+11]=items.length>>>8;w(out,p+12,cd);w(out,p+16,cdo);return new Blob([out],{type:'application/zip'})})()}
window.downloadExcelZip=async function(){try{const selected=$('downloadPeriod').value,p=(await periods()).find(x=>x.folder===selected||x.name===selected),files=(await fileRecords(p)).filter(x=>!window.excelDownloadCategory||x.category===window.excelDownloadCategory);if(!files.length)throw new Error('İndirilecek kayıtlı Excel bulunamadı.');const blob=await zipStore(files.map(f=>({name:f.name,blob:f.blob})));const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=p.folder+'_'+window.excelDownloadCategory+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}catch(e){alert('ZIP indirilemedi: '+e.message)}};
window.studentDetailStoreReset=()=>{window.__studentDetailStore=Object.create(null);window.__studentDetailSeq=0};
window.refreshData=async function(){try{clearReadCache();window.UnitBriefingService?.invalidateReadSummaries?.();await window.load();await window.loadTopPeriodSelect();alert('Seçili dönem Firebase üzerinden yenilendi.')}catch(e){alert('Firebase verisi yenilenemedi: '+e.message)}};

// Read an explicit published period without changing the selected or active period.
window.readAssistantPeriod=async function(folder,kinds){const p=await window.UnitBriefingService.account();if(!p||p.role!=='admin'&&!p.screens?.includes('data-assistant'))throw Error('Akıllı Veri Asistanı yetkiniz yok.');const allowed=['students','institutions','teachers','managers'];if(!Array.isArray(kinds)||!kinds.length||kinds.some(k=>!allowed.includes(k)))throw Error('Bu veri kaynağı için erişim yetkiniz yok.');const meta=(await periods()).find(p=>p.folder===folder);if(!meta)throw Error('Seçilen dönem bulunamadı.');const data=await readVersion(meta),out={};if(kinds.includes('students')){out.basic=data.basic||[];out.secondary=data.secondary||[];}if(kinds.includes('institutions'))out.institutions=data.institutions||[];if(kinds.includes('teachers')||kinds.includes('managers'))out.staff={};if(kinds.includes('teachers'))out.staff.teacher=data.staff?.teacher;if(kinds.includes('managers')){out.staff.manager=data.staff?.manager;out.staff.manager_need=data.staff?.manager_need;}return {data:out,period:{id:meta.folder,name:meta.name,version:meta.latestVersion||'',updatedAt:meta.updatedAt||''}};};
window.__firebaseDownloadExcelFile=window.downloadExcelFile;window.__firebaseDownloadExcelZip=window.downloadExcelZip;
})();
