import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeepseekService } from './deepseek.service';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';

@Controller('deepseek')
@UseGuards(JwtAuthGuard)
export class DeepseekController {
  constructor(private readonly deepseekService: DeepseekService) {}

  @Post('logo/make-prompt-better')
  async enhancePrompt(
    @Body() dto: EnhancePromptDto,
  ): Promise<{ enhancedPrompt: string }> {
    const enhancedPrompt = await this.deepseekService.enhancePrompt(dto);

    return { enhancedPrompt };
  }
}
