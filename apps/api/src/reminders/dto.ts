import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReminderDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsInt()
  @Min(1)
  @Max(525600)
  offsetMinutes: number;
}

export class UpdateReminderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(525600)
  offsetMinutes?: number;
}

export class ReplaceEventRemindersDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(525600, { each: true })
  offsetMinutes: number[];
}
