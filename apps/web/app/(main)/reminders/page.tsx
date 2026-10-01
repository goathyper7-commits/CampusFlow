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

const OFFSET_OPTIONS_MINUTES = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

function formatOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} menit`;
  if (minutes % 60 === 0) return `${minutes / 60} jam`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABEL: Record<Reminder['status'], string> = {
  SCHEDULED: 'Terjadwal',
  SENT: 'Terkirim',
  SNOOZED: 'Ditunda',
  CANCELLED: 'Dibatalkan',
  FAILED: 'Gagal',
};

export default function RemindersPage() {
  const {
    data: reminders,
    loading,
    error,
    reload,
  } = useApi<Reminder[]>(() => apiFetch('/reminders'));
  const { data: tasks } = useApi<Task[]>(() => apiFetch('/tasks'));

  const [taskId, setTaskId] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(60);
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
        body: JSON.stringify({ taskId, offsetMinutes }),
      });
      setTaskId('');
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menambah pengingat',
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeOffset(id: string, value: number) {
    await apiFetch(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ offsetMinutes: value }),
    });
    reload();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus pengingat ini?')) return;
    await apiFetch(`/reminders/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengingat</h1>
        <p className="text-sm text-gray-500">
          Atur pengingat tugas dan aktivitas. Notifikasi dikirim ke Telegram,
          dengan cadangan ke aplikasi dan push.
        </p>
      </div>

      <Card title="Tambah Pengingat Tugas">
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
            value={offsetMinutes}
            onChange={(e) => setOffsetMinutes(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {OFFSET_OPTIONS_MINUTES.map((m) => (
              <option key={m} value={m}>
                {formatOffset(m)} sebelumnya
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
          Pengingat aktivitas diatur dari halaman Aktivitas. Worker memproses
          antrean setiap menit, jadi job yang terlewat tetap terkirim.
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
                      {r.judul || r.task?.judul || r.event?.judul}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {r.sumber === 'TUGAS' ? 'Tugas' : 'Aktivitas'}
                    </span>
                    {r.task?.status && <StatusBadge status={r.task.status} />}
                    <span
                      className={
                        r.status === 'SENT'
                          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                          : r.status === 'FAILED'
                            ? 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700'
                            : r.status === 'CANCELLED'
                              ? 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600'
                              : 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700'
                      }
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {r.task?.deadline ? `Deadline ${formatDateTime(r.task.deadline)}` : ''}
                    {r.event?.waktuMulai
                      ? `Mulai ${formatDateTime(r.event.waktuMulai)}`
                      : ''}
                    {r.event?.lokasi ? ` · ${r.event.lokasi}` : ''}
                    {' · Mengingatkan '}
                    {formatDateTime(r.scheduledAt)}
                    {r.sentAt ? ` · Dikirim ${formatDateTime(r.sentAt)}` : ''}
                    {r.snoozeCount > 0 ? ` · Ditunda ${r.snoozeCount}x` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={r.offsetMinutes}
                    onChange={(e) => changeOffset(r.id, Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    {OFFSET_OPTIONS_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {formatOffset(m)}
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
