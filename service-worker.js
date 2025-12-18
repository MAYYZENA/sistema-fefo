const CACHE_NAME = 'fefo-pro-v3';
const RUNTIME_CACHE = 'fefo-runtime-v3';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './vendor/bootstrap.min.css',
  './vendor/qrcode.min.js',
  './fontawesome-fix.css'
];

// Instalação: cachear assets essenciais
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto, adicionando assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] Assets cacheados com sucesso!');
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Erro ao cachear:', err))
  );
});

// Ativação: limpar caches antigos
self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker...');
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map(key => {
              console.log('[SW] Deletando cache antigo:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker ativado!');
        return self.clients.claim();
      })
  );
});

// Fetch: estratégia Network First, fallback para Cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições de outros domínios (Firebase, CDN, etc)
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Estratégia: Network First com Cache Fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Se a resposta for OK, clonar e salvar no runtime cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), buscar no cache
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Servindo do cache:', request.url);
            return cachedResponse;
          }
          
          // Fallback para index.html em requisições de navegação
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          
          // Retornar resposta offline genérica
          return new Response('Offline - Sem cache disponível', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Background Sync: sincronizar dados quando voltar online
self.addEventListener('sync', event => {
  console.log('[SW] Evento de sync:', event.tag);
  
  if (event.tag === 'sync-estoque') {
    event.waitUntil(
      // Aqui você pode implementar lógica de sincronização
      Promise.resolve()
        .then(() => {
          console.log('[SW] Sincronização de estoque concluída');
          return self.registration.showNotification('FEFO Pro', {
            body: 'Dados sincronizados com sucesso!',
            icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Crect width=\'512\' height=\'512\' rx=\'105\' fill=\'%231a73e8\'/%3E%3Crect x=\'128\' y=\'180\' width=\'256\' height=\'210\' rx=\'25\' fill=\'white\'/%3E%3C/svg%3E',
            badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 96 96\'%3E%3Ccircle cx=\'48\' cy=\'48\' r=\'48\' fill=\'%231e8e3e\'/%3E%3C/svg%3E'
          });
        })
    );
  }
});

// Push Notifications
self.addEventListener('push', event => {
  console.log('[SW] Push recebido:', event);
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FEFO Pro';
  const options = {
    body: data.body || 'Nova notificação',
    icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 512 512\'%3E%3Crect width=\'512\' height=\'512\' rx=\'105\' fill=\'%231a73e8\'/%3E%3Crect x=\'128\' y=\'180\' width=\'256\' height=\'210\' rx=\'25\' fill=\'white\'/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 96 96\'%3E%3Ccircle cx=\'48\' cy=\'48\' r=\'48\' fill=\'%23f9ab00\'/%3E%3C/svg%3E',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notificação clicada:', event.action);
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker carregado!');
  );
});
