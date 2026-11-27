// Damamondo – funzionamento senza internet. File creato da tools/build-pages.js: non modificarlo a mano.
const CACHE = 'damamondo-fae979b7e9f3';
const FILES = ["./","index.html","regole.html","manifest.webmanifest","css/style.css","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/favicon-32.png","js/bot.js","js/buildings.js","js/combat.js","js/data.js","js/decor.js","js/economy.js","js/fx.js","js/game.js","js/main.js","js/map.js","js/menu.js","js/music.js","js/prefs.js","js/render.js","js/rules.js","js/save.js","js/secret-data.js","js/secret.js","js/settings.js","js/sfx.js","js/territory.js","js/transport.js","js/troops.js","js/turn.js","js/ui.js"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('damamondo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
