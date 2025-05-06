import { Module } from '@nestjs/common';
import { DeepseekController } from './deepseek.controller';
import { LogoModule } from '../logo/logo.module';

@Module({
  imports: [LogoModule],
  controllers: [DeepseekController],
})
export class DeepseekModule { }
