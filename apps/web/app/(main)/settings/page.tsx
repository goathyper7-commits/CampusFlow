'use client';

import { useCallback, useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import type { TelegramLinkResponse, TelegramStatus } from '@campusflow/shared-types';
import { Card, ErrorBox, Loading } from '@/components/ui';

export default function SettingsPage() {
  const user = getStoredUser();
  const { data: status, loading, error, reload } = useApi<TelegramStatus>(() =>
    apiFetch('/channels/telegram/status'),
  );
  const [link, setLink] = useState<TelegramLinkResponse | null>(null);
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const buatTautan = useCallback(async () => {
    setBusy(true);
    setFormError('');
    try {
      const res = await apiFetch<TelegramLinkResponse>('/channels/telegram/link', {
        method: 'POST',
      });
      setLink(res);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal membuat tautan');
    } finally {
      setBusy(false);
    }
  }, []);

  const putuskan = useCallback(async () => {
    if (!window.confirm('Putuskan koneksi Telegram?')) return;
    setBusy(true);
    setFormError('');
    try {
      await apiFetch('/channels/telegram', { method: 'DELETE' });
      setLink(null);
      setInfo('Telegram diputus.');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memutus tautan');
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500">
          Kelola akun dan kanal notifikasi Anda.
        </p>
      </div>

      <Card title="Akun">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">NIM</dt>
            <dd className="font-medium text-gray-800">{user?.nim ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Nama</dt>
            <dd className="font-medium text-gray-800">{user?.nama ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="font-medium text-gray-800">{user?.email ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Program Studi</dt>
            <dd className="font-medium text-gray-800">{user?.prodi ?? '-'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Kanal Telegram">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span
                className={
                  status?.terhubung
                    ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                    : 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600'
                }
              >
                {status?.terhubung ? 'Terhubung' : 'Belum terhubung'}
              </span>
              {status?.username && (
                <span className="text-xs text-gray-500">@{status.username}</span>
              )}
            </div>

            {status?.terhubung ? (
              <button
                onClick={putuskan}
                disabled={busy}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                Putuskan Telegram
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={buatTautan}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? 'Membuat tautan...' : 'Hubungkan Telegram'}
                </button>
                {link && (
                  <div className="space-y-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-indigo-600 hover:underline"
                    >
                      Buka bot di Telegram
                    </a>
                    <p className="text-xs text-gray-500">
                      Tekan Start, lalu pilih Bagikan kontak milik sendiri. Tautan
                      berlaku sampai {new Date(link.expiresAt).toLocaleString('id-ID')}.
                    </p>
                  </div>
                )}
              </div>
            )}
            {formError && <ErrorBox message={formError} />}
            {info && <p className="text-xs text-emerald-600">{info}</p>}
          </div>
        )}
      </Card>

      <Card title="Perintah Bot">
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
          <li>
            <code className="rounded bg-gray-100 px-1">/hariini</code> — jadwal,
            tugas, dan aktivitas hari ini
          </li>
          <li>
            <code className="rounded bg-gray-100 px-1">/tugas</code> — lima tugas
            aktif terdekat
          </li>
          <li>
            <code className="rounded bg-gray-100 px-1">/stop</code> — matikan
            pesan bot
          </li>
          <li>
            <code className="rounded bg-gray-100 px-1">/mulai</code> — aktifkan
            kembali pesan bot
          </li>
        </ul>
      </Card>
    </div>
  );
}
