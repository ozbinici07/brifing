(() => {
'use strict';
const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = 'manifest.webmanifest'; document.head.append(manifest);
const theme = document.createElement('meta'); theme.name = 'theme-color'; theme.content = '#bd1235'; document.head.append(theme);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).catch(error => console.error('PWA:', error)));
let installPrompt;
const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = 'Uygulamayı yükle'; button.style.display = 'none';
(document.querySelector('.loginbox') || document.body).append(button);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; button.style.display = 'block'; });
button.addEventListener('click', async () => { if (!installPrompt) return; const prompt = installPrompt; installPrompt = null; button.style.display = 'none'; await prompt.prompt(); await prompt.userChoice; });
window.addEventListener('appinstalled', () => { installPrompt = null; button.style.display = 'none'; });
})();
