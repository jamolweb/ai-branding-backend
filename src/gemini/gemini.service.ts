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
    try {
      const generationStartTime = Date.now();
      const model = this.gemini.models;
      const imageUrls: string[] = [];

      // Generate 5 different logos in parallel
      const promises = Array(5).fill(null).map(async () => {
        const response = await model.generateContent({
          model: 'gemini-2.0-flash-exp-image-generation',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Generate a unique professional logo design with the following description: ${prompt}. The logo should be clean, modern, and suitable for business use. Make it different from other variations.`,
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
        const parts = Array.isArray(content) ? content : content.parts;

        if (!parts) {
          throw new Error('No parts found in response content');
        }

        let imageBase64 = null;
        for (const part of parts) {
          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            break;
          }
        }

        if (!imageBase64) {
          throw new Error('No image data found in response parts');
        }

        return `data:image/png;base64,${imageBase64}`;
      });

      // Wait for all logo generations to complete
      const results = await Promise.all(promises);
      imageUrls.push(...results);
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
        imageUrls,
        prompt,
        userId,
        job.id,
        generationTime,
      ).catch((error) => {
        console.error('Background processing error:', error);
      });

      return {
        images: imageUrls,
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
    imageUrls: string[],
    prompt: string,
    userId: string,
    jobId: string,
    generationTime: number,
  ): Promise<void> {
    try {
      // Upload all images to Cloudinary in parallel
      const cloudinaryUrls = await Promise.all(
        imageUrls.map(imageUrl => this.cloudinaryService.uploadImage(imageUrl))
      );

      // Create all logos in parallel
      const logos = await Promise.all(
        cloudinaryUrls.map(cloudinaryUrl =>
          this.prisma.logo.create({
            data: {
              prompt,
              imageUrl: cloudinaryUrl,
              userId,
              generationTime,
              status: 'COMPLETED',
            },
          })
        )
      );

      // Update the job with the first logo ID (maintaining backwards compatibility)
      await this.prisma.logoGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          logoId: logos[0].id,
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

  async generateBrandImage(prompt: string): Promise<string> {
    try {
      const model = this.gemini.models;
      const response = await model.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
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
      const cloudinaryUrl = await this.cloudinaryService.uploadImage(imageUrl);

      return cloudinaryUrl;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new HttpException(
        `Failed to generate brand image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
