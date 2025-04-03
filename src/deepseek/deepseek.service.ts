import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';

@Injectable()
export class DeepseekService {
  constructor(private readonly configService: ConfigService) {}

  async enhancePrompt(dto: EnhancePromptDto): Promise<string> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    try {
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
                  'You are a prompt engineering expert. Your task is to enhance the given text to make it a better prompt for AI image generation. Make it more specific, detailed, and effective while maintaining the original intent.',
              },
              {
                role: 'user',
                content: dto.text,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      throw new Error(`Failed to enhance prompt: ${error.message}`);
    }
  }
}
