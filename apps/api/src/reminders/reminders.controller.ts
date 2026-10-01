import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { CreateReminderDto, ReplaceEventRemindersDto, UpdateReminderDto } from './dto';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  findAll(@Req() req: { user: JwtUser }) {
    return this.reminders.findAll(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateReminderDto) {
    return this.reminders.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.reminders.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.reminders.remove(req.user.sub, id);
  }

  @Get('events/:eventId')
  listByEvent(@Req() req: { user: JwtUser }, @Param('eventId') eventId: string) {
    return this.reminders.listByEvent(req.user.sub, eventId);
  }

  @Put('events/:eventId')
  replaceForEvent(
    @Req() req: { user: JwtUser },
    @Param('eventId') eventId: string,
    @Body() dto: ReplaceEventRemindersDto,
  ) {
    return this.reminders.replaceForEvent(req.user.sub, eventId, dto.offsetMinutes);
  }
}