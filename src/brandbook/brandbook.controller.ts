import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
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

@Controller('brandbook')
@UseGuards(JwtAuthGuard)
export class BrandbookController {
  constructor(private readonly brandbookService: BrandbookService) {}

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
  async deleteBrandbook(@Param('id') id: string, @Req() req: Request) {
    return this.brandbookService.delete(id, req.user['id']);
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

  @Get('pdf/:filename')
  async servePdf(
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
