import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { OpenAI } from 'openai';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(
    private cloudinaryService: CloudinaryService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateLogo(
    prompt: string,
    userId: string,
  ): Promise<{ images: string[]; jobId: string }> {
    const startTime = Date.now();
    try {
      console.log('Starting DALL-E image generation...');
      const dalleStartTime = Date.now();

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024', // DALL-E 3 only supports: 1024x1024, 1792x1024, or 1024x1792
        quality: 'standard',
        style: 'vivid',
      });

      const dalleEndTime = Date.now();
      const generationTime = dalleEndTime - dalleStartTime;
      console.log(`DALL-E generation took ${generationTime / 1000} seconds`);

      const dalleUrl = response.data[0].url;

      // Create a job record in the database
      const job = await this.prisma.logoGenerationJob.create({
        data: {
          prompt,
          userId,
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Start background processing
      this.processBackgroundTasks(
        dalleUrl,
        prompt,
        userId,
        job.id,
        generationTime,
      ).catch((error) => {
        console.error('Background processing error:', error);
      });

      // Return immediately with the DALL-E URL and job ID
      return {
        images: [dalleUrl],
        jobId: job.id,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Error after ${totalTime / 1000} seconds:`, error);

      // Handle specific OpenAI errors
      if (error.error?.type === 'invalid_request_error') {
        throw new HttpException(
          error.error.message || 'Invalid request to OpenAI API',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Handle rate limits
      if (error.status === 429) {
        throw new HttpException(
          'Rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Handle other errors
      throw new HttpException(
        'Failed to generate logo. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async processBackgroundTasks(
    dalleUrl: string,
    prompt: string,
    userId: string,
    jobId: string,
    generationTime: number,
  ): Promise<void> {
    try {
      console.log('Starting background processing...');

      // Download the image from DALL-E
      console.log('Downloading image from DALL-E...');
      const downloadStartTime = Date.now();

      const imageResponse = await axios.get(dalleUrl, {
        responseType: 'arraybuffer',
        timeout: 5000,
      });
      const buffer = Buffer.from(imageResponse.data);

      const downloadEndTime = Date.now();
      console.log(
        `Image download took ${(downloadEndTime - downloadStartTime) / 1000} seconds`,
      );

      // Convert buffer to base64 string for CloudinaryService
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

      // Upload to Cloudinary
      console.log('Uploading to Cloudinary...');
      const uploadStartTime = Date.now();

      const cloudinaryUrl =
        await this.cloudinaryService.uploadImage(base64Image);

      const uploadEndTime = Date.now();
      console.log(
        `Cloudinary upload took ${(uploadEndTime - uploadStartTime) / 1000} seconds`,
      );

      // Save to database
      console.log('Saving to database...');
      const dbStartTime = Date.now();

      const logo = await this.prisma.logo.create({
        data: {
          prompt,
          imageUrl: cloudinaryUrl,
          userId,
          generationTime,
          status: 'COMPLETED',
        },
      });

      const dbEndTime = Date.now();
      console.log(
        `Database save took ${(dbEndTime - dbStartTime) / 1000} seconds`,
      );

      // Update job status
      await this.prisma.logoGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          logoId: logo.id,
        },
      });

      console.log('Background processing completed successfully');
    } catch (error) {
      console.error('Background processing error:', error);

      // Update job status to failed
      await this.prisma.logoGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          error: error.message,
        },
      });
    }
  }
}
