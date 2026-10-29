(function(){
'use strict';
let access={};
const protectedPages=new Set(['admin','excel','units','personnel-review']);
window.screenAccessCatalog=function(){return [...document.querySelectorAll('.content .page[id]')].filter(p=>!protectedPages.has(p.id)&&p.dataset.accessManaged!=='false').map(p=>{const nav=[...document.querySelectorAll('.side .nav[data-page]')].find(n=>n.dataset.page===p.id);const title=p.dataset.screenTitle||(nav?[...nav.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():'')||p.querySelector('.page-head h2,.personnel-hero h2,h2')?.textContent?.trim()||p.id;return {id:p.id,title}})};
const defaults=user=>user==='personel.hizmetleri'?['overview','personnel']:['overview'];
window.defaultScreenAccess=defaults;

window.canViewScreen=function(page){const u=window.authUser?.();if(!u)return false;if(u.username==='admin')return true;return (access[u.username]||defaults(u.username)).includes(page)};
window.reloadScreenAccess=async function(){if(!window.authUser?.())return;const s=await window.__personnelFirestore.read('personnelSettings/screenAccess');access=s?.data?.users||{};window.applyScreenAccess?.();return access};
window.saveScreenAccess=async function(username,pages){if(window.authUser?.()?.username!=='admin')throw new Error('Yönetici yetkisi gereklidir.');if(!pages.length||pages.some(p=>!window.screenAccessCatalog().some(s=>s.id===p)))throw new Error('En az bir ekran seçiniz.');const a=window.__personnelFirestore,s=await a.read('personnelSettings/screenAccess');const users={...(s?.data?.users||{}),[username]:pages};await a.commit([a.write('personnelSettings/screenAccess',{users},s)]);access=users;window.applyScreenAccess?.()};
window.getScreenAccess=()=>access;
const login=window.login;window.login=async function(){await login();if(!window.authUser?.())return;await window.reloadScreenAccess();await window.load();const page=document.querySelector('.page.active');if(page&&!window.canViewScreen(page.id))window.show((access[window.authUser().username]||['overview'])[0]);};
const show=window.show;window.show=function(page){if(!window.canViewScreen(page)){const u=window.authUser?.();page=u?.username==='admin'?'overview':(access[u?.username]||defaults(u?.username))[0];}show(page)};
window.reloadScreenAccess().catch(e=>console.warn('Ekran tercihleri alınamadı:',e.message));
setInterval(()=>{if(window.authUser?.())window.reloadScreenAccess().catch(()=>{});},20000);
})();