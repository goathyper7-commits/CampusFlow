import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityKategori } from '@campusflow/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto, UpdateActivityDto } from './dto';
import { RemindersService } from '../reminders/reminders.service';
import { durationMinutes, isDurationValid, isSlotAligned, snapToSlot } from '../common/waktu.util';

function toDto(activity: {
  id: string;
  judul: string;
  kategori: ActivityKategori;
  lokasi: string | null;
  waktuMulai: Date;
  waktuSelesai: Date;
  isRecurring: boolean;
}) {
  return {
    id: activity.id,
    judul: activity.judul,
    kategori: activity.kategori,
    lokasi: activity.lokasi,
    waktuMulai: activity.waktuMulai.toISOString(),
    waktuSelesai: activity.waktuSelesai.toISOString(),
    durasiMenit: durationMinutes(activity.waktuMulai, activity.waktuSelesai),
    isRecurring: activity.isRecurring,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private reminders: RemindersService,
  ) {}

  async findAll(userId: string) {
    const activities = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { waktuMulai: 'asc' },
    });
    return activities.map(toDto);
  }

  async hariIni(userId: string) {
    const now = new Date();
    const mulaiHari = new Date(now);
    mulaiHari.setHours(0, 0, 0, 0);
    const akhirHari = new Date(mulaiHari.getTime() + 24 * 60 * 60_000 - 1);

    const [activities, tasks] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId, waktuMulai: { gte: mulaiHari, lte: akhirHari } },
        orderBy: { waktuMulai: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { userId, deadline: { gte: mulaiHari, lte: akhirHari }, status: { not: 'SELESAI' } },
        orderBy: { deadline: 'asc' },
      }),
    ]);

    const baris = [
      ...activities.map((a) => ({
        jam: a.waktuMulai.toISOString(),
        jenis: 'AKTIVITAS' as const,
        judul: a.judul,
        detail: a.lokasi,
      })),
      ...tasks.map((t) => ({
        jam: t.deadline.toISOString(),
        jenis: 'TUGAS' as const,
        judul: t.judul,
        detail: null,
      })),
    ];
    return baris.sort((a, b) => a.jam.localeCompare(b.jam));
  }

  async create(userId: string, dto: CreateActivityDto) {
    const waktuMulai = snapToSlot(new Date(dto.waktuMulai));
    const waktuSelesai = snapToSlot(new Date(dto.waktuSelesai));
    this.validateRange(waktuMulai, waktuSelesai);
    const activity = await this.prisma.activity.create({
      data: {
        userId,
        judul: dto.judul,
        kategori: dto.kategori,
        lokasi: dto.lokasi ?? null,
        waktuMulai,
        waktuSelesai,
        isRecurring: dto.isRecurring ?? false,
      },
    });
    await this.reminders.ensureDefaultForActivity(activity.id);
    return toDto(activity);
  }

  async update(userId: string, id: string, dto: UpdateActivityDto) {
    const existing = await this.ensureOwned(userId, id);
    const berubahWaktu = Boolean(dto.waktuMulai || dto.waktuSelesai);
    const waktuMulai = dto.waktuMulai ? snapToSlot(new Date(dto.waktuMulai)) : existing.waktuMulai;
    const waktuSelesai = dto.waktuSelesai
      ? snapToSlot(new Date(dto.waktuSelesai))
      : existing.waktuSelesai;
    if (berubahWaktu) this.validateRange(waktuMulai, waktuSelesai);

    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        judul: dto.judul,
        kategori: dto.kategori,
        lokasi: dto.lokasi,
        waktuMulai: dto.waktuMulai ? waktuMulai : undefined,
        waktuSelesai: dto.waktuSelesai ? waktuSelesai : undefined,
        isRecurring: dto.isRecurring,
      },
    });
    if (berubahWaktu) await this.reminders.syncActivity(id);
    return toDto(activity);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.reminders.unscheduleActivity(id);
    await this.prisma.activity.delete({ where: { id } });
    return { message: 'Aktivitas berhasil dihapus' };
  }

  private validateRange(mulai: Date, selesai: Date) {
    if (selesai.getTime() <= mulai.getTime()) {
      throw new BadRequestException('Waktu selesai harus setelah waktu mulai');
    }
    if (!isSlotAligned(mulai) || !isSlotAligned(selesai)) {
      throw new BadRequestException('Waktu harus kelipatan 5 menit');
    }
    if (!isDurationValid(durationMinutes(mulai, selesai))) {
      throw new BadRequestException(
        'Durasi harus antara 30 menit dan 3 jam, kelipatan 5 menit',
      );
    }
  }

  private async ensureOwned(userId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, userId } });
    if (!activity) throw new NotFoundException('Aktivitas tidak ditemukan');
    return activity;
  }
}
