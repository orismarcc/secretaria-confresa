// Service Worker — Secretaria de Agricultura
// - Notificações push (inalterado)
// - Cache offline do app (shell + assets) para funcionar sem internet no campo.
//   Estratégia segura: navegação = network-first (online sempre pega a versão
//   nova); assets do mesmo domínio = stale-while-revalidate; requisições ao
//   Supabase/externas = NÃO tocadas (vão direto à rede; offline é tratado pela
//   fila local + persistência do app).

const CACHE_NAME = 'sec-agri-v2';
const APP_SHELL = '/index.html';

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', APP_SHELL]).catch(() => {}))
  );
  self.skipWaiting();
});

// ─── Activate (limpa caches antigos) ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch (cache offline) ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET e só o mesmo domínio (não mexe no Supabase/APIs/externos).
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // Navegação (abrir o app / rotas): network-first, cai pro shell em cache offline.
  const isNavigation = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(APP_SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(APP_SHELL).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Demais recursos do app (js/css/img/fontes): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'Secretaria de Agricultura',
    body: 'Você tem atendimentos pendentes para hoje.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'daily-reminder',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: false,
      data: { url: data.url || '/' },
    })
  );
});

// ─── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
