import {
  Body,
  Controller,
  Get,
  Logger,
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
  constructor(private readonly chatService: ChatService) { }

  private readonly logger = new Logger(ChatController.name);

  @Post('send')
  async sendMessage(
    @GetUser('id') userId: string,
    @Body() body: { sessionId?: string; message: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let chunkCount = 0;
    try {
      for await (const chunk of this.chatService.streamMessage(
        userId,
        body.sessionId,
        body.message,
      )) {
        if (!chunk) {
          this.logger.warn('Received empty chunk from streamMessage');
          continue;
        }
        chunkCount++;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      if (chunkCount === 0) {
        this.logger.warn(`No chunks were streamed for user ${userId}`);
      }
      res.end();
    } catch (error) {
      this.logger.error(
        `Error in chat stream for user ${userId}: ${error.message}`,
        error.stack,
      );
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process message' });
      } else {
        res.end();
      }
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
