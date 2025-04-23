import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { GeminiService } from '../../gemini/gemini.service';

interface BrandBookConfig {
  companyName: string;
  tagline: string;
  preferredColor: string;
  authorName: string;
  authorRole: string;
  authorEmail: string;
  logoUrl?: string;
  description?: string;
  mission?: string;
  vision?: string;
  coreValues?: string[];
}

@Injectable()
export class PdfGeneratorService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly geminiService: GeminiService,
  ) {}

  async generateBrandBook(config: BrandBookConfig): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Register Poppins font (you'll need to have the font files in your assets)
    doc.registerFont('Poppins-Regular', 'assets/fonts/Poppins-Regular.ttf');
    doc.registerFont('Poppins-Bold', 'assets/fonts/Poppins-Bold.ttf');

    // Generate each page
    await this.generateCoverPage(doc, config);
    await this.generateBrandOverview(doc, config);
    await this.generatePurposePage(doc, config);
    await this.generateLogoPage(doc, config);
    await this.generateColorPalette(doc, config);
    await this.generateTypography(doc, config);
    await this.generateVisualStyle(doc, config);
    await this.generateVoiceAndTone(doc, config);
    await this.generateApplications(doc, config);
    await this.generateContactPage(doc, config);

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private async generateCoverPage(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');

    // Title
    const titleY = doc.page.height / 3;
    doc
      .font('Poppins-Bold')
      .fontSize(72)
      .fillColor(config.preferredColor)
      .text(config.companyName, 50, titleY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    // Tagline
    const taglineY = titleY + 100;
    doc
      .font('Poppins-Regular')
      .fontSize(20)
      .fillColor('#007B50')
      .text(config.tagline, 50, taglineY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    // Author credit
    doc
      .font('Poppins-Regular')
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Prepared by ${config.authorName}, ${config.authorRole}`,
        50,
        doc.page.height - 100,
        {
          align: 'center',
          width: doc.page.width - 100,
        },
      );

    doc.addPage();
  }

  private async generateBrandOverview(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Brand Overview', 50, 50);

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#333333')
      .text(config.description || '', 50, 100, {
        width: doc.page.width - 100,
        align: 'justify',
      });

    // Author block
    doc
      .font('Poppins-Regular')
      .fontSize(12)
      .text(`${config.authorName}`, 50, doc.page.height - 150)
      .text(`${config.authorRole}`, 50, doc.page.height - 130)
      .text(`${config.authorEmail}`, 50, doc.page.height - 110);

    doc.addPage();
  }

  private async generatePurposePage(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Our Purpose', 50, 50);

    // Mission
    doc.font('Poppins-Bold').fontSize(20).text('Mission', 50, 120);

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .text(config.mission || '', 50, 150);

    // Vision
    doc.font('Poppins-Bold').fontSize(20).text('Vision', 50, 250);

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .text(config.vision || '', 50, 280);

    // Core Values
    doc.font('Poppins-Bold').fontSize(20).text('Core Values', 50, 380);

    let yOffset = 410;
    (config.coreValues || []).forEach((value, index) => {
      doc
        .font('Poppins-Regular')
        .fontSize(14)
        .text(`${index + 1}. ${value}`, 70, yOffset);
      yOffset += 30;
    });

    doc.addPage();
  }

  private async generateLogoPage(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Logo & Usage', 50, 50);

    if (config.logoUrl) {
      // Add logo display logic here
      // You'll need to download and embed the logo image
    }

    doc.addPage();
  }

  private async generateColorPalette(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Color Palette', 50, 50);

    // Primary color
    const rgb = this.hexToRgb(config.preferredColor);
    doc.rect(50, 100, 100, 100).fill(config.preferredColor);

    doc
      .font('Poppins-Regular')
      .fontSize(12)
      .fillColor('#333333')
      .text(
        `Primary Color
HEX: ${config.preferredColor}
RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`,
        160,
        100,
      );

    doc.addPage();
  }

  private async generateTypography(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Typography', 50, 50);

    // Typography examples
    doc.font('Poppins-Bold').fontSize(40).text('Heading 1', 50, 120);

    doc.font('Poppins-Bold').fontSize(32).text('Heading 2', 50, 180);

    doc.font('Poppins-Bold').fontSize(24).text('Heading 3', 50, 240);

    doc.font('Poppins-Regular').fontSize(16).text('Body Text', 50, 300);

    doc.addPage();
  }

  private async generateVisualStyle(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Visual Style', 50, 50);

    // Visual style content will be added here
    doc.addPage();
  }

  private async generateVoiceAndTone(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Voice & Tone', 50, 50);

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .text('Brand Voice: Friendly, knowledgeable, forward-thinking', 50, 100);

    doc.addPage();
  }

  private async generateApplications(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Applications', 50, 50);

    // Applications content will be added here
    doc.addPage();
  }

  private async generateContactPage(
    doc: typeof PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Contact & Credits', 50, 50);

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .text(
        `${config.authorName}
${config.authorEmail}`,
        50,
        100,
      );

    // Generate and add QR code
    const qrCodeBuffer = await this.generateQRCode(
      `mailto:${config.authorEmail}`,
    );
    // Add QR code image logic here

    doc
      .font('Poppins-Regular')
      .fontSize(10)
      .text('© 2024 All rights reserved.', 50, doc.page.height - 100);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private async generateQRCode(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data);
  }
}
