import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  async sendMessage(
    @GetUser('id') userId: string,
    @Body() body: { sessionId?: string; message: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.chatService.streamMessage(
        userId,
        body.sessionId,
        body.message,
      )) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.end();
    } catch (error) {
      res.status(500).json({ error: 'Failed to process message' });
    }
  }

  @Get('sessions')
  async getUserSessions(@GetUser('id') userId: string) {
    return this.chatService.getUserSessions(userId);
  }

  @Get('history/:sessionId')
  async getChatHistory(
    @GetUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getChatHistory(sessionId);
  }
}
