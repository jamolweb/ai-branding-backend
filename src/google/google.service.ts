import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GeminiService {
  private gemini: GoogleGenerativeAI;

  constructor(
    private cloudinaryService: CloudinaryService,
    private prisma: PrismaService,
  ) {
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  }

  async generateLogo(
    prompt: string,
    userId: string,
  ): Promise<{ images: string[]; jobId: string }> {
    const startTime = Date.now();
    try {
      console.log('Starting Gemini image generation...');
      const geminiStartTime = Date.now();

      const model = this.gemini.getGenerativeModel({
        model: 'gemini-1-pro-vision-latest',
      });
      const result = await model.generateContent([prompt]);

      if (!result.response?.candidates?.[0]?.content) {
        throw new Error('No image generated');
      }

      const imageData = result.response.candidates[0].content;
      const imageUrl = imageData.parts[0]?.inlineData?.data;

      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      const geminiEndTime = Date.now();
      const generationTime = geminiEndTime - geminiStartTime;
      console.log(`Gemini generation took ${generationTime / 1000} seconds`);

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
        imageUrl,
        prompt,
        userId,
        job.id,
        generationTime,
      ).catch((error) => {
        console.error('Background processing error:', error);
      });

      // Return immediately with the Gemini URL and job ID
      return {
        images: [imageUrl],
        jobId: job.id,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Error after ${totalTime / 1000} seconds:`, error);

      // Handle specific Gemini errors
      if (error.message?.includes('API key')) {
        throw new HttpException(
          'Invalid API key or authentication error',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Handle rate limits
      if (
        error.message?.includes('quota') ||
        error.message?.includes('rate limit')
      ) {
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
    imageUrl: string,
    prompt: string,
    userId: string,
    jobId: string,
    generationTime: number,
  ): Promise<void> {
    try {
      console.log('Starting background processing...');

      // Download the image from Gemini
      console.log('Downloading image from Gemini...');
      const downloadStartTime = Date.now();

      const imageResponse = await axios.get(imageUrl, {
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
