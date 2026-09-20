'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Course, Prioritas, Task, TaskStatus } from '@campusflow/shared-types';
import {
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  PrioritasBadge,
  StatusBadge,
} from '@/components/ui';
import CommentThread from '@/components/CommentThread';
import AttachmentList from '@/components/AttachmentList';

const STATUS_FILTERS: (TaskStatus | '')[] = [
  '',
  'BELUM_DIKERJAKAN',
  'DIKERJAKAN',
  'SELESAI',
  'TERLAMBAT',
];

const STATUS_LABEL: Record<string, string> = {
  '': 'Semua',
  BELUM_DIKERJAKAN: 'Belum',
  DIKERJAKAN: 'Dikerjakan',
  SELESAI: 'Selesai',
  TERLAMBAT: 'Terlambat',
};

const emptyForm = {
  judul: '',
  deskripsi: '',
  deadline: '',
  prioritas: 'SEDANG' as Prioritas,
  courseId: '',
};

export default function TasksPage() {
  const [filter, setFilter] = useState<TaskStatus | ''>('');
  const { data: tasks, loading, error, reload } = useApi<Task[]>(() =>
    apiFetch(`/tasks${filter ? `?status=${filter}` : ''}`),
  );
  const { data: courses } = useApi<Course[]>(() => apiFetch('/courses'));

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [subtaskMap, setSubtaskMap] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>(
    {},
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          judul: form.judul,
          deskripsi: form.deskripsi || undefined,
          deadline: new Date(form.deadline).toISOString(),
          prioritas: form.prioritas,
          courseId: form.courseId || undefined,
        }),
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan tugas');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: TaskStatus) {
    await apiFetch(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus tugas ini?')) return;
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    reload();
  }

  async function addSubtask(taskId: string) {
    const judul = (subtaskMap[taskId] ?? '').trim();
    if (!judul) return;
    await apiFetch(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ judul }),
    });
    setSubtaskMap((m) => ({ ...m, [taskId]: '' }));
    reload();
  }

  async function toggleSubtask(taskId: string, subtaskId: string) {
    await apiFetch(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
    });
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tugas</h1>
        <p className="text-sm text-gray-500">
          Kelola tugas kuliah dan pantau deadline-nya.
        </p>
      </div>

      <Card title="Tambah Tugas">
        <form onSubmit={create} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              required
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Judul tugas"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:col-span-2"
            />
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Tanpa mata kuliah</option>
              {(courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kode} — {c.namaMatkul}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Deskripsi (opsional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:col-span-3"
            />
            <select
              value={form.prioritas}
              onChange={(e) =>
                setForm({ ...form, prioritas: e.target.value as Prioritas })
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="RENDAH">Rendah</option>
              <option value="SEDANG">Sedang</option>
              <option value="TINGGI">Tinggi</option>
            </select>
          </div>
          {formError && <ErrorBox message={formError} />}
          <div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Tambah Tugas'}
            </button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !tasks || tasks.length === 0 ? (
        <Card>
          <EmptyState text="Tidak ada tugas." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{t.judul}</span>
                    <PrioritasBadge prioritas={t.prioritas} />
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {t.course?.namaMatkul ?? 'Tanpa mata kuliah'} · Deadline{' '}
                    {new Date(t.deadline).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  {t.deskripsi && (
                    <p className="mt-2 text-sm text-gray-600">{t.deskripsi}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      changeStatus(t.id, e.target.value as TaskStatus)
                    }
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    {(['BELUM_DIKERJAKAN', 'DIKERJAKAN', 'SELESAI'] as TaskStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    onClick={() => remove(t.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="mb-2 text-xs font-medium text-gray-500">
                  Subtasks {t.subtasks && t.subtasks.length > 0 ? `(${t.subtasks.filter((s) => s.isDone).length}/${t.subtasks.length})` : ''}
                </div>
                <ul className="mb-2 space-y-1">
                  {(t.subtasks ?? []).map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={s.isDone}
                        onChange={() => toggleSubtask(t.id, s.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      />
                      <span
                        className={
                          s.isDone
                            ? 'text-gray-400 line-through'
                            : 'text-gray-700'
                        }
                      >
                        {s.judul}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    value={subtaskMap[t.id] ?? ''}
                    onChange={(e) =>
                      setSubtaskMap((m) => ({
                        ...m,
                        [t.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask(t.id);
                      }
                    }}
                    placeholder="Tambah subtask..."
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={() => addSubtask(t.id)}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <span className="block text-xs font-medium text-gray-500">
                  Lampiran
                </span>
                <div className="mt-1">
                  <AttachmentList taskId={t.id} />
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <button
                  onClick={() =>
                    setOpenComments((m) => ({
                      ...m,
                      [t.id]: !m[t.id],
                    }))
                  }
                  className="text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
                >
                  {openComments[t.id] ? 'Tutup diskusi' : 'Diskusi'}
                </button>
                {openComments[t.id] && (
                  <div className="mt-3">
                    <CommentThread taskId={t.id} />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}