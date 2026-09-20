import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTaskGroupDto {
  @IsUUID()
  taskId: string;
}

export class AddMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nim: string;
}