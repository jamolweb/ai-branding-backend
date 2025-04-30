import { Injectable } from '@nestjs/common';
import { createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import { GenerateSimpleBrandbookDto } from '../dto/generate-simple-brandbook.dto';

@Injectable()
export class SimplePdfGeneratorService {
  async generateSimpleBrandbook(
    data: GenerateSimpleBrandbookDto,
  ): Promise<string> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    // Create directory if it doesn't exist
    const pdfDir = path.join(process.cwd(), 'public', 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });

    // Generate unique filename
    const filename = `${data.companyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, filename);
    const writeStream = createWriteStream(filePath);

    // Pipe the PDF document to a write stream
    doc.pipe(writeStream);

    // Cover Page
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(data.companyName, { align: 'center' })
      .moveDown(2);

    // Description
    doc
      .font('Helvetica')
      .fontSize(14)
      .text('Brand Description', { underline: true })
      .moveDown()
      .text(data.description)
      .moveDown(2);

    // Author Information
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('Contact Information', { underline: true })
      .moveDown()
      .font('Helvetica')
      .fontSize(12)
      .text(`Name: ${data.authorName}`)
      .text(`Role: ${data.authorRole}`)
      .text(`Email: ${data.authorEmail}`);

    // Footer
    doc
      .fontSize(10)
      .text(
        `Generated on ${new Date().toLocaleDateString()}`,
        50,
        doc.page.height - 50,
        {
          align: 'center',
        },
      );

    // Finalize the PDF
    doc.end();

    // Wait for the write stream to finish
    await new Promise<void>((resolve) =>
      writeStream.on('finish', () => resolve()),
    );

    // Return the filename
    return filename;
  }
}
