import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Uploads a PDF buffer to S3 and returns a signed URL
   * @param pdfBuffer The PDF buffer to upload
   * @param filename The filename to use for the uploaded PDF
   * @returns A promise that resolves to the signed URL of the uploaded PDF
   */
  async uploadPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `pdfs/${filename}`,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `pdfs/${filename}`,
      });

      const signedUrl = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn: 24 * 60 * 60, // 24 hours
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to upload PDF to S3: ${filename}`, error);
      throw error;
    }
  }
}
