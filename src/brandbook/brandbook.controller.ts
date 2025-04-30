import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrandbookService } from './brandbook.service';
import { CreateBrandbookDto } from './dto/create-brandbook.dto';
import { GenerateCustomBrandBookDto } from './dto/generate-custom-brandbook.dto';
import { GenerateSimpleBrandbookDto } from './dto/generate-simple-brandbook.dto';
import { BrandBookPdfGeneratorService } from './services/brandbook-pdf-generator.service';
import { SimplePdfGeneratorService } from './services/simple-pdf-generator.service';

@Controller('brandbook')
@UseGuards(JwtAuthGuard)
export class BrandbookController {
  private readonly logger = new Logger(BrandbookController.name);

  constructor(
    private readonly brandbookService: BrandbookService,
    private readonly brandBookPdfGeneratorService: BrandBookPdfGeneratorService,
    private readonly simplePdfGeneratorService: SimplePdfGeneratorService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  async createBrandbook(
    @UploadedFile() logo: Express.Multer.File,
    @Body() createBrandbookDto: CreateBrandbookDto,
    @Req() req: Request,
  ) {
    if (!logo) {
      throw new BadRequestException('Logo file is required');
    }

    return this.brandbookService.create({
      ...createBrandbookDto,
      userId: req.user['id'],
      logo,
    });
  }

  @Get()
  async getBrandbooks(@Req() req: Request) {
    return this.brandbookService.findAllByUser(req.user['id']);
  }

  @Get(':id')
  async getBrandbook(@Param('id') id: string, @Req() req: Request) {
    const brandbook = await this.brandbookService.findOne(id, req.user['id']);
    if (!brandbook) {
      throw new NotFoundException('Brandbook not found');
    }
    return brandbook;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBrandbook(@Param('id') id: string, @Req() req: Request) {
    try {
      this.logger.debug(`Delete request received for brandbook: ${id}`);
      this.logger.debug('Request user object:', req.user);
      this.logger.debug('Request headers:', req.headers);

      if (!id) {
        throw new BadRequestException('Brandbook ID is required');
      }

      // Safely extract user ID with type checking
      const user = req.user as { id: string } | undefined;
      this.logger.debug('Extracted user:', user);

      if (!user?.id) {
        this.logger.error('User ID not found in request');
        throw new UnauthorizedException('User not authenticated properly');
      }

      try {
        await this.brandbookService.delete(id, user.id);
        this.logger.debug(`Successfully deleted brandbook with id: ${id}`);
      } catch (error) {
        this.logger.error('Service error:', error);
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new BadRequestException(
          `Failed to delete brandbook: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error('Controller error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the brandbook',
      );
    }
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo'))
  async updateBrandbook(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateBrandbookDto>,
    @UploadedFile() logo: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.brandbookService.update(id, {
      ...updateData,
      logo,
      userId: req.user['id'],
    });
  }

  @Get(':id/pdf')
  async getBrandbookPdf(@Param('id') id: string, @Req() req: Request) {
    const pdf = await this.brandbookService.generatePdf(id, req.user['id']);
    if (!pdf) {
      throw new NotFoundException('PDF not found');
    }
    return pdf;
  }

  @Post(':id/regenerate')
  async regenerateBrandbook(@Param('id') id: string, @Req() req: Request) {
    return this.brandbookService.regenerateWithAI(id, req.user['id']);
  }

  @Get('logo/:filename')
  async getLogo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const filePath = path.join(process.cwd(), 'public', 'logos', filename);
      const file = await fs.readFile(filePath);

      // Determine content type based on file extension
      const mimeType = filename.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';
      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'max-age=3600',
      });

      return new StreamableFile(file);
    } catch (error) {
      throw new NotFoundException('Logo not found');
    }
  }

  @Post('generate-simple')
  async generateSimpleBrandbook(@Body() data: GenerateSimpleBrandbookDto) {
    const filename =
      await this.simplePdfGeneratorService.generateSimpleBrandbook(data);
    const pdfUrl = `http://localhost:3003/api/brandbook/pdf/${filename}`;
    return { pdfUrl };
  }

  @Get('pdf/:filename')
  async getPdf(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const filePath = path.join(process.cwd(), 'public', 'pdfs', filename);
      const file = await fs.readFile(filePath);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'max-age=3600',
      });

      return new StreamableFile(file);
    } catch (error) {
      throw new NotFoundException('PDF not found');
    }
  }

  @Post('generate-custom')
  async generateCustomBrandBook(
    @Body() brandBookData: GenerateCustomBrandBookDto,
    @Res() res: Response,
  ) {
    try {
      // Get AI content first
      const aiContent = await this.brandBookPdfGeneratorService[
        'aiContentService'
      ].generateBrandContent(
        brandBookData.companyName,
        brandBookData.industry || 'technology',
      );

      const pdfBuffer =
        await this.brandBookPdfGeneratorService.generateBrandBook({
          ...brandBookData,
          aiContent,
        });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${brandBookData.companyName.replace(/\s+/g, '-').toLowerCase()}-brandbook.pdf"`,
      );

      res.send(pdfBuffer);
    } catch (error) {
      this.logger.error('Error generating custom brand book:', error);
      throw new InternalServerErrorException('Error generating brand book');
    }
  }
}
