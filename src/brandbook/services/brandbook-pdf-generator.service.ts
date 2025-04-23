import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { GeminiService } from '../../gemini/gemini.service';
import { AIContentService } from './ai-content.service';

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
  industry?: string;
}

@Injectable()
export class BrandBookPdfGeneratorService {
  private currentPage = 1;

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly geminiService: GeminiService,
    private readonly aiContentService: AIContentService,
  ) {}

  async generateBrandBook(config: BrandBookConfig): Promise<Buffer> {
    this.currentPage = 1;

    if (
      !config.description ||
      !config.mission ||
      !config.vision ||
      !config.coreValues
    ) {
      const aiContent = await this.aiContentService.generateBrandContent(
        config.companyName,
        config.industry || 'technology',
      );

      config = {
        ...config,
        description: config.description || aiContent.description,
        mission: config.mission || aiContent.mission,
        vision: config.vision || aiContent.vision,
        coreValues: config.coreValues || aiContent.coreValues,
      };
    }

    const colorPalette = await this.aiContentService.generateColorPalette(
      config.preferredColor,
    );

    const mockups = await this.aiContentService.generateApplicationMockups(
      config.companyName,
      config.industry || 'technology',
      colorPalette,
    );

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    doc.registerFont(
      'Poppins-Regular',
      path.join(fontsDir, 'Poppins-Regular.ttf'),
    );
    doc.registerFont('Poppins-Bold', path.join(fontsDir, 'Poppins-Bold.ttf'));

    await this.generateCoverPage(doc, config);
    await this.generateBrandOverview(doc, config);
    await this.generatePurposePage(doc, config);
    await this.generateLogoPage(doc, config);
    await this.generateColorPalette(doc, config, colorPalette);
    await this.generateTypography(doc, config);
    await this.generateVisualStyle(doc, config);
    await this.generateVoiceAndTone(doc, config);
    await this.generateApplications(doc, config, mockups);
    await this.generateContactPage(doc, config);

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private async generateCoverPage(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F5F5F5');

    doc.rect(0, 0, 10, doc.page.height).fill(config.preferredColor);

    const titleY = doc.page.height / 3;
    doc
      .font('Poppins-Bold')
      .fontSize(72)
      .fillColor('#333333')
      .text('BRAND BOOK', 50, titleY - 100, {
        align: 'center',
        width: doc.page.width - 100,
      });

    doc
      .font('Poppins-Bold')
      .fontSize(48)
      .fillColor(config.preferredColor)
      .text(config.companyName.toUpperCase(), 50, titleY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    const taglineY = titleY + 80;
    doc
      .font('Poppins-Regular')
      .fontSize(24)
      .fillColor('#666666')
      .text(config.tagline, 50, taglineY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    const authorY = doc.page.height - 150;
    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#666666')
      .text('PREPARED BY', 50, authorY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    doc
      .font('Poppins-Bold')
      .fontSize(18)
      .fillColor('#333333')
      .text(config.authorName, 50, authorY + 20, {
        align: 'center',
        width: doc.page.width - 100,
      });

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#666666')
      .text(config.authorRole, 50, authorY + 45, {
        align: 'center',
        width: doc.page.width - 100,
      });

    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateBrandOverview(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Brand Overview', config.preferredColor);

    const contentY = 150;
    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#333333')
      .text(config.description || '', 50, contentY, {
        width: doc.page.width - 100,
        align: 'justify',
      });

    if (config.logoUrl) {
      const logoY = contentY + 100;
      doc.image(config.logoUrl, 50, logoY, {
        width: 200,
        height: 200,
        fit: [200, 200],
      });
    }

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generatePurposePage(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Our Purpose', config.preferredColor);

    let yOffset = 150;

    this.addSubsectionTitle(doc, 'Mission', config.preferredColor, yOffset);
    yOffset += 40;

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#333333')
      .text(config.mission || '', 50, yOffset, {
        width: doc.page.width - 100,
      });

    yOffset += 80;
    this.addSubsectionTitle(doc, 'Vision', config.preferredColor, yOffset);
    yOffset += 40;

    doc
      .font('Poppins-Regular')
      .fontSize(14)
      .fillColor('#333333')
      .text(config.vision || '', 50, yOffset, {
        width: doc.page.width - 100,
      });

    yOffset += 80;
    this.addSubsectionTitle(doc, 'Core Values', config.preferredColor, yOffset);
    yOffset += 40;

    const values = config.coreValues || [];
    const columns = 2;
    const valueWidth = (doc.page.width - 150) / columns;

    values.forEach((value, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 50 + col * valueWidth;
      const y = yOffset + row * 80;

      doc
        .rect(x, y, valueWidth - 20, 60)
        .fill('#F5F5F5')
        .fillColor('#333333')
        .font('Poppins-Bold')
        .fontSize(14)
        .text(value, x + 15, y + 20, {
          width: valueWidth - 50,
          align: 'left',
        });
    });

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateLogoPage(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc
      .font('Poppins-Bold')
      .fontSize(32)
      .fillColor(config.preferredColor)
      .text('Logo & Usage', 50, 50);

    if (config.logoUrl) {
    }

    doc.addPage();
  }

  private async generateColorPalette(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
    colorPalette: string[],
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Color Palette', config.preferredColor);

    let yOffset = 150;
    const swatchSize = 100;
    const swatchesPerRow = 3;
    const margin = 50;
    const spacing = 30;
    const swatchWidth =
      (doc.page.width - 2 * margin - (swatchesPerRow - 1) * spacing) /
      swatchesPerRow;

    this.addColorSwatch(
      doc,
      config.preferredColor,
      'Primary Color',
      margin,
      yOffset,
      swatchWidth,
    );

    colorPalette.forEach((color, index) => {
      const row = Math.floor((index + 1) / swatchesPerRow);
      const col = (index + 1) % swatchesPerRow;
      const x = margin + col * (swatchWidth + spacing);
      const y = yOffset + row * (swatchSize + spacing);

      const colorType =
        index < 2 ? 'Complementary' : index < 4 ? 'Accent' : 'Neutral';
      this.addColorSwatch(doc, color, `${colorType} Color`, x, y, swatchWidth);
    });

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateTypography(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Typography', config.preferredColor);

    let yOffset = 150;

    const samples = [
      { size: 48, weight: 'Bold', text: 'Heading 1', description: '48px Bold' },
      { size: 36, weight: 'Bold', text: 'Heading 2', description: '36px Bold' },
      { size: 24, weight: 'Bold', text: 'Heading 3', description: '24px Bold' },
      {
        size: 18,
        weight: 'Bold',
        text: 'Subheading',
        description: '18px Bold',
      },
      {
        size: 16,
        weight: 'Regular',
        text: 'Body Text',
        description: '16px Regular',
      },
      {
        size: 14,
        weight: 'Regular',
        text: 'Small Text',
        description: '14px Regular',
      },
    ];

    samples.forEach((sample) => {
      doc.rect(50, yOffset, doc.page.width - 100, 80).fill('#F5F5F5');

      doc
        .font(`Poppins-${sample.weight}`)
        .fontSize(sample.size)
        .fillColor('#333333')
        .text(sample.text, 70, yOffset + 20);

      doc
        .font('Poppins-Regular')
        .fontSize(12)
        .fillColor('#666666')
        .text(sample.description, doc.page.width - 200, yOffset + 20);

      yOffset += 100;
    });

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateVisualStyle(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Visual Style Guidelines', config.preferredColor);

    let yOffset = 150;

    this.addSubsectionTitle(
      doc,
      'Photography Style',
      config.preferredColor,
      yOffset,
    );
    yOffset += 40;

    const photoStyles = [
      {
        title: 'Lighting',
        description:
          'Natural, bright lighting that creates a clean and professional atmosphere.',
      },
      {
        title: 'Composition',
        description: 'Clean, uncluttered compositions with clear focal points.',
      },
      {
        title: 'Color Treatment',
        description:
          'Consistent color grading that aligns with the brand palette.',
      },
    ];

    photoStyles.forEach((style) => {
      doc
        .rect(50, yOffset, doc.page.width - 100, 80)
        .fill('#F5F5F5')
        .font('Poppins-Bold')
        .fontSize(16)
        .fillColor('#333333')
        .text(style.title, 70, yOffset + 20)
        .font('Poppins-Regular')
        .fontSize(14)
        .text(style.description, 70, yOffset + 45, {
          width: doc.page.width - 140,
        });
      yOffset += 100;
    });

    yOffset += 20;
    this.addSubsectionTitle(
      doc,
      'Imagery Guidelines',
      config.preferredColor,
      yOffset,
    );
    yOffset += 40;

    const guidelines = [
      'Use high-quality, professional imagery',
      'Maintain consistent style across all materials',
      'Avoid overly filtered or artificial-looking photos',
      'Ensure images reflect brand values and message',
    ];

    guidelines.forEach((guideline) => {
      doc
        .font('Poppins-Regular')
        .fontSize(14)
        .fillColor('#333333')
        .text(`• ${guideline}`, 70, yOffset);
      yOffset += 30;
    });

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateVoiceAndTone(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Voice & Tone', config.preferredColor);

    let yOffset = 150;

    this.addSubsectionTitle(
      doc,
      'Brand Voice Characteristics',
      config.preferredColor,
      yOffset,
    );
    yOffset += 40;

    const voiceCharacteristics = [
      {
        trait: 'Professional',
        description:
          'Clear, competent, and authoritative while remaining accessible',
      },
      {
        trait: 'Friendly',
        description: 'Warm and approachable, building trust with our audience',
      },
      {
        trait: 'Innovative',
        description: 'Forward-thinking and solution-oriented',
      },
      {
        trait: 'Authentic',
        description: 'Genuine, transparent, and honest in all communications',
      },
    ];

    voiceCharacteristics.forEach((char) => {
      doc
        .rect(50, yOffset, doc.page.width - 100, 80)
        .fill('#F5F5F5')
        .font('Poppins-Bold')
        .fontSize(16)
        .fillColor('#333333')
        .text(char.trait, 70, yOffset + 20)
        .font('Poppins-Regular')
        .fontSize(14)
        .text(char.description, 70, yOffset + 45, {
          width: doc.page.width - 140,
        });
      yOffset += 100;
    });

    yOffset += 20;
    this.addSubsectionTitle(
      doc,
      'Writing Guidelines',
      config.preferredColor,
      yOffset,
    );
    yOffset += 40;

    const writingGuidelines = [
      'Use active voice and direct language',
      'Keep sentences concise and clear',
      'Avoid jargon and overly technical terms',
      'Maintain a consistent tone across all platforms',
      'Address the audience directly using "you" and "your"',
    ];

    writingGuidelines.forEach((guideline) => {
      doc
        .font('Poppins-Regular')
        .fontSize(14)
        .fillColor('#333333')
        .text(`• ${guideline}`, 70, yOffset);
      yOffset += 30;
    });

    // this.addFooter(doc, config);
    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateApplications(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
    mockups: string[],
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Brand Applications', config.preferredColor);

    let yOffset = 150;

    const categories = [
      {
        title: 'Digital Presence',
        items: ['Website', 'Social Media', 'Email Templates', 'Digital Ads'],
      },
      {
        title: 'Print Materials',
        items: ['Business Cards', 'Letterheads', 'Brochures', 'Presentations'],
      },
      {
        title: 'Marketing Collateral',
        items: [
          'Product Catalogs',
          'Banners',
          'Promotional Items',
          'Event Materials',
        ],
      },
      {
        title: 'Brand Assets',
        items: [
          'Logo Variations',
          'Icon Set',
          'Photography Style',
          'Illustration Style',
        ],
      },
    ];

    categories.forEach((category) => {
      this.addSubsectionTitle(
        doc,
        category.title,
        config.preferredColor,
        yOffset,
      );
      yOffset += 40;

      doc.rect(50, yOffset, doc.page.width - 100, 100).fill('#F5F5F5');

      let itemX = 70;
      category.items.forEach((item) => {
        doc
          .font('Poppins-Regular')
          .fontSize(14)
          .fillColor('#333333')
          .text(item, itemX, yOffset + 20);
        itemX += 150;
      });

      yOffset += 120;
    });

    this.addPageNumber(doc);
    doc.addPage();
  }

  private async generateContactPage(
    doc: PDFKit.PDFDocument,
    config: BrandBookConfig,
  ) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
    doc.rect(0, 0, doc.page.width, 120).fill('#F5F5F5');

    this.addSectionTitle(doc, 'Contact Information', config.preferredColor);

    let yOffset = 150;

    doc.rect(50, yOffset, doc.page.width - 100, 200).fill('#F5F5F5');

    doc
      .font('Poppins-Bold')
      .fontSize(24)
      .fillColor('#333333')
      .text(config.authorName, 70, yOffset + 40);

    doc
      .font('Poppins-Regular')
      .fontSize(16)
      .fillColor('#666666')
      .text(config.authorRole, 70, yOffset + 70)
      .text(config.authorEmail, 70, yOffset + 100);

    try {
      const qrCodeBuffer = await this.generateQRCode(
        `mailto:${config.authorEmail}`,
      );
      doc.image(qrCodeBuffer, doc.page.width - 200, yOffset + 20, {
        width: 120,
        height: 120,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }

    doc
      .font('Poppins-Regular')
      .fontSize(12)
      .fillColor('#666666')
      .text(
        `© ${new Date().getFullYear()} ${config.companyName}. All rights reserved.`,
        50,
        doc.page.height - 100,
        {
          width: doc.page.width - 100,
          align: 'center',
        },
      );

    this.addPageNumber(doc);
  }

  private async generateQRCode(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data);
  }

  private addSectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    color: string,
  ) {
    doc.font('Poppins-Bold').fontSize(36).fillColor(color).text(title, 50, 40);
  }

  private addSubsectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    color: string,
    y: number,
  ) {
    doc.font('Poppins-Bold').fontSize(24).fillColor(color).text(title, 50, y);
  }

  private addColorSwatch(
    doc: PDFKit.PDFDocument,
    color: string,
    label: string,
    x: number,
    y: number,
    width: number,
  ) {
    const height = 100;

    doc.rect(x, y, width, height).fill(color);

    doc
      .font('Poppins-Bold')
      .fontSize(14)
      .fillColor('#333333')
      .text(label, x, y + height + 10);

    doc
      .font('Poppins-Regular')
      .fontSize(12)
      .fillColor('#666666')
      .text(color.toUpperCase(), x, y + height + 30);
  }

  private addFooter(doc: PDFKit.PDFDocument, config: BrandBookConfig) {
    const footerY = doc.page.height - 50;

    doc
      .font('Poppins-Regular')
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `${config.authorName} | ${config.authorRole} | ${config.authorEmail}`,
        50,
        footerY,
        {
          width: doc.page.width - 100,
          align: 'center',
        },
      );
  }

  private addPageNumber(doc: PDFKit.PDFDocument) {
    doc
      .font('Poppins-Regular')
      .fontSize(10)
      .fillColor('#666666')
      .text(`${this.currentPage}`, doc.page.width - 50, doc.page.height - 50, {
        align: 'right',
      });

    this.currentPage++;
  }
}
