import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ChannelType, OtpPurpose } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  OTP_MAX_ATTEMPTS,
  OTP_SEND_LIMIT,
  generateOtpCode,
  hashOtpCode,
  isOtpUsable,
  otpExpiresAt,
  sendWindowBlocked,
} from '../common/otp.util';

export interface OtpDeliveryResult {
  terkirim: boolean;
  channel: ChannelType;
  alasan?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  async request(userId: string, purpose: OtpPurpose): Promise<OtpDeliveryResult> {
    const recent = await this.prisma.otpCode.findMany({
      where: { userId, purpose, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
      select: { sendCount: true, lastSentAt: true },
    });
    if (sendWindowBlocked(recent)) {
      throw new HttpException(
        `Maksimal ${OTP_SEND_LIMIT} permintaan kode per 10 menit. Coba lagi nanti.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const kode = generateOtpCode();
    const now = new Date();
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userChannels: { where: { channel: ChannelType.TELEGRAM, optedIn: true } } },
    });
    const terhubungTelegram = (target?.userChannels.length ?? 0) > 0;

    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
    await this.prisma.otpCode.create({
      data: {
        userId,
        codeHash: hashOtpCode(kode),
        purpose,
        channel: terhubungTelegram ? ChannelType.TELEGRAM : ChannelType.EMAIL,
        expiresAt: otpExpiresAt(now),
        maxAttempts: OTP_MAX_ATTEMPTS,
        sendCount: 1,
        lastSentAt: now,
      },
    });

    if (!terhubungTelegram) {
      this.logger.warn(`[otp] user ${userId} belum terhubung Telegram, kode dibuat tanpa kirim bot`);
      return { terkirim: false, channel: ChannelType.EMAIL, alasan: 'Belum terhubung Telegram' };
    }

    const hasil = await this.telegram.sendOtp(userId, kode, purpose);
    if (!hasil.terkirim) {
      this.logger.warn(`[otp] gagal kirim ke user ${userId}: ${hasil.alasan}`);
      await this.prisma.otpCode.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { channel: ChannelType.EMAIL },
      });
      return {
        terkirim: false,
        channel: ChannelType.EMAIL,
        alasan: hasil.alasan,
      };
    }
    return { terkirim: true, channel: ChannelType.TELEGRAM };
  }

  async verify(userId: string, purpose: OtpPurpose, kode: string): Promise<boolean> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Kode verifikasi tidak ditemukan');
    if (!isOtpUsable(otp)) {
      throw new BadRequestException('Kode verifikasi kadaluarsa atau sudah dipakai');
    }

    if (otp.codeHash !== hashOtpCode(kode.trim())) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Kode verifikasi salah');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date(), attempts: { increment: 1 } },
    });
    return true;
  }
}
