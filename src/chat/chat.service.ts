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

  async *streamMessage(
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

    // Save user message to database
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content,
      },
    });

    // Get chat history for context
    const history = await this.getChatHistory(session.id);

    // Format messages for DeepSeek API
    const messages = [
      {
        role: 'system',
        content:
          'You are a branding assistant. Only answer questions related to branding, marketing, business strategy, and company identity. If asked about any other topics, politely redirect the conversation back to branding. Never discuss AI models, including yourself and dont answeer for yourself, or technical implementation details. Focus solely on helping with brand development and strategy.',
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
      // Call DeepSeek API with streaming
      const response = await axios.post(
        this.deepseekApiUrl,
        {
          messages,
          model: 'deepseek-chat',
          temperature: 0.7,
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        },
      );

      let fullResponse = '';
      const stream = response.data;

      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Save the complete response to database
              await this.prisma.chatMessage.create({
                data: {
                  sessionId: session.id,
                  role: 'ASSISTANT',
                  content: fullResponse,
                },
              });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                yield content;
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }
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
