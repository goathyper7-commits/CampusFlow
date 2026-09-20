import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtUser } from '../auth/jwt-auth.guard';
import { AttachmentsService, StoredFile } from './attachments.service';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('tasks/:taskId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @Req() req: { user: JwtUser },
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: StoredFile,
  ) {
    return this.attachments.upload(req.user, taskId, file);
  }

  @Get('tasks/:taskId/attachments')
  list(
    @Req() req: { user: JwtUser },
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.attachments.list(req.user, taskId);
  }

  @Delete('attachments/:id')
  remove(@Req() req: { user: JwtUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachments.remove(req.user, id);
  }

  @Get('attachments/:id/file')
  @Header('Cache-Control', 'private, max-age=3600')
  async file(
    @Req() req: { user: JwtUser },
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.attachments.getFile(req.user, id);
    res.set({
      'Content-Type': data.fileType,
      'Content-Length': data.buffer.length,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        data.fileName,
      )}"`,
    });
    return new StreamableFile(data.buffer);
  }
}