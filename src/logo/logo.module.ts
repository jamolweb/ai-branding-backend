import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { GeminiModule } from '../gemini/gemini.module';
import { LogoController } from './logo.controller';
import { LogoService } from './logo.service';

@Module({
  imports: [ConfigModule, CloudinaryModule, GeminiModule],
  controllers: [LogoController],
  providers: [LogoService],
})
export class LogoModule {}
