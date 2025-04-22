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

  async uploadLogo(file: Express.Multer.File): Promise<string> {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'brandbook/logos',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(file.buffer);
      });

      return (result as any).secure_url;
    } catch (error) {
      console.error('Error uploading logo to Cloudinary:', error);
      throw error;
    }
  }

  async uploadPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'brandbook/pdfs',
            resource_type: 'raw',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(pdfBuffer);
      });

      return (result as any).secure_url;
    } catch (error) {
      console.error('Error uploading PDF to Cloudinary:', error);
      throw error;
    }
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  }
}
