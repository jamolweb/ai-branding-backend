import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { OpenAI } from 'openai';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private cloudinaryService: CloudinaryService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateLogo(prompt: string): Promise<string[]> {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
      });

      const dalleUrl = response.data[0].url;

      // Download the image from DALL-E
      const imageResponse = await axios.get(dalleUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(imageResponse.data);

      // Convert buffer to base64 string for CloudinaryService
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

      // Upload to Cloudinary using existing service
      const cloudinaryUrl =
        await this.cloudinaryService.uploadImage(base64Image);

      return [cloudinaryUrl];
    } catch (error) {
      console.error('Error generating or uploading logo:', error);
      throw error;
    }
  }
}
