import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { GeminiModule } from '../gemini/gemini.module';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../prisma/prisma.service';
import { BrandbookController } from './brandbook.controller';
import { BrandbookService } from './brandbook.service';
import { AIContentService } from './services/ai-content.service';
import { BrandBookPdfGeneratorService } from './services/brandbook-pdf-generator.service';
import { MockContentService } from './services/mock-content.service';
import { PdfService } from './services/pdf.service';
import { SimplePdfGeneratorService } from './services/simple-pdf-generator.service';
import { TemplateService } from './services/template.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    GeminiModule,
    HttpModule,
    CommonModule,
  ],
  controllers: [BrandbookController],
  providers: [
    BrandbookService,
    PrismaService,
    MockContentService,
    TemplateService,
    PdfService,
    BrandBookPdfGeneratorService,
    AIContentService,
    SimplePdfGeneratorService,
  ],
  exports: [BrandbookService],
})
export class BrandbookModule {}
