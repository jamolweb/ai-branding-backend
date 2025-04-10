import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';

@Injectable()
export class LogoService {
  private readonly API_TIMEOUT = 30000; // 30 seconds timeout for DALL-E
  private readonly DALLE_API_URL =
    'https://api.openai.com/v1/images/generations';

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  async enhancePrompt(dto: EnhancePromptDto): Promise<string> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new HttpException(
        'DEEPSEEK_API_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const response = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content:
                  'You are a prompt engineering expert. Enhance the given text to make it a better prompt for AI image generation. Be concise but specific. Keep the response minimalistic to the point.',
              },
              {
                role: 'user',
                content: dto.text,
              },
            ],
            temperature: 0.5,
            max_tokens: 150,
            presence_penalty: 0,
            frequency_penalty: 0,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new HttpException(
          `DeepSeek API error: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Request timeout: DeepSeek API took too long to respond',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new HttpException(
        `Failed to enhance prompt: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get user's logos
  async getUserLogos(userId: string) {
    return this.prisma.logo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { favoritedBy: true },
        },
      },
    });
  }

  // Get user's favorite logos
  async getUserFavorites(userId: string) {
    return this.prisma.favoriteLogo.findMany({
      where: { userId },
      include: {
        logo: {
          include: {
            _count: {
              select: { favoritedBy: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Add logo to favorites
  async addToFavorites(userId: string, logoId: string) {
    // Check if logo exists
    const logo = await this.prisma.logo.findUnique({
      where: { id: logoId },
    });

    if (!logo) {
      throw new HttpException('Logo not found', HttpStatus.NOT_FOUND);
    }

    try {
      return await this.prisma.favoriteLogo.create({
        data: {
          userId,
          logoId,
        },
        include: {
          logo: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new HttpException(
          'Logo already in favorites',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  // Remove logo from favorites
  async removeFromFavorites(userId: string, logoId: string) {
    const favorite = await this.prisma.favoriteLogo.findFirst({
      where: {
        userId,
        logoId,
      },
    });

    if (!favorite) {
      throw new HttpException(
        'Logo not found in favorites',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.favoriteLogo.delete({
      where: {
        id: favorite.id,
      },
    });

    return { message: 'Logo removed from favorites' };
  }

  // Check if a logo is favorited by user
  async isLogoFavorited(userId: string, logoId: string) {
    const favorite = await this.prisma.favoriteLogo.findFirst({
      where: {
        userId,
        logoId,
      },
    });

    return { isFavorited: !!favorite };
  }

  // Delete logo from both Cloudinary and database
  async deleteLogo(userId: string, logoId: string) {
    // First check if logo exists and belongs to user
    const logo = await this.prisma.logo.findFirst({
      where: {
        id: logoId,
        userId,
      },
    });

    if (!logo) {
      throw new HttpException(
        'Logo not found or unauthorized',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      // Extract public_id from Cloudinary URL
      const urlParts = logo.imageUrl.split('/');
      const filenameWithExtension = urlParts[urlParts.length - 1];
      const publicId = `logos/${filenameWithExtension.split('.')[0]}`; // Assuming logos folder in Cloudinary

      // Delete from Cloudinary
      await new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // Delete all favorite records first (due to foreign key constraints)
      await this.prisma.favoriteLogo.deleteMany({
        where: {
          logoId,
        },
      });

      // Delete the logo from database
      await this.prisma.logo.delete({
        where: {
          id: logoId,
        },
      });

      return { message: 'Logo deleted successfully' };
    } catch (error) {
      console.error('Error deleting logo:', error);
      throw new HttpException(
        'Failed to delete logo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
