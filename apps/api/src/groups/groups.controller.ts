import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { JwtUser } from '../auth/jwt-auth.guard';
import { AddMemberDto, CreateTaskGroupDto } from './dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  findAll(@Req() req: { user: JwtUser }) {
    return this.groups.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.groups.findOne(req.user.sub, id);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() dto: CreateTaskGroupDto) {
    return this.groups.create(req.user.sub, dto);
  }

  @Post(':id/members')
  addMember(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.groups.addMember(req.user.sub, id, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groups.removeMember(req.user.sub, id, memberId);
  }

  @Post(':id/leave')
  leave(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.groups.leave(req.user.sub, id);
  }

  @Delete(':id')
  remove(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.groups.remove(req.user.sub, id);
  }
}