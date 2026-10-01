'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Activity } from '@campusflow/shared-types';
import { AKTIVITAS_KATEGORI } from '@campusflow/shared-types';
import { Card, EmptyState, ErrorBox, Loading } from '@/components/ui';

const KATEGORI_LABEL: Record<string, string> = {
  ORGANISASI: 'Organisasi',
  OLAHRAGA: 'Olahraga',
  KERJA_KELOMPOK: 'Kerja Kelompok',
  PRIBADI: 'Pribadi',
};

const OFFSET_PILIHAN = [15, 30, 60, 120];
const DEFAULT_OFFSETS = [60, 15];

const HARI_ID = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const BULAN_ID = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

const inputCls =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

function formatWaktu(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivitiesPage() {
  const { data, loading, error, reload } = useApi<Activity[]>(() =>
    apiFetch('/activities'),
  );

  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [waktuMulai, setWaktuMulai] = useState('');
  const [waktuSelesai, setWaktuSelesai] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [offsets, setOffsets] = useState<number[]>(DEFAULT_OFFSETS);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function toggleOffset(value: number) {
    setOffsets((prev) =>
      prev.includes(value)
        ? prev.filter((o) => o !== value)
        : [...prev, value].sort((a, b) => b - a),
    );
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!judul.trim() || !kategori || !waktuMulai || !waktuSelesai) {
      setFormError('Lengkapi judul, kategori, waktu mulai, dan waktu selesai.');
      return;
    }
    if (offsets.length === 0) {
      setFormError('Pilih minimal satu waktu pengingat.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const dibuat = await apiFetch<Activity>('/activities', {
        method: 'POST',
        body: JSON.stringify({
          judul,
          kategori,
          lokasi: lokasi || undefined,
          waktuMulai: new Date(waktuMulai).toISOString(),
          waktuSelesai: new Date(waktuSelesai).toISOString(),
          isRecurring,
        }),
      });
      await apiFetch(`/reminders/events/${dibuat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ offsetMinutes: offsets }),
      });
      setJudul('');
      setKategori('');
      setLokasi('');
      setWaktuMulai('');
      setWaktuSelesai('');
      setIsRecurring(false);
      setOffsets(DEFAULT_OFFSETS);
      reload();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan aktivitas',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus aktivitas ini?')) return;
    await apiFetch(`/activities/${id}`, { method: 'DELETE' });
    reload();
  }

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { dayKey: string; label: string; items: Activity[] }
    >();
    for (const a of data ?? []) {
      const d = new Date(a.waktuMulai);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const label = `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
      const entry = map.get(dayKey) ?? { dayKey, label, items: [] };
      entry.items.push(a);
      map.set(dayKey, entry);
    }
    return Array.from(map.values());
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aktivitas</h1>
        <p className="text-sm text-gray-500">
          Catat agenda non-kuliah (UKM, organisasi, proyek) dan pribadi Anda.
        </p>
      </div>

      <Card title="Tambah Aktivitas">
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Judul aktivitas"
              className={inputCls}
            />
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih kategori…</option>
              {AKTIVITAS_KATEGORI.map((k) => (
                <option key={k} value={k}>
                  {KATEGORI_LABEL[k] ?? k}
                </option>
              ))}
            </select>
            <input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Lokasi (opsional)"
              className={inputCls}
            />
            <input
              type="datetime-local"
              value={waktuMulai}
              onChange={(e) => setWaktuMulai(e.target.value)}
              className={inputCls}
            />
            <input
              type="datetime-local"
              value={waktuSelesai}
              onChange={(e) => setWaktuSelesai(e.target.value)}
              className={inputCls}
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Berulang
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Ingatkan:</span>
            {OFFSET_PILIHAN.map((m) => (
              <label
                key={m}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={offsets.includes(m)}
                  onChange={() => toggleOffset(m)}
                  className="size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {m >= 60 ? `${m / 60} jam` : `${m} menit`} sebelumnya
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Durasi 30 menit sampai 3 jam, kelipatan 5 menit.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
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
          <EmptyState text="Belum ada aktivitas. Tambahkan agenda pribadi Anda." />
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.dayKey} title={g.label}>
            <ul className="divide-y divide-gray-100">
              {g.items.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {a.judul}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatWaktu(a.waktuMulai)} –{' '}
                      {new Date(a.waktuSelesai).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {a.durasiMenit} menit
                    </div>
                    {a.lokasi && (
                      <div className="text-xs text-gray-400">{a.lokasi}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.kategori && (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {KATEGORI_LABEL[a.kategori] ?? a.kategori}
                      </span>
                    )}
                    {a.isRecurring && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Berulang
                      </span>
                    )}
                    <button
                      onClick={() => remove(a.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}