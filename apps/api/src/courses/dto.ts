import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCourseDto {
  @IsString()
  @MaxLength(20)
  kode: string;

  @IsString()
  @MinLength(2)
  namaMatkul: string;

  @IsInt()
  @Min(1)
  @Max(24)
  sks: number;

  @IsOptional()
  @IsString()
  dosen?: string;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}