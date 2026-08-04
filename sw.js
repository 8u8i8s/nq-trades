const CACHE = 'puli-life-v3';
const SHELL = ['./', './index.html', './styles.css?v=3', './app.js?v=3', './config.js?v=3', './vendor/supabase.min.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('.supabase.co')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net')) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
