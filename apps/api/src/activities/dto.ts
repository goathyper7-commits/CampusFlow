import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { AKTIVITAS_KATEGORI, ActivityKategori } from '@campusflow/shared-types';

export class CreateActivityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  judul: string;

  @IsIn(AKTIVITAS_KATEGORI)
  kategori: ActivityKategori;

  @IsDateString()
  waktuMulai: string;

  @IsDateString()
  waktuSelesai: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  lokasi?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}