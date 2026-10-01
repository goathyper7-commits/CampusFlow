import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestOtpDto,
  VerifyProfileChangeDto,
} from './dto';
import { Public } from './public.decorator';
import { JwtUser } from './jwt-auth.guard';

const REFRESH_COOKIE = 'refresh_token';

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ) {
    const result = await this.auth.register(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('otp/request')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtpPublik(dto.email, dto.purpose);
  }

  @Public()
  @Post('login')
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const result = await this.auth.login(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('profile/verify')
  async verifyProfile(
    @Req() req: { user: JwtUser },
    @Body() dto: VerifyProfileChangeDto,
  ) {
    return { user: await this.auth.verifyProfileChange(req.user.sub, dto.purpose, dto.kode) };
  }

  @Public()
  @Post('refresh-token')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string) ?? dto.refreshToken;
    const result = await this.auth.refresh(token);
    if (req.cookies?.[REFRESH_COOKIE]) {
      res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());
    }
    return { user: result.user, accessToken: result.accessToken };
  }
}