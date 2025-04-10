import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenaiService } from '../openai/openai.service';
import { FavoriteLogoDto } from './dto/favorite-logo.dto';
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

  @Get('my-logos')
  @HttpCode(HttpStatus.OK)
  async getMyLogos(@Req() req: any) {
    return this.logoService.getUserLogos(req.user.id);
  }

  @Get('favorites')
  @HttpCode(HttpStatus.OK)
  async getFavorites(@Req() req: any) {
    return this.logoService.getUserFavorites(req.user.id);
  }

  @Post('favorites')
  @HttpCode(HttpStatus.OK)
  async addToFavorites(@Body() dto: FavoriteLogoDto, @Req() req: any) {
    return this.logoService.addToFavorites(req.user.id, dto.logoId);
  }

  @Delete('favorites/:logoId')
  @HttpCode(HttpStatus.OK)
  async removeFromFavorites(@Param('logoId') logoId: string, @Req() req: any) {
    return this.logoService.removeFromFavorites(req.user.id, logoId);
  }

  @Get('favorites/:logoId/status')
  @HttpCode(HttpStatus.OK)
  async checkFavoriteStatus(@Param('logoId') logoId: string, @Req() req: any) {
    return this.logoService.isLogoFavorited(req.user.id, logoId);
  }
}
