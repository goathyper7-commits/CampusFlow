'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch, API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import type { Attachment } from '@campusflow/shared-types';
import { EmptyState, ErrorBox, Loading } from '@/components/ui';

interface Props {
  taskId: string;
}

const MAX_SIZE = 5 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ taskId }: Props) {
  const { data: items, loading, error, reload } = useApi<Attachment[]>(() =>
    apiFetch(`/tasks/${taskId}/attachments`),
  );
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setFormError('Ukuran file maksimal 5 MB.');
      return;
    }
    setUploading(true);
    setFormError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: form,
        credentials: 'include',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (body && (body.message as string)) || 'Gagal mengunggah file',
        );
      }
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal mengunggah file',
      );
    } finally {
      setUploading(false);
    }
  }

  async function download(id: string, fileName: string) {
    const res = await fetch(`${API_URL}/attachments/${id}/file`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      credentials: 'include',
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus lampiran ini?')) return;
    await apiFetch(`/attachments/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !items || items.length === 0 ? (
        <EmptyState text="Belum ada lampiran." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 py-2"
            >
              <button
                onClick={() => download(a.id, a.fileName)}
                className="min-w-0 truncate text-left text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
                title="Unduh file"
              >
                {a.fileName}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {formatSize(a.fileSize)}
                </span>
              </button>
              <button
                onClick={() => remove(a.id)}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-red-500 transition hover:bg-red-50"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          onChange={pick}
          className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 file:hover:bg-indigo-100"
        />
        {uploading && <span className="text-xs text-gray-400">Mengunggah...</span>}
      </div>
      {formError && <ErrorBox message={formError} />}
    </div>
  );
}