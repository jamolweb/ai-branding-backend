import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseFilePipeBuilder,
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
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { BrandbookService } from './brandbook.service';
import { CreateBrandbookDto } from './dto/create-brandbook.dto';
import { UpdateBrandbookDto } from './dto/update-brandbook.dto';
import { BrandBookPdfGeneratorService } from './services/brandbook-pdf-generator.service';

@Controller('brandbook')
@UseGuards(JwtAuthGuard)
export class BrandbookController {
  private readonly logger = new Logger(BrandbookController.name);

  constructor(
    private readonly brandbookService: BrandbookService,
  ) { }

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
      if (!id) {
        throw new BadRequestException('Brandbook ID is required');
      }

      // Safely extract user ID with type checking
      const user = req.user as { id: string } | undefined;

      if (!user?.id) {
        throw new UnauthorizedException('User not authenticated properly');
      }

      try {
        await this.brandbookService.delete(id, user.id);
      } catch (error) {
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
    @Body() updateData: UpdateBrandbookDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: '.(png|jpeg|jpg|gif|webp)',
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024,
        })
        .build({
          fileIsRequired: false,
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    logo: Express.Multer.File | null,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) {
      this.logger.error('User ID not found in request during update');
      throw new UnauthorizedException('User not authenticated properly');
    }
    return this.brandbookService.update(id, updateData, logo, user.id);
  }

  @Get(':id/pdf')
  async getBrandbookPdf(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) {
      this.logger.error('User ID not found in request for PDF generation');
      throw new UnauthorizedException('User not authenticated properly');
    }
    const result = await this.brandbookService.generatePdf(id, user.id);
    if (result && result.pdfUrl) {
      return { pdfUrl: result.pdfUrl };
    } else {
      throw new InternalServerErrorException('Could not retrieve PDF URL.');
    }
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

  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  async createBrandbook(
    @Body() data: CreateBrandbookDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|gif|webp)' }),
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        ],
        fileIsRequired: true,
      }),
    )
    logo: Express.Multer.File,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) {
      this.logger.error('User ID not found in request during create');
      throw new UnauthorizedException('User not authenticated properly');
    }
    try {
      return this.brandbookService.create(data, logo, user.id);
    } catch (error) {
      this.logger.error('Error creating brandbook:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create brandbook.');
    }
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
}
