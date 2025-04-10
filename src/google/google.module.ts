import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { GeminiService } from './google.service';

@Module({
  imports: [ConfigModule, CloudinaryModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
