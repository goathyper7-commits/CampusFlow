'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Comment, UserProfile } from '@campusflow/shared-types';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';

interface Props {
  taskId: string;
}

export default function CommentThread({ taskId }: Props) {
  const {
    data: comments,
    loading,
    error,
    reload,
  } = useApi<Comment[]>(() => apiFetch(`/comments?taskId=${taskId}`));
  const { data: me } = useApi<UserProfile>(() => apiFetch('/users/me'));

  const [isi, setIsi] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isi.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ taskId, isi: isi.trim() }),
      });
      setIsi('');
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal mengirim komentar',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus komentar ini?')) return;
    await apiFetch(`/comments/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !comments || comments.length === 0 ? (
        <EmptyState text="Belum ada komentar. Mulai diskusi di bawah." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {comments.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {c.user?.nama ?? 'Pengguna'}
                  </span>
                  <span className="text-gray-400">
                    {new Date(c.createdAt).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {me && c.user && c.user.id === me.id && (
                  <button
                    onClick={() => remove(c.id)}
                    className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-red-500 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-700">{c.isi}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          placeholder="Tulis komentar..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !isi.trim()}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Mengirim...' : 'Kirim'}
        </button>
      </form>
      {formError && (
        <div className="pt-1">
          <ErrorBox message={formError} />
        </div>
      )}
    </div>
  );
}