import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MaxLength(20)
  nim: string;

  @IsString()
  @MinLength(2)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  prodi?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nim?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  nama?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  prodi?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  semester?: number;
}