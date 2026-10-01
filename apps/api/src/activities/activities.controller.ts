import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  findAll(@Req() req: { user: JwtUser }) {
    return this.activities.findAll(req.user.sub);
  }

  @Get('today')
  hariIni(@Req() req: { user: JwtUser }) {
    return this.activities.hariIni(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateActivityDto) {
    return this.activities.create(req.user.sub, dto);
  }

  @Put(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activities.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.activities.remove(req.user.sub, id);
  }
}