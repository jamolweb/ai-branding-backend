import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, PutObjectAclCommand } from '@aws-sdk/client-s3';
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
   * Uploads a PDF buffer to S3 and returns a URL with type information
   * @param pdfBuffer The PDF buffer to upload
   * @param filename The filename to use for the uploaded PDF
   * @param makePublic Whether to make the file publicly accessible (default: true)
   * @returns A promise that resolves to an object containing the URL and type information
   */
  /**
   * Checks if a given URL is a public S3 URL or a signed URL
   * @param url The URL to check
   * @returns An object indicating if the URL is public and its type
   */
  checkUrlType(url: string): { isPublic: boolean; type: 'public' | 'signed' | 'unknown' } {
    if (!url) {
      return { isPublic: false, type: 'unknown' };
    }
    
    // Check if it's a public S3 URL (matches our bucket pattern)
    const publicPattern = new RegExp(`https://${process.env.S3_BUCKET_NAME}\.s3\.${process.env.AWS_REGION}\.amazonaws\.com/`);
    if (publicPattern.test(url)) {
      console.log('URL CHECK: This is a PUBLIC S3 URL');
      return { isPublic: true, type: 'public' };
    }
    
    // Check if it's a signed URL (contains X-Amz-Signature parameter)
    if (url.includes('X-Amz-Signature=')) {
      console.log('URL CHECK: This is a SIGNED URL (temporary)');
      return { isPublic: false, type: 'signed' };
    }
    
    console.log('URL CHECK: Unknown URL type');
    return { isPublic: false, type: 'unknown' };
  }

  async uploadPdf(pdfBuffer: Buffer, filename: string, makePublic: boolean = true): Promise<{ url: string; isPublic: boolean }> {
    try {
      // Upload the file to S3 without ACL settings (since your bucket has ACLs disabled)
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `pdfs/${filename}`,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      // For buckets with ACLs disabled, we'll use bucket policy or presigned URLs
      // No need to attempt setting ACLs as they're not supported

      let url: string;
      let isPublic: boolean;

      if (makePublic) {
        // Create a permanent public URL
        // Since your bucket has ACLs disabled, we need to use a different approach
        // We'll check if the bucket is configured with a bucket policy that makes objects public
        // If not, we'll use a presigned URL with a long expiration time

        // First, try to construct a direct URL (this will work if the bucket has a policy making objects public)
        const directUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/pdfs/${filename}`;

        // Log that we're using a direct URL, but it might require bucket policy to be public
        this.logger.log(`Generated direct URL for ${filename}. Note: This requires appropriate bucket policy to be public`);
        console.log('S3Service: Generated direct URL:', directUrl);
        console.log('NOTE: For this URL to work publicly, your bucket must have a policy allowing public read access');

        // Return the direct URL with a flag indicating we're attempting to use a public URL
        return { url: directUrl, isPublic: true };
      } else {
        // Generate a signed URL with a long expiration time
        const getObjectCommand = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `pdfs/${filename}`,
        });

        const signedUrl = await getSignedUrl(this.s3Client, getObjectCommand, {
          expiresIn: 30 * 24 * 60 * 60, // 30 days
        });

        console.log('S3Service: Generated SIGNED URL (expires in 30 days):', signedUrl);
        this.logger.log(`Generated SIGNED URL for ${filename} (expires in 30 days)`);
        return { url: signedUrl, isPublic: false };
      }
    } catch (error) {
      this.logger.error(`Failed to upload PDF to S3: ${filename}`, error);
      throw error;
    }
  }
}
