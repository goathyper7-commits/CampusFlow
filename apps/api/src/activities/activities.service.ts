import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityKategori } from '@campusflow/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto, UpdateActivityDto } from './dto';

interface ActivityRow {
  id: string;
  judul: string;
  kategori: ActivityKategori;
  waktuMulai: Date;
  waktuSelesai: Date;
  isRecurring: boolean;
}

function toDto(activity: ActivityRow) {
  return {
    id: activity.id,
    judul: activity.judul,
    kategori: activity.kategori,
    waktuMulai: activity.waktuMulai.toISOString(),
    waktuSelesai: activity.waktuSelesai.toISOString(),
    isRecurring: activity.isRecurring,
  };
}

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const activities = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { waktuMulai: 'asc' },
    });
    return activities.map(toDto);
  }

  async create(userId: string, dto: CreateActivityDto) {
    this.validateRange(dto.waktuMulai, dto.waktuSelesai);
    const activity = await this.prisma.activity.create({
      data: {
        userId,
        judul: dto.judul,
        kategori: dto.kategori,
        waktuMulai: new Date(dto.waktuMulai),
        waktuSelesai: new Date(dto.waktuSelesai),
        isRecurring: dto.isRecurring ?? false,
      },
    });
    return toDto(activity);
  }

  async update(userId: string, id: string, dto: UpdateActivityDto) {
    await this.ensureOwned(userId, id);
    if (dto.waktuMulai || dto.waktuSelesai) {
      const existing = await this.prisma.activity.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundException('Aktivitas tidak ditemukan');
      this.validateRange(
        dto.waktuMulai ?? existing.waktuMulai.toISOString(),
        dto.waktuSelesai ?? existing.waktuSelesai.toISOString(),
      );
    }
    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        judul: dto.judul,
        kategori: dto.kategori,
        waktuMulai: dto.waktuMulai ? new Date(dto.waktuMulai) : undefined,
        waktuSelesai: dto.waktuSelesai
          ? new Date(dto.waktuSelesai)
          : undefined,
        isRecurring: dto.isRecurring,
      },
    });
    return toDto(activity);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.activity.delete({ where: { id } });
    return { message: 'Aktivitas berhasil dihapus' };
  }

  private validateRange(mulai: string, selesai: string) {
    if (new Date(selesai) <= new Date(mulai)) {
      throw new BadRequestException('Waktu selesai harus setelah waktu mulai');
    }
  }

  private async ensureOwned(userId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, userId },
    });
    if (!activity) throw new NotFoundException('Aktivitas tidak ditemukan');
    return activity;
  }
}