import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserProfile } from '@campusflow/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto';

export interface TokenPayload {
  id: string;
  nim: string;
  nama: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private otp: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { nim: dto.nim }] },
    });
    if (exists) throw new ConflictException('Email atau NIM sudah terdaftar');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password: _pw, ...rest } = dto;
    const user = await this.prisma.user.create({
      data: { ...rest, passwordHash },
    });

    return { user: this.toProfile(user), ...this.signTokens(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Email atau password salah');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email atau password salah');

    return { user: this.toProfile(user), ...this.signTokens(user) };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('User tidak ditemukan');

    return { user: this.toProfile(user), ...this.signTokens(user) };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    if (dto.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (dup && dup.id !== userId) {
        throw new ConflictException('Email sudah digunakan');
      }
    }
    if (dto.username) {
      const dup = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (dup && dup.id !== userId) {
        throw new ConflictException('Username sudah digunakan');
      }
    }
    if (dto.phoneE164) {
      const dup = await this.prisma.user.findUnique({ where: { phoneE164: dto.phoneE164 } });
      if (dup && dup.id !== userId) {
        throw new ConflictException('Nomor HP sudah digunakan');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        prodi: dto.prodi,
        semester: dto.semester,
        nama: dto.nama,
        nim: dto.nim,
        email: dto.email,
        username: dto.username,
        phoneE164: dto.phoneE164,
        usernameChangedAt: dto.username ? new Date() : undefined,
        phoneVerifiedAt: dto.phoneE164 ? null : undefined,
      },
    });

    if (dto.username) {
      await this.prisma.usernameHistory.create({
        data: { userId, username: dto.username },
      });
    }
    return this.toProfile(user);
  }

  async requestOtpPublik(
    email: string,
    purpose: 'REGISTER' | 'LOGIN_PERANGKAT_BARU' | 'LUPA_SANDI',
  ): Promise<{ terkirim: boolean; alasan?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { terkirim: false, alasan: 'Akun tidak ditemukan atau kanal belum terhubung' };
    }
    if (purpose === 'REGISTER') {
      return { terkirim: false, alasan: 'Akun sudah terdaftar' };
    }
    const hasil = await this.otp.request(user.id, purpose);
    return { terkirim: hasil.terkirim, alasan: hasil.alasan };
  }

  async verifyProfileChange(
    userId: string,
    purpose: 'GANTI_USERNAME' | 'GANTI_NOMOR',
    kode: string,
  ): Promise<UserProfile> {
    await this.otp.verify(userId, purpose, kode);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: purpose === 'GANTI_NOMOR' ? { phoneVerifiedAt: new Date() } : {},
    });
    return this.toProfile(user);
  }

  signTokens(user: TokenPayload) {
    const payload = {
      sub: user.id,
      nim: user.nim,
      nama: user.nama,
      role: user.role,
    };
    return {
      accessToken: this.jwt.sign(
        { ...payload, type: 'access' },
        { expiresIn: '15m' },
      ),
      refreshToken: this.jwt.sign(
        { ...payload, type: 'refresh' },
        { expiresIn: '7d' },
      ),
    };
  }

  private toProfile(
    user: {
      id: string;
      nim: string;
      nama: string;
      email: string;
      prodi: string | null;
      semester: number | null;
      username: string | null;
      phoneE164: string | null;
      phoneVerifiedAt: Date | null;
      role: string;
      createdAt: Date;
    },
  ): UserProfile {
    return {
      id: user.id,
      nim: user.nim,
      nama: user.nama,
      email: user.email,
      prodi: user.prodi,
      semester: user.semester,
      username: user.username,
      phoneE164: user.phoneE164,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      role: user.role as UserProfile['role'],
      createdAt: user.createdAt.toISOString(),
    };
  }
}