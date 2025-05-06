import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrandbookModule } from './brandbook/brandbook.module';
import { ChatModule } from './chat/chat.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { DeepseekModule } from './deepseek/deepseek.module';
import { GeminiModule } from './gemini/gemini.module';
import { LogoModule } from './logo/logo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    LogoModule,
    CloudinaryModule,
    GeminiModule,
    ChatModule,
    BrandbookModule,
    DeepseekModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
