'use client';

import { useApi } from '@/lib/hooks';
import { apiFetch } from '@/lib/api';
import type {
  DashboardSummary,
  Task,
  TaskStatus,
} from '@campusflow/shared-types';
import {
  Card,
  EmptyState,
  ErrorBox,
  Loading,
  StatusBadge,
} from '@/components/ui';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const HARI_LABEL: Record<string, string> = {
  SENIN: 'Senin',
  SELASA: 'Selasa',
  RABU: 'Rabu',
  KAMIS: 'Kamis',
  JUMAT: 'Jumat',
  SABTU: 'Sabtu',
  MINGGU: 'Minggu',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  BELUM_DIKERJAKAN: 'Belum dikerjakan',
  DIKERJAKAN: 'Dikerjakan',
  SELESAI: 'Selesai',
  TERLAMBAT: 'Terlambat',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  BELUM_DIKERJAKAN: '#9ca3af',
  DIKERJAKAN: '#3b82f6',
  SELESAI: '#10b981',
  TERLAMBAT: '#ef4444',
};

function effectiveStatus(task: Task): TaskStatus {
  if (
    task.status !== 'SELESAI' &&
    new Date(task.deadline).getTime() < Date.now()
  ) {
    return 'TERLAMBAT';
  }
  return task.status;
}

export default function DashboardPage() {
  const {
    data,
    loading,
    error,
  } = useApi<DashboardSummary>(() => apiFetch('/dashboard/summary'));
  const { data: tasks } = useApi<Task[]>(() => apiFetch('/tasks'));

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const stats = [
    { label: 'Mata Kuliah', value: data.totalCourses, color: 'text-indigo-600' },
    { label: 'Total Tugas', value: data.totalTasks, color: 'text-gray-900' },
    { label: 'Selesai', value: data.tasksDone, color: 'text-emerald-600' },
    { label: 'Terlambat', value: data.tasksOverdue, color: 'text-red-600' },
  ];

  const statusCounts: Record<TaskStatus, number> = {
    BELUM_DIKERJAKAN: 0,
    DIKERJAKAN: 0,
    SELESAI: 0,
    TERLAMBAT: 0,
  };
  (tasks ?? []).forEach((t) => {
    statusCounts[effectiveStatus(t)] += 1;
  });
  const statusData = (Object.keys(statusCounts) as TaskStatus[])
    .map((key) => ({
      key,
      name: STATUS_LABEL[key],
      value: statusCounts[key],
    }))
    .filter((d) => d.value > 0);
  const hasStatus = statusData.length > 0;

  const weekData = data.weeklySchedule.map((d) => ({
    hari: HARI_LABEL[d.hari].slice(0, 3),
    jumlah: d.schedules.length,
    isToday: d.isToday,
  }));
  const hasWeek = weekData.some((w) => w.jumlah > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Ringkasan aktivitas perkuliahan Anda hari ini.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-xs font-medium text-gray-500">{s.label}</div>
            <div className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card title={`Progres Tugas — ${data.progressPercent}%`}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${data.progressPercent}%` }}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Distribusi Status Tugas">
          {!hasStatus ? (
            <EmptyState text="Belum ada tugas." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Jadwal per Hari">
          {!hasWeek ? (
            <EmptyState text="Belum ada jadwal." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData} margin={{ top: 8, right: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hari" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="jumlah" name="Kegiatan" radius={[6, 6, 0, 0]}>
                    {weekData.map((d, i) => (
                      <Cell key={i} fill={d.isToday ? '#4f46e5' : '#c7d2fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Deadline Terdekat">
          {data.upcomingDeadlines.length === 0 ? (
            <EmptyState text="Tidak ada deadline mendatang." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.upcomingDeadlines.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800">
                      {t.judul}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.course?.namaMatkul ?? 'Tanpa mata kuliah'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-medium text-gray-700">
                      {new Date(t.deadline).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Jadwal Mingguan">
          {data.weeklySchedule.every((d) => d.schedules.length === 0) ? (
            <EmptyState text="Belum ada jadwal kuliah." />
          ) : (
            <ul className="space-y-3">
              {data.weeklySchedule.map((day) => (
                <li key={day.hari}>
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase ${
                        day.isToday ? 'text-indigo-600' : 'text-gray-400'
                      }`}
                    >
                      {HARI_LABEL[day.hari]}
                    </span>
                    {day.isToday && (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Hari ini
                      </span>
                    )}
                  </div>
                  {day.schedules.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-gray-800">
                        {s.course.namaMatkul}
                      </span>
                      <span className="text-xs text-gray-500">
                        {s.jamMulai}–{s.jamSelesai} · {s.ruang ?? '—'}
                      </span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}