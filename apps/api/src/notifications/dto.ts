import {
  IsBoolean,
  IsBooleanString,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}

export class SavePushSubscriptionDto {
  @IsUrl({ require_protocol: true })
  endpoint: string;

  @IsString()
  @MinLength(10)
  p256dh: string;

  @IsString()
  @MinLength(5)
  auth: string;
}

export class RemovePushSubscriptionDto {
  @IsUrl({ require_protocol: true })
  endpoint: string;
}

export class UpdatePreferenceDto {
  @IsOptional()
  @IsBoolean()
  autoRemindersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}