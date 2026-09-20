'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Notification, NotificationPreference } from '@campusflow/shared-types';
import { getExistingPush, subscribePush, type PushToken } from '@/lib/push';
import {
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  StatusBadge,
} from '@/components/ui';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const {
    data: notifications,
    loading,
    error,
    reload,
  } = useApi<Notification[]>(() =>
    apiFetch(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`),
  );

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    reload();
  }

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    reload();
  }

  async function clearAll() {
    if (!window.confirm('Hapus semua notifikasi?')) return;
    await apiFetch('/notifications', { method: 'DELETE' });
    reload();
  }

  const {
    data: preferences,
    loading: prefLoading,
    error: prefError,
    reload: reloadPrefs,
  } = useApi<NotificationPreference>(() =>
    apiFetch('/notifications/preferences'),
  );
  const [pushToken, setPushToken] = useState<PushToken | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefBusy, setPrefBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getExistingPush().then((token) => {
      if (alive) setPushToken(token);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function togglePreference(
    key: 'autoRemindersEnabled' | 'pushEnabled',
  ) {
    if (!preferences) return;
    setPrefBusy(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: !preferences[key] }),
      });
      reloadPrefs();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Gagal memperbarui');
    } finally {
      setPrefBusy(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    try {
      const token = await subscribePush();
      if (!token) {
        window.alert(
          'Push notification tidak didukung browser ini / VAPID belum dikonfigurasi.',
        );
        return;
      }
      await apiFetch('/notifications/subscriptions', {
        method: 'POST',
        body: JSON.stringify(token),
      });
      setPushToken(token);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Gagal mengaktifkan push',
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      if (pushToken) {
        await apiFetch('/notifications/subscriptions', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: pushToken.endpoint }),
        });
      }
      const { unsubscribePush } = await import('@/lib/push');
      await unsubscribePush();
      setPushToken(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Gagal menonaktifkan');
    } finally {
      setPushBusy(false);
    }
  }

  const pushEnabled = pushToken !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifikasi</h1>
          <p className="text-sm text-gray-500">
            Peringatan otomatis dari pengingat tugas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              unreadOnly
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
            }`}
          >
            Belum dibaca saja
          </button>
          <button
            onClick={markAllRead}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
          >
            Tandai semua dibaca
          </button>
          <button
            onClick={clearAll}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-red-600 ring-1 ring-gray-200 transition hover:bg-red-50"
          >
            Hapus semua
          </button>
        </div>
      </div>

      <Card title="Preferensi & Push Notification">
        {prefError ? (
          <ErrorBox message={prefError} />
        ) : prefLoading ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">
                Pengingat otomatis
                <span className="block text-xs text-gray-400">
                  Kirim notifikasi sebelum deadline tugas
                </span>
              </span>
              <button
                onClick={() => togglePreference('autoRemindersEnabled')}
                disabled={prefBusy}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                  preferences?.autoRemindersEnabled
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {preferences?.autoRemindersEnabled ? 'Aktif' : 'Nonaktif'}
              </button>
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">
                Notifikasi browser (push)
                <span className="block text-xs text-gray-400">
                  Terima notifikasi walau aplikasi tertutup {pushEnabled ? '(aktif)' : ''}
                </span>
              </span>
              <button
                onClick={pushEnabled ? disablePush : enablePush}
                disabled={pushBusy}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                  pushEnabled
                    ? 'bg-gray-200 text-gray-600'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {pushBusy
                  ? 'Memproses...'
                  : pushEnabled
                    ? 'Nonaktifkan'
                    : 'Aktifkan'}
              </button>
            </label>
          </div>
        )}
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !notifications || notifications.length === 0 ? (
        <Card>
          <EmptyState text="Tidak ada notifikasi." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={n.isRead ? '' : 'border-indigo-200 bg-indigo-50/40'}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {n.tipe === 'REMINDER' ? 'Pengingat' : n.tipe}
                    </span>
                    {!n.isRead && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        Baru
                      </span>
                    )}
                    {n.reminder?.task?.status && (
                      <StatusBadge status={n.reminder.task.status} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{n.pesan}</p>
                  <div className="mt-1 text-xs text-gray-400">
                    {formatTime(n.createdAt)}
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}