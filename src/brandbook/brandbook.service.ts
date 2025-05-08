import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import { Brandbook, Prisma } from '@prisma/client';
import * as puppeteer from 'puppeteer';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandbookDto } from './dto/create-brandbook.dto';
import { UpdateBrandbookDto } from './dto/update-brandbook.dto';
import {
  AIContentService,
  CoreContentInput,
  CoreContentOutput,
} from './services/ai-content.service';
import { MockContentService } from './services/mock-content.service';
import { PdfService } from './services/pdf.service';
import { TemplateService } from './services/template.service';
import { BrandBookPdfGeneratorService } from './services/brandbook-pdf-generator.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as QRCode from 'qrcode';

@Injectable()
export class BrandbookService {
  private readonly logger: Logger;

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private pdfService: PdfService,
    private readonly aiContentService: AIContentService,
    private readonly templateService: TemplateService,
    private readonly brandBookPdfGeneratorService: BrandBookPdfGeneratorService,
  ) {
    this.logger = new Logger(BrandbookService.name);
  }

  // Helper method to generate QR code as data URL
  private async generateQRCodeDataURL(websiteUrl: string): Promise<string> {
    try {
      // Generate QR code as data URL (base64 encoded)
      return await QRCode.toDataURL(websiteUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate QR code for website: ${websiteUrl}`,
        error,
      );
      return '';
    }
  }

  async create(
    data: CreateBrandbookDto,
    logoFile: Express.Multer.File,
    userId: string,
  ): Promise<Brandbook> {

    let logoUrl: string | null = null;
    try {
      logoUrl = await this.cloudinaryService.uploadLogo(logoFile);
    } catch (error) {
      throw new BadRequestException('Failed to upload logo file.');
    }

    const aiInputData: CoreContentInput = {
      companyName: data.companyName,
      companyDescription: data.companyDescription,
      industry: data.industry,
      targetAudience: data.targetAudience,
      brandPersonalityKeywords: data.brandPersonalityKeywords,
      visualStyleKeywords: data.visualStyleKeywords,
      toneOfVoice: data.toneOfVoice,
      providedMission: data.missionStatement,
      providedVision: data.visionStatement,
    };

    let generatedContent: CoreContentOutput;
    try {
      generatedContent =
        await this.aiContentService.generateCoreContent(aiInputData);
    } catch (aiError) {
      this.logger.error('AI Content Generation failed:', aiError);
      generatedContent = {
        missionStatement:
          data.missionStatement ||
          `Default Mission (Service Error) for ${data.companyName}`,
        visionStatement:
          data.visionStatement ||
          `Default Vision (Service Error) for ${data.companyName}`,
      };
      this.logger.warn(
        'Proceeding with default mission/vision after AI error.',
      );
    }

    const prismaCreateData: Prisma.BrandbookCreateInput = {
      user: { connect: { id: userId } },
      companyName: data.companyName,
      tagline: data.tagline,
      industry: data.industry,
      companyDescription: data.companyDescription,
      targetAudience: data.targetAudience,
      brandPersonalityKeywords: data.brandPersonalityKeywords,
      visualStyleKeywords: data.visualStyleKeywords,
      toneOfVoice: data.toneOfVoice,
      missionStatement: generatedContent.missionStatement,
      visionStatement: generatedContent.visionStatement,
      logoUrl: logoUrl,
      brandColorsJson: data.brandColors as unknown as Prisma.InputJsonValue,
      primaryFontName: data.primaryFontName,
      secondaryFontName: data.secondaryFontName,
      contactEmail: data.contactEmail,
      contactWebsite: data.contactWebsite,
      contactPhone: data.contactPhone,
      contactAddress: data.contactAddress,
    };

    let createdBrandbook: Brandbook;
    try {
      createdBrandbook = await this.prisma.brandbook.create({
        data: { ...prismaCreateData, user: { connect: { id: userId } } },
      });
    } catch (error) {
      this.logger.error('Error saving brandbook to database', error);
      if (logoUrl) {
        try {
          const publicId = this.getCloudinaryPublicId(logoUrl);
          if (publicId) {
            await this.cloudinaryService.deleteFile(publicId);
          }
        } catch (cleanupError) {
          this.logger.error(
            'Failed to clean up logo after DB error',
            cleanupError,
          );
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma Error Code: ${error.code}`);
      }
      throw new InternalServerErrorException(
        'Failed to save initial brandbook data.',
      );
    }

    let pdfBuffer: Buffer;
    try {
      let parsedColors: { name: string; value: string; usageNote?: string }[] =
        [];
      if (
        createdBrandbook.brandColorsJson &&
        typeof createdBrandbook.brandColorsJson === 'object'
      ) {
        try {
          if (Array.isArray(createdBrandbook.brandColorsJson)) {
            parsedColors = createdBrandbook.brandColorsJson.map(
              (c: any, index: number) => {
                if (!c) c = {};

                const name =
                  c.name && typeof c.name === 'string' && c.name.trim() !== ''
                    ? c.name
                    : `Color ${index + 1}`;

                const value =
                  c.value &&
                    typeof c.value === 'string' &&
                    /^#[0-9A-Fa-f]{6}$/.test(c.value)
                    ? c.value
                    : this.getDefaultColorByIndex(index);

                return {
                  name,
                  value,
                  usageNote:
                    c.usageNote && typeof c.usageNote === 'string'
                      ? c.usageNote
                      : undefined,
                };
              },
            );
          }
        } catch (e) {
          this.logger.error('Failed to parse brandColorsJson during create', e);
          parsedColors = [{ name: 'Primary', value: '#000000' }];
        }
      }

      // Generate an AI-enhanced introduction
      let enhancedIntroduction = createdBrandbook.companyDescription || '';
      try {
        const introInput = {
          companyName: createdBrandbook.companyName,
          companyDescription: createdBrandbook.companyDescription,
          industry: createdBrandbook.industry,
          targetAudience: createdBrandbook.targetAudience,
          brandPersonalityKeywords: createdBrandbook.brandPersonalityKeywords,
          visualStyleKeywords: createdBrandbook.visualStyleKeywords,
          toneOfVoice: createdBrandbook.toneOfVoice,
          missionStatement: createdBrandbook.missionStatement,
          visionStatement: createdBrandbook.visionStatement,
          tagline: createdBrandbook.tagline,
        };

        const enhancedContent =
          await this.aiContentService.generateEnhancedIntroduction(introInput);
        enhancedIntroduction = enhancedContent.enhancedIntroduction;
      } catch (introError) {
        this.logger.error(
          `Failed to generate enhanced introduction for brandbook ID: ${createdBrandbook.id}. Using original description.`,
          introError,
        );
        // Fall back to the original description or empty string
        enhancedIntroduction = createdBrandbook.companyDescription || '';
      }

      // Generate QR Code for website if available
      let websiteQrCodeUrl = '';
      if (createdBrandbook.contactWebsite) {
        try {
          websiteQrCodeUrl = await this.generateQRCodeDataURL(
            createdBrandbook.contactWebsite,
          );
          this.logger.log(
            `Generated QR code for website: ${createdBrandbook.contactWebsite}`,
          );
        } catch (qrError) {
          this.logger.error(
            `Failed to generate QR code for website: ${createdBrandbook.contactWebsite}`,
            qrError,
          );
        }
      }

      const pdfData = {
        ...createdBrandbook,
        brandColors: parsedColors,
        currentDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        currentYear: new Date().getFullYear(),
        enhancedIntroduction,
        colorPaletteDescription:
          "These colors form the foundation of our brand's visual identity. When used consistently, they help establish brand recognition across all touchpoints. The primary colors should dominate your designs, with secondary and accent colors used for highlights, backgrounds, and to create visual interest. Always ensure sufficient contrast between text and background colors for optimal readability.",
        websiteQrCodeUrl,
      };
      delete (pdfData as any).brandColorsJson;
      delete (pdfData as any).generatedJson;

      pdfBuffer = await this.pdfService.generatePdfFromTemplate(
        'brandbook-template',
        pdfData,
      );
    } catch (pdfError) {
      this.logger.error(
        `Failed to generate TEMPLATE PDF Buffer for brandbook ID: ${createdBrandbook.id}`,
        pdfError,
      );
      return createdBrandbook;
    }

    let pdfUrl: string | null = null;
    try {
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import(
        '@aws-sdk/client-s3'
      );
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const filename = `${createdBrandbook.id}_${createdBrandbook.companyName.replace(/\s+/g, '_')}_BrandBook.pdf`;

      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `pdfs/${filename}`,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `pdfs/${filename}`,
      });

      pdfUrl = await getSignedUrl(s3Client, getObjectCommand, {
        expiresIn: 24 * 60 * 60,
      });
    } catch (uploadError) {
      this.logger.error(
        `Failed to upload PDF to S3 for brandbook ID: ${createdBrandbook.id}`,
        uploadError,
      );
      return createdBrandbook;
    }

    try {
      const updatedBrandbook = await this.prisma.brandbook.update({
        where: { id: createdBrandbook.id },
        data: { pdfUrl: pdfUrl },
      });
      return updatedBrandbook;
    } catch (updateError) {
      this.logger.error(
        `Failed to update brandbook ID: ${createdBrandbook.id} with PDF URL path ${pdfUrl}`,
        updateError,
      );
      return createdBrandbook;
    }
  }

  async findAllByUser(userId: string) {
    return this.prisma.brandbook.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string) {
    const brandbook = await this.prisma.brandbook.findFirst({
      where: { id, userId },
    });
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }
    return brandbook;
  }

  async delete(id: string, userId: string): Promise<void> {
    const brandbook = await this.findOne(id, userId);

    try {
      await this.prisma.brandbook.delete({
        where: { id },
      });

      await this.cleanupCloudinaryFiles(brandbook);
    } catch (error) {
      this.logger.error('Error during delete operation:', {
        error,
        id,
        userId,
      });
      if (!(error instanceof NotFoundException)) {
        throw new InternalServerErrorException(
          `Failed to delete brandbook: ${error.message}`,
        );
      }
    }
  }

  private async cleanupCloudinaryFiles(brandbook: Brandbook) {
    if (brandbook.logoUrl) {
      try {
        const logoPublicId = this.getCloudinaryPublicId(brandbook.logoUrl);
        if (logoPublicId) {
          await this.cloudinaryService.deleteFile(logoPublicId);
        }
      } catch (error) {
        this.logger.error('Error deleting logo from Cloudinary:', {
          url: brandbook.logoUrl,
          error,
        });
      }
    }
    if (brandbook.pdfUrl && !brandbook.pdfUrl.startsWith('http')) {
      try {
        const localPath = path.join(process.cwd(), 'public', brandbook.pdfUrl);
        await fs.unlink(localPath);
      } catch (localDeleteError) {
        if (localDeleteError.code !== 'ENOENT') {
          this.logger.error(
            `Error deleting local PDF file ${brandbook.pdfUrl}:`,
            localDeleteError,
          );
        }
      }
    }
  }

  private getCloudinaryPublicId(url: string): string | null {
    try {
      if (!url) return null;
      const matches = url.match(/\/v\d+\/(?:logos\/|pdfs\/)?(.+?)(?:\.\w+)?$/);
      return matches
        ? matches[1].startsWith('logos/') || matches[1].startsWith('pdfs/')
          ? matches[1]
          : null
        : null;
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
    data: UpdateBrandbookDto,
    logoFile: Express.Multer.File | null,
    userId: string,
  ): Promise<Brandbook> {
    const existingBrandbook = await this.findOne(id, userId);

    const updatePayload: Prisma.BrandbookUpdateInput = {};

    if (data.companyName !== undefined)
      updatePayload.companyName = data.companyName;
    if (data.tagline !== undefined) updatePayload.tagline = data.tagline;
    if (data.industry !== undefined) updatePayload.industry = data.industry;
    if (data.companyDescription !== undefined)
      updatePayload.companyDescription = data.companyDescription;
    if (data.targetAudience !== undefined)
      updatePayload.targetAudience = data.targetAudience;
    if (data.brandPersonalityKeywords !== undefined)
      updatePayload.brandPersonalityKeywords = data.brandPersonalityKeywords;
    if (data.visualStyleKeywords !== undefined)
      updatePayload.visualStyleKeywords = data.visualStyleKeywords;
    if (data.toneOfVoice !== undefined)
      updatePayload.toneOfVoice = data.toneOfVoice;
    if (data.missionStatement !== undefined)
      updatePayload.missionStatement = data.missionStatement;
    if (data.visionStatement !== undefined)
      updatePayload.visionStatement = data.visionStatement;
    if (data.primaryFontName !== undefined)
      updatePayload.primaryFontName = data.primaryFontName;
    if (data.secondaryFontName !== undefined)
      updatePayload.secondaryFontName = data.secondaryFontName;
    if (data.contactEmail !== undefined)
      updatePayload.contactEmail = data.contactEmail;
    if (data.contactWebsite !== undefined)
      updatePayload.contactWebsite = data.contactWebsite;
    if (data.contactPhone !== undefined)
      updatePayload.contactPhone = data.contactPhone;
    if (data.contactAddress !== undefined)
      updatePayload.contactAddress = data.contactAddress;

    if (data.brandColors !== undefined) {
      updatePayload.brandColorsJson =
        data.brandColors as unknown as Prisma.InputJsonValue;
    }

    let newLogoUrl: string | null = null;
    if (logoFile) {
      try {
        newLogoUrl = await this.cloudinaryService.uploadLogo(logoFile);
        updatePayload.logoUrl = newLogoUrl;
      } catch (uploadError) {
        this.logger.error(
          'Error uploading new logo during update:',
          uploadError,
        );
        throw new BadRequestException('Failed to upload new logo.');
      }
    }

    try {
      const updatedBrandbook = await this.prisma.brandbook.update({
        where: { id },
        data: updatePayload,
      });

      if (newLogoUrl && existingBrandbook.logoUrl) {
        const oldLogoPublicId = this.getCloudinaryPublicId(
          existingBrandbook.logoUrl,
        );
        if (oldLogoPublicId) {
          try {
            await this.cloudinaryService.deleteFile(oldLogoPublicId);
          } catch (deleteError) {
            this.logger.error(
              'Error deleting old logo after update:',
              deleteError,
            );
          }
        }
      }

      return updatedBrandbook;
    } catch (error) {
      this.logger.error('Error updating brandbook in database:', {
        error,
        id,
        userId,
      });
      if (newLogoUrl) {
        const publicId = this.getCloudinaryPublicId(newLogoUrl);
        if (publicId) {
          try {
            await this.cloudinaryService.deleteFile(publicId);
          } catch (cleanupError) {
            this.logger.error(
              'Failed to clean up new logo after DB update error',
              cleanupError,
            );
          }
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma Error Code: ${error.code}`);
      }
      throw new InternalServerErrorException(
        `Failed to update brandbook: ${error.message}`,
      );
    }
  }

  async generatePdf(id: string, userId: string): Promise<{ pdfUrl: string }> {
    const brandbook = await this.findOne(id, userId);

    let parsedColors: { name: string; value: string; usageNote?: string }[] =
      [];
    if (
      brandbook.brandColorsJson &&
      typeof brandbook.brandColorsJson === 'object'
    ) {
      try {
        if (Array.isArray(brandbook.brandColorsJson)) {
          parsedColors = brandbook.brandColorsJson.map(
            (c: any, index: number) => {
              if (!c) c = {};

              const name =
                c.name && typeof c.name === 'string' && c.name.trim() !== ''
                  ? c.name
                  : `Color ${index + 1}`;

              const value =
                c.value &&
                  typeof c.value === 'string' &&
                  /^#[0-9A-Fa-f]{6}$/.test(c.value)
                  ? c.value
                  : this.getDefaultColorByIndex(index);

              return {
                name,
                value,
                usageNote:
                  c.usageNote && typeof c.usageNote === 'string'
                    ? c.usageNote
                    : undefined,
              };
            },
          );
        }
      } catch (e) {
        this.logger.error(
          `Failed to parse brandColorsJson for brandbook ${id}.`,
          e,
        );
        parsedColors = [{ name: 'Primary', value: '#000000' }];
      }
    } else {
      this.logger.warn(
        `No brandColorsJson found or invalid type for brandbook ${id}.`,
      );
      parsedColors = [{ name: 'Primary', value: '#000000' }];
    }

    // Generate an AI-enhanced introduction
    let enhancedIntroduction = brandbook.companyDescription || '';
    try {
      const introInput = {
        companyName: brandbook.companyName,
        companyDescription: brandbook.companyDescription,
        industry: brandbook.industry,
        targetAudience: brandbook.targetAudience,
        brandPersonalityKeywords: brandbook.brandPersonalityKeywords,
        visualStyleKeywords: brandbook.visualStyleKeywords,
        toneOfVoice: brandbook.toneOfVoice,
        missionStatement: brandbook.missionStatement,
        visionStatement: brandbook.visionStatement,
        tagline: brandbook.tagline,
      };

      const enhancedContent =
        await this.aiContentService.generateEnhancedIntroduction(introInput);
      enhancedIntroduction = enhancedContent.enhancedIntroduction;
    } catch (introError) {
      this.logger.error(
        `Failed to generate enhanced introduction for brandbook ID: ${id}. Using original description.`,
        introError,
      );
      // Fall back to the original description or empty string
      enhancedIntroduction = brandbook.companyDescription || '';
    }

    // Generate QR Code for website if available
    let websiteQrCodeUrl = '';
    if (brandbook.contactWebsite) {
      try {
        websiteQrCodeUrl = await this.generateQRCodeDataURL(
          brandbook.contactWebsite,
        );
        this.logger.log(
          `Generated QR code for website: ${brandbook.contactWebsite}`,
        );
      } catch (qrError) {
        this.logger.error(
          `Failed to generate QR code for website: ${brandbook.contactWebsite}`,
          qrError,
        );
      }
    }

    const pdfData = {
      ...brandbook,
      brandColors: parsedColors,
      currentDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      currentYear: new Date().getFullYear(),
      enhancedIntroduction,
      colorPaletteDescription:
        "These colors form the foundation of our brand's visual identity. When used consistently, they help establish brand recognition across all touchpoints. The primary colors should dominate your designs, with secondary and accent colors used for highlights, backgrounds, and to create visual interest. Always ensure sufficient contrast between text and background colors for optimal readability.",
      websiteQrCodeUrl,
    };
    delete (pdfData as any).brandColorsJson;
    delete (pdfData as any).generatedJson;


    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfService.generatePdfFromTemplate(
        'brandbook-template',
        pdfData,
      );
    } catch (error) {
      this.logger.error(
        `PDF generation from template failed for brandbook ${id}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to generate PDF document.',
      );
    }

    let pdfUrl: string;
    try {
      const filename = `${brandbook.id}_${brandbook.companyName.replace(/\s+/g, '_')}_BrandBook.pdf`;
      const directoryPath = path.join(process.cwd(), 'public', 'pdfs');
      const filePath = path.join(directoryPath, filename);

      await fs.mkdir(directoryPath, { recursive: true });
      await fs.writeFile(filePath, pdfBuffer);
      pdfUrl = `/pdfs/${filename}`;

      if (
        brandbook.pdfUrl &&
        brandbook.pdfUrl !== pdfUrl &&
        !brandbook.pdfUrl.startsWith('http')
      ) {
        try {
          const oldLocalPath = path.join(
            process.cwd(),
            'public',
            brandbook.pdfUrl,
          );
          await fs.unlink(oldLocalPath);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            this.logger.error(
              'Failed to clean up old local PDF:',
              cleanupError,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Local PDF saving failed for brandbook ${id}:`, error);
      throw new InternalServerErrorException(
        'Failed to save PDF file locally.',
      );
    }

    try {
      await this.prisma.brandbook.update({
        where: { id },
        data: { pdfUrl: pdfUrl },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update brandbook ${id} with PDF URL path:`,
        error,
      );
      try {
        const localPath = path.join(process.cwd(), 'public', pdfUrl);
        await fs.unlink(localPath);
        this.logger.warn(
          `Cleaned up newly saved local PDF (${localPath}) after DB update failure.`,
        );
      } catch (finalCleanupError) {
        this.logger.error(
          'CRITICAL: Failed to cleanup newly saved local PDF after DB update failure.',
          finalCleanupError,
        );
      }
      throw new InternalServerErrorException(
        'Failed to save PDF URL path to brandbook record.',
      );
    }

    return { pdfUrl };
  }

  async regenerateWithAI(
    id: string,
    userId: string,
  ): Promise<{ pdfUrl: string }> {
    const result = await this.generatePdf(id, userId);
    return result;
  }

  private getDefaultColorByIndex(index: number): string {
    const defaultColors = [
      '#000000', // Black (Primary)
      '#4A4A4A', // Dark Gray (Secondary)
      '#007BFF', // Blue (Accent)
      '#28A745', // Green (Success)
      '#DC3545', // Red (Warning)
    ];

    return index < defaultColors.length ? defaultColors[index] : '#CCCCCC';
  }
}
