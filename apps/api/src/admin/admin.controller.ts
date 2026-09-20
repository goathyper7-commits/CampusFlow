import { Body, ConflictException, Controller, Delete, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { Prisma, Role } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminQueryDto, UpdateUserRoleDto } from './dto';

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const [users, courses, tasks, activities, groups, audit] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.course.count(),
        this.prisma.task.count(),
        this.prisma.activity.count(),
        this.prisma.taskGroup.count(),
        this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { admin: { select: { nama: true, email: true } } },
        }),
      ]);
    return {
      users,
      courses,
      tasks,
      activities,
      groups,
      recentAudit: audit.map((a) => ({
        id: a.id,
        aksi: a.aksi,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
        admin: a.admin.nama,
      })),
    };
  }

  @Get('users')
  async users(@Query() query: AdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { nama: { contains: query.search, mode: 'insensitive' } },
            { nim: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          nim: true,
          nama: true,
          email: true,
          prodi: true,
          semester: true,
          role: true,
          createdAt: true,
          _count: { select: { tasks: true, courses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        nim: r.nim,
        nama: r.nama,
        email: r.email,
        prodi: r.prodi,
        semester: r.semester,
        role: r.role,
        createdAt: r.createdAt.toISOString(),
        taskCount: r._count.tasks,
        courseCount: r._count.courses,
      })),
      total,
      page,
      limit,
    };
  }

  @Get('audit')
  async audit(@Query() query: AdminQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { admin: { select: { nama: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return {
      rows: rows.map((a) => ({
        id: a.id,
        aksi: a.aksi,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
        admin: a.admin ? { nama: a.admin.nama, email: a.admin.email } : null,
      })),
      total,
      page,
      limit,
    };
  }

  @Patch('users/:id/role')
  @Roles('ADMIN')
  async updateRole(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    if (id === req.user.sub && dto.role !== 'ADMIN') {
      throw new ConflictException('Admin tidak dapat menghapus role dirinya sendiri');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new ConflictException('User tidak ditemukan');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });
    await this.log(req.user, 'UBAH_ROLE', `${target.nama} -> ${dto.role}`);
    return { id, role: updated.role };
  }

  @Delete('users/:id')
  @Roles('ADMIN')
  async removeUser(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
  ) {
    if (id === req.user.sub) {
      throw new ConflictException('Tidak dapat menghapus admin yang sedang aktif');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nim: true,
        nama: true,
        _count: { select: { tasks: true, courses: true } },
      },
    });
    if (!target) throw new ConflictException('User tidak ditemukan');
    if (target._count.tasks > 0 || target._count.courses > 0) {
      throw new ConflictException(
        'User memiliki data (tugas/mata kuliah); tidak dihapus untuk mencegah kehilangan data',
      );
    }
    await this.prisma.user.delete({ where: { id } });
    await this.log(req.user, 'HAPUS_USER', `${target.nama} (${target.nim})`);
    return { message: 'User dihapus' };
  }

  private async log(admin: JwtUser, aksi: string, detail: string) {
    await this.prisma.auditLog
      .create({ data: { adminId: admin.sub, aksi, detail } })
      .catch(() => undefined);
  }
}