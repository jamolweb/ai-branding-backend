import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenaiService } from '../openai/openai.service';
import { LogoService } from './logo.service';

@Controller('logo')
@UseGuards(JwtAuthGuard)
export class LogoController {
  constructor(
    private readonly logoService: LogoService,
    private readonly openaiService: OpenaiService,
  ) {}

  @Post('deepseek/make-prompt-better')
  @HttpCode(HttpStatus.OK)
  async enhancePrompt(@Body('text') text: string) {
    return this.logoService.enhancePrompt({ text });
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateLogo(@Body('prompt') prompt: string, @Req() req: any) {
    const result = await this.openaiService.generateLogo(prompt, req.user.id);
    return result;
  }
}
