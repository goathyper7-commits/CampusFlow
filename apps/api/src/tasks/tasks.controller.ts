import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import {
  CreateSubTaskDto,
  CreateTaskDto,
  TaskQueryDto,
  UpdateSubTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto';
import { JwtUser } from '../auth/jwt-auth.guard';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll(
    @Req() req: { user: JwtUser },
    @Query() query: TaskQueryDto,
  ) {
    return this.tasks.findAll(req.user.sub, query);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.sub, dto);
  }

  @Put(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(req.user.sub, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasks.updateStatus(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.tasks.remove(req.user.sub, id);
  }

  @Post(':id/subtasks')
  addSubTask(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: CreateSubTaskDto,
  ) {
    return this.tasks.addSubTask(req.user.sub, id, dto);
  }

  @Patch(':id/subtasks/:subtaskId')
  updateSubTask(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubTaskDto,
  ) {
    return this.tasks.updateSubTask(req.user.sub, id, subtaskId, dto);
  }

  @Patch(':id/subtasks/:subtaskId/toggle')
  toggleSubTask(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.tasks.toggleSubTask(req.user.sub, id, subtaskId);
  }

  @Delete(':id/subtasks/:subtaskId')
  removeSubTask(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    return this.tasks.removeSubTask(req.user.sub, id, subtaskId);
  }
}