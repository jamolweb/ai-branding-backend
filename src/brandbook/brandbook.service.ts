import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandbookDto } from './dto/create-brandbook.dto';
import { MockContentService } from './services/mock-content.service';
import { PdfService } from './services/pdf.service';
import { TemplateService } from './services/template.service';

@Injectable()
export class BrandbookService {
  private readonly logger: Logger;

  constructor(
    private prisma: PrismaService,
    private mockContentService: MockContentService,
    private templateService: TemplateService,
    private cloudinaryService: CloudinaryService,
    private pdfService: PdfService,
  ) {
    this.logger = new Logger(BrandbookService.name);
  }

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

    // Upload PDF to Cloudinary (convert Uint8Array to Buffer)
    return this.cloudinaryService.uploadPdf(Buffer.from(pdfBuffer));
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

  async delete(id: string, userId: string): Promise<void> {
    this.logger.debug(`Deleting brandbook: ${id} for user: ${userId}`);

    // Find the brandbook and ensure it exists
    const brandbook = await this.prisma.brandbook.findFirst({
      where: { id, userId },
    });

    this.logger.debug('Found brandbook:', brandbook);

    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }

    try {
      // Delete from database first
      await this.prisma.brandbook.delete({
        where: { id },
      });

      this.logger.debug('Successfully deleted brandbook from database');

      // Then try to clean up Cloudinary files
      if (brandbook.logoUrl) {
        try {
          const logoPublicId = this.getCloudinaryPublicId(brandbook.logoUrl);
          if (logoPublicId) {
            await this.cloudinaryService.deleteFile(logoPublicId);
            this.logger.debug('Successfully deleted logo from Cloudinary');
          }
        } catch (error) {
          this.logger.error('Error deleting logo from Cloudinary:', error);
          // Don't throw - we've already deleted from database
        }
      }

      if (brandbook.pdfUrl) {
        try {
          const pdfPublicId = this.getCloudinaryPublicId(brandbook.pdfUrl);
          if (pdfPublicId) {
            await this.cloudinaryService.deleteFile(pdfPublicId);
            this.logger.debug('Successfully deleted PDF from Cloudinary');
          }
        } catch (error) {
          this.logger.error('Error deleting PDF from Cloudinary:', error);
          // Don't throw - we've already deleted from database
        }
      }
    } catch (error) {
      this.logger.error('Error in delete operation:', {
        error,
        brandbook,
        userId,
      });
      throw new BadRequestException(
        `Failed to delete brandbook: ${error.message}`,
      );
    }
  }

  private getCloudinaryPublicId(url: string): string | null {
    try {
      if (!url) return null;
      const matches = url.match(/\/v\d+\/(.+?)\./);
      return matches ? matches[1] : null;
    } catch (error) {
      this.logger.error('Error extracting Cloudinary public ID:', {
        url,
        error,
      });
      return null;
    }
  }

  async update(
    id: string,
    data: Partial<
      CreateBrandbookDto & { userId: string; logo?: Express.Multer.File }
    >,
  ) {
    this.logger.debug(`Updating brandbook: ${id} for user: ${data.userId}`);

    const brandbook = await this.findOne(id, data.userId);
    if (!brandbook) {
      this.logger.warn(`Brandbook not found: ${id} for user: ${data.userId}`);
      throw new NotFoundException('Brandbook not found');
    }

    try {
      const updateData: any = { ...data };
      delete updateData.logo;

      // Handle logo update if provided
      if (data.logo) {
        this.logger.debug('Uploading new logo to Cloudinary');
        try {
          // Upload new logo to Cloudinary
          const logoUrl = await this.cloudinaryService.uploadLogo(data.logo);
          updateData.logoUrl = logoUrl;
          this.logger.debug('Successfully uploaded new logo:', logoUrl);

          // Delete old logo from Cloudinary
          if (brandbook.logoUrl) {
            const oldLogoPublicId = this.getCloudinaryPublicId(
              brandbook.logoUrl,
            );
            if (oldLogoPublicId) {
              try {
                await this.cloudinaryService.deleteFile(oldLogoPublicId);
                this.logger.debug(
                  'Successfully deleted old logo from Cloudinary',
                );
              } catch (deleteError) {
                this.logger.error('Error deleting old logo from Cloudinary:', {
                  error: deleteError,
                  publicId: oldLogoPublicId,
                });
                // Continue with update even if old logo deletion fails
              }
            }
          }
        } catch (uploadError) {
          this.logger.error('Error uploading new logo:', uploadError);
          throw new BadRequestException('Failed to upload new logo');
        }
      }

      // Update the brandbook in database
      const updated = await this.prisma.brandbook.update({
        where: { id },
        data: updateData,
      });

      this.logger.debug(`Successfully updated brandbook: ${id}`);
      return updated;
    } catch (error) {
      this.logger.error('Error updating brandbook:', {
        error,
        brandbook: id,
        userId: data.userId,
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to update brandbook: ${error.message}`,
      );
    }
  }

  async generatePdf(id: string, userId: string) {
    this.logger.debug(
      `Generating PDF for brandbook: ${id} for user: ${userId}`,
    );

    const brandbook = await this.findOne(id, userId);
    if (!brandbook) {
      this.logger.warn(`Brandbook not found: ${id} for user: ${userId}`);
      throw new NotFoundException('Brandbook not found');
    }

    try {
      this.logger.debug('Starting PDF generation process');
      const pdfBuffer = await this.pdfService.generatePdf(
        brandbook.generatedHtml,
      );

      // Upload PDF to Cloudinary
      this.logger.debug('Uploading PDF to Cloudinary');
      try {
        const pdfUrl = await this.cloudinaryService.uploadPdf(pdfBuffer);
        this.logger.debug('Successfully uploaded PDF:', pdfUrl);

        // Delete old PDF if it exists
        if (brandbook.pdfUrl) {
          const oldPdfPublicId = this.getCloudinaryPublicId(brandbook.pdfUrl);
          if (oldPdfPublicId) {
            try {
              await this.cloudinaryService.deleteFile(oldPdfPublicId);
              this.logger.debug('Successfully deleted old PDF from Cloudinary');
            } catch (deleteError) {
              this.logger.error('Error deleting old PDF from Cloudinary:', {
                error: deleteError,
                publicId: oldPdfPublicId,
              });
              // Continue with update even if old PDF deletion fails
            }
          }
        }

        // Update brandbook with new PDF URL
        const updated = await this.prisma.brandbook.update({
          where: { id },
          data: { pdfUrl },
        });

        this.logger.debug(
          `Successfully generated and stored PDF for brandbook: ${id}`,
        );
        return updated;
      } catch (uploadError) {
        this.logger.error('Error uploading PDF to Cloudinary:', {
          error: uploadError,
          brandbook: id,
          userId,
        });
        throw new BadRequestException('Failed to upload generated PDF');
      }
    } catch (error) {
      this.logger.error('Error generating PDF:', {
        error,
        brandbook: id,
        userId,
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(`Failed to generate PDF: ${error.message}`);
    }
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

  async uploadPdf(html: string): Promise<Buffer> {
    return await this.pdfService.generatePdf(html);
  }
}
