import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { ChannelsService } from './channels.service';
import { TelegramUpdatesService, TelegramUpdate } from '../telegram/telegram.updates';
import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '@campusflow/database';

const PURPOSE_VALID: OtpPurpose[] = [
  'REGISTER',
  'LOGIN_PERANGKAT_BARU',
  'LUPA_SANDI',
  'GANTI_USERNAME',
  'GANTI_NOMOR',
];

function cekPurpose(purpose: string): OtpPurpose {
  if (!PURPOSE_VALID.includes(purpose as OtpPurpose)) {
    throw new BadRequestException('Purpose kode verifikasi tidak valid');
  }
  return purpose as OtpPurpose;
}

@Controller('channels')
export class ChannelsController {
  constructor(
    private channels: ChannelsService,
    private otp: OtpService,
  ) {}

  @Post('telegram/link')
  async link(@Req() req: { user: JwtUser }) {
    return this.channels.createLinkToken(req.user.sub);
  }

  @Get('telegram/status')
  async status(@Req() req: { user: JwtUser }) {
    return this.channels.status(req.user.sub);
  }

  @Delete('telegram')
  async unlink(@Req() req: { user: JwtUser }) {
    return this.channels.unlink(req.user.sub);
  }

  @Post('otp/request')
  async requestOtp(@Req() req: { user: JwtUser }, @Body('purpose') purpose: string) {
    return this.otp.request(req.user.sub, cekPurpose(purpose));
  }

  @Post('otp/verify')
  async verifyOtp(
    @Req() req: { user: JwtUser },
    @Body('purpose') purpose: string,
    @Body('kode') kode: string,
  ) {
    if (!kode) throw new BadRequestException('Kode verifikasi wajib diisi');
    const sah = await this.otp.verify(req.user.sub, cekPurpose(purpose), kode);
    return { sah };
  }
}

@Controller('telegram')
export class TelegramWebhookController {
  constructor(@Inject(TelegramUpdatesService) private updates: TelegramUpdatesService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    const expected = this.updates.webhookSecret();
    if (!expected) {
      throw new UnauthorizedException('Webhook belum dikonfigurasi');
    }
    if (secret !== expected) {
      throw new UnauthorizedException('Secret token tidak cocok');
    }
    if (!update?.update_id) {
      throw new BadRequestException('Body tidak valid');
    }
    await this.updates.handleUpdate(update);
    return { ok: true };
  }
}
