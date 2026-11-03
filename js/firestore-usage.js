/* Administrator-only link to authoritative Firebase usage; no stale counters or extra reads. */
(function(){'use strict';let panel=null;
const admin=()=>window.authUser?.()?.role==='System Admin';
function clear(){panel?.remove();panel=null;}
function update(){if(!admin()){clear();return;}const quick=document.querySelector('#overview .quick-info');if(!quick)return;if(panel?.isConnected)return;panel=document.createElement('section');panel.id='firebaseUsagePanel';panel.className='firebase-usage';panel.style.cssText='flex:0 0 auto;border:0;padding:0;font-size:12px';panel.setAttribute('aria-label','Firebase kullanım limiti');const link=document.createElement('a');link.href='https://console.firebase.google.com/project/brifingbilgisistemi/firestore/usage';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Firebase Kullanım Limiti Kontrol Etme';panel.append(link);quick.append(panel);}
const show=window.show;window.show=function(page){const result=show.apply(this,arguments);if(page==='overview'&&result!==false)update();return result;};
const login=window.login;window.login=async function(){const result=await login.apply(this,arguments);update();return result;};const logout=window.logout;window.logout=function(){clear();return logout.apply(this,arguments);};document.addEventListener('visibilitychange',()=>{if(document.querySelector('#overview.active'))update();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();window.FirebaseUsage={refresh:update};
})();
