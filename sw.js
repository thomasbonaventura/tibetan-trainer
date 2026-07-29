const SHELL_CACHE = 'tibtrainer-shell-v6';
const DATA_CACHE = 'tibtrainer-data-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/main.js',
  './js/data.js',
  './js/storage.js',
  './js/filters.js',
  './js/queue.js',
  './js/session.js',
  './js/search.js',
  './js/entry-view.js',
  './js/lookup.js',
  './js/drills/discrimination.js',
  './js/drills/cloze.js',
  './js/drills/recall.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL_FILES.map((f) => cache.add(f).catch(() => {}))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('tibetan_trainer_data.json')) {
    // Network-first, so re-importing updated data is picked up whenever
    // online; falls back to the last cached copy when offline.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
