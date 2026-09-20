'use client';

import { useOnline } from '@/lib/offline';

export function OfflineBanner() {
  const online = useOnline();

  if (online) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <span className="font-semibold">Mode offline</span>
      <span>
        — Anda sedang melihat data terakhir yang tersimpan. Beberapa aksi
        mungkin tidak dapat dijalankan sampai terhubung kembali.
      </span>
    </div>
  );
}