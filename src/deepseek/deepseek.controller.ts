import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { LogoService } from '../logo/logo.service';

@Controller('deepseek')
export class DeepseekController {
  constructor(
    private readonly logoService: LogoService,
  ) {}

  @Post('make-prompt-better')
  @HttpCode(HttpStatus.OK)
  async enhancePrompt(@Body('text') text: string) {
    return this.logoService.enhancePrompt({ text });
  }
}
