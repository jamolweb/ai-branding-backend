import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';

@Injectable()
export class DeepseekService {
  private readonly API_TIMEOUT = 10000; // 10 seconds timeout

  constructor(private readonly configService: ConfigService) {}

  async enhancePrompt(dto: EnhancePromptDto): Promise<string> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new HttpException(
        'DEEPSEEK_API_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const response = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content:
                  'You are a prompt engineering expert. Enhance the given text to make it a better prompt for AI image generation. Be concise but specific. Keep the response minimalistic to the point.',
              },
              {
                role: 'user',
                content: dto.text,
              },
            ],
            temperature: 0.5,
            max_tokens: 150,
            presence_penalty: 0,
            frequency_penalty: 0,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpException(
          `DeepSeek API error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Request timeout: DeepSeek API took too long to respond',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new HttpException(
        `Failed to enhance prompt: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
