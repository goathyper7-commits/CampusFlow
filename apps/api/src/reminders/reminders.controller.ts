import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { CreateReminderDto, UpdateReminderDto } from './dto';
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
}