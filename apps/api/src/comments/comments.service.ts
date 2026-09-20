import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/jwt-auth.guard';
import { assertTaskAccess } from '../common/task-access';
import { CreateCommentDto, UpdateCommentDto } from './dto';

const includeUser = {
  user: { select: { id: true, nim: true, nama: true } },
};

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: JwtUser, taskId: string) {
    await assertTaskAccess(this.prisma, user, taskId);
    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      include: includeUser,
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async create(user: JwtUser, dto: CreateCommentDto) {
    await assertTaskAccess(this.prisma, user, dto.taskId);
    const comment = await this.prisma.comment.create({
      data: { taskId: dto.taskId, userId: user.sub, isi: dto.isi },
      include: includeUser,
    });
    return { ...comment, createdAt: comment.createdAt.toISOString() };
  }

  async update(user: JwtUser, id: string, dto: UpdateCommentDto) {
    await this.ensureWritable(user, id);
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { isi: dto.isi },
      include: includeUser,
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  }

  async remove(user: JwtUser, id: string) {
    await this.ensureWritable(user, id);
    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Komentar berhasil dihapus' };
  }

  private async ensureWritable(user: JwtUser, id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: includeUser,
    });
    if (!comment) throw new NotFoundException('Komentar tidak ditemukan');
    if (comment.userId !== user.sub && user.role !== 'ADMIN') {
      throw new ForbiddenException('Anda tidak berhak mengubah komentar ini');
    }
    await assertTaskAccess(this.prisma, user, comment.taskId);
    return comment;
  }
}