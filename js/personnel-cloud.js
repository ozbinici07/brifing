/* Shared Firestore unit briefing service; uses the existing authenticated adapter. */
(function(){
'use strict';
const UNIT='personel.hizmetleri', ROOT='personnelReports';
let schemaPromise;
const schema=()=>schemaPromise ||= fetch('config/personnel-schema.json').then(r=>{if(!r.ok)throw new Error('Personel tablo tanımları bulunamadı.');return r.json()});
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const adapter=()=>window.__personnelFirestore;
const admin=()=>window.authUser?.()?.username==='admin';
function authorized(){if(!['admin',UNIT].includes(window.authUser?.()?.username))throw new Error('Birim oturumu gereklidir.');}
function payload(p,s){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Geçerli bir tablo gönderiniz.');
 const keys=s.sections.flatMap(s=>s.rows.flatMap((_,i)=>s.columns.map(c=>s.id+'.'+i+'.'+c.id)));
 if(!p.cells||Object.keys(p.cells).some(k=>!keys.includes(k)))throw new Error('Tablo alanları geçersiz.');
 const cells={};for(const k of keys){const v=p.cells[k]??null;if(v!==null&&(!Number.isInteger(v)||v<0||v>10000000))throw new Error('Sayılar 0–10.000.000 arasında tam sayı olmalıdır.');cells[k]=v;}
 const out={cells};for(const [k,n] of [['source',500],['asOf',10],['notes',5000],['needs',5000]]){if(typeof (p[k]??'')!=='string'||(p[k]||'').length>n)throw new Error('Açıklama alanı geçersiz veya çok uzun.');out[k]=(p[k]||'').trim();}
 if(out.asOf&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.asOf)||isNaN(Date.parse(out.asOf))))throw new Error('Veri tarihi geçersiz.');return out;
}
async function service(url,opts={}){
 authorized();const a=adapter();if(!a)throw new Error('Firebase birim bağlantısı hazır değil.');
 const u=new URL(url,location.href),action=u.pathname.split('/').pop(),read=(!opts.method||opts.method==='GET');
 if(action==='catalog')return {ok:true}; // Periods already live in Firestore.
 if(read&&action==='inbox'){
  if(!admin())throw new Error('Yönetici yetkisi gereklidir.');
  const reports=(await a.list(ROOT)).filter(r=>!r.archived&&r.status==='pending').sort((x,y)=>String(y.submitted_at).localeCompare(String(x.submitted_at)));return {reports};
 }
 if(read&&action==='report'){
  const folder=u.searchParams.get('period');const [snapshot,settings]=await Promise.all([folder?a.read(ROOT+'/'+encodeURIComponent(folder)):null,a.read('personnelSettings/published')]);
  let report=snapshot?.data||null;if(report?.archived)report=null;
  if(report&&u.searchParams.get('view')==='published'){report=clone(report);report.draft=report.approved;report.pending=null;}
  return {report,published:!!settings?.data?.enabled};
 }
 const body=typeof opts.body==='string'?JSON.parse(opts.body):opts.body||{},folder=body.period;
 if(typeof folder!=='string'||!folder||folder.length>200||typeof body.name!=='string'||!body.name||body.name.length>200)throw new Error('Dönem seçiniz.');
 const path=ROOT+'/'+encodeURIComponent(folder),snapshot=await a.read(path),existing=snapshot?.data;
 if(body.version!==(existing?.version||0))throw new Error('Bilgiler başka bir oturumda değişti. Yenileyip tekrar kontrol ediniz.');
 const next=clone(existing)||{period:folder,name:body.name,unit:UNIT,version:0,draft:null,pending:null,pending_version:null,approved:null,approved_version:null,status:'draft',updated_at:null,submitted_at:null,approved_at:null,review_note:'',archived:false};
 next.version++;const stamps=[],writes=[];let historyPayload=null;
 if(action==='save'||action==='submit'){
  if(admin())throw new Error('Veri girişini Personel Hizmetleri birim hesabıyla yapınız.');
  const p=payload(body.payload,await schema());
  if(action==='submit'){
   if(!p.asOf||!p.source)throw new Error('Kontrole göndermek için veri tarihi ve kaynağını giriniz.');
   if(!Object.values(p.cells).some(v=>v!==null))throw new Error('En az bir sayısal bilgi giriniz.');
   const previous=existing?.status==='pending'?existing?.pending:existing?.approved;
   if(previous&&equal(p,previous))throw new Error('Yeni bir değişiklik bulunmuyor; aynı kayıt tekrar gönderilmedi.');
   next.pending=clone(p);next.pending_version=next.version;next.status='pending';next.review_note='';stamps.push('submitted_at');
  }else if(next.status!=='pending')next.status='draft';
  next.draft=p;stamps.push('updated_at');historyPayload=p;
 }else if(action==='approve'||action==='return'){
  if(!admin())throw new Error('Yönetici yetkisi gereklidir.');
  if(!existing||existing.status!=='pending'||!existing.pending||body.pendingVersion!==existing.pending_version)throw new Error('Kontrol bekleyen sürüm değişti. Yenileyiniz.');
  if(action==='approve'){
   next.approved=clone(existing.pending);next.approved_version=existing.pending_version;next.status=equal(existing.draft,existing.pending)?'approved':'draft';next.review_note='';stamps.push('approved_at');historyPayload=next.approved;
   const settings=await a.read('personnelSettings/published');writes.push(a.write('personnelSettings/published',{enabled:true},settings));
  }else{
   const note=String(body.note||'').trim();if(!note||note.length>2000)throw new Error('Birim için düzeltme açıklaması giriniz.');next.status='returned';next.review_note=note;historyPayload={note,payload:existing.pending};
  }
  next.pending=null;next.pending_version=null;
 }else if(action==='archive-test'){
  if(!admin()||!folder.startsWith('__personnel_test_'))throw new Error('Yalnızca test kaydı arşivlenebilir.');
  next.archived=true;historyPayload={};
  const others=(await a.list(ROOT)).filter(r=>!r.archived&&r.period!==folder&&r.approved);
  if(!others.length){const settings=await a.read('personnelSettings/published');writes.push(a.write('personnelSettings/published',{enabled:false},settings));}
 }else throw new Error('Birim işlemi desteklenmiyor.');
 if(action==='save'||action==='submit'){
  // Small validation documents keep every numeric field checked within Rules limits.
  for(let i=0;i<6;i++){
   const validationPath=path+'/validation/'+i,previous=await a.read(validationPath);
   writes.push(a.write(validationPath,{version:next.version,payload:next.draft},previous));
  }
 }
 writes.unshift(a.write(path,next,snapshot,stamps));
 writes.push(a.write(path+'/history/'+crypto.randomUUID(),{version:next.version,action,actor:window.authUser().username,payload:historyPayload,created_at:null},null,['created_at']));
 await a.commit(writes);return {ok:true};
}
window.__personnelCloudApi=service;
})();
