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

@Injectable()
export class BrandbookService {
  private readonly logger: Logger;

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private pdfService: PdfService,
    private readonly aiContentService: AIContentService,
  ) {
    this.logger = new Logger(BrandbookService.name);
  }

  async create(
    data: CreateBrandbookDto,
    logoFile: Express.Multer.File,
    userId: string,
  ): Promise<Brandbook> {
    this.logger.log(
      `Starting brandbook creation for user ${userId} and company ${data.companyName}`,
    );

    let logoUrl: string | null = null;
    try {
      this.logger.debug('Uploading logo...');
      logoUrl = await this.cloudinaryService.uploadLogo(logoFile);
      this.logger.debug(`Logo uploaded successfully: ${logoUrl}`);
    } catch (error) {
      this.logger.error('Failed to upload logo to Cloudinary', error);
      throw new BadRequestException('Failed to upload logo file.');
    }

    // Prepare data for AI Content Generation
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
    this.logger.debug('Prepared data for AI content generation:', aiInputData);

    // --- Call AIContentService to generate/retrieve core content ---
    let generatedContent: CoreContentOutput;
    try {
      generatedContent =
        await this.aiContentService.generateCoreContent(aiInputData);
      this.logger.log(
        'Successfully retrieved/generated core content:',
        generatedContent,
      );
    } catch (aiError) {
      this.logger.error('AI Content Generation failed:', aiError);
      // Decide how to handle AI failure: proceed with defaults or throw?
      // For now, let's use simple defaults and proceed
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
    // --- End AI Call ---

    // Prepare data for Prisma create operation
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

    this.logger.debug('Prepared data for Prisma create:', prismaCreateData);

    let createdBrandbook: Brandbook;
    try {
      // Step 1: Create the initial brandbook record
      createdBrandbook = await this.prisma.brandbook.create({
        data: { ...prismaCreateData, user: { connect: { id: userId } } }, // ensure user connection is passed
      });
      this.logger.log(
        `Brandbook created successfully with ID: ${createdBrandbook.id}`,
      );
    } catch (error) {
      this.logger.error('Error saving brandbook to database', error);
      if (logoUrl) {
        try {
          const publicId = this.getCloudinaryPublicId(logoUrl);
          if (publicId) {
            await this.cloudinaryService.deleteFile(publicId);
            this.logger.log(
              `Cleaned up uploaded logo (${publicId}) after DB error.`,
            );
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

    // Step 2: Prepare data and generate PDF Buffer using the TEMPLATE service
    let pdfBuffer: Buffer;
    try {
      this.logger.log(
        `Preparing data for TEMPLATE PDF generation for brandbook ID: ${createdBrandbook.id}`,
      );

      // --- Prepare pdfData similar to generatePdf method ---
      let parsedColors: { name: string; value: string; usageNote?: string }[] =
        [];
      if (
        createdBrandbook.brandColorsJson &&
        typeof createdBrandbook.brandColorsJson === 'object'
      ) {
        try {
          if (Array.isArray(createdBrandbook.brandColorsJson)) {
            parsedColors = createdBrandbook.brandColorsJson.filter(
              (c: any) =>
                c && typeof c.name === 'string' && typeof c.value === 'string',
            ) as { name: string; value: string; usageNote?: string }[];
          }
        } catch (e) {
          this.logger.error('Failed to parse brandColorsJson during create', e);
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
      };
      delete (pdfData as any).brandColorsJson;
      delete (pdfData as any).generatedJson; // Ensure this is removed if it exists
      this.logger.debug(
        `Prepared data for PDF template: ID ${createdBrandbook.id}`,
      );
      // --- End pdfData preparation ---

      // Call the Template-based PDF Service
      pdfBuffer = await this.pdfService.generatePdfFromTemplate(
        'brandbook-template', // Assuming this is the correct template name
        pdfData,
      );
      this.logger.log(
        `TEMPLATE PDF Buffer generated successfully for ${createdBrandbook.id}`,
      );
    } catch (pdfError) {
      this.logger.error(
        `Failed to generate TEMPLATE PDF Buffer for brandbook ID: ${createdBrandbook.id}`,
        pdfError,
      );
      // Still return the created record, just without a PDF link
      return createdBrandbook;
    }

    // Step 3: Upload PDF Buffer to S3 and generate pre-signed URL
    let pdfUrl: string | null = null;
    try {
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const filename = `${createdBrandbook.id}_${createdBrandbook.companyName.replace(/\s+/g, '_')}_BrandBook.pdf`;
      
      const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      this.logger.log(`Uploading PDF to S3 bucket: ${process.env.S3_BUCKET_NAME}`);
      
      // Upload the file
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `pdfs/${filename}`,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
      );

      // Generate pre-signed URL (24 hour expiration)
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `pdfs/${filename}`,
      });
      
      pdfUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 24 * 60 * 60 });
      this.logger.log(`PDF uploaded to S3. Pre-signed URL generated (24h expiration): ${pdfUrl}`);
    } catch (uploadError) {
      this.logger.error(
        `Failed to upload PDF to S3 for brandbook ID: ${createdBrandbook.id}`,
        uploadError,
      );
      // PDF generated but not uploaded. Return record without URL.
      return createdBrandbook;
    }

    // Step 4: Update the brandbook record with the local PDF URL Path
    try {
      const updatedBrandbook = await this.prisma.brandbook.update({
        where: { id: createdBrandbook.id },
        data: { pdfUrl: pdfUrl }, // Save the local URL path
      });
      this.logger.log(
        `Successfully updated brandbook ID: ${createdBrandbook.id} with PDF URL path.`,
      );
      return updatedBrandbook; // Return final record including PDF URL path
    } catch (updateError) {
      this.logger.error(
        `Failed to update brandbook ID: ${createdBrandbook.id} with PDF URL path ${pdfUrl}`,
        updateError,
      );
      // Record created, PDF generated and saved, but DB update failed.
      // Log error, maybe try cleanup? Return original record for now.
      // TODO: Consider deleting the orphaned local PDF if update fails.
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
    this.logger.debug(`Deleting brandbook: ${id} for user: ${userId}`);
    const brandbook = await this.findOne(id, userId);
    this.logger.debug('Found brandbook for deletion:', brandbook);

    try {
      await this.prisma.brandbook.delete({
        where: { id },
      });
      this.logger.debug('Successfully deleted brandbook from database');

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
          this.logger.debug(`Deleted logo from Cloudinary: ${logoPublicId}`);
        }
      } catch (error) {
        this.logger.error('Error deleting logo from Cloudinary:', {
          url: brandbook.logoUrl,
          error,
        });
      }
    }
    if (brandbook.pdfUrl && !brandbook.pdfUrl.startsWith('http')) {
      // Simple check for local path
      try {
        const localPath = path.join(process.cwd(), 'public', brandbook.pdfUrl);
        await fs.unlink(localPath);
        this.logger.debug(`Deleted local PDF file: ${localPath}`);
      } catch (localDeleteError) {
        // Log error if deletion fails (e.g., file not found)
        if (localDeleteError.code !== 'ENOENT') {
          // Ignore file not found error
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
    this.logger.debug(`Updating brandbook: ${id} for user: ${userId}`);

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
      this.logger.debug('New logo provided, uploading...');
      try {
        newLogoUrl = await this.cloudinaryService.uploadLogo(logoFile);
        updatePayload.logoUrl = newLogoUrl;
        this.logger.debug('New logo uploaded successfully:', newLogoUrl);
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
      this.logger.debug(`Successfully updated brandbook: ${id}`);

      if (newLogoUrl && existingBrandbook.logoUrl) {
        const oldLogoPublicId = this.getCloudinaryPublicId(
          existingBrandbook.logoUrl,
        );
        if (oldLogoPublicId) {
          try {
            await this.cloudinaryService.deleteFile(oldLogoPublicId);
            this.logger.debug(
              'Cleaned up old logo from Cloudinary:',
              oldLogoPublicId,
            );
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
            this.logger.log(
              `Cleaned up newly uploaded logo (${publicId}) after DB update error.`,
            );
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
    this.logger.log(
      `Initiating LOCAL PDF generation process for brandbook: ${id}, user: ${userId}`,
    );

    const brandbook = await this.findOne(id, userId);
    this.logger.debug(`Fetched brandbook data for PDF generation: ID ${id}`);

    let parsedColors: { name: string; value: string; usageNote?: string }[] =
      [];
    if (
      brandbook.brandColorsJson &&
      typeof brandbook.brandColorsJson === 'object'
    ) {
      try {
        if (Array.isArray(brandbook.brandColorsJson)) {
          parsedColors = brandbook.brandColorsJson.filter(
            (c: any) =>
              c && typeof c.name === 'string' && typeof c.value === 'string',
          ) as { name: string; value: string; usageNote?: string }[];
          this.logger.debug(
            `Parsed ${parsedColors.length} brand colors for PDF.`,
          );
        }
      } catch (e) {
        this.logger.error(
          `Failed to parse brandColorsJson for brandbook ${id}.`,
          e,
        );
      }
    } else {
      this.logger.warn(
        `No brandColorsJson found or invalid type for brandbook ${id}.`,
      );
    }

    // Prepare data object for the template
    const pdfData = {
      ...brandbook,
      brandColors: parsedColors,
      currentDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      currentYear: new Date().getFullYear(),
    };
    delete (pdfData as any).brandColorsJson;
    delete (pdfData as any).generatedJson;

    this.logger.debug(`Prepared data for PDF template: ID ${id}`);

    let pdfBuffer: Buffer;
    try {
      this.logger.log(`Calling PdfService to generate PDF from template...`);
      pdfBuffer = await this.pdfService.generatePdfFromTemplate(
        'brandbook-template',
        pdfData,
      );
      this.logger.log(
        `PDF buffer generated successfully for brandbook ${id}. Size: ${pdfBuffer.length} bytes`,
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

      this.logger.log(`Saving generated PDF locally to: ${filePath}`);
      await fs.mkdir(directoryPath, { recursive: true });
      await fs.writeFile(filePath, pdfBuffer);
      pdfUrl = `/pdfs/${filename}`;
      this.logger.log(`PDF saved locally. URL path: ${pdfUrl}`);

      // Cleanup old local PDF if it exists and path is different
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
          this.logger.debug(`Cleaned up old local PDF: ${oldLocalPath}`);
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
      this.logger.log(
        `Updating brandbook ${id} with new local PDF URL path...`,
      );
      await this.prisma.brandbook.update({
        where: { id },
        data: { pdfUrl: pdfUrl },
      });
      this.logger.log(
        `Brandbook ${id} updated successfully with PDF URL path: ${pdfUrl}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update brandbook ${id} with PDF URL path:`,
        error,
      );
      // Consider deleting the newly saved file if DB update fails
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
    this.logger.log(
      `Initiating LOCAL PDF RE-generation for brandbook ID: ${id}, user: ${userId}`,
    );
    const result = await this.generatePdf(id, userId);
    this.logger.log(
      `PDF LOCAL regeneration completed for brandbook ${id}. New URL path: ${result.pdfUrl}`,
    );
    return result;
  }
}
