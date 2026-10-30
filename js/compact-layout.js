/* Shared application chrome; existing controls keep their IDs and listeners. */
(function(){
'use strict';
function install(){
const side=document.querySelector('.side'),top=document.querySelector('.top'),actions=document.querySelector('.top-actions');
if(!side||!top||!actions||document.getElementById('compact-layout-style'))return;
const identity=side.querySelector('.sidebar-identity');
if(identity){identity.innerHTML='<img src="assets/bbs-logo.png" alt="Muğla BBS logosu"><div>Muğla İl Millî Eğitim Müdürlüğü Brifing Bilgi Sistemi</div>';side.prepend(identity);}
top.querySelector('.brand')?.remove();
top.querySelector('.app-wordmark')?.remove();
const status=document.querySelector('.overview-status'),avatar=actions.querySelector('.avatar');
if(status&&avatar){const period=status.querySelector('.status-period');period.classList.add('top-period');period.querySelector('select').setAttribute('aria-label','Aktif dönem');actions.insertBefore(status,avatar);actions.insertBefore(period,avatar);}
const originalPeriod=document.getElementById('periodSelect'),visiblePeriod=document.getElementById('overviewPeriodSelect');
if(originalPeriod&&visiblePeriod){const syncDisabled=()=>{visiblePeriod.disabled=originalPeriod.disabled;};syncDisabled();new MutationObserver(syncDisabled).observe(originalPeriod,{attributes:true,attributeFilter:['disabled']});}
for(const node of [...actions.childNodes])if(node.nodeType===3&&node.textContent.includes('⚙'))node.remove();
const logout=document.getElementById('logoutBtn');if(logout)actions.append(logout);
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="140" viewBox="0 0 1200 140"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#edf8ff"/><stop offset=".65" stop-color="#cce7f9"/><stop offset="1" stop-color="#8ac5e9"/></linearGradient></defs><path fill="url(#b)" d="M0 0h1200v140H0z"/><path d="M0 20Q330 210 810 40T1200 0M0 42Q350 215 850 62T1200 10M0 60Q360 225 950 70T1200 28" stroke="white" stroke-opacity=".6" fill="none"/><path d="M400 140Q830 160 1200 45v95" fill="#07568d" fill-opacity=".18"/><g fill="none" stroke="#1687c7" stroke-opacity=".23"><path d="m640 115 80-70 82 48 65-72 90 55 73-69 83 57 87-51M640 115l162-22 65-72 163-14-73 69 156-12M720 45l147-24 90 55 73-69M802 93l155-17 156-12-83-57"/></g><g fill="#1286c5"><circle cx="640" cy="115" r="3"/><circle cx="720" cy="45" r="3"/><circle cx="802" cy="93" r="4"/><circle cx="867" cy="21" r="3"/><circle cx="957" cy="76" r="4"/><circle cx="1030" cy="7" r="3"/><circle cx="1113" cy="64" r="4"/></g></svg>';
const style=document.createElement('style');style.id='compact-layout-style';style.textContent=`
#moduleDataStatus{display:none!important}
.module-chart-grid>.notice{grid-column:1/-1;font-size:16px!important;line-height:1.6;padding:16px 18px;background:#fff0f2!important;color:#942b40!important;border:1px solid #f4ced5;border-left:4px solid #d42b4c;border-radius:8px}
.app{grid-template-columns:220px minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important}
.side{grid-column:1;grid-row:1/3;padding-top:38px;min-height:0}.content{grid-column:2;grid-row:2}.top{grid-column:2;grid-row:1;min-width:0;min-height:48px;padding:4px 14px!important;gap:16px!important;flex-wrap:wrap}
.top .app-wordmark{width:206px;flex-shrink:0;font-size:16px!important;letter-spacing:-.4px}
.top .global-search{min-width:100px;max-width:300px;flex:1;margin:0 auto!important}
.top-actions{margin-left:auto;gap:12px!important;flex-wrap:wrap;min-width:0}
#sessionUser,#periodSelect{display:none!important}
#personnelBell{font-size:0;cursor:pointer}#personnelBell:before{content:'🔔 Bildirimler';font-size:11px}
.top-actions>.overview-status{display:flex!important;flex-wrap:nowrap;gap:12px!important;margin:0!important;padding:0!important;min-height:0!important;background:none!important;border:0!important;box-shadow:none!important;border-radius:0}
.top-actions .overview-status .status-item{min-width:0!important;padding:0 12px 0 0!important;border-left:0!important;border-right:1px solid #e4eaf1;white-space:nowrap}
.top-actions .overview-status small{font-size:9px}.top-actions .overview-status b{font-size:11px}
.top-actions #overviewRefresh{height:28px;white-space:nowrap;font-size:10px;padding:0 6px;border-radius:5px}
.top-actions .top-period{display:flex;align-items:center;gap:8px;flex:none;font-size:10px;white-space:nowrap}
.top-period select{min-width:135px;max-width:170px;height:32px!important;padding:0 8px!important}
.top-actions .avatar{flex-shrink:0}.top-actions>.avatar+span{display:block!important;white-space:nowrap;font-size:11px}
#logoutBtn{order:100;flex-shrink:0;margin-left:2px}
.side .sidebar-identity{display:block!important;margin:4px 0 22px!important;padding:6px 10px 18px;border-bottom:1px solid #ffffff20;text-align:center;font-size:12px;line-height:1.6;color:#dbe9f8}
.side .sidebar-identity>img{display:block;width:142px;height:142px;object-fit:contain;margin:0 auto 12px}
.side .sidebar-identity>div{max-width:180px;margin:auto}.sidebar-identity small{display:none}
.content{min-width:0}.page{padding-top:0!important}
.content .page .compact-page-banner,#overview .compact-page-banner{height:64px!important;min-height:64px!important;max-height:64px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;position:relative;overflow:hidden;margin:0 0 12px!important;padding:0 136px 0 22px!important;border:0!important;border-radius:8px!important;box-shadow:none!important;background:var(--compact-banner) center/cover no-repeat!important}
.content .compact-page-banner h2,#overview .compact-page-banner h2{display:block!important;visibility:visible!important;color:#153b5b!important;font-size:24px!important;font-weight:750;line-height:1.15!important;margin:0!important;text-shadow:none!important;letter-spacing:-.4px}
.compact-page-banner p,.compact-page-banner .overview-brand-logo,.compact-page-banner .banner-photo-credit,.compact-page-banner .overview-banner-flag,.compact-page-banner .personnel-eyebrow,.compact-page-banner .personnel-unit-icon{display:none!important}
.compact-page-banner .compact-flag{display:block;position:absolute;right:0;top:0;height:64px;width:112px;background:#d30932;clip-path:polygon(14% 0,100% 0,100% 100%,0 100%);padding:10px 14px 10px 24px;box-sizing:border-box}
.compact-flag svg{width:100%;height:100%;display:block}
.page-header-tools{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin:0 0 10px}.page-header-tools .student-header-actions{flex-wrap:wrap}
@media(max-width:1550px){.top .global-search{max-width:180px}.top-actions{gap:8px!important}.top-actions>.overview-status{gap:8px!important}.top-actions .overview-status .status-item{padding-right:8px!important}.top-period>b{display:none}}
@media(max-width:1250px){.top{display:grid!important;grid-template-columns:minmax(0,1fr)!important}.top .global-search{grid-column:1;width:100%;max-width:350px;justify-self:end}.top-actions{grid-column:1/-1;width:100%;justify-content:flex-end}.top-period>b{display:block}.top-actions .overview-status{margin-right:auto!important}}
@media(max-width:800px){.app{grid-template-columns:170px minmax(0,1fr)!important}.side .sidebar-identity>img{width:114px;height:114px}.side .sidebar-identity{padding:4px 4px 14px;font-size:11px}.top-actions{gap:8px!important}.top-actions>.overview-status{width:100%;justify-content:space-between}.top-actions .overview-status small{font-size:8px}.top-actions .overview-status b{font-size:10px}.top-actions .overview-status .status-item{white-space:normal}.top-actions>.avatar+span{font-size:10px}.content .page .compact-page-banner,#overview .compact-page-banner{padding-left:14px!important;padding-right:90px!important}.content .compact-page-banner h2,#overview .compact-page-banner h2{font-size:20px!important}.compact-page-banner .compact-flag{width:80px;padding-left:15px;padding-right:6px}}
@media(max-width:480px){.app{grid-template-columns:132px minmax(0,1fr)!important}.side .sidebar-identity>img{width:96px;height:96px}.side .sidebar-identity{font-size:10px;padding:0 2px 12px}.side .nav{font-size:10px;padding:9px 5px}.top{grid-template-columns:minmax(0,1fr)!important}.top .app-wordmark{width:auto}.top .global-search{grid-column:1;display:block!important;max-width:none;height:30px}.top-actions{grid-column:1;justify-content:flex-end}.top-actions>.overview-status{flex-wrap:wrap!important;gap:8px!important}.top-actions .overview-status .status-item{flex:1;min-width:75px!important}.top-actions #overviewRefresh{margin-left:auto}.top-period>b{display:none}.top-period select{min-width:120px}.content .compact-page-banner h2,#overview .compact-page-banner h2{font-size:17px!important}.content .page .compact-page-banner,#overview .compact-page-banner{padding-right:64px!important}.compact-page-banner .compact-flag{width:58px;padding:14px 4px 14px 10px}}
.top .top-actions .overview-status .status-item{display:flex;align-items:center;gap:5px;white-space:nowrap}
.top .top-actions .overview-status .status-item small{display:inline;margin:0;font-size:10px;line-height:1.2}
.top .top-actions .overview-status .status-item b{font-size:11px;line-height:1.2}
.top-actions>.avatar+span br{display:none}.top-actions>.avatar+span small{margin-left:5px;font-size:10px}

.top-actions>.avatar{order:90}.top-actions>.avatar+span{order:89;font-size:13px!important}.top-actions>.avatar+span small{font-size:12px!important;margin-left:6px}
.top-actions .top-period{background:#fff0f2;border:1px solid #f2d2d9;border-radius:6px;padding:3px 7px}.top-period select{background:#fff8f9!important;border-color:#ebc5ce!important;font-weight:700!important}.top-period select option{font-weight:700}
.top .top-actions #logoutBtn{background:#c51136!important;color:#fff!important;border:1px solid #a90d2d!important;font-size:12px!important;font-weight:700;padding:5px 12px!important;box-shadow:0 2px 5px #a90d2d22}.top .top-actions #logoutBtn:hover{background:#a90d2d!important}.top .top-actions #logoutBtn:focus-visible{outline:2px solid #a90d2d;outline-offset:3px}
.page-header-tools.module-toolbar{justify-content:space-between;align-items:center;gap:12px}.module-toolbar>.mini-tabs{margin:0;flex-shrink:0}.module-toolbar>.student-header-actions{margin-left:auto}
`;
document.head.append(style);document.documentElement.style.setProperty('--compact-banner','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');
function decorate(){document.querySelectorAll('.content .page .page-head,.content .personnel-hero').forEach(head=>{
if(head.classList.contains('compact-page-banner')||!head.querySelector('h2'))return;
head.classList.add('compact-page-banner');
const tools=[...head.children].filter(el=>el.matches('.actions,.student-header-actions'));
if(tools.length){const row=document.createElement('div');row.className='page-header-tools';tools.forEach(el=>row.append(el));head.after(row);if(head.closest("#institutionsSystem,#students")){const tabs=head.parentElement.querySelector(".mini-tabs");if(tabs){row.prepend(tabs);row.classList.add("module-toolbar");}}}
if(head.closest('#overview'))head.querySelectorAll('.overview-brand-logo,.overview-banner-flag,.banner-photo-credit').forEach(el=>el.remove());
const flag=document.createElement('div');flag.className='compact-flag';flag.setAttribute('role','img');flag.setAttribute('aria-label','Türk bayrağı');flag.innerHTML='<svg viewBox="0 0 120 80" aria-hidden="true"><circle cx="45" cy="40" r="27" fill="white"/><circle cx="53" cy="40" r="22" fill="#d30932"/><path d="m78 23 4 12 13 .1-10 8 4 12-11-8-10 8 4-12-10-8 13-.1z" fill="white"/></svg>';head.append(flag);
});}
decorate();new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.page,.page-head,.personnel-hero')||n.querySelector?.('.page-head,.personnel-hero')))))decorate();}).observe(document.querySelector('.content'),{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
