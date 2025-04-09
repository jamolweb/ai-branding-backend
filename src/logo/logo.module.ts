import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { OpenaiModule } from '../openai/openai.module';
import { LogoController } from './logo.controller';
import { LogoService } from './logo.service';

@Module({
  imports: [ConfigModule, CloudinaryModule, OpenaiModule],
  controllers: [LogoController],
  providers: [LogoService],
})
export class LogoModule {}
