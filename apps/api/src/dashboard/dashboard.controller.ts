import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtUser } from '../auth/jwt-auth.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Req() req: { user: JwtUser }) {
    return this.dashboard.summary(req.user.sub);
  }
}