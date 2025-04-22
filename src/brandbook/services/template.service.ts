import { Injectable } from '@nestjs/common';
import { CreateBrandbookDto } from '../dto/create-brandbook.dto';
import { BrandbookContent } from '../interfaces/brandbook-content.interface';

@Injectable()
export class TemplateService {
  generateHTML(content: BrandbookContent, input: CreateBrandbookDto): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${input.companyName} Brand Guidelines</title>
        <style>
          :root {
            --primary-color: ${content.colorPalette.primary};
            --secondary-color: ${content.colorPalette.secondary};
            --accent-color: ${content.colorPalette.accent};
          }
          body {
            font-family: ${content.typography.primaryFont}, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }
          h1, h2, h3 {
            color: var(--primary-color);
          }
          .section {
            margin-bottom: 3rem;
            padding: 2rem;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .color-swatch {
            display: inline-block;
            width: 100px;
            height: 100px;
            margin: 10px;
            border-radius: 8px;
          }
          .guidelines-list {
            list-style-type: none;
            padding-left: 0;
          }
          .guidelines-list li {
            margin-bottom: 1rem;
            padding-left: 1.5rem;
            position: relative;
          }
          .guidelines-list li:before {
            content: "•";
            color: var(--primary-color);
            position: absolute;
            left: 0;
          }
        </style>
      </head>
      <body>
        <header class="section">
          <h1>${input.companyName} Brand Guidelines</h1>
          <p>${input.tagline || ''}</p>
        </header>

        <section class="section">
          <h2>Brand Identity</h2>
          <h3>Mission</h3>
          <p>${content.brandIdentity.mission}</p>
          <h3>Vision</h3>
          <p>${content.brandIdentity.vision}</p>
          <h3>Values</h3>
          <ul class="guidelines-list">
            ${content.brandIdentity.values.map((value) => `<li>${value}</li>`).join('')}
          </ul>
        </section>

        <section class="section">
          <h2>Typography</h2>
          <h3>Primary Font: ${content.typography.primaryFont}</h3>
          <h3>Secondary Font: ${content.typography.secondaryFont}</h3>
          <ul class="guidelines-list">
            ${content.typography.fontUsageGuidelines.map((guideline) => `<li>${guideline}</li>`).join('')}
          </ul>
        </section>

        <section class="section">
          <h2>Color Palette</h2>
          <div>
            <div class="color-swatch" style="background-color: ${content.colorPalette.primary}"></div>
            <div class="color-swatch" style="background-color: ${content.colorPalette.secondary}"></div>
            <div class="color-swatch" style="background-color: ${content.colorPalette.accent}"></div>
          </div>
          <ul class="guidelines-list">
            ${content.colorPalette.colorUsageGuidelines.map((guideline) => `<li>${guideline}</li>`).join('')}
          </ul>
        </section>

        <section class="section">
          <h2>Logo Guidelines</h2>
          <p><strong>Minimum Size:</strong> ${content.logoGuidelines.minimumSize}</p>
          <p><strong>Clear Space:</strong> ${content.logoGuidelines.clearSpace}</p>
          <h3>Do's</h3>
          <ul class="guidelines-list">
            ${content.logoGuidelines.dosDonts.dos.map((item) => `<li>${item}</li>`).join('')}
          </ul>
          <h3>Don'ts</h3>
          <ul class="guidelines-list">
            ${content.logoGuidelines.dosDonts.donts.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </section>

        <section class="section">
          <h2>Voice & Tone</h2>
          <h3>Characteristics</h3>
          <ul class="guidelines-list">
            ${content.voiceTone.characteristics.map((char) => `<li>${char}</li>`).join('')}
          </ul>
          <h3>Examples</h3>
          <p><strong>Formal:</strong> ${content.voiceTone.examples.formal}</p>
          <p><strong>Casual:</strong> ${content.voiceTone.examples.casual}</p>
        </section>
      </body>
      </html>
    `;
  }
}
