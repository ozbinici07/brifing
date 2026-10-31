/* Integrate Birimler with the existing shell without exposing source data in Hosting. */
(function(){
'use strict';
const $=id=>document.getElementById(id),S=window.UnitBriefingService;
let profile=null;
function frame(section,mode){section.replaceChildren();const head=document.createElement('div');head.className='page-head';const h=document.createElement('h2');h.textContent=mode==='admin'?'Yönetici Paneli':'Birimler';head.append(h);const iframe=document.createElement('iframe');iframe.className='unit-system-frame';iframe.title=mode==='admin'?'Birim ve kullanıcı yönetimi':'Birimler';iframe.src='units/index.html'+(mode?'?mode='+mode:'');section.append(head,iframe);}
const units=$('units');frame(units,'');
const nav=document.querySelector('.side .nav[data-page="units"]');nav.hidden=false;nav.classList.remove('admin-card-only');nav.innerHTML='<span class="ico">▦</span>Birimler';
document.querySelectorAll('.side .nav[data-page="personnel"],.side .nav[data-page="personnel-review"]').forEach(n=>n.remove());
window.loadUnits=async()=>{};
frame($('admin'),'admin');window.loadAdmin=async()=>{};
const bell=document.querySelector('.top-actions>span');if(bell){bell.id='personnelBell';bell.setAttribute('role','button');bell.setAttribute('tabindex','0');bell.setAttribute('aria-label','Bildirimler');bell.onclick=()=>window.show('units');bell.onkeydown=e=>{if(e.key==='Enter')window.show('units');};}
const style=document.createElement('style');style.textContent='#units,#admin{height:100%}.unit-system-frame{border:0;width:100%;height:calc(100% - 30px);min-height:650px;display:block;background:#f3f6fa}.unit-import-entry{margin:15px 0;padding:18px;background:#fff;border:1px solid #dce6ef;border-radius:8px}.unit-import-entry p{font-size:12px;color:#546d82}';document.head.append(style);
const excel=$('excel'),entry=document.createElement('section');entry.className='unit-import-entry';entry.innerHTML='<h3>Birim Brifing Excel’i</h3><p>Birim tablolarını Excel’den karşılaştırarak aktarın. Mevcut birim girişleri otomatik olarak silinmez.</p><button class="btn" type="button">Birim Excel Aktarımını Aç</button>';excel.prepend(entry);entry.querySelector('button').onclick=()=>{let f=entry.querySelector('iframe');if(!f){f=document.createElement('iframe');f.className='unit-system-frame';f.title='Birim Excel içe aktarma';f.src='units/index.html?mode=import';entry.append(f);}f.scrollIntoView({block:'start'});};
const oldLogout=window.logout;window.logout=function(){profile=null;document.querySelectorAll('.unit-system-frame').forEach(f=>{if(!f.dataset.src)f.dataset.src=f.src;f.src='about:blank';});oldLogout();};$('logoutBtn').onclick=()=>window.logout();
async function refreshAccess(){if(!window.token?.())return;profile=await S.account();const admin=profile.role==='admin';$('periodSelect').disabled=!admin;const avatar=document.querySelector('.top-actions .avatar');if(avatar){avatar.textContent=admin?'A':profile.username[0].toLocaleUpperCase('tr');const label=avatar.nextElementSibling;if(label){label.replaceChildren();label.append(document.createTextNode(profile.username+' '));const role=document.createElement('small');role.textContent=admin?'Yönetici':'Birim';label.append(role);}}document.querySelectorAll('.side .nav[data-page]').forEach(n=>{n.hidden=!admin&&!(profile.screens||['units']).includes(n.dataset.page);});nav.hidden=!admin&&!(profile.screens||['units']).includes('units');}
const oldShow=window.show;window.show=function(page){if(profile?.role!=='admin'&&profile&&!profile.screens?.includes(page))page=profile.screens?.[0]||'units';oldShow(page);};
const login=window.login;window.login=async function(){await login();if(!window.token?.())return;try{await refreshAccess();window.show(profile.role==='admin'?'overview':profile.screens?.[0]||'units');document.querySelectorAll('.unit-system-frame').forEach(f=>f.src=f.dataset.src||f.src);}catch(e){window.forceLogin();$('loginMsg').textContent=e.message;}};
window.addEventListener('DOMContentLoaded',()=>{if(window.token?.())refreshAccess().then(()=>{if(profile?.role!=='admin')window.show(profile.screens?.[0]||'units');}).catch(()=>window.forceLogin());});
window.addEventListener('beforeunload',()=>{profile=null;});
})();

