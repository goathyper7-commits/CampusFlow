import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { HARI_OPTIONS, Hari } from '@campusflow/shared-types';

export class CreateScheduleDto {
  @IsUUID()
  courseId: string;

  @IsIn(HARI_OPTIONS)
  hari: Hari;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'jamMulai harus format HH:mm',
  })
  jamMulai: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'jamSelesai harus format HH:mm',
  })
  jamSelesai: string;

  @IsOptional()
  @IsString()
  ruang?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}

export class ConflictCheckQueryDto {
  @IsIn(HARI_OPTIONS)
  hari: Hari;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  jamMulai: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  jamSelesai: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}