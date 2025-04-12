import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
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
  ) {
    return this.chatService.sendMessage(userId, body.sessionId, body.message);
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
