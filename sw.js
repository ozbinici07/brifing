self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Keep Firebase requests and application content on the network; no private data cache.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Brifing Bilgi Sistemi</title><body style="font:18px system-ui;padding:40px"><h1>İnternet bağlantısı gerekli</h1><p>Bağlantınızı kontrol edip uygulamayı yeniden açınız.</p><button onclick="location.reload()">Yeniden dene</button></body></html>', {headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
