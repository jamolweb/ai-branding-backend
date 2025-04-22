import { Injectable, NotFoundException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandbookDto } from './dto/create-brandbook.dto';
import { MockContentService } from './services/mock-content.service';
import { TemplateService } from './services/template.service';

@Injectable()
export class BrandbookService {
  constructor(
    private prisma: PrismaService,
    private mockContentService: MockContentService,
    private templateService: TemplateService,
    private cloudinaryService: CloudinaryService,
  ) {}

  private async generatePdfFromHtml(html: string): Promise<string> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      printBackground: true,
    });

    await browser.close();

    // Upload PDF to Cloudinary
    return this.cloudinaryService.uploadPdf(pdfBuffer);
  }

  async create(
    data: CreateBrandbookDto & { userId: string; logo: Express.Multer.File },
  ) {
    // Upload logo to Cloudinary
    const logoUrl = await this.cloudinaryService.uploadLogo(data.logo);

    // Generate mock content (to be replaced with AI-generated content later)
    const content = this.mockContentService.generateMockContent(data);

    // Generate HTML from content
    const html = this.templateService.generateHTML(content, data);

    // Generate PDF and upload to Cloudinary
    const pdfUrl = await this.generatePdfFromHtml(html);

    // Save to database
    return this.prisma.brandbook.create({
      data: {
        userId: data.userId,
        companyName: data.companyName,
        tagline: data.tagline,
        industry: data.industry,
        description: data.description,
        authorName: data.authorName,
        authorRole: data.authorRole,
        authorEmail: data.authorEmail,
        preferredColor: data.preferredColor,
        preferredFont: data.preferredFont,
        logoUrl,
        generatedHtml: html,
        generatedJson: content,
        pdfUrl,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.brandbook.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string) {
    return this.prisma.brandbook.findFirst({
      where: { id, userId },
    });
  }

  async delete(id: string, userId: string) {
    const brandbook = await this.findOne(id, userId);
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }

    // Extract public IDs from URLs
    const getPublicId = (url: string) => {
      const parts = url.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      return `brandbook/${parts[parts.length - 2]}/${filename}`;
    };

    // Delete files from Cloudinary
    try {
      if (brandbook.logoUrl) {
        await this.cloudinaryService.deleteFile(getPublicId(brandbook.logoUrl));
      }
      if (brandbook.pdfUrl) {
        await this.cloudinaryService.deleteFile(getPublicId(brandbook.pdfUrl));
      }
    } catch (error) {
      console.error('Error deleting files from Cloudinary:', error);
    }

    return this.prisma.brandbook.delete({
      where: { id },
    });
  }

  async update(
    id: string,
    data: Partial<
      CreateBrandbookDto & { userId: string; logo?: Express.Multer.File }
    >,
  ) {
    const brandbook = await this.findOne(id, data.userId);
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }

    const updateData: any = { ...data };
    delete updateData.logo;

    // Handle logo update if provided
    if (data.logo) {
      // Upload new logo to Cloudinary
      const logoUrl = await this.cloudinaryService.uploadLogo(data.logo);
      updateData.logoUrl = logoUrl;

      // Delete old logo from Cloudinary
      try {
        if (brandbook.logoUrl) {
          const publicId = brandbook.logoUrl
            .split('/')
            .slice(-2)
            .join('/')
            .split('.')[0];
          await this.cloudinaryService.deleteFile(`brandbook/${publicId}`);
        }
      } catch (error) {
        console.error('Error deleting old logo from Cloudinary:', error);
      }
    }

    return this.prisma.brandbook.update({
      where: { id },
      data: updateData,
    });
  }

  async generatePdf(id: string, userId: string) {
    const brandbook = await this.findOne(id, userId);
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }
    return brandbook.pdfUrl;
  }

  async regenerateWithAI(id: string, userId: string) {
    const brandbook = await this.findOne(id, userId);
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }

    // Generate new content
    const content = this.mockContentService.generateMockContent({
      companyName: brandbook.companyName,
      tagline: brandbook.tagline,
      industry: brandbook.industry,
      description: brandbook.description,
      authorName: brandbook.authorName,
      authorRole: brandbook.authorRole,
      authorEmail: brandbook.authorEmail,
      preferredColor: brandbook.preferredColor,
      preferredFont: brandbook.preferredFont,
    });

    // Generate new HTML
    const html = this.templateService.generateHTML(content, brandbook);

    // Generate new PDF and upload to Cloudinary
    const pdfUrl = await this.generatePdfFromHtml(html);

    // Delete old PDF from Cloudinary
    try {
      if (brandbook.pdfUrl) {
        const publicId = brandbook.pdfUrl
          .split('/')
          .slice(-2)
          .join('/')
          .split('.')[0];
        await this.cloudinaryService.deleteFile(`brandbook/${publicId}`);
      }
    } catch (error) {
      console.error('Error deleting old PDF from Cloudinary:', error);
    }

    // Update database
    return this.prisma.brandbook.update({
      where: { id },
      data: {
        generatedHtml: html,
        generatedJson: content,
        pdfUrl,
      },
    });
  }
}
