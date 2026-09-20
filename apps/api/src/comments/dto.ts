import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  taskId!: string;

  @IsString()
  @Length(1, 1000)
  @IsNotEmpty()
  isi!: string;
}

export class UpdateCommentDto {
  @IsString()
  @Length(1, 1000)
  @IsNotEmpty()
  isi!: string;
}