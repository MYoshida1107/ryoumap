// アプリ本体（画面とプログラム）を端末に保存し、圏外でも起動できるようにする。
// 地図タイルと禁止区域データはアプリ側が IndexedDB に保存するので、ここでは扱わない。
const VERSION = 'ryoumap-v1';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/layers.png', 'vendor/images/layers-2x.png',
  'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // 電波があれば新しい版を取りに行き、なければ保存済みを返す
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
