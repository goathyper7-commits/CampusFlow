'use client';

import { useEffect } from 'react';
import { dbDrain } from '@/lib/offline';

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // registrasi gagal (mis. dev/SSL) — diabaikan, PWA opsional.
    });
  }, []);

  useEffect(() => {
    const onOnline = () => {
      void dbDrain();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return null;
}