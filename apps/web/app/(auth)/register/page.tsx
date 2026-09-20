'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import type { AuthTokens, UserProfile } from '@campusflow/shared-types';
import { ErrorBox } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nim: '',
    nama: '',
    email: '',
    password: '',
    prodi: '',
    semester: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<AuthTokens & { user: UserProfile }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            nim: form.nim,
            nama: form.nama,
            email: form.email,
            password: form.password,
            prodi: form.prodi || undefined,
            semester: form.semester ? Number(form.semester) : undefined,
          }),
        },
      );
      saveAuth(res);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-1 text-xl font-bold text-gray-900">Daftar Akun</h2>
      <p className="mb-5 text-sm text-gray-500">
        Mulai kelola jadwal dan tugas kuliahmu.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              NIM
            </label>
            <input
              required
              value={form.nim}
              onChange={(e) => update('nim', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="60225000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Semester
            </label>
            <input
              type="number"
              min={1}
              max={14}
              value={form.semester}
              onChange={(e) => update('semester', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="3"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nama Lengkap
          </label>
          <input
            required
            value={form.nama}
            onChange={(e) => update('nama', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Nama Mahasiswa"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="nama@email.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Program Studi
          </label>
          <input
            value={form.prodi}
            onChange={(e) => update('prodi', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Teknik Informatika"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Minimal 6 karakter"
          />
        </div>

        <ErrorBox message={error} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-semibold text-indigo-600">
          Masuk
        </Link>
      </p>
    </>
  );
}