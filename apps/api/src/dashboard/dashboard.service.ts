import { Injectable } from '@nestjs/common';
import { HARI_OPTIONS } from '@campusflow/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(userId: string) {
    const [courses, tasks, schedules] = await Promise.all([
      this.prisma.course.count({ where: { userId } }),
      this.prisma.task.findMany({
        where: { userId },
        include: { course: true },
      }),
      this.prisma.schedule.findMany({
        where: { course: { userId } },
        include: { course: true },
      }),
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

    const totalTasks = tasks.length;
    const tasksDone = tasks.filter((t) => t.status === 'SELESAI').length;
    const tasksInProgress = tasks.filter(
      (t) =>
        t.status === 'DIKERJAKAN' ||
        (t.status === 'BELUM_DIKERJAKAN' && new Date(t.deadline) >= now),
    ).length;
    const tasksOverdue = tasks.filter(
      (t) => t.status !== 'SELESAI' && new Date(t.deadline) < now,
    ).length;

    const upcomingDeadlines = tasks
      .filter((t) => t.status !== 'SELESAI' && new Date(t.deadline) >= now)
      .sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
      .slice(0, 5)
      .map((t) => ({
        ...t,
        deadline: t.deadline.toISOString(),
        createdAt: t.createdAt.toISOString(),
      }));

    const hariNames: Record<string, string> = {
      SENIN: 'Monday',
      SELASA: 'Tuesday',
      RABU: 'Wednesday',
      KAMIS: 'Thursday',
      JUMAT: 'Friday',
      SABTU: 'Saturday',
      MINGGU: 'Sunday',
    };
    const todayName = hariNames[
      today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    ];

    const weeklySchedule = HARI_OPTIONS.map((hari) => ({
      hari,
      schedules: schedules
        .filter((s) => s.hari === hari)
        .map((s) => ({
          id: s.id,
          courseId: s.courseId,
          course: s.course,
          hari: s.hari,
          jamMulai: s.jamMulai,
          jamSelesai: s.jamSelesai,
          ruang: s.ruang,
          isRecurring: s.isRecurring,
        })),
    })).map((group) => ({
      ...group,
      isToday: group.hari === todayName,
    }));

    return {
      totalCourses: courses,
      totalTasks,
      tasksDone,
      tasksInProgress,
      tasksOverdue,
      progressPercent:
        totalTasks === 0 ? 0 : Math.round((tasksDone / totalTasks) * 100),
      upcomingDeadlines,
      weeklySchedule,
      today: today.toISOString(),
    };
  }
}