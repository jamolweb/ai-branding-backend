import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaService } from '../prisma/prisma.service';
import { BrandbookController } from './brandbook.controller';
import { BrandbookService } from './brandbook.service';
import { MockContentService } from './services/mock-content.service';
import { TemplateService } from './services/template.service';

@Module({
  imports: [AuthModule, CloudinaryModule],
  controllers: [BrandbookController],
  providers: [
    BrandbookService,
    PrismaService,
    MockContentService,
    TemplateService,
  ],
  exports: [BrandbookService],
})
export class BrandbookModule {}
