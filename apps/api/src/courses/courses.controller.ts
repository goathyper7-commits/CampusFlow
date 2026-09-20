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
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto';
import { JwtUser } from '../auth/jwt-auth.guard';

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  findAll(@Req() req: { user: JwtUser }) {
    return this.courses.findAll(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateCourseDto) {
    return this.courses.create(req.user.sub, dto);
  }

  @Put(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.courses.remove(req.user.sub, id);
  }
}