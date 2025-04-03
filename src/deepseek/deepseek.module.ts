import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepseekController } from './deepseek.controller';
import { DeepseekService } from './deepseek.service';

@Module({
  imports: [ConfigModule],
  controllers: [DeepseekController],
  providers: [DeepseekService],
})
export class DeepseekModule {}
