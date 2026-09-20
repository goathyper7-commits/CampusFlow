import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Hari } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictCheckQueryDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';

@Injectable()
export class SchedulesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, courseId?: string) {
    return this.prisma.schedule.findMany({
      where: {
        course: { userId },
        ...(courseId ? { courseId } : {}),
      },
      include: { course: true },
      orderBy: [{ hari: 'asc' }, { jamMulai: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateScheduleDto) {
    await this.ensureCourseOwned(userId, dto.courseId);

    const conflicts = await this.findConflicts(userId, {
      hari: dto.hari,
      jamMulai: dto.jamMulai,
      jamSelesai: dto.jamSelesai,
    });
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Jadwal bentrok dengan jadwal yang sudah ada',
        conflicts,
      });
    }

    return this.prisma.schedule.create({
      data: {
        courseId: dto.courseId,
        hari: dto.hari,
        jamMulai: dto.jamMulai,
        jamSelesai: dto.jamSelesai,
        ruang: dto.ruang,
        isRecurring: dto.isRecurring,
      },
      include: { course: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateScheduleDto) {
    await this.ensureOwned(userId, id);
    if (dto.courseId) {
      await this.ensureCourseOwned(userId, dto.courseId);
    }

    const current = await this.prisma.schedule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Jadwal tidak ditemukan');
    const merged = {
      hari: dto.hari ?? current.hari,
      jamMulai: dto.jamMulai ?? current.jamMulai,
      jamSelesai: dto.jamSelesai ?? current.jamSelesai,
    };
    const conflicts = await this.findConflicts(
      userId,
      {
        hari: merged.hari,
        jamMulai: merged.jamMulai,
        jamSelesai: merged.jamSelesai,
      },
      id,
    );
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Jadwal bentrok dengan jadwal yang sudah ada',
        conflicts,
      });
    }

    return this.prisma.schedule.update({
      where: { id },
      data: {
        courseId: dto.courseId,
        hari: dto.hari,
        jamMulai: dto.jamMulai,
        jamSelesai: dto.jamSelesai,
        ruang: dto.ruang,
        isRecurring: dto.isRecurring,
      },
      include: { course: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.schedule.delete({ where: { id } });
    return { message: 'Jadwal berhasil dihapus' };
  }

  async conflictCheck(userId: string, query: ConflictCheckQueryDto) {
    return this.findConflicts(userId, query, query.excludeId);
  }

  private async findConflicts(
    userId: string,
    query: {
      hari: Hari;
      jamMulai: string;
      jamSelesai: string;
    },
    excludeId?: string,
  ) {
    const schedule = await this.prisma.schedule.findMany({
      where: {
        course: { userId },
        hari: query.hari,
        id: excludeId ? { not: excludeId } : undefined,
      },
      include: { course: true },
    });

    return schedule
      .filter((s) => this.isOverlap(query, s))
      .map((s) => ({
        schedule: s,
        message: `Bentrok dengan ${s.course.namaMatkul} (${s.hari} ${s.jamMulai}-${s.jamSelesai})`,
      }));
  }

  private isOverlap(
    a: { jamMulai: string; jamSelesai: string },
    b: { jamMulai: string; jamSelesai: string },
  ): boolean {
    return a.jamMulai < b.jamSelesai && b.jamMulai < a.jamSelesai;
  }

  private async ensureCourseOwned(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, userId },
    });
    if (!course) throw new NotFoundException('Course tidak ditemukan');
  }

  private async ensureOwned(userId: string, id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, course: { userId } },
    });
    if (!schedule) throw new NotFoundException('Jadwal tidak ditemukan');
  }
}