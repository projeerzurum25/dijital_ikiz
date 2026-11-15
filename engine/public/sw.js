self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ağ isteklerini doğrudan yerel sunucuya geçir (offline-first yerel motor)
  if (event.request.method !== 'GET') return;
});
