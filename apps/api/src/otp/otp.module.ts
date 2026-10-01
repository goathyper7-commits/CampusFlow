import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { OtpService } from './otp.service';

@Module({
  imports: [TelegramModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
