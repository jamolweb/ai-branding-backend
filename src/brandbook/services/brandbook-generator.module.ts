import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';
import { GeminiModule } from '../../gemini/gemini.module';
import { BrandBookGeneratorController } from './brandbook-generator.controller';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  imports: [CloudinaryModule, GeminiModule],
  providers: [PdfGeneratorService],
  controllers: [BrandBookGeneratorController],
  exports: [PdfGeneratorService],
})
export class BrandBookGeneratorModule {}
