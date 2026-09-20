import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateReminderDto {
  @IsUUID()
  taskId: string;

  @IsInt()
  @Min(1)
  @Max(8760)
  offsetHours: number;
}

export class UpdateReminderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  offsetHours?: number;
}