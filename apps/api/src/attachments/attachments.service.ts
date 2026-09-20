import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { assertTaskAccess } from '../common/task-access';
import { JwtUser } from '../auth/jwt-auth.guard';

export interface StoredFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MAX_SIZE = 5 * 1024 * 1024;

@Injectable()
export class AttachmentsService {
  private readonly dir: string;

  constructor(private prisma: PrismaService) {
    this.dir = join(process.cwd(), 'uploads');
    mkdirSync(this.dir, { recursive: true });
  }

  async list(user: JwtUser, taskId: string) {
    await assertTaskAccess(this.prisma, user, taskId);
    const items = await this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { id: 'asc' },
    });
    return items.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      fileUrl: a.fileUrl,
      fileName: this.fileNameOf(a.fileUrl),
      fileType: a.fileType,
      fileSize: a.fileSize,
    }));
  }

  async upload(user: JwtUser, taskId: string, file: StoredFile) {
    await assertTaskAccess(this.prisma, user, taskId);
    if (!file) throw new NotFoundException('File tidak ditemukan');
    if (file.size > MAX_SIZE) {
      throw new PayloadTooLargeException('Ukuran file maksimal 5 MB');
    }
    const name = this.sanitize(file.originalname);
    const stored = `${randomUUID()}__${name}`;
    await writeFile(join(this.dir, stored), file.buffer);
    const row = await this.prisma.attachment.create({
      data: {
        taskId,
        fileUrl: stored,
        fileType: file.mimetype || 'application/octet-stream',
        fileSize: file.size,
      },
    });
    return {
      id: row.id,
      taskId: row.taskId,
      fileUrl: row.fileUrl,
      fileName: name,
      fileType: row.fileType,
      fileSize: row.fileSize,
    };
  }

  async remove(user: JwtUser, id: string) {
    const row = await this.prisma.attachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lampiran tidak ditemukan');
    await assertTaskAccess(this.prisma, user, row.taskId);
    await this.prisma.attachment.delete({ where: { id } });
    const path = join(this.dir, row.fileUrl);
    rm(path, { force: true }).catch(() => undefined);
    return { message: 'Lampiran berhasil dihapus' };
  }

  async getFile(user: JwtUser, id: string) {
    const row = await this.prisma.attachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Lampiran tidak ditemukan');
    await assertTaskAccess(this.prisma, user, row.taskId);
    const buffer = readFileSync(join(this.dir, row.fileUrl));
    return {
      buffer,
      fileName: this.fileNameOf(row.fileUrl),
      fileType: row.fileType,
    };
  }

  private fileNameOf(fileUrl: string) {
    return fileUrl.split('__').slice(1).join('__') || fileUrl;
  }

  private sanitize(name: string) {
    return name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ');
  }
}