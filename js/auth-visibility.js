/* Fail closed before the first paint, including uncached and failed asset loads. */
(function(){
 const app=document.querySelector('.app'),login=document.getElementById('login');
 if(!app||!login)return;
 const sync=()=>{const locked=login.classList.contains('show');app.inert=locked;app.style.setProperty('visibility',locked?'hidden':'visible','important');app.style.setProperty('opacity',locked?'0':'1','important');app.style.setProperty('pointer-events',locked?'none':'auto','important');};
 sync();new MutationObserver(sync).observe(login,{attributes:true,attributeFilter:['class']});
})();
