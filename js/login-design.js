(() => {
'use strict';
const input=document.getElementById('loginPass');
if(!input)return;
const userLabel=document.querySelector('.loginbox>label');if(userLabel){userLabel.htmlFor='loginUserSelect';userLabel.textContent='♟  Kullanıcı / Birim';}
const passwordLabel=document.querySelector('.login-password-label');if(passwordLabel)passwordLabel.textContent='▣  Şifre';
const wrap=document.createElement('div');wrap.className='login-password-wrap';input.before(wrap);wrap.append(input);
const toggle=document.createElement('button');toggle.type='button';toggle.className='login-password-toggle';toggle.setAttribute('aria-label','Şifreyi göster');toggle.setAttribute('aria-pressed','false');toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
toggle.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.setAttribute('aria-pressed',String(visible));toggle.setAttribute('aria-label',visible?'Şifreyi gizle':'Şifreyi göster');};wrap.append(toggle);
})();
(() => {
'use strict';const $=id=>document.getElementById(id),user=$('loginUser'),select=$('loginUserSelect'),remember=$('rememberUsername');if(!user||!select||!remember)return;
function update(){const value=user.value.trim().toLocaleLowerCase('tr');const profile=window.USERS?.find(p=>p.username===value);select.value=profile?.username||'';$('selectedUnit').style.display=profile?'block':'none';$('selectedUnit').textContent=profile?`Birim: ${profile.unit} · Rol: ${profile.role}`:'';let saved;try{saved=JSON.parse(localStorage.getItem('brifing_remembered_login')||'null')}catch{}const ready=remember.checked&&saved?.username===value&&!!saved.refreshToken;$('loginPass').placeholder=ready?'Hatırlanan oturum hazır — Giriş Yap ile devam edin':'Şifreniz';$('loginPass').setAttribute('aria-description',ready?'Bu cihazda hatırlanan oturumla devam edebilirsiniz.':'Şifrenizi giriniz.');}
user.addEventListener('input',()=>{$('loginPass').value='';update();});select.addEventListener('change',()=>{$('loginPass').value='';setTimeout(update,0);});remember.addEventListener('change',()=>{if(!remember.checked){try{localStorage.removeItem('brifing_remembered_login');localStorage.removeItem('brifing_remember_username');}catch{}}update();});
const loadUsers=window.loadUsers;window.loadUsers=async function(...args){await loadUsers(...args);try{const name=localStorage.getItem('brifing_remember_username');if(name){user.value=name;remember.checked=true;}}catch{}update();};
user.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('loginBtn').click();}});$('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('loginBtn').click();}});update();
})();
