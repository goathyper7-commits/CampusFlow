'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Course } from '@campusflow/shared-types';
import { Card, EmptyState, ErrorBox, Loading } from '@/components/ui';

const emptyForm = { kode: '', namaMatkul: '', sks: '3', dosen: '' };

export default function CoursesPage() {
  const { data, loading, error, reload } = useApi<Course[]>(() =>
    apiFetch('/courses'),
  );
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/courses', {
        method: 'POST',
        body: JSON.stringify({
          kode: form.kode,
          namaMatkul: form.namaMatkul,
          sks: Number(form.sks),
          dosen: form.dosen || undefined,
        }),
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus mata kuliah ini?')) return;
    try {
      await apiFetch(`/courses/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mata Kuliah</h1>
        <p className="text-sm text-gray-500">
          Kelola daftar mata kuliah yang Anda ambil semester ini.
        </p>
      </div>

      <Card title="Tambah Mata Kuliah">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-5">
          <input
            required
            value={form.kode}
            onChange={(e) => setForm({ ...form, kode: e.target.value })}
            placeholder="Kode (contoh: IF101)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <input
            required
            value={form.namaMatkul}
            onChange={(e) => setForm({ ...form, namaMatkul: e.target.value })}
            placeholder="Nama Mata Kuliah"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:col-span-2"
          />
          <input
            type="number"
            min={1}
            max={6}
            value={form.sks}
            onChange={(e) => setForm({ ...form, sks: e.target.value })}
            placeholder="SKS"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
          <input
            value={form.dosen}
            onChange={(e) => setForm({ ...form, dosen: e.target.value })}
            placeholder="Dosen Pengampu (opsional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:col-span-5"
          />
          {formError && (
            <div className="sm:col-span-5">
              <ErrorBox message={formError} />
            </div>
          )}
        </form>
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState text="Belum ada mata kuliah. Tambahkan yang pertama di atas." />
        </Card>
      ) : (
        <Card title={`Daftar Mata Kuliah (${data.length})`}>
          <ul className="divide-y divide-gray-100">
            {data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800">
                    {c.namaMatkul}
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {c.kode}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.sks} SKS{c.dosen ? ` · ${c.dosen}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}