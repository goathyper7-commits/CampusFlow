import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from '../auth/dto';
import { JwtUser } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Req() req: { user: JwtUser }) {
    return this.auth.getProfile(req.user.sub);
  }

  @Patch('me')
  update(@Req() req: { user: JwtUser }, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(req.user.sub, dto);
  }
}