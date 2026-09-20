import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Prioritas, TaskStatus } from '@campusflow/shared-types';

export class CreateTaskDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  judul: string;

  @IsOptional()
  @IsString()
  deskripsi?: string;

  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsIn(['RENDAH', 'SEDANG', 'TINGGI'])
  prioritas?: Prioritas;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class UpdateTaskStatusDto {
  @IsIn(['BELUM_DIKERJAKAN', 'DIKERJAKAN', 'SELESAI', 'TERLAMBAT'])
  status: TaskStatus;
}

export class CreateSubTaskDto {
  @IsString()
  @MinLength(2)
  judul: string;
}

export class UpdateSubTaskDto {
  @IsOptional()
  @IsString()
  judul?: string;

  @IsOptional()
  @IsIn([true, false])
  isDone?: boolean;
}

export class TaskQueryDto {
  @IsOptional()
  @IsIn(['BELUM_DIKERJAKAN', 'DIKERJAKAN', 'SELESAI', 'TERLAMBAT'])
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}