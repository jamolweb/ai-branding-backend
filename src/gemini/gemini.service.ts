import { GoogleGenAI } from '@google/genai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GeminiService {
  private gemini: GoogleGenAI;

  constructor(
    private cloudinaryService: CloudinaryService,
    private prisma: PrismaService,
  ) {
    this.gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  }

  async generateLogo(
    prompt: string,
    userId: string,
  ): Promise<{ images: string[]; jobId: string }> {
    const startTime = Date.now();
    try {
      console.log('Starting logo generation process...');
      const generationStartTime = Date.now();

      // Generate image using Gemini
      console.log('Generating image with Gemini...');
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: `${prompt}`,
        config: {
          responseModalities: ['Text', 'Image'],
        },
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('No content generated');
      }

      let imageBase64;
      let generationText;

      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          generationText = part.text;
          console.log('Generation text:', generationText);
        } else if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
        }
      }

      if (!imageBase64) {
        throw new Error('No image generated');
      }

      const imageUrl = `data:image/png;base64,${imageBase64}`;
      const generationEndTime = Date.now();
      const generationTime = generationEndTime - generationStartTime;
      console.log(`Image generation took ${generationTime / 1000} seconds`);

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

      // Return immediately with the image URL and job ID
      return {
        images: [imageUrl],
        jobId: job.id,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`Error after ${totalTime / 1000} seconds:`, error);

      if (error.message?.includes('PERMISSION_DENIED')) {
        throw new HttpException(
          'Access to the Gemini API is denied. Please check your API key and permissions.',
          HttpStatus.FORBIDDEN,
        );
      }

      if (
        error.message?.includes('not found') ||
        error.message?.includes('404')
      ) {
        throw new HttpException(
          'The requested model is not available. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

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

      // Download the image
      console.log('Processing image...');
      const downloadStartTime = Date.now();

      // The image is already in base64 format, just need to extract the data part
      const base64Data = imageUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const downloadEndTime = Date.now();
      console.log(
        `Image processing took ${(downloadEndTime - downloadStartTime) / 1000} seconds`,
      );

      // Upload to Cloudinary
      console.log('Uploading to Cloudinary...');
      const uploadStartTime = Date.now();

      const cloudinaryUrl = await this.cloudinaryService.uploadImage(imageUrl);

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
