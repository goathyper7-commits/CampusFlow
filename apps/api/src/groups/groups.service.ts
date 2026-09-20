import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto, CreateTaskGroupDto } from './dto';

interface MemberRow {
  id: string;
  role: string;
  user: { id: string; nim: string; nama: string; prodi: string | null };
}

interface GroupRow {
  id: string;
  taskId: string;
  ketuaId: string;
  task: {
    id: string;
    judul: string;
    deadline: Date;
    status: string;
    course: { id: string; kode: string; namaMatkul: string; sks: number; dosen: string | null } | null;
  };
  members: MemberRow[];
}

function toDto(group: GroupRow, userId: string) {
  return {
    id: group.id,
    taskId: group.taskId,
    ketuaId: group.ketuaId,
    isLeader: group.ketuaId === userId,
    task: {
      id: group.task.id,
      judul: group.task.judul,
      deadline: group.task.deadline.toISOString(),
      status: group.task.status,
      course: group.task.course,
    },
    members: group.members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    })),
  };
}

const includeRelations = {
  task: { include: { course: true } },
  members: {
    include: {
      user: { select: { id: true, nim: true, nama: true, prodi: true } },
    },
    orderBy: { role: 'asc' as const },
  },
};

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskGroupDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: dto.taskId, userId },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan');

    const existing = await this.prisma.taskGroup.findUnique({
      where: { taskId: dto.taskId },
    });
    if (existing) throw new ConflictException('Tugas ini sudah punya grup');

    const group = await this.prisma.taskGroup.create({
      data: {
        taskId: dto.taskId,
        ketuaId: userId,
        members: { create: { userId, role: 'KETUA' } },
      },
      include: includeRelations,
    });
    return toDto(group, userId);
  }

  async findAll(userId: string) {
    const groups = await this.prisma.taskGroup.findMany({
      where: { OR: [{ ketuaId: userId }, { members: { some: { userId } } }] },
      include: includeRelations,
      orderBy: { task: { deadline: 'asc' } },
    });
    return groups.map((g) => toDto(g, userId));
  }

  async findOne(userId: string, id: string) {
    const group = await this.prisma.taskGroup.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!group) throw new NotFoundException('Grup tidak ditemukan');
    this.assertMember(group, userId);
    return toDto(group, userId);
  }

  async addMember(userId: string, id: string, dto: AddMemberDto) {
    const group = await this.ensureLeader(userId, id);

    const user = await this.prisma.user.findUnique({
      where: { nim: dto.nim },
    });
    if (!user) throw new NotFoundException('NIM tidak ditemukan');
    if (user.id === group.ketuaId) {
      throw new BadRequestException('Ketua sudah otomatis menjadi anggota');
    }

    const exists = await this.prisma.groupMember.findFirst({
      where: { groupId: id, userId: user.id },
    });
    if (exists) throw new ConflictException('Anggota sudah terdaftar di grup');

    const member = await this.prisma.groupMember.create({
      data: { groupId: id, userId: user.id, role: 'ANGGOTA' },
    });
    return member;
  }

  async removeMember(userId: string, id: string, memberId: string) {
    await this.ensureLeader(userId, id);
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId: id },
    });
    if (!member) throw new NotFoundException('Anggota tidak ditemukan');
    await this.prisma.groupMember.delete({ where: { id: memberId } });
    return { message: 'Anggota berhasil dikeluarkan' };
  }

  async leave(userId: string, id: string) {
    const group = await this.prisma.taskGroup.findUnique({
      where: { id },
    });
    if (!group) throw new NotFoundException('Grup tidak ditemukan');
    if (group.ketuaId === userId) {
      throw new BadRequestException(
        'Ketua tidak bisa keluar; hapus grup untuk membubarkan',
      );
    }
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: id, userId },
    });
    if (!member) throw new NotFoundException('Anda bukan anggota grup ini');
    await this.prisma.groupMember.delete({ where: { id: member.id } });
    return { message: 'Anda keluar dari grup' };
  }

  async remove(userId: string, id: string) {
    await this.ensureLeader(userId, id);
    await this.prisma.taskGroup.delete({ where: { id } });
    return { message: 'Grup berhasil dibubarkan' };
  }

  private async ensureLeader(userId: string, id: string) {
    const group = await this.prisma.taskGroup.findUnique({
      where: { id },
      include: includeRelations,
    });
    if (!group) throw new NotFoundException('Grup tidak ditemukan');
    if (group.ketuaId !== userId) {
      throw new ForbiddenException('Hanya ketua grup yang dapat melakukan ini');
    }
    return group;
  }

  private assertMember(group: { ketuaId: string; members: MemberRow[] }, userId: string) {
    const isMember =
      group.ketuaId === userId || group.members.some((m) => m.user.id === userId);
    if (!isMember) throw new ForbiddenException('Anda bukan anggota grup ini');
  }
}