export type Role = 'MAHASISWA' | 'ADMIN';
export type Prioritas = 'RENDAH' | 'SEDANG' | 'TINGGI';
export type TaskStatus =
  | 'BELUM_DIKERJAKAN'
  | 'DIKERJAKAN'
  | 'SELESAI'
  | 'TERLAMBAT';

export const HARI_OPTIONS = [
  'SENIN',
  'SELASA',
  'RABU',
  'KAMIS',
  'JUMAT',
  'SABTU',
  'MINGGU',
] as const;
export type Hari = (typeof HARI_OPTIONS)[number];

export type ActivityKategori = 'ORGANISASI' | 'EVENT' | 'PERSONAL';
export const AKTIVITAS_KATEGORI: ActivityKategori[] = [
  'ORGANISASI',
  'EVENT',
  'PERSONAL',
];

export interface UserProfile {
  id: string;
  nim: string;
  nama: string;
  email: string;
  prodi?: string | null;
  semester?: number | null;
  role: Role;
  createdAt: string;
}

export interface Course {
  id: string;
  kode: string;
  namaMatkul: string;
  sks: number;
  dosen?: string | null;
}

export interface Schedule {
  id: string;
  courseId: string;
  course?: Course;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruang?: string | null;
  isRecurring: boolean;
}

export interface ScheduleWithCourse extends Schedule {
  course: Course;
}

export interface Task {
  id: string;
  courseId?: string | null;
  course?: Course | null;
  judul: string;
  deskripsi?: string | null;
  deadline: string;
  prioritas: Prioritas;
  status: TaskStatus;
  createdAt: string;
  subtasks?: SubTask[];
  comments?: Comment[];
  attachments?: Attachment[];
  assignees?: Array<{ id: string; nama: string }>;
}

export interface SubTask {
  id: string;
  taskId: string;
  judul: string;
  isDone: boolean;
  assigneeId?: string | null;
  assignee?: Pick<UserProfile, 'id' | 'nama'> | null;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  user?: Pick<UserProfile, 'id' | 'nama'>;
  isi: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ConflictItem {
  schedule: Schedule;
  message: string;
}

export interface DaySchedule {
  hari: Hari;
  isToday: boolean;
  schedules: ScheduleWithCourse[];
}

export interface WeeklyTaskLoad {
  weekStart: string;
  label: string;
  total: number;
  selesai: number;
}

export interface DashboardSummary {
  totalCourses: number;
  totalTasks: number;
  tasksDone: number;
  tasksInProgress: number;
  tasksOverdue: number;
  progressPercent: number;
  upcomingDeadlines: Task[];
  weeklySchedule: DaySchedule[];
  weeklyTaskLoad: WeeklyTaskLoad[];
  today: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  task?:
    | (Pick<Task, 'id' | 'judul' | 'deadline' | 'status'> & {
        course?: Course | null;
      })
    | null;
  offsetHours: number;
  scheduledAt: string;
  isSent: boolean;
  sentAt?: string | null;
}

export interface Activity {
  id: string;
  judul: string;
  kategori: ActivityKategori;
  waktuMulai: string;
  waktuSelesai: string;
  isRecurring: boolean;
}

export interface GroupMember {
  id: string;
  role: 'KETUA' | 'ANGGOTA';
  user: Pick<UserProfile, 'id' | 'nim' | 'nama' | 'prodi'>;
}

export interface TaskGroup {
  id: string;
  taskId: string;
  ketuaId: string;
  isLeader: boolean;
  task: Pick<Task, 'id' | 'judul' | 'deadline' | 'status'> & {
    course?: Course | null;
  };
  members: GroupMember[];
}

export interface NotificationPreference {
  autoRemindersEnabled: boolean;
  pushEnabled: boolean;
}

export interface PushSubscription {
  id: string;
  endpoint: string;
}

export interface Notification {
  id: string;
  userId: string;
  tipe: string;
  pesan: string;
  scheduledAt: string;
  isSent: boolean;
  isRead: boolean;
  createdAt: string;
  reminderId?: string | null;
  reminder?: {
    id: string;
    offsetHours: number;
    scheduledAt: string;
    task?: {
      id: string;
      judul: string;
      deadline: string;
      status: TaskStatus;
    } | null;
  } | null;
}

export interface CalendarItem {
  id: string;
  type: 'schedule' | 'task' | 'activity';
  title: string;
  start: string;
  end?: string | null;
  hari?: Hari | null;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  status?: TaskStatus | null;
  kategori?: ActivityKategori | null;
  course?: Course | null;
  taskId?: string | null;
}

export interface HealthCheck {
  status: string;
  database: string;
  redis: string;
  timestamp: string;
}