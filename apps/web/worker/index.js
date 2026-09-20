const OUTBOX_DB = 'campusflow-cache';
const OUTBOX_STORE = 'outbox';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification('CampusFlow', {
      body: payload.pesan || 'Pengingat tugas baru.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          client.focus();
          client.navigate(url).catch(() => {});
          return;
        }
        return clients.openWindow(url);
      }),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'campusflow-outbox') {
    event.waitUntil(drainOutbox());
  }
});

function openOutboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OUTBOX_STORE)) {
        req.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function drainOutbox() {
  const db = await openOutboxDb();
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const store = tx.objectStore(OUTBOX_STORE);
  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const item of all) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (item.accessToken) {
        headers.Authorization = 'Bearer ' + item.accessToken;
      }
      const res = await fetch(item.apiBase + item.path, {
        method: item.method,
        headers,
        body: item.body,
        credentials: 'include',
      });
      if (res.ok) {
        store.delete(item.id);
      } else {
        item.tries = (item.tries || 0) + 1;
        if (item.tries >= 5) {
          store.delete(item.id);
        } else {
          store.put(item);
        }
      }
    } catch {
      break;
    }
  }
}