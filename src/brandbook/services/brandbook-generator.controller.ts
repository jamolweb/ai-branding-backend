import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { PdfGeneratorService } from './pdf-generator.service';

interface GenerateBrandBookDto {
  companyName: string;
  tagline: string;
  preferredColor: string;
  authorName: string;
  authorRole: string;
  authorEmail: string;
  logoUrl?: string;
  description?: string;
  mission?: string;
  vision?: string;
  coreValues?: string[];
}

@Controller('brandbook')
export class BrandBookGeneratorController {
  constructor(private readonly pdfGeneratorService: PdfGeneratorService) {}

  @Post('generate')
  async generateBrandBook(
    @Body() brandBookData: GenerateBrandBookDto,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer =
        await this.pdfGeneratorService.generateBrandBook(brandBookData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${brandBookData.companyName.replace(/\s+/g, '-').toLowerCase()}-brandbook.pdf"`,
      );

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating brand book:', error);
      res.status(500).json({ message: 'Error generating brand book' });
    }
  }
}
