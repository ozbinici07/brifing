(function(){
'use strict';
const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), N=v=>v===null||v===undefined?'Veri yok':Number(v).toLocaleString('tr-TR');
let schema, current=null, period=null, published=false, reviewMode=false, dirty=false, busy=false, generation=0, inbox=[];
const admin=()=>window.authUser?.()?.username==='admin';
const unit=()=>window.authUser?.()?.role==='Unit User';
const api=(url,opts)=>window.api(url,opts);
const date=v=>v?new Date(v).toLocaleString('tr-TR'):'—';
const label={draft:'Taslak',pending:'Kontrol bekliyor',approved:'Onaylandı',returned:'Düzeltme istendi'};
const blank=()=>({cells:{},source:'',asOf:'',notes:'',needs:''});
const sum=(values)=>values.every(v=>v!==null&&v!==undefined)?values.reduce((a,v)=>a+v,0):null;
const msg=(text,error=false)=>{const el=$('personnelMessage');el.textContent=text;el.className='personnel-message'+(error?' error':'');};

function install(){
 const side=document.querySelector('.side'), content=document.querySelector('.content');
 const nav=document.createElement('div');nav.className='nav';nav.dataset.page='personnel';nav.innerHTML='<span class="ico">♙</span>Personel Hizmetleri';nav.onclick=()=>window.show('personnel');side.insertBefore(nav,side.querySelector('.sidebar-identity'));
 const pending=document.createElement('div');pending.className='nav';pending.dataset.page='personnel-review';pending.innerHTML='<span class="ico">☑</span>Kontrol Edilecekler <span id="personnelPendingCount" class="count">0</span>';pending.onclick=()=>window.show('personnel-review');side.insertBefore(pending,nav);
 const page=document.createElement('section');page.className='page';page.id='personnel';page.innerHTML=`
 <div class="personnel-hero"><div><span class="personnel-eyebrow">BİRİM BRİFİNGİ</span><h2>Personel Hizmetleri</h2><p>Muğla İl Millî Eğitim Müdürlüğü · Dönem bazlı personel bilgileri</p></div><span class="personnel-unit-icon">♙</span></div>
 <div id="personnelContext" class="personnel-context"></div>
 <div class="personnel-toolbar"><label>Dönem<select id="personnelPeriod" aria-label="Personel brifing dönemi"></select></label><button id="personnelReload" class="btn light">Bilgileri Yenile</button><button id="personnelBack" class="btn light">Birimlere Dön</button></div>
 <div id="personnelMessage" class="personnel-message" role="status" aria-live="polite"></div>
 <div id="personnelStatus" class="personnel-status"></div><div id="personnelStats" class="personnel-stats"></div>
 <div id="personnelFields" class="personnel-card"><h3>Brifing Bilgileri</h3><div class="personnel-meta"><label>Veri tarihi<input id="personnelAsOf" type="date"></label><label>Veri kaynağı<input id="personnelSource" maxlength="500" placeholder="Örn. MEBBİS / Personel kayıtları"></label></div></div>
 <div id="personnelTables"></div>
 <div class="personnel-card"><h3>Brifing Açıklamaları</h3><label>Öne çıkan çalışmalar<textarea id="personnelNotes" maxlength="5000" rows="3" placeholder="Bu dönemde yapılan çalışmalar ve açıklamalar"></textarea></label><label>İhtiyaçlar ve planlanan çalışmalar<textarea id="personnelNeeds" maxlength="5000" rows="3" placeholder="Personel ihtiyaçları, çözüm önerileri ve sonraki dönem planı"></textarea></label></div>
 <div class="personnel-actions"><button id="personnelSave" class="btn light">Taslağı Kaydet</button><button id="personnelSubmit" class="btn">Yönetici Kontrolüne Gönder</button><button id="personnelApprove" class="btn">Onayla ve Sekmeyi Ekle</button><label id="personnelReturnLabel">Düzeltme açıklaması<input id="personnelReturnNote" maxlength="2000" placeholder="Birime iletilecek açıklama"></label><button id="personnelReturn" class="btn light">Düzeltme İste</button><button id="personnelArchiveTest" class="btn light">Test Kaydını Arşivle</button></div>
 <p class="personnel-footnote">Boş hücreler “Veri yok” anlamına gelir; sıfır kaydı için 0 giriniz. Güncellenen alanlar son onaylı sürüme göre kırmızı gösterilir. Onaysız değişiklikler yönetici sekmesindeki yayımlanmış veriyi değiştirmez.</p>`;
 content.appendChild(page);
 const review=document.createElement('section');review.id='personnel-review';review.className='page';review.innerHTML='<div class="personnel-hero"><div><span class="personnel-eyebrow">YÖNETİCİ İNCELEMESİ</span><h2>Kontrol Edilecekler</h2><p>Birimlerin onaya gönderdiği yeni ve güncellenen bilgiler</p></div></div><button id="personnelInboxRefresh" class="btn light">Listeyi Yenile</button><div id="personnelInbox"></div>';content.appendChild(review);
 const unitOverview=document.createElement('div');unitOverview.id='personnelUnitOverview';unitOverview.innerHTML='<div class="personnel-hero"><div><span class="personnel-eyebrow">PERSONEL HİZMETLERİ ŞUBESİ</span><h2>Birim Genel Bakışı</h2><p>Personel brifing bilgilerinizi kaydedin ve yönetici kontrolüne gönderin.</p></div></div><div id="personnelUnitSummary" class="personnel-card"></div><button class="btn" id="personnelOverviewOpen">Personel Hizmetlerini Aç</button>'; $('overview').prepend(unitOverview);
 const bell=document.querySelector('.top-actions > span');bell.id='personnelBell';bell.setAttribute('role','button');bell.setAttribute('tabindex','0');bell.setAttribute('aria-label','Kontrol edilecek bildirimler');bell.onclick=()=>{if(admin())window.show('personnel-review')};bell.onkeydown=e=>{if(e.key==='Enter'&&admin())window.show('personnel-review')};
 $('personnelPeriod').onchange=async()=>{if(dirty&&!confirm('Kaydedilmemiş değişiklikler var. Dönemi değiştirmek istiyor musunuz?')){$('personnelPeriod').value=period.folder;return}await openReport($('personnelPeriod').value);};
 $('personnelReload').onclick=()=>{if(!dirty||confirm('Kaydedilmemiş değişiklikler yerine kayıtlı bilgileri yüklemek istiyor musunuz?'))openReport(period?.folder)};
 $('personnelBack').onclick=()=>window.show('units');
 $('personnelSave').onclick=()=>mutate('save');$('personnelSubmit').onclick=()=>mutate('submit');$('personnelApprove').onclick=()=>mutate('approve');$('personnelReturn').onclick=()=>mutate('return');$('personnelArchiveTest').onclick=()=>mutate('archive-test');
 $('personnelInboxRefresh').onclick=()=>refreshInbox();$('personnelOverviewOpen').onclick=()=>window.show('personnel');
 page.addEventListener('input',()=>{if(unit()){dirty=true;highlight();try{updateStats(readPayload());msg('Kaydedilmemiş değişiklikler var.');}catch(e){msg(e.message,true);}}});
 const oldShow=window.show;window.show=function(name){
   if(unit()&&!(window.canViewScreen?.(name)??['overview','personnel'].includes(name)))name='overview';
   if(name==='personnel-review'&&!admin())name='overview';
   if(name==='personnel'&&admin())reviewMode=false;
   oldShow(name);if(name==='personnel')openReport();if(name==='personnel-review')refreshInbox();applyRole();
 };
 window.unitInfo=function(username){if(username==='personel.hizmetleri'&&admin()){reviewMode=true;period=null;oldShow('personnel');openReport();}};
 const oldLogin=window.login;window.login=async function(){await oldLogin();if(!$('login').classList.contains('show')){dirty=false;current=null;period=null;applyRole();await refreshStatus();}};
 const oldLogout=window.logout;window.logout=function(){dirty=false;current=null;period=null;published=false;inbox=[];oldLogout();applyRole();};$('logoutBtn').onclick=()=>window.logout();
 const oldRender=window.renderAll;window.renderAll=function(){oldRender?.();applyRole();refreshStatus();};
 applyRole();refreshStatus();
 setInterval(()=>{if(document.visibilityState==='visible'&&window.authUser?.()&&!busy)refreshStatus();},20000);
}

function applyRole(){
 const isUnit=unit(), isAdmin=admin();document.body.classList.toggle('personnel-unit-session',isUnit);
 document.querySelectorAll('.side .nav').forEach(n=>{const p=n.dataset.page;n.hidden=isUnit?!(window.canViewScreen?.(p)??['overview','personnel'].includes(p)):p==='personnel'?!published:p==='personnel-review'?!isAdmin:false;});
 $('personnelUnitOverview').hidden=!isUnit;
 $('personnelOverviewOpen').hidden=isUnit&&window.canViewScreen&&!window.canViewScreen('personnel');
 const avatar=document.querySelector('.top-actions .avatar');if(avatar){avatar.textContent=isUnit?'P':'A';const label=avatar.nextElementSibling;if(label?.tagName==='SPAN')label.innerHTML=isUnit?'Personel<br><small>Birim Kullanıcısı</small>':'admin<br><small>Yönetici</small>';}
 $('periodSelect').disabled=isUnit;
}
window.applyScreenAccess=()=>{applyRole();const active=document.querySelector('.page.active');if(unit()&&active&&!window.canViewScreen(active.id))window.show('overview');};
async function refreshStatus(){
 if(!window.authUser?.())return;
 try{const ps=await api('/api/periods'), active=ps.periods.find(p=>p.status==='Aktif');
   if(admin())await api('/api/personnel/catalog',{method:'POST',body:JSON.stringify(ps)});const result=await api('/api/personnel/report?period='+encodeURIComponent(active?.folder||''));published=result.published;applyRole();
   const r=result.report;if(unit())$('personnelUnitSummary').innerHTML=`<h3>${E(active?.name||'Aktif dönem bulunmuyor')}</h3><p>Veri durumu: <b>${E(label[r?.status]||'Henüz veri girilmedi')}</b></p><p>Son kayıt: ${E(date(r?.updated_at))}</p><p>Son onay: ${E(date(r?.approved_at))}</p>${r?.review_note?'<p class="personnel-changed">Yönetici açıklaması: '+E(r.review_note)+'</p>':''}`;
   if(admin())await refreshInbox();
 }catch(e){$('personnelUnitSummary').textContent='Birim bilgileri alınamadı: '+e.message;}
}
async function refreshInbox(){
 if(!admin())return;
 try{const result=await api('/api/personnel/inbox');inbox=result.reports;
 const text=inbox.length?inbox.length+' kayıt kontrol bekliyor':'Kontrol bekleyen kayıt bulunmuyor.';
 $('personnelPendingCount').textContent=inbox.length;$('personnelBell').textContent='🔔'+(inbox.length?' '+inbox.length:'');$('personnelBell').setAttribute('aria-label','Kontrol edilecek bildirimler: '+inbox.length);
 $('personnelInbox').innerHTML=inbox.length?inbox.map((r,i)=>`<div class="personnel-card personnel-pending-card"><div><h3>Personel Hizmetleri · ${E(r.name)}</h3><p>Gönderilme: ${E(date(r.submitted_at))} · Sürüm ${r.pending_version}</p><span class="personnel-pill pending">Kontrol bekliyor</span></div><button class="btn" data-review-index="${i}">Bilgileri İncele</button></div>`).join(''):'<div class="personnel-card">Kontrol bekleyen kayıt bulunmuyor.</div>';
 $('personnelInbox').querySelectorAll('[data-review-index]').forEach(b=>b.onclick=()=>{reviewMode=true;const r=inbox[Number(b.dataset.reviewIndex)];document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='personnel'));document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));openReport(r.period,r.name);});
 }catch(e){$('personnelInbox').textContent='Kontrol listesi yüklenemedi: '+e.message;}
}
async function openReport(folder, name){
 const turn=++generation;busy=true;msg('Dönem bilgileri yükleniyor...');toggleBusy(true);
 try{
  schema ||= await fetch('config/personnel-schema.json').then(r=>{if(!r.ok)throw new Error('Tablo tanımları yüklenemedi.');return r.json()});
  const list=await api('/api/periods');if(turn!==generation)return;
  const selected=folder||period?.folder||list.periods.find(p=>p.status==='Aktif')?.folder;
  const testMode=new URLSearchParams(location.search).get('personnelTest');
  if(testMode&&!folder){folder='__personnel_test_'+testMode;name='Personel Testi '+testMode;}
  const candidate=folder||selected;period=list.periods.find(p=>p.folder===candidate)||(candidate?{folder:candidate,name:name||period?.name||candidate}:null);
  $('personnelPeriod').innerHTML=list.periods.map(p=>`<option value="${E(p.folder)}">${E(p.name)}</option>`).join('');
  if(period&&!list.periods.some(p=>p.folder===period.folder))$('personnelPeriod').insertAdjacentHTML('beforeend',`<option value="${E(period.folder)}">${E(period.name)}</option>`);
  if(period)$('personnelPeriod').value=period.folder;
  if(!period){current=null;renderReport();msg('Aktif dönem bulunmuyor. Önce yönetici bir dönem oluşturmalıdır.',true);return;}
  const result=await api('/api/personnel/report?period='+encodeURIComponent(period.folder)+(admin()&&!reviewMode?'&view=published':''));if(turn!==generation)return;
  current=result.report;if(current?.name)period.name=current.name;published=result.published;dirty=false;renderReport();applyRole();msg('');
 }catch(e){msg('Bilgiler yüklenemedi: '+e.message,true);}finally{if(turn===generation){busy=false;toggleBusy(false);}}
}
function viewedPayload(){return (admin()?(reviewMode?(current?.pending||current?.draft||current?.approved):current?.approved):(current?.draft||current?.approved))||blank();}
function renderReport(){
 const payload=viewedPayload(), editable=unit()&&!!period;
 $('personnelContext').textContent=admin()?(reviewMode?'Birim ekranını yönetici olarak inceliyorsunuz. Gönderilen değişiklikler kırmızı gösterilir.':'Yayımlanmış brifing bilgileri. Yalnızca onaylı sürüm gösterilir.'):'Personel Hizmetleri birim ekranı · Bilgilerinizi girip yönetici kontrolüne gönderiniz.';
 $('personnelStatus').innerHTML=`<span class="personnel-pill ${E(current?.status||'draft')}">${E(admin()&&!reviewMode?(current?.approved?'Yayımlanmış':'Bu dönem için onaylı veri bulunmuyor'):label[current?.status]||'Henüz veri girilmedi')}</span> <span>Dönem: <b>${E(period?.name||'—')}</b> · Son kayıt: ${E(date(current?.updated_at))} · Son onay: ${E(date(current?.approved_at))}</span>${current?.review_note?'<p class="personnel-changed">Düzeltme açıklaması: '+E(current.review_note)+'</p>':''}`;
 for(const [id,key] of [['personnelAsOf','asOf'],['personnelSource','source'],['personnelNotes','notes'],['personnelNeeds','needs']]){$(id).value=payload[key]||'';$(id).disabled=!editable;}
 $('personnelTables').innerHTML=schema.sections.map(s=>`<div class="personnel-card"><h3>${E(s.title)}</h3><p class="personnel-description">${E(s.description)}</p><div class="personnel-table-wrap"><table class="personnel-table"><thead><tr><th>${s.id==='norm'?'İlçe':'Bilgi Türü'}</th>${s.columns.map(c=>'<th>'+E(c.label)+'</th>').join('')}${s.total?'<th>Toplam</th>':''}${s.difference?'<th>Net Açık</th><th>Net Fazla</th>':''}</tr></thead><tbody>${s.rows.map((row,i)=>`<tr><th scope="row">${E(row)}</th>${s.columns.map(c=>{const key=s.id+'.'+i+'.'+c.id;return `<td><input type="number" min="0" max="10000000" step="1" data-cell="${E(key)}" aria-label="${E(s.title+' '+row+' '+c.label)}" placeholder="Veri yok" value="${E(payload.cells[key]??'')}" ${editable?'':'disabled'}></td>`;}).join('')}${s.total?`<td data-total="${s.id}.${i}"></td>`:''}${s.difference?`<td data-open="${s.id}.${i}"></td><td data-surplus="${s.id}.${i}"></td>`:''}</tr>`).join('')}</tbody></table></div></div>`).join('');
 $('personnelSave').hidden=!editable;$('personnelSubmit').hidden=!editable;
 const canReview=admin()&&reviewMode&&current?.status==='pending';$('personnelApprove').hidden=!canReview;$('personnelReturn').hidden=!canReview;$('personnelReturnLabel').hidden=!canReview;$('personnelReturnNote').value='';
 $('personnelBack').hidden=!admin();$('personnelArchiveTest').hidden=!(admin()&&period?.folder.startsWith('__personnel_test_')&&current&&!current.archived);
 updateStats(payload);highlight();
}
function readPayload(){
 const payload=blank();$('personnelTables').querySelectorAll('[data-cell]').forEach(input=>{if(!input.checkValidity())throw new Error('Sayılar 0–10.000.000 arasında tam sayı olmalıdır.');payload.cells[input.dataset.cell]=input.value===''?null:Number(input.value);});
 for(const [id,key] of [['personnelAsOf','asOf'],['personnelSource','source'],['personnelNotes','notes'],['personnelNeeds','needs']])payload[key]=$(id).value.trim();return payload;
}
function updateStats(payload){
 if(!schema)return;
 for(const s of schema.sections)for(let i=0;i<s.rows.length;i++){const key=s.id+'.'+i, values=s.columns.map(c=>payload.cells[key+'.'+c.id]??null);const total=document.querySelector(`[data-total="${key}"]`);if(total)total.textContent=N(sum(values));
 const open=document.querySelector(`[data-open="${key}"]`),extra=document.querySelector(`[data-surplus="${key}"]`);if(open){open.textContent=N(values.every(v=>v!==null)?Math.max(0,values[0]-values[1]):null);extra.textContent=N(values.every(v=>v!==null)?Math.max(0,values[1]-values[0]):null);}}
 const all=(section,column)=>schema.sections.find(s=>s.id===section).rows.map((_,i)=>payload.cells[section+'.'+i+'.'+column]??null);
 const cards=[['Kadrolu + Sözleşmeli Öğretmen',sum(['personnel.0.official','personnel.1.official'].map(k=>payload.cells[k]??null))],['Resmî Öğretmen Normu',sum(all('norm','norm'))],['Normla Karşılaştırılan Mevcut',sum(all('norm','present'))],['Atama / Yer Değiştirme İşlemi',sum(all('appointments','count'))]];
 $('personnelStats').innerHTML=cards.map(([name,value])=>`<div class="personnel-stat"><span>${E(name)}</span><strong>${N(value)}</strong></div>`).join('');
}
function highlight(){
 const baseline=current?.approved||blank();const highlightEnabled=unit()||reviewMode;
 $('personnelTables').querySelectorAll('[data-cell]').forEach(input=>{const value=input.value===''?null:Number(input.value),old=baseline.cells[input.dataset.cell]??null,changed=highlightEnabled&&value!==old;input.classList.toggle('personnel-changed',changed);input.title=changed?'Son onaylı değer: '+N(old):'';});
 for(const [id,key] of [['personnelAsOf','asOf'],['personnelSource','source'],['personnelNotes','notes'],['personnelNeeds','needs']]){$(id).classList.toggle('personnel-changed',highlightEnabled&&$(id).value!==(baseline[key]||''));$(id).title=highlightEnabled&&$(id).value!==(baseline[key]||'')?'Son onaylı değer: '+(baseline[key]||'Veri yok'):'';}
}
function toggleBusy(value){$('personnel').querySelectorAll('button,select').forEach(b=>b.disabled=value);}
async function mutate(action){
 if(busy||!period)return;busy=true;toggleBusy(true);
 try{const body={period:period.folder,name:period.name,version:current?.version||0};
 if(action==='save'||action==='submit')body.payload=readPayload();
 if(action==='approve'||action==='return')body.pendingVersion=current?.pending_version;
 if(action==='return')body.note=$('personnelReturnNote').value;
 await api('/api/personnel/'+action,{method:'POST',body:JSON.stringify(body)});dirty=false;await openReport(period.folder,period.name);await refreshStatus();
 msg({save:'Taslak kaydedildi. Kontrole göndermek için Yönetici Kontrolüne Gönder düğmesini kullanınız.',submit:'Bilgiler yönetici kontrolüne gönderildi. Yönetici ekranına bildirim eklendi.',approve:'Bilgiler onaylandı. Personel Hizmetleri sekmesi yönetici menüsüne eklendi.',return:'Düzeltme açıklaması birim ekranına iletildi. Onaylı bilgiler korundu.','archive-test':'Test kaydı arşivlendi. Gerçek dönem kayıtları korundu.'}[action]);
 }catch(e){msg(e.message,true);}finally{busy=false;toggleBusy(false);}
}
install();
})();
