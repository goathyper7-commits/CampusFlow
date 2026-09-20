import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import {
  NotificationQueryDto,
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
  UpdatePreferenceDto,
} from './dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(
    @Req() req: { user: JwtUser },
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.findAll(req.user.sub, query);
  }

  @Patch(':id/read')
  markRead(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: JwtUser }) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Delete()
  clearAll(@Req() req: { user: JwtUser }) {
    return this.notifications.clearAll(req.user.sub);
  }

  @Post('subscriptions')
  saveSubscription(
    @Req() req: { user: JwtUser },
    @Body() dto: SavePushSubscriptionDto,
  ) {
    return this.notifications.saveSubscription(req.user.sub, dto);
  }

  @Delete('subscriptions')
  removeSubscription(
    @Req() req: { user: JwtUser },
    @Body() dto: RemovePushSubscriptionDto,
  ) {
    return this.notifications.removeSubscription(req.user.sub, dto);
  }

  @Get('preferences')
  getPreferences(@Req() req: { user: JwtUser }) {
    return this.notifications.getPreferences(req.user.sub);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: { user: JwtUser },
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.notifications.updatePreferences(req.user.sub, dto);
  }
}