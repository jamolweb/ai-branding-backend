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

  async uploadPdf(pdfBuffer: Buffer, filename?: string): Promise<string> {
    try {
      // Generate a unique filename with .pdf extension if not provided
      const uniqueFilename =
        filename ||
        `${Date.now()}-${Math.random().toString(36).substring(2)}.pdf`;

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'brandbook/pdfs',
            resource_type: 'raw',
            public_id: uniqueFilename.replace(/\.pdf$/, ''), // Remove .pdf extension as Cloudinary will add it
            format: 'pdf', // Explicitly set the format to PDF
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

  async uploadFile(
    buffer: Buffer,
    options: {
      filename: string;
      folder: string;
      resourceType?: 'raw' | 'image' | 'video' | 'auto';
    },
  ): Promise<string> {
    try {
      const fileExtension = options.filename.split('.').pop()?.toLowerCase();
      const isPdf = fileExtension === 'pdf';

      const uploadOptions = {
        folder: options.folder,
        resource_type:
          options.resourceType || ((isPdf ? 'raw' : 'auto') as 'raw' | 'auto'),
        public_id: options.filename.replace(/\.[^/.]+$/, ''), // Remove extension
        format: fileExtension, // Explicitly set the format to maintain extension
      };

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        uploadStream.end(buffer);
      });

      return (result as any).secure_url;
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
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
