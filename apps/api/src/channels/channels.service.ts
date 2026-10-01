import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { ChannelType } from '@campusflow/database';
import { TelegramLinkResponse, TelegramStatus } from '@campusflow/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@campusflow/database';

export const LINK_TOKEN_TTL_MS = 10 * 60_000;
export const LINK_TOKEN_BYTES = 32;

function toE164(input: string): string {
  const angka = input.replace(/[^\d+]/g, '');
  if (angka.startsWith('+')) return angka;
  if (angka.startsWith('0')) return `+62${angka.slice(1)}`;
  if (angka.startsWith('62')) return `+${angka}`;
  return `+62${angka}`;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  botUsername(): string {
    return this.config.get<string>('TG_BOT_USERNAME', 'CampusFlowBot').replace(/^@/, '');
  }

  async createLinkToken(userId: string): Promise<TelegramLinkResponse> {
    const token = randomBytes(LINK_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
    await this.prisma.telegramLinkToken.create({
      data: { userId, tokenHash: tokenHash(token), expiresAt },
    });
    return {
      url: `https://t.me/${this.botUsername()}?start=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async consumeLinkToken(token: string): Promise<string> {
    const hash = tokenHash(token);
    const record = await this.prisma.telegramLinkToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!record) throw new NotFoundException('Token penautan tidak dikenal');
    if (record.usedAt) throw new NotFoundException('Token penautan sudah dipakai');
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Token penautan kedaluwarsa');
    }
    await this.prisma.telegramLinkToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record.userId;
  }

  async verifyContact(userId: string, chatId: string, contact: {
    telegramUserId: string;
    phoneNumber: string;
  }): Promise<{ cocok: boolean; alasan?: string }> {
    const sudah = await this.prisma.userChannel.findUnique({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      select: { telegramChatId: true },
    });
    if (sudah?.telegramChatId && sudah.telegramChatId !== chatId) {
      return { cocok: false, alasan: 'Akun ini sudah tertaut ke chat Telegram lain' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneE164: true },
    });
    if (!user?.phoneE164) {
      return { cocok: false, alasan: 'Nomor HP belum diisi di profil' };
    }
    if (toE164(contact.phoneNumber) !== user.phoneE164) {
      return { cocok: false, alasan: 'Nomor kontak tidak sama dengan nomor profil' };
    }

    const bentrok = await this.prisma.userChannel.findFirst({
      where: {
        channel: ChannelType.TELEGRAM,
        telegramChatId: chatId,
        userId: { not: userId },
      },
    });
    if (bentrok) {
      return { cocok: false, alasan: 'Chat ini sudah tertaut ke akun lain' };
    }

    await this.prisma.userChannel.upsert({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      create: {
        userId,
        channel: ChannelType.TELEGRAM,
        telegramChatId: chatId,
        verifiedAt: new Date(),
        optedIn: true,
      },
      update: {
        telegramChatId: chatId,
        verifiedAt: new Date(),
        optedIn: true,
        optedOutAt: null,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
    return { cocok: true };
  }

  async status(userId: string): Promise<TelegramStatus> {
    const channel = await this.prisma.userChannel.findUnique({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
    });
    if (!channel) {
      return { terhubung: false, chatId: null, username: null, optedIn: false, verifiedAt: null };
    }
    return {
      terhubung: Boolean(channel.telegramChatId && channel.verifiedAt),
      chatId: channel.telegramChatId,
      username: channel.telegramUsername,
      optedIn: channel.optedIn,
      verifiedAt: channel.verifiedAt?.toISOString() ?? null,
    };
  }

  async setUsername(chatId: string, username: string | null): Promise<void> {
    await this.prisma.userChannel.updateMany({
      where: { channel: ChannelType.TELEGRAM, telegramChatId: chatId },
      data: { telegramUsername: username },
    });
  }

  async setOptedIn(userId: string, optedIn: boolean): Promise<void> {
    await this.prisma.userChannel.update({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      data: {
        optedIn,
        optedOutAt: optedIn ? null : new Date(),
      },
    });
  }

  async markOptedOut(chatId: string): Promise<void> {
    await this.prisma.userChannel.updateMany({
      where: { channel: ChannelType.TELEGRAM, telegramChatId: chatId },
      data: { optedIn: false, optedOutAt: new Date() },
    });
  }

  async unlink(userId: string): Promise<{ message: string }> {
    try {
      await this.prisma.userChannel.delete({
        where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      });
    } catch (galat) {
      if (galat instanceof Prisma.PrismaClientKnownRequestError && galat.code === 'P2025') {
        throw new NotFoundException('Kanal Telegram belum tertaut');
      }
      throw galat;
    }
    return { message: 'Kanal Telegram diputus' };
  }

  async userForChat(chatId: string): Promise<string | null> {
    const channel = await this.prisma.userChannel.findUnique({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    return channel?.userId ?? null;
  }

  async setBotEnabled(userId: string, aktif: boolean): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { botEnabled: aktif } });
  }

  async botEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { botEnabled: true },
    });
    return user?.botEnabled ?? true;
  }

  async chatIdFor(userId: string): Promise<string | null> {
    const channel = await this.prisma.userChannel.findUnique({
      where: { userId_channel: { userId, channel: ChannelType.TELEGRAM } },
      select: { telegramChatId: true, optedIn: true },
    });
    if (!channel?.optedIn || !channel.telegramChatId) return null;
    return channel.telegramChatId;
  }

  async requireChatId(userId: string): Promise<string> {
    const chatId = await this.chatIdFor(userId);
    if (!chatId) {
      throw new ServiceUnavailableException('Kanal Telegram belum terhubung');
    }
    return chatId;
  }
}
