import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessUser {
  sub: string;
  role: string;
}

export async function assertTaskAccess(
  prisma: PrismaService,
  user: AccessUser,
  taskId: string,
) {
  if (user.role === 'ADMIN') return;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      taskGroup: { include: { members: { select: { userId: true } } } },
    },
  });
  if (!task) throw new NotFoundException('Tugas tidak ditemukan');
  const isOwner = task.userId === user.sub;
  const isMember = task.taskGroup?.members.some(
    (m) => m.userId === user.sub,
  );
  if (!isOwner && !isMember) {
    throw new ForbiddenException('Anda tidak punya akses ke tugas ini');
  }
}