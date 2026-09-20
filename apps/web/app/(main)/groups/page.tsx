'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Task, TaskGroup } from '@campusflow/shared-types';
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from '@/components/ui';
import CommentThread from '@/components/CommentThread';

const inputCls =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

function convertStatus(t: Task): Task['status'] {
  if (t.status !== 'SELESAI' && new Date(t.deadline).getTime() < Date.now()) {
    return 'TERLAMBAT';
  }
  return t.status;
}

export default function GroupsPage() {
  const { data, loading, error, reload } = useApi<TaskGroup[]>(() =>
    apiFetch('/groups'),
  );
  const { data: tasks, reload: reloadTasks } = useApi<Task[]>(() =>
    apiFetch('/tasks'),
  );

  const [selected, setSelected] = useState<TaskGroup | null>(null);
  const [nimBaru, setNimBaru] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const ungroupedOwnedTasks = useMemo(() => {
    const groupedIds = new Set((data ?? []).map((g) => g.taskId));
    return (tasks ?? [])
      .filter((t) => !groupedIds.has(t.id))
      .filter((t) => convertStatus(t) !== 'SELESAI');
  }, [data, tasks]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const taskId = form.get('taskId');
    if (typeof taskId !== 'string' || !taskId) {
      setFormError('Pilih tugas untuk membuat grup.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const g = await apiFetch<TaskGroup>('/groups', {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      setSelected(g);
      reload();
      reloadTasks();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal membuat grup',
      );
    } finally {
      setSaving(false);
    }
  }

  async function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !nimBaru.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await apiFetch(`/groups/${selected.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ nim: nimBaru.trim() }),
      });
      setNimBaru('');
      const g = await apiFetch<TaskGroup>(`/groups/${selected.id}`);
      setSelected(g);
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menambah anggota',
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(groupId: string, memberId: string) {
    await apiFetch(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
    const g = await apiFetch<TaskGroup>(`/groups/${groupId}`);
    setSelected(g);
    reload();
  }

  async function leave(id: string) {
    if (!window.confirm('Keluar dari grup ini?')) return;
    await apiFetch(`/groups/${id}/leave`, { method: 'POST' });
    setSelected(null);
    reload();
  }

  async function dissolve(id: string) {
    if (!window.confirm('Bubarkan grup ini? Tugas tetap ada.')) return;
    await apiFetch(`/groups/${id}`, { method: 'DELETE' });
    setSelected(null);
    reload();
  }

  const selectedView = selected ?? data?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kolaborasi</h1>
        <p className="text-sm text-gray-500">
          Kerjakan tugas bersama teman sekelas dalam satu grup.
        </p>
      </div>

      <Card title="Buat Grup Baru">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-gray-500">
              Pilih tugas yang belum berkelompok
            </label>
            <select
              name="taskId"
              className={`mt-1 w-full ${inputCls}`}
              defaultValue=""
            >
              <option value="">— Pilih tugas —</option>
              {ungroupedOwnedTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.judul} ({t.course?.namaMatkul ?? 'Tanpa MK'})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Membuat...' : 'Buat'}
          </button>
        </form>
        {formError && (
          <div className="mt-3">
            <ErrorBox message={formError} />
          </div>
        )}
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState text="Belum ada grup. Buat grup untuk tugas yang dikerjakan bersama." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="space-y-3">
            {data.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className={`w-full rounded-lg border bg-white p-4 text-left transition ${
                  selectedView?.id === g.id
                    ? 'border-indigo-500 ring-2 ring-indigo-100'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-800">
                    {g.task.judul}
                  </span>
                  <StatusBadge status={convertStatus(g.task as Task)} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{g.members.length} anggota</span>
                  {g.isLeader && (
                    <span className="text-xs font-medium text-indigo-600">
                      Ketua
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedView && (
            <div className="space-y-4">
              {selectedView.isLeader && (
                <form onSubmit={addMember} className="flex gap-2">
                  <input
                    value={nimBaru}
                    onChange={(e) => setNimBaru(e.target.value)}
                    placeholder="NIM teman"
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Tambah
                  </button>
                </form>
              )}
              <button
                onClick={() =>
                  selectedView.isLeader
                    ? dissolve(selectedView.id)
                    : leave(selectedView.id)
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  selectedView.isLeader
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
              >
                {selectedView.isLeader ? 'Bubarkan' : 'Keluar'}
              </button>
              <Card title={selectedView.task.judul}>
                <ul className="divide-y divide-gray-100">
                  {selectedView.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                          {m.user?.nama}
                          {m.role === 'KETUA' && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                              Ketua
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {m.user?.nim}
                          {m.user?.prodi ? ` · ${m.user.prodi}` : ''}
                        </div>
                      </div>
                      {selectedView.isLeader && m.role === 'ANGGOTA' && (
                        <button
                          onClick={() =>
                            removeMember(selectedView.id, m.id)
                          }
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Keluarkan
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Diskusi">
                <CommentThread taskId={selectedView.taskId} />
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}