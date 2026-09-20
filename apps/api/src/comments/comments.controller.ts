import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';
import { JwtUser } from '../auth/jwt-auth.guard';

class CommentQueryDto {
  @IsUUID()
  taskId!: string;
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  findAll(
    @Req() req: { user: JwtUser },
    @Query() query: CommentQueryDto,
  ) {
    return this.comments.findAll(req.user, query.taskId);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateCommentDto) {
    return this.comments.create(req.user, dto);
  }

  @Patch(':id')
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(req.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.comments.remove(req.user, id);
  }
}