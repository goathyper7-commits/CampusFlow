'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Reminder, Task } from '@campusflow/shared-types';
import {
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  StatusBadge,
} from '@/components/ui';

const OFFSET_OPTIONS = [1, 2, 3, 6, 12, 24, 48, 72, 168];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RemindersPage() {
  const {
    data: reminders,
    loading,
    error,
    reload,
  } = useApi<Reminder[]>(() => apiFetch('/reminders'));
  const { data: tasks } = useApi<Task[]>(() => apiFetch('/tasks'));

  const [taskId, setTaskId] = useState('');
  const [offsetHours, setOffsetHours] = useState(24);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId) {
      setFormError('Pilih tugas yang ingin diingatkan.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/reminders', {
        method: 'POST',
        body: JSON.stringify({ taskId, offsetHours }),
      });
      setTaskId('');
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menambah reminder',
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeOffset(id: string, value: number) {
    await apiFetch(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ offsetHours: value }),
    });
    reload();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus reminder ini?')) return;
    await apiFetch(`/reminders/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengingat</h1>
        <p className="text-sm text-gray-500">
          Terima notifikasi beberapa jam sebelum deadline tugas.
        </p>
      </div>

      <Card title="Tambah Pengingat">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <select
            required
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Pilih tugas...</option>
            {(tasks ?? [])
              .filter((t) => t.status !== 'SELESAI')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.judul} — deadline{' '}
                  {new Date(t.deadline).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </option>
              ))}
          </select>
          <select
            value={offsetHours}
            onChange={(e) => setOffsetHours(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {OFFSET_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h} jam sebelumnya
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
        </form>
        {formError && (
          <div className="mt-3">
            <ErrorBox message={formError} />
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Pengingat aktif diproses oleh worker setiap menit; jika Redis mati,
          tugas tersimpan namun job terlewat sampai terkirim berikutnya.
        </p>
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !reminders || reminders.length === 0 ? (
        <Card>
          <EmptyState text="Belum ada pengingat. Tambahkan satu di atas." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {reminders.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {r.task?.judul}
                    </span>
                    {r.task?.status && <StatusBadge status={r.task.status} />}
                    {r.isSent ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Terkirim
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        Terjadwal
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Deadline{' '}
                    {r.task?.deadline
                      ? formatDateTime(r.task.deadline)
                      : '—'}{' '}
                    · Mengingatkan {formatDateTime(r.scheduledAt)}
                    {r.sentAt ? ` · Dikirim ${formatDateTime(r.sentAt)}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={r.offsetHours}
                    onChange={(e) => changeOffset(r.id, Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    {OFFSET_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h} jam
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}