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
