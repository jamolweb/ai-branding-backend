import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiService } from './gemini.service';

@Module({
  imports: [ConfigModule, CloudinaryModule, PrismaModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
