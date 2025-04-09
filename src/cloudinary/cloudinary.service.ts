import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(base64Image: string): Promise<string> {
    try {
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: 'image',
              folder: 'logos',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          )
          .end(Buffer.from(base64Data, 'base64'));
      });

      return (result as any).secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }
}
