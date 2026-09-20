import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from './dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.course.findMany({
      where: { userId },
      orderBy: { namaMatkul: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.course.findFirst({ where: { id, userId } });
  }

  async create(userId: string, dto: CreateCourseDto) {
    return this.prisma.course.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdateCourseDto) {
    await this.ensureOwned(userId, id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.course.delete({ where: { id } });
    return { message: 'Course berhasil dihapus' };
  }

  private async ensureOwned(userId: string, id: string) {
    const course = await this.findOne(userId, id);
    if (!course) throw new NotFoundException('Course tidak ditemukan');
  }
}