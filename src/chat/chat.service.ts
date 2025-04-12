import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private readonly deepseekApiKey: string;
  private readonly deepseekApiUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    this.deepseekApiUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  async createChatSession(userId: string) {
    return this.prisma.chatSession.create({
      data: {
        userId,
      },
    });
  }

  async getChatHistory(sessionId: string, limit: number = 10) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async sendMessage(
    userId: string,
    sessionId: string | undefined,
    content: string,
  ) {
    // Get or create session
    let session;

    if (sessionId) {
      session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
    }

    if (!session) {
      session = await this.createChatSession(userId);
    }

    // Get chat history for context
    const history = await this.getChatHistory(session.id);

    // Format messages for DeepSeek API
    const messages = [
      {
        role: 'system',
        content:
          'You are a helpful AI branding assistant. Provide clear, concise, and professional responses about branding, marketing, and business strategy.',
      },
      ...history.map((msg) => ({
        role: msg.role.toLowerCase(),
        content: msg.content,
      })),
      {
        role: 'user',
        content,
      },
    ];

    try {
      // Call DeepSeek API
      const response = await axios.post(
        this.deepseekApiUrl,
        {
          messages,
          model: 'deepseek-chat',
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const aiResponse = response.data.choices[0].message.content;
      const tokensUsed = response.data.usage.total_tokens;

      // Save both messages to database
      await this.prisma.$transaction([
        this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'USER',
            content,
          },
        }),
        this.prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'ASSISTANT',
            content: aiResponse,
            tokensUsed,
          },
        }),
      ]);

      return {
        response: aiResponse,
        sessionId: session.id,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get AI response',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
