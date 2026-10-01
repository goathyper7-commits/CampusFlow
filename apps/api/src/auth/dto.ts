import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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

  @IsOptional()
  @Matches(USERNAME_PATTERN)
  username?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneE164?: string;
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

  @IsOptional()
  @Matches(USERNAME_PATTERN)
  username?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneE164?: string;
}

export class RequestOtpDto {
  @IsEmail()
  email: string;

  @IsIn(['REGISTER', 'LOGIN_PERANGKAT_BARU', 'LUPA_SANDI'])
  purpose: 'REGISTER' | 'LOGIN_PERANGKAT_BARU' | 'LUPA_SANDI';
}

export class VerifyProfileChangeDto {
  @IsIn(['GANTI_USERNAME', 'GANTI_NOMOR'])
  purpose: 'GANTI_USERNAME' | 'GANTI_NOMOR';

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  kode: string;
}