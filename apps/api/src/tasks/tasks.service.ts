import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import {
  CreateSubTaskDto,
  CreateTaskDto,
  TaskQueryDto,
  UpdateSubTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private reminders: RemindersService,
  ) {}

  async findAll(userId: string, query: TaskQueryDto) {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.courseId ? { courseId: query.courseId } : {}),
      },
      include: { course: true, subtasks: true },
      orderBy: [{ deadline: 'asc' }],
    });

    const now = new Date();
    return tasks.map((task) => {
      let status = task.status;
      if (status !== 'SELESAI' && new Date(task.deadline) < now) {
        status = 'TERLAMBAT';
      }
      return {
        ...task,
        status,
        deadline: task.deadline.toISOString(),
        createdAt: task.createdAt.toISOString(),
      };
    });
  }

  async create(userId: string, dto: CreateTaskDto) {
    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, userId },
      });
      if (!course) throw new NotFoundException('Course tidak ditemukan');
    }

    const { courseId, ...rest } = dto;
    const task = await this.prisma.task.create({
      data: { ...rest, userId, courseId: courseId ?? null },
      include: { course: true, subtasks: true },
    });

    await this.reminders.syncTask(task.id);

    return {
      ...task,
      deadline: task.deadline.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    await this.ensureOwned(userId, id);
    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: dto.courseId, userId },
      });
      if (!course) throw new NotFoundException('Course tidak ditemukan');
    }

    const { courseId, ...rest } = dto;
    const task = await this.prisma.task.update({
      where: { id },
      data: { ...rest, ...(courseId !== undefined ? { courseId } : {}) },
      include: { course: true, subtasks: true },
    });

    await this.reminders.syncTask(task.id);

    return {
      ...task,
      deadline: task.deadline.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  }

  async updateStatus(userId: string, id: string, dto: UpdateTaskStatusDto) {
    await this.ensureOwned(userId, id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: { course: true, subtasks: true },
    });

    await this.reminders.syncTask(task.id);

    return {
      ...task,
      deadline: task.deadline.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.reminders.unscheduleTask(id);
    await this.prisma.task.delete({ where: { id } });
    return { message: 'Tugas berhasil dihapus' };
  }

  async addSubTask(userId: string, taskId: string, dto: CreateSubTaskDto) {
    await this.ensureOwned(userId, taskId);
    return this.prisma.subTask.create({
      data: { taskId, judul: dto.judul },
    });
  }

  async updateSubTask(
    userId: string,
    taskId: string,
    subTaskId: string,
    dto: UpdateSubTaskDto,
  ) {
    await this.ensureOwned(userId, taskId);
    return this.prisma.subTask.update({
      where: { id: subTaskId },
      data: dto,
    });
  }

  async toggleSubTask(userId: string, taskId: string, subTaskId: string) {
    await this.ensureOwned(userId, taskId);
    const subtask = await this.prisma.subTask.findUnique({
      where: { id: subTaskId },
    });
    if (!subtask) throw new NotFoundException('Subtask tidak ditemukan');
    return this.prisma.subTask.update({
      where: { id: subTaskId },
      data: { isDone: !subtask.isDone },
    });
  }

  async removeSubTask(userId: string, taskId: string, subTaskId: string) {
    await this.ensureOwned(userId, taskId);
    await this.prisma.subTask.delete({ where: { id: subTaskId } });
    return { message: 'Subtask berhasil dihapus' };
  }

  private async ensureOwned(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan');
  }
}