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
      const generationStartTime = Date.now();

      const model = this.gemini.models;
      const response = await model.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Generate a professional logo design with the following description: ${prompt}. The logo should be clean, modern, and suitable for business use.`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['Text', 'Image'],
        },
      });

      if (!response?.candidates?.[0]?.content) {
        throw new Error(
          'Invalid response structure: No candidates or content found',
        );
      }

      const content = response.candidates[0].content;

      let imageBase64 = null;

      // Check if content is an array or object
      const parts = Array.isArray(content) ? content : content.parts;
      if (!parts) {
        throw new Error('No parts found in response content');
      }

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          break;
        }
      }

      if (!imageBase64) {
        throw new Error('No image data found in response parts');
      }

      const imageUrl = `data:image/png;base64,${imageBase64}`;
      const generationEndTime = Date.now();
      const generationTime = generationEndTime - generationStartTime;

      const job = await this.prisma.logoGenerationJob.create({
        data: {
          prompt,
          userId,
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      this.processBackgroundTasks(
        imageUrl,
        prompt,
        userId,
        job.id,
        generationTime,
      ).catch((error) => {
        console.error('Background processing error:', error);
      });

      return {
        images: [imageUrl],
        jobId: job.id,
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      console.error('Error details:', error.response?.data || error.message);

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
          'The image generation model is not available. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        `Failed to generate logo: ${error.message}`,
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
      const base64Data = imageUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const cloudinaryUrl = await this.cloudinaryService.uploadImage(imageUrl);

      const logo = await this.prisma.logo.create({
        data: {
          prompt,
          imageUrl: cloudinaryUrl,
          userId,
          generationTime,
          status: 'COMPLETED',
        },
      });

      await this.prisma.logoGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          logoId: logo.id,
        },
      });
    } catch (error) {
      console.error('Background processing error:', error);
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
