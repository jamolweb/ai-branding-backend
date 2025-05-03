import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor() {
    // Register Handlebars helpers upon service initialization
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers() {
    // Helper to split a string by a separator (default: comma) and trim whitespace.
    // Usage: {{#each (split myString ",")}}<li>{{this}}</li>{{/each}}
    Handlebars.registerHelper('split', (str: string, separator: string) => {
      if (typeof str !== 'string') return [];
      // Split, trim each item, and filter out empty strings
      return str
        .split(separator || ',')
        .map((item) => item.trim())
        .filter(Boolean);
    });

    // Helper to trim leading/trailing whitespace from a string.
    // Usage: {{trim myString}}
    // Note: Often used within #each loops after splitting.
    Handlebars.registerHelper('trim', (str: string) => {
      if (typeof str !== 'string') return '';
      return str.trim();
      // Note: The 'split' helper above already includes trimming.
      // This separate helper might be redundant unless needed elsewhere.
    });

    // Helper to convert newline characters (\n) into HTML <br> tags.
    // Automatically handles HTML escaping of the text content for security.
    // Usage: {{{multiline myText}}}
    Handlebars.registerHelper('multiline', (text: string) => {
      if (typeof text !== 'string') return '';
      const lines = text.split('\n');
      const escapedLines = lines.map((line) =>
        Handlebars.Utils.escapeExpression(line),
      );
      const result = escapedLines.join('<br>');
      // Use SafeString to prevent Handlebars from escaping the <br> tags
      return new Handlebars.SafeString(result);
    });

    this.logger.log('Handlebars helpers registered: split, trim, multiline.');
  }

  async generatePdfSimple(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Error generating PDF (simple):', error);
      throw error;
    } finally {
      await page.close();
      await browser.close();
    }
  }

  async generatePdfFromTemplate(
    templateName: string,
    data: any,
  ): Promise<Buffer> {
    this.logger.log(`Generating PDF using template: ${templateName}`);
    let browser: puppeteer.Browser | null = null;

    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'brandbook',
        `${templateName}.hbs`,
      );
      this.logger.debug(`Reading template file: ${templatePath}`);

      const templateSource = await fs.readFile(templatePath, 'utf-8');

      // --- NEW: Prepare dynamic font links ---
      let fontLinks = '';
      const fontsToLoad: string[] = [];
      if (data.primaryFontName && typeof data.primaryFontName === 'string') {
        fontsToLoad.push(data.primaryFontName.trim());
      }
      if (
        data.secondaryFontName &&
        typeof data.secondaryFontName === 'string'
      ) {
        fontsToLoad.push(data.secondaryFontName.trim());
      }
      // Add default/base fonts if needed (e.g., Inter is already linked in template)
      // fontsToLoad.push('Inter');

      const uniqueFonts = [...new Set(fontsToLoad)]; // Remove duplicates

      if (uniqueFonts.length > 0) {
        // Construct Google Fonts URL (basic version, assumes weights 400, 700, 900 available)
        // More robust solution might check available weights via Google Fonts API
        const googleFontsUrl = `https://fonts.googleapis.com/css2?${uniqueFonts
          .map((font) => `family=${font.replace(/\s+/g, '+')}:wght@400;700;900`)
          .join('&')}&display=swap`;

        fontLinks = `
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="${googleFontsUrl}" rel="stylesheet">
        `;
        this.logger.debug(`Generated Google Fonts link: ${googleFontsUrl}`);
      }
      // --- End Font Links ---

      // Inject font links into the template source before compiling
      // This is a basic injection, might need more robust parsing if head tag is complex
      const finalTemplateSource = templateSource.replace(
        '</title>\n',
        `</title>\n${fontLinks}\n`,
      );

      // Compile template
      const compiledTemplate = Handlebars.compile(finalTemplateSource); // Use modified source

      // Render HTML
      const html = compiledTemplate(data);
      this.logger.debug(
        `Rendered HTML from template ${templateName} with dynamic fonts.`,
      );

      // Puppeteer launch and PDF generation (remains the same)
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      // Increase timeout? Wait until load?
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      }); // Wait longer for fonts
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      this.logger.log(
        `Successfully generated PDF buffer for template ${templateName}`,
      );
      await page.close();
      await browser.close();
      browser = null;
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(
        `Error generating PDF from template ${templateName}:`,
        error,
      );
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          this.logger.error(
            'Error closing browser after PDF generation error:',
            closeError,
          );
        }
      }
      throw new Error(`Failed to generate PDF from template: ${error.message}`);
    }
  }
}
