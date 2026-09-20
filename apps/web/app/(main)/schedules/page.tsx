'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type { Course, Hari, ScheduleWithCourse } from '@campusflow/shared-types';
import { HARI_OPTIONS } from '@campusflow/shared-types';
import { Card, EmptyState, ErrorBox, Loading } from '@/components/ui';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import idLocale from '@fullcalendar/core/locales/id';
import type { EventInput } from '@fullcalendar/core';

const HARI_LABEL: Record<Hari, string> = {
  SENIN: 'Senin',
  SELASA: 'Selasa',
  RABU: 'Rabu',
  KAMIS: 'Kamis',
  JUMAT: 'Jumat',
  SABTU: 'Sabtu',
  MINGGU: 'Minggu',
};

const HARI_NUM: Record<Hari, number> = {
  MINGGU: 0,
  SENIN: 1,
  SELASA: 2,
  RABU: 3,
  KAMIS: 4,
  JUMAT: 5,
  SABTU: 6,
};

function buildCalendarEvents(schedules: ScheduleWithCourse[]): EventInput[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 56);
  const events: EventInput[] = [];
  for (const s of schedules) {
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === HARI_NUM[s.hari]) {
        const [sh, sm] = s.jamMulai.split(':').map(Number);
        const [eh, em] = s.jamSelesai.split(':').map(Number);
        const startDate = new Date(d);
        startDate.setHours(sh, sm, 0, 0);
        const endDate = new Date(d);
        endDate.setHours(eh, em, 0, 0);
        events.push({
          id: `${s.id}-${d.toISOString().slice(0, 10)}`,
          title: s.course.namaMatkul,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          extendedProps: { ruang: s.ruang ?? null },
        });
      }
    }
  }
  return events;
}

const emptyForm = {
  courseId: '',
  hari: 'SENIN' as Hari,
  jamMulai: '08:00',
  jamSelesai: '09:40',
  ruang: '',
};

export default function SchedulesPage() {
  const { data: schedules, loading, error, reload } = useApi<
    ScheduleWithCourse[]
  >(() => apiFetch('/schedules'));
  const { data: courses } = useApi<Course[]>(() => apiFetch('/courses'));

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          courseId: form.courseId,
          hari: form.hari,
          jamMulai: form.jamMulai,
          jamSelesai: form.jamSelesai,
          ruang: form.ruang || undefined,
        }),
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan jadwal');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus jadwal ini?')) return;
    try {
      await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jadwal Kuliah</h1>
        <p className="text-sm text-gray-500">
          Atur jadwal mingguan. Sistem otomatis memeriksa jadwal yang bentrok.
        </p>
      </div>

      <Card title="Tambah Jadwal">
        <form
          onSubmit={create}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <select
            required
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none lg:col-span-2"
          >
            <option value="">— Pilih Mata Kuliah —</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.kode} — {c.namaMatkul}
              </option>
            ))}
          </select>
          <select
            required
            value={form.hari}
            onChange={(e) =>
              setForm({ ...form, hari: e.target.value as Hari })
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {HARI_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {HARI_LABEL[h]}
              </option>
            ))}
          </select>
          <input
            type="time"
            required
            value={form.jamMulai}
            onChange={(e) => setForm({ ...form, jamMulai: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="time"
            required
            value={form.jamSelesai}
            onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !form.courseId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
          <input
            value={form.ruang}
            onChange={(e) => setForm({ ...form, ruang: e.target.value })}
            placeholder="Ruang (opsional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none sm:col-span-2 lg:col-span-6"
          />
          {formError && (
            <div className="sm:col-span-2 lg:col-span-6">
              <ErrorBox message={formError} />
            </div>
          )}
        </form>
      </Card>

      <Card title="Kalender Bulanan">
        <div className="overflow-x-auto">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="dayGridMonth"
            height="auto"
            locale={idLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek',
            }}
            events={buildCalendarEvents(schedules ?? [])}
            dayMaxEvents={2}
            eventContent={(arg) => (
              <div className="flex flex-col overflow-hidden px-1 text-[11px] leading-tight">
                <span className="truncate font-medium">
                  {arg.timeText} {arg.event.title}
                </span>
                {arg.event.extendedProps.ruang && (
                  <span className="truncate text-gray-500">
                    {arg.event.extendedProps.ruang}
                  </span>
                )}
              </div>
            )}
          />
        </div>
      </Card>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {HARI_OPTIONS.map((hari) => {
            const items = (schedules ?? []).filter((s) => s.hari === hari);
            const isToday =
              new Date().toLocaleDateString('en-US', {
                weekday: 'long',
              }).toUpperCase() === hari;
            return (
              <Card
                key={hari}
                className={isToday ? 'ring-2 ring-indigo-200' : ''}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">
                    {HARI_LABEL[hari]}
                  </h3>
                  {isToday && (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Hari ini
                    </span>
                  )}
                </div>
                {items.length === 0 ? (
                  <EmptyState text="Tidak ada jadwal." />
                ) : (
                  <ul className="space-y-2">
                    {items.map((s) => (
                      <li
                        key={s.id}
                        className="group rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-800">
                              {s.course.namaMatkul}
                            </div>
                            <div className="text-xs text-gray-500">
                              {s.jamMulai}–{s.jamSelesai}
                              {s.ruang ? ` · ${s.ruang}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => remove(s.id)}
                            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 opacity-0 transition group-hover:opacity-100 hover:bg-red-50"
                          >
                            Hapus
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}