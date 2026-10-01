import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from '../channels/channels.service';
import { RemindersService } from '../reminders/reminders.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramUpdatesService {
  constructor(
    private channels: ChannelsService,
    private reminders: RemindersService,
    private telegram: TelegramService,
    private config: ConfigService,
  ) {}

  webhookSecret(): string {
    return this.config.get<string>('TG_WEBHOOK_SECRET', '');
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) await this.handleMessage(update.message);
    if (update.callback_query) await this.handleCallback(update.callback_query);
  }

  private async handleMessage(msg: TelegramMessage): Promise<void> {
    const chatId = String(msg.chat.id);
    const text = (msg.text ?? '').trim();

    if (text.startsWith('/start')) {
      await this.handleStart(chatId, text.split(/\s+/, 2)[1]);
      return;
    }

    if (msg.contact) {
      await this.handleContact(chatId, msg.from, msg.contact);
      return;
    }

    const userId = await this.channels.userForChat(chatId);
    if (!userId) {
      await this.telegram.kirimPesan(
        chatId,
        'Akun ini belum tertaut. Buka aplikasi CampusFlow, pilih **Hubungkan Telegram**, lalu tekan Start di sini.',
      );
      return;
    }

    const [command] = text.split(/\s+/, 2);
    switch (command) {
      case '/hariini':
        await this.telegram.laporkanHariIni(chatId, userId);
        return;
      case '/tugas':
        await this.telegram.laporkanTugas(chatId, userId);
        return;
      case '/stop':
        await this.channels.setOptedIn(userId, false);
        await this.channels.setBotEnabled(userId, false);
        await this.telegram.kirimPesan(
          chatId,
          'Pesan bot dimatikan. Kirim /mulai untuk mengaktifkan lagi.',
        );
        return;
      case '/mulai':
        await this.channels.setOptedIn(userId, true);
        await this.channels.setBotEnabled(userId, true);
        await this.telegram.kirimPesan(chatId, 'Pesan bot aktif kembali.');
        return;
      case '/bantuan':
        await this.telegram.daftarPerintah(chatId);
        return;
      case '/start':
        await this.telegram.daftarPerintah(chatId);
        return;
      default:
        await this.telegram.kirimPesan(chatId, 'Perintah tidak dikenal. Kirim /bantuan.');
    }
  }

  private async handleStart(chatId: string, token?: string): Promise<void> {
    await this.channels.setUsername(chatId, await this.telegram.botUsername());

    if (!token) {
      const userId = await this.channels.userForChat(chatId);
      await this.telegram.kirimPesan(
        chatId,
        userId
          ? 'Telegram sudah terhubung. Kirim /bantuan untuk melihat perintah.'
          : 'Mulai penautan dari aplikasi CampusFlow: **Hubungkan Telegram**, lalu tekan tombol Start di sini.',
      );
      return;
    }

    let userId: string | null = null;
    try {
      userId = await this.channels.consumeLinkToken(token);
    } catch {
      userId = null;
    }
    if (!userId) {
      await this.telegram.kirimPesan(
        chatId,
        'Token penautan tidak dikenal atau sudah kedaluwarsa. Buat tautan baru dari aplikasi CampusFlow.',
      );
      return;
    }

    this.telegram.registerLinkContext(chatId, userId);
    await this.telegram.kirimPesan(
      chatId,
      'Terima kasih. Sekarang tekan tombol **Bagikan kontak** di keyboard lalu pilih kontak Anda sendiri.',
    );
    await this.telegram.mintaKontak(chatId);
  }

  private async handleContact(
    chatId: string,
    from: { id: number | string; username?: string },
    contact: TelegramContact,
  ): Promise<void> {
    if (String(contact.user_id) !== String(from.id)) {
      await this.telegram.mintaKontak(chatId);
      await this.telegram.kirimPesan(
        chatId,
        'Kontak harus milik Anda sendiri. Pilih **Bagikan kontak** pada akun ini.',
      );
      return;
    }

    const userId = this.telegram.peekLinkContext(chatId) ?? (await this.channels.userForChat(chatId));
    if (!userId) {
      await this.telegram.kirimPesan(
        chatId,
        'Belum ada proses penautan untuk chat ini. Buat tautan baru dari aplikasi CampusFlow.',
      );
      return;
    }

    const hasil = await this.channels.verifyContact(userId, chatId, {
      telegramUserId: String(contact.user_id),
      phoneNumber: contact.phone_number,
    });
    if (!hasil.cocok) {
      await this.telegram.mintaKontak(chatId);
      await this.telegram.kirimPesan(
        chatId,
        `Verifikasi gagal: ${hasil.alasan}. Pilih **Bagikan kontak** milik Anda sendiri.`,
      );
      return;
    }

    this.telegram.takeLinkContext(chatId);
    await this.channels.setUsername(chatId, from.username ?? (await this.telegram.botUsername()));
    await this.telegram.hapusTombol(chatId);
    await this.telegram.kirimPesan(
      chatId,
      'Telegram terhubung. Pengingat tugas dan aktivitas akan dikirim ke sini. Kirim /bantuan untuk daftar perintah.',
    );
  }

  private async handleCallback(cb: TelegramCallbackQuery): Promise<void> {
    const chatId = String(cb.message?.chat.id ?? cb.from.id);
    const data = cb.data ?? '';
    const pemisah = data.indexOf(':');
    const aksi = pemisah === -1 ? data : data.slice(0, pemisah);
    const id = pemisah === -1 ? '' : data.slice(pemisah + 1);

    const userId = await this.channels.userForChat(chatId);
    if (!userId) {
      await this.telegram.jawab(chatId, cb.id, 'Akun tidak tertaut');
      return;
    }

    if (aksi === 'done' && id) {
      const task = await this.reminders.markTaskSelesai(userId, id);
      if (!task) {
        await this.telegram.jawab(chatId, cb.id, 'Tugas tidak ditemukan');
        return;
      }
      if (cb.message?.message_id) {
        await this.telegram.editSelesai(
          chatId,
          cb.message.message_id,
          `*CampusFlow*\n${task.judul}\nStatus: Selesai`,
        );
      }
      await this.telegram.jawab(chatId, cb.id, 'Tugas ditandai selesai');
      return;
    }

    if (aksi === 'snooze' && id) {
      const hasil = await this.reminders.snooze(userId, id);
      await this.telegram.jawab(
        chatId,
        cb.id,
        hasil.terkirim ? 'Pengingat ditunda 5 menit' : (hasil.alasan ?? 'Tidak bisa ditunda'),
      );
      return;
    }

    if (aksi === 'detail' && id) {
      const teks = id.startsWith('event:')
        ? await this.telegram.kirimDetailAktivitas(userId, id.slice('event:'.length))
        : await this.telegram.kirimDetailTugas(userId, id);
      await this.telegram.kirimPesan(chatId, teks);
      await this.telegram.jawab(chatId, cb.id, 'Detail dikirim');
      return;
    }

    await this.telegram.jawab(chatId, cb.id, 'Perintah tidak dikenal');
  }
}

export interface TelegramContact {
  user_id: number | string;
  phone_number: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number | string };
  from: { id: number | string; username?: string };
  text?: string;
  contact?: TelegramContact;
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from: { id: number | string; username?: string };
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}
