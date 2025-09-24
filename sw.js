// sw.js — wersja odporna na 404
const CACHE = 'pd-v2';
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './manifest.webmanifest',
  './assets/icon-192.png', // FIXME: odkomentuj, gdy plik będzie w repo
];


self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const reqs = ASSETS.map(u => c.add(u));
    await Promise.allSettled(reqs);
    self.skipWaiting();
  })());
});


self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});


self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try { return await fetch(e.request); }
    catch { return await caches.match('./index.html'); }
  })());
});