import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import { ChannelType, Hari, OtpPurpose } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatJam,
  formatTanggalJam,
  formatSisa,
  minutesUntil,
} from '../common/waktu.util';

const KONTEKS_PENAUTAN = new Map<string, { userId: string; expiresAt: number }>();
const BATAS_KONTEKS = 10_000;
const LINK_TTL_MS = 10 * 60_000;

export interface KirimHasil {
  terkirim: boolean;
  messageId?: number;
  alasan?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get token(): string | null {
    return this.config.get<string>('TG_BOT_TOKEN') ?? null;
  }

  aktif(): boolean {
    return Boolean(this.token);
  }

  private client(): Bot | null {
    if (!this.token) return null;
    if (!this.bot) {
      this.bot = new Bot(this.token);
    }
    return this.bot;
  }

  private async safeCall(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (galat) {
      const e = galat as { error_code?: number; description?: string };
      if (e.error_code === 429) {
        const retryAfter = (galat as { parameters?: { retry_after?: number } }).parameters
          ?.retry_after;
        this.logger.warn(`[telegram] rate limited, dijadwalkan ulang ${retryAfter ?? 5} detik`);
        const delay = (retryAfter ?? 5) * 1000;
        setTimeout(() => void this.safeCall(fn), delay);
        return;
      }
      if (e.error_code === 403) {
        this.logger.warn('[telegram] bot diblokir pengguna');
        return;
      }
      this.logger.warn(`[telegram] panggilan gagal: ${e.description ?? galat}`);
    }
  }

  async sendOtp(userId: string, kode: string, purpose: OtpPurpose): Promise<KirimHasil> {
    const chatId = await this.chatIdFor(userId);
    if (!chatId) return { terkirim: false, alasan: 'Kanal Telegram belum aktif' };
    const client = this.client();
    if (!client) return { terkirim: false, alasan: 'TG_BOT_TOKEN belum diisi' };
    const label = this.labelPurpose(purpose);
    try {
      const sent = await client.api.sendMessage(
        chatId,
        `*CampusFlow*\nKode verifikasi untuk ${label}: \`${kode}\`\nBerlaku 5 menit. Jangan bagikan ke siapa pun.`,
        { parse_mode: 'Markdown' },
      );
      return { terkirim: true, messageId: sent.message_id };
    } catch (galat) {
      await this.tanganiGalatKirim(galat, chatId);
      return { terkirim: false, alasan: (galat as Error).message };
    }
  }

  private labelPurpose(purpose: OtpPurpose): string {
    switch (purpose) {
      case 'REGISTER':
        return 'pendaftaran';
      case 'LOGIN_PERANGKAT_BARU':
        return 'login perangkat baru';
      case 'LUPA_SANDI':
        return 'lupa sandi';
      case 'GANTI_USERNAME':
        return 'ganti username';
      case 'GANTI_NOMOR':
        return 'ganti nomor HP';
    }
  }

  private async tanganiGalatKirim(galat: unknown, chatId: string): Promise<void> {
    const e = galat as { error_code?: number };
    if (e.error_code === 403) {
      await this.prisma.userChannel.updateMany({
        where: { channel: ChannelType.TELEGRAM, telegramChatId: chatId },
        data: { optedIn: false, optedOutAt: new Date() },
      });
    }
  }

  private async chatIdFor(userId: string): Promise<string | null> {
    const channel = await this.prisma.userChannel.findUnique({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      select: { telegramChatId: true, optedIn: true },
    });
    if (!channel?.optedIn || !channel.telegramChatId) return null;
    return channel.telegramChatId;
  }

  private botUsernameFallback(): string {
    return this.config.get<string>('TG_BOT_USERNAME', 'CampusFlowBot').replace(/^@/, '');
  }

  async sendReminder(
    reminderId: string,
    payload: {
      judul: string;
      waktuTujuan: Date;
      kind: 'TUGAS' | 'AKTIVITAS';
      taskId: string | null;
      eventId: string | null;
    },
  ): Promise<KirimHasil> {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
    });
    if (!reminder) return { terkirim: false, alasan: 'Reminder tidak ditemukan' };
    const chatId = await this.chatIdFor(reminder.userId);
    if (!chatId) return { terkirim: false, alasan: 'Kanal Telegram belum aktif' };
    const client = this.client();
    if (!client) return { terkirim: false, alasan: 'TG_BOT_TOKEN belum diisi' };

    const tombol = new InlineKeyboard();
    if (payload.kind === 'TUGAS' && payload.taskId) {
      tombol.text('Selesai', `done:${payload.taskId}`).row();
    }
    tombol.text('Tunda 5 menit', `snooze:${reminderId}`).row();
    tombol.text('Detail', `detail:${payload.taskId ?? `event:${payload.eventId}`}`);

    const sisaMenit = minutesUntil(payload.waktuTujuan);
    const waktu = payload.kind === 'TUGAS' ? 'tenggat' : 'mulai';
    const teks =
      `*CampusFlow*\n${payload.judul}\n${waktu} ${formatTanggalJam(payload.waktuTujuan)}, sisa ${formatSisa(sisaMenit)}`;

    try {
      const sent = await client.api.sendMessage(chatId, teks, {
        parse_mode: 'Markdown',
        reply_markup: tombol,
      });
      return { terkirim: true, messageId: sent.message_id };
    } catch (galat) {
      await this.tanganiGalatKirim(galat, chatId);
      return { terkirim: false, alasan: (galat as Error).message };
    }
  }

  async editSelesai(chatId: string, messageId: number, teks: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await this.safeCall(() =>
      client.api.editMessageText(chatId, messageId, teks, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] },
      }),
    );
  }

  async jawab(chatId: number | string, callbackId: string, teks: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await this.safeCall(() => client.api.answerCallbackQuery(callbackId, { text: teks }));
  }

  async kirimPesan(chatId: string, teks: string): Promise<KirimHasil> {
    const client = this.client();
    if (!client) return { terkirim: false, alasan: 'TG_BOT_TOKEN belum diisi' };
    try {
      const sent = await client.api.sendMessage(chatId, teks, { parse_mode: 'Markdown' });
      return { terkirim: true, messageId: sent.message_id };
    } catch (galat) {
      await this.tanganiGalatKirim(galat, chatId);
      return { terkirim: false, alasan: (galat as Error).message };
    }
  }

  async kirimKontak(chatId: string): Promise<void> {
    await this.mintaKontak(chatId);
  }

  async mintaKontak(chatId: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await this.safeCall(() =>
      client.api.sendMessage(chatId, 'Pilih **Bagikan kontak** di keyboard lalu kirim kontak sendiri.', {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: 'Bagikan kontak', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }),
    );
  }

  async hapusTombol(chatId: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await this.safeCall(() =>
      client.api.sendMessage(chatId, 'Tombol keyboard dihapus.', { reply_markup: { remove_keyboard: true } }),
    );
  }

  async setWebhook(url: string, secret: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await client.api.setWebhook(url, {
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    await client.api.setMyCommands([
      { command: 'hariini', description: 'Kuliah, tugas, dan aktivitas hari ini' },
      { command: 'tugas', description: 'Lima tugas aktif terdekat' },
      { command: 'mulai', description: 'Aktifkan pesan bot' },
      { command: 'stop', description: 'Matikan pesan bot' },
      { command: 'bantuan', description: 'Daftar perintah' },
    ]);
  }

  async daftarPerintah(chatId: string): Promise<void> {
    await this.kirimPesan(
      chatId,
      [
        '*Perintah CampusFlow*',
        '/hariini - kuliah, tugas, dan aktivitas hari ini',
        '/tugas - lima tugas aktif terdekat',
        '/stop - matikan pesan bot',
        '/mulai - aktifkan kembali pesan bot',
        '/bantuan - daftar ini',
      ].join('\n'),
    );
  }

  async laporkanHariIni(chatId: string, userId: string): Promise<void> {
    const now = new Date();
    const timezone = 'Asia/Jakarta';
    const hariIni = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, weekday: 'long' }).format(
      now,
    );
    const hariKey = this.hariKey(now, timezone);
    const mulaiHari = this.keAwalHari(now, timezone);
    const akhirHari = new Date(mulaiHari.getTime() + 24 * 60 * 60_000 - 1);

    const [tasks, activities, schedules] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, deadline: { gte: mulaiHari, lte: akhirHari }, status: { not: 'SELESAI' } },
        include: { course: true },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: { userId, waktuMulai: { gte: mulaiHari, lte: akhirHari } },
        orderBy: { waktuMulai: 'asc' },
      }),
      this.prisma.schedule.findMany({
        where: { course: { userId } },
        include: { course: true },
      }),
    ]);

    const baris: string[] = [`*Hari ini (${hariIni})*`];

    const jadwalHariIni = schedules
      .filter((s) => s.hari === hariKey || s.isRecurring)
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

    if (jadwalHariIni.length) {
      baris.push('', '*Kuliah*');
      for (const s of jadwalHariIni) {
        baris.push(
          `- ${s.jamMulai}-${s.jamSelesai} ${s.course.namaMatkul}${s.ruang ? ` (${s.ruang})` : ''}`,
        );
      }
    }
    if (tasks.length) {
      baris.push('', '*Tugas*');
      for (const t of tasks) {
        baris.push(`- ${formatJam(t.deadline, timezone)} ${t.judul} (sisa ${formatSisa(minutesUntil(t.deadline, now))})`);
      }
    }
    if (activities.length) {
      baris.push('', '*Aktivitas*');
      for (const a of activities) {
        baris.push(`- ${formatJam(a.waktuMulai, timezone)} ${a.judul}${a.lokasi ? ` (${a.lokasi})` : ''}`);
      }
    }
    if (!jadwalHariIni.length && !tasks.length && !activities.length) {
      baris.push('Tidak ada agenda hari ini.');
    }
    await this.kirimPesan(chatId, baris.join('\n'));
  }

  private hariKey(now: Date, timezone: string): Hari {
    const nama = new Intl.DateTimeFormat('id-ID', { timeZone: timezone, weekday: 'long' }).format(
      now,
    );
    const peta: Record<string, Hari> = {
      Senin: 'SENIN',
      Selasa: 'SELASA',
      Rabu: 'RABU',
      Kamis: 'KAMIS',
      Jumat: 'JUMAT',
      Sabtu: 'SABTU',
      Minggu: 'MINGGU',
    };
    return peta[nama] ?? 'SENIN';
  }

  private keAwalHari(now: Date, timezone: string): Date {
    const bagian = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    return new Date(`${bagian}T00:00:00.000Z`);
  }

  async laporkanTugas(chatId: string, userId: string): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, status: { not: 'SELESAI' } },
      orderBy: { deadline: 'asc' },
      take: 5,
    });
    if (!tasks.length) {
      await this.kirimPesan(chatId, 'Tidak ada tugas aktif.');
      return;
    }
    const now = new Date();
    const baris = tasks.map(
      (t, i) => `${i + 1}. ${t.judul}\n   ${formatTanggalJam(t.deadline)} - sisa ${formatSisa(minutesUntil(t.deadline, now))}`,
    );
    await this.kirimPesan(chatId, ['*Tugas aktif terdekat*', ...baris].join('\n'));
  }

  async kirimDetailTugas(userId: string, taskId: string): Promise<string> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      include: { subtasks: { orderBy: { id: 'asc' } }, course: true },
    });
    if (!task) return 'Tugas tidak ditemukan.';
    const baris = [`*${task.judul}*`, `Tenggat: ${formatTanggalJam(task.deadline)}`];
    if (task.course) baris.push(`Mata kuliah: ${task.course.namaMatkul}`);
    if (task.deskripsi) baris.push('', task.deskripsi);
    const belum = task.subtasks.filter((s) => !s.isDone);
    if (belum.length) {
      baris.push('', '*Sub-tugas belum selesai*');
      for (const s of belum) baris.push(`- ${s.judul}`);
    } else if (task.subtasks.length) {
      baris.push('', 'Semua sub-tugas sudah selesai.');
    }
    return baris.join('\n');
  }

  async kirimDetailAktivitas(userId: string, eventId: string): Promise<string> {
    const event = await this.prisma.activity.findFirst({
      where: { id: eventId, userId },
    });
    if (!event) return 'Aktivitas tidak ditemukan.';
    return [
      `*${event.judul}*`,
      `Mulai: ${formatTanggalJam(event.waktuMulai)}`,
      `Selesai: ${formatTanggalJam(event.waktuSelesai)}`,
      event.lokasi ? `Lokasi: ${event.lokasi}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  registerLinkContext(chatId: string, userId: string): void {
    if (KONTEKS_PENAUTAN.size > BATAS_KONTEKS) {
      const now = Date.now();
      for (const [key, value] of KONTEKS_PENAUTAN) {
        if (value.expiresAt < now) KONTEKS_PENAUTAN.delete(key);
      }
    }
    KONTEKS_PENAUTAN.set(chatId, { userId, expiresAt: Date.now() + LINK_TTL_MS });
  }

  peekLinkContext(chatId: string): string | null {
    const entry = KONTEKS_PENAUTAN.get(chatId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      KONTEKS_PENAUTAN.delete(chatId);
      return null;
    }
    return entry.userId;
  }

  takeLinkContext(chatId: string): string | null {
    const userId = this.peekLinkContext(chatId);
    if (userId) KONTEKS_PENAUTAN.delete(chatId);
    return userId;
  }

  clearLinkContexts(): void {
    KONTEKS_PENAUTAN.clear();
  }

  async botUsername(): Promise<string> {
    const client = this.client();
    if (!client) return this.botUsernameFallback();
    try {
      return (await client.api.getMe()).username;
    } catch {
      return this.botUsernameFallback();
    }
  }
}
