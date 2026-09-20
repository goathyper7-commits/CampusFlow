'use client';

import { useEffect, useState } from 'react';

const DB_NAME = 'campusflow-cache';
const STORE = 'api-snapshots';
const OUTBOX_STORE = 'outbox';
const DB_VERSION = 2;

export interface OutboxItem {
  id: string;
  method: string;
  path: string;
  body?: string;
  apiBase: string;
  accessToken?: string | null;
  createdAt: number;
  tries: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB tidak didukung'));
  }
  if (!dbPromise) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
      if (!request.result.objectStoreNames.contains(OUTBOX_STORE)) {
        request.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      }
    };
    dbPromise = new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Penyimpanan lokal gagal — abaikan, bukan kondisi kritis.
  }
}

export async function dbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function dbEnqueue(item: OutboxItem): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, 'readwrite');
      tx.objectStore(OUTBOX_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Antrean offline gagal ditulis — abaikan.
  }
}

export async function dbDrain(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  try {
    const db = await openDb();
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    const items = (await new Promise<OutboxItem[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })) as OutboxItem[];
    let sent = 0;
    for (const item of items) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (item.accessToken) {
          headers.Authorization = `Bearer ${item.accessToken}`;
        }
        const res = await fetch(item.apiBase + item.path, {
          method: item.method,
          headers,
          body: item.body,
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          store.delete(item.id);
          sent += 1;
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
    return sent;
  } catch {
    return 0;
  }
}

export function requestOutboxSync() {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (!reg) return;
      const syncReg = reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      if (!syncReg.sync) return;
      return syncReg.sync.register('campusflow-outbox').catch(() => {});
    })
    .catch(() => {});
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}