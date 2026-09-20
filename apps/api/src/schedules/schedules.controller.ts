import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import {
  ConflictCheckQueryDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto';
import { JwtUser } from '../auth/jwt-auth.guard';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get('conflict-check')
  conflictCheck(
    @Req() req: { user: JwtUser },
    @Query() query: ConflictCheckQueryDto,
  ) {
    return this.schedules.conflictCheck(req.user.sub, query);
  }

  @Get()
  findAll(
    @Req() req: { user: JwtUser },
    @Query('courseId') courseId?: string,
  ) {
    return this.schedules.findAll(req.user.sub, courseId);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateScheduleDto) {
    return this.schedules.create(req.user.sub, dto);
  }

  @Put(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedules.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.schedules.remove(req.user.sub, id);
  }
}