'use client';

import { useCallback, useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Card, EmptyState, ErrorBox, Loading } from '@/components/ui';

interface AdminSummary {
  users: number;
  courses: number;
  tasks: number;
  activities: number;
  groups: number;
  recentAudit: { id: string; aksi: string; detail: string; createdAt: string; admin: string }[];
}

interface AdminUserRow {
  id: string;
  nim: string;
  nama: string;
  email: string;
  prodi: string | null;
  semester: number | null;
  role: string;
  createdAt: string;
  taskCount: number;
  courseCount: number;
}

interface AuditRow {
  id: string;
  aksi: string;
  detail: string;
  createdAt: string;
  admin: { nama: string; email: string } | null;
}

interface PageResponse<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

const AKSI_LABEL: Record<string, string> = {
  UBAH_ROLE: 'Ubah role',
  HAPUS_USER: 'Hapus user',
};

export default function AdminPage() {
  const user = getStoredUser();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data: summary, loading: sumLoading, error: sumError, reload: reloadSum } =
    useApi<AdminSummary>(() => apiFetch('/admin/summary'));
  const { data: usersRes, loading: usersLoading, error: usersError, reload: reloadUsers } =
    useApi<PageResponse<AdminUserRow>>(() =>
      apiFetch(
        `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}&page=${page}&limit=20`,
      ),
    );
  const { data: auditRes, loading: auditLoading, error: auditError } = useApi<
    PageResponse<AuditRow>
  >(() => apiFetch(`/admin/audit?page=1&limit=20`));

  if (!user || user.role !== 'ADMIN') {
    return (
      <Card>
        <EmptyState text="Akses ditolak — halaman khusus admin." />
      </Card>
    );
  }

  async function toggleRole(row: AdminUserRow) {
    const next = row.role === 'ADMIN' ? 'MAHASISWA' : 'ADMIN';
    setBusyId(row.id);
    setActionError('');
    try {
      await apiFetch(`/admin/users/${row.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: next }),
      });
      await Promise.all([reloadUsers(), reloadSum()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengubah role');
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(row: AdminUserRow) {
    if (!window.confirm(`Hapus user ${row.nama}?`)) return;
    setBusyId(row.id);
    setActionError('');
    try {
      await apiFetch(`/admin/users/${row.id}`, { method: 'DELETE' });
      await Promise.all([reloadUsers(), reloadSum()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus user');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
        <p className="text-sm text-gray-500">
          Rekap data pengguna, manajemen role, dan jejak audit.
        </p>
      </div>

      {sumLoading ? (
        <Loading />
      ) : sumError || !summary ? (
        <ErrorBox message={sumError ?? 'Gagal memuat rekap'} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: 'Pengguna', value: summary.users },
            { label: 'Mata Kuliah', value: summary.courses },
            { label: 'Tugas', value: summary.tasks },
            { label: 'Aktivitas', value: summary.activities },
            { label: 'Grup', value: summary.groups },
          ].map((s) => (
            <Card key={s.label}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      <Card title="Pengguna">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Cari nama / nim / email..."
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {actionError && <div className="mb-3"><ErrorBox message={actionError} /></div>}
        {usersLoading ? (
          <Loading />
        ) : usersError || !usersRes ? (
          <ErrorBox message={usersError ?? 'Gagal memuat pengguna'} />
        ) : usersRes.rows.length === 0 ? (
          <EmptyState text="Tidak ada pengguna." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="pb-2">Nama</th>
                  <th className="pb-2">NIM</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Prodi</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {usersRes.rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">
                      {r.nama}
                      {r.id === user.id && (
                        <span className="ml-1 text-xs text-gray-400">(Anda)</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-600">{r.nim}</td>
                    <td className="py-2 text-gray-600">{r.email}</td>
                    <td className="py-2 text-gray-600">{r.prodi ?? '—'}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.role === 'ADMIN'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.role}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {r.taskCount} tugas · {r.courseCount} MK
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleRole(r)}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-60"
                        >
                          {busyId === r.id
                            ? '...'
                            : r.role === 'ADMIN'
                              ? 'Turunkan'
                              : 'Jadikan admin'}
                        </button>
                        <button
                          onClick={() => removeUser(r)}
                          disabled={busyId === r.id}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usersRes && usersRes.total > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>
              {usersRes.rows.length} dari {usersRes.total} pengguna
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * usersRes.limit >= usersRes.total}
                className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Audit Log">
        {auditLoading ? (
          <Loading />
        ) : auditError || !auditRes ? (
          <ErrorBox message={auditError ?? 'Gagal memuat audit log'} />
        ) : auditRes.rows.length === 0 ? (
          <EmptyState text="Belum ada aktivitas admin." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="pb-2">Waktu</th>
                  <th className="pb-2">Admin</th>
                  <th className="pb-2">Aksi</th>
                  <th className="pb-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditRes.rows.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">
                      {new Date(a.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 text-gray-600">{a.admin?.nama ?? '—'}</td>
                    <td className="py-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {AKSI_LABEL[a.aksi] ?? a.aksi}
                      </span>
                    </td>
                    <td className="py-2 text-gray-700">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}