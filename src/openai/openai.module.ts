import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { OpenaiService } from './openai.service';

@Module({
  imports: [ConfigModule, CloudinaryModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
