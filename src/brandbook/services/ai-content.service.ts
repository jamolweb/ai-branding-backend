import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GeminiService } from '../../gemini/gemini.service';

interface AIBrandContent {
  description: string;
  mission: string;
  vision: string;
  coreValues: string[];
  visualStyle: string;
  brandVoice: string;
  applicationExamples: string;
  visualExample?: string;
  typography: {
    description: string;
    guidelines: string[];
  };
  voiceTone: {
    characteristics: Array<{ trait: string; description: string }>;
    guidelines: string[];
  };
  visualGuidelines: {
    photography: Array<{ title: string; description: string }>;
    imagery: string[];
  };
  applications: Array<{
    category: string;
    description: string;
    items: string[];
  }>;
}

@Injectable()
export class AIContentService {
  private readonly logger = new Logger(AIContentService.name);
  private readonly API_TIMEOUT = 30000;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiService: GeminiService,
  ) {}

  async generateBrandContent(
    companyName: string,
    industry: string,
  ): Promise<AIBrandContent> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    try {
      const prompt = `Create a comprehensive brand identity for ${companyName}, a company in the ${industry} industry. Include:

1. Brand Description: A compelling overview of the brand
2. Mission & Vision:
   - Mission statement
   - Vision statement
3. Core Values: 4-5 key values with brief descriptions
4. Visual Style: Guidelines for brand's visual identity
5. Typography: Guidelines and recommendations
6. Voice & Tone:
   - 4 key characteristics with descriptions
   - 5 writing guidelines
7. Visual Guidelines:
   - 3 photography style points
   - 4 imagery guidelines
8. Brand Applications:
   - 4 categories (Digital, Print, Marketing, Brand Assets)
   - 4 items per category

Format as detailed JSON matching the following structure:
{
  "description": "string",
  "mission": "string",
  "vision": "string",
  "coreValues": ["string"],
  "visualStyle": "string",
  "brandVoice": "string",
  "applicationExamples": "string",
  "typography": {
    "description": "string",
    "guidelines": ["string"]
  },
  "voiceTone": {
    "characteristics": [{"trait": "string", "description": "string"}],
    "guidelines": ["string"]
  },
  "visualGuidelines": {
    "photography": [{"title": "string", "description": "string"}],
    "imagery": ["string"]
  },
  "applications": [
    {
      "category": "string",
      "description": "string",
      "items": ["string"]
    }
  ]
}

Make all content professional, modern, and specific to the ${industry} industry.`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                'You are a professional brand strategist with expertise in creating compelling brand identities. Provide responses in clean JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          presence_penalty: 0,
          frequency_penalty: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: this.API_TIMEOUT,
        },
      );

      let content;
      try {
        content = JSON.parse(response.data.choices[0].message.content.trim());
      } catch (parseError) {
        this.logger.error('Error parsing AI content response:', parseError);
        return this.getDefaultBrandContent(companyName, industry);
      }

      if (!this.isValidBrandContent(content)) {
        return this.getDefaultBrandContent(companyName, industry);
      }

      let visualExample;
      try {
        const visualPrompt = `Create a professional brand visual for ${companyName} in ${industry} industry. Style: ${content.visualStyle}. Make it modern, clean, and professional.`;
        visualExample =
          await this.geminiService.generateBrandImage(visualPrompt);
      } catch (error) {
        this.logger.error('Error generating visual example:', error);
        visualExample =
          'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';
      }

      return {
        ...content,
        visualExample,
      };
    } catch (error) {
      this.logger.error('Error generating AI content:', error);
      return this.getDefaultBrandContent(companyName, industry);
    }
  }

  private isValidBrandContent(content: any): content is AIBrandContent {
    return (
      typeof content === 'object' &&
      typeof content.description === 'string' &&
      typeof content.mission === 'string' &&
      typeof content.vision === 'string' &&
      Array.isArray(content.coreValues) &&
      content.coreValues.every((value) => typeof value === 'string') &&
      typeof content.visualStyle === 'string' &&
      typeof content.brandVoice === 'string' &&
      typeof content.applicationExamples === 'string' &&
      typeof content.typography === 'object' &&
      typeof content.typography.description === 'string' &&
      Array.isArray(content.typography.guidelines) &&
      typeof content.voiceTone === 'object' &&
      Array.isArray(content.voiceTone.characteristics) &&
      Array.isArray(content.voiceTone.guidelines) &&
      typeof content.visualGuidelines === 'object' &&
      Array.isArray(content.visualGuidelines.photography) &&
      Array.isArray(content.visualGuidelines.imagery) &&
      Array.isArray(content.applications) &&
      content.applications.every(
        (app) =>
          typeof app.category === 'string' &&
          typeof app.description === 'string' &&
          Array.isArray(app.items),
      )
    );
  }

  private getDefaultBrandContent(
    companyName: string,
    industry: string,
  ): AIBrandContent {
    return {
      description: `${companyName} is an innovative ${industry} company committed to delivering exceptional value to its customers through cutting-edge solutions and outstanding service.`,
      mission: `To revolutionize the ${industry} industry by providing innovative solutions that empower our customers to achieve their goals.`,
      vision: `To become the leading ${industry} company known for excellence, innovation, and customer satisfaction.`,
      coreValues: [
        'Innovation and Excellence',
        'Customer-Centric Approach',
        'Integrity and Trust',
        'Continuous Improvement',
      ],
      visualStyle:
        'Modern, professional, and minimalist design with a focus on clarity and impact.',
      brandVoice:
        'Professional, confident, and approachable, reflecting our expertise and commitment to customer success.',
      applicationExamples:
        'Brand applications include corporate stationery, digital presence, marketing materials, and customer touchpoints.',
      visualExample:
        'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      typography: {
        description:
          'Clean, modern typography that emphasizes readability and professionalism.',
        guidelines: [
          'Use Poppins as the primary font family',
          'Maintain consistent heading hierarchy',
          'Ensure adequate contrast and spacing',
          'Keep text aligned and balanced',
        ],
      },
      voiceTone: {
        characteristics: [
          {
            trait: 'Professional',
            description:
              'Clear, competent, and authoritative while remaining accessible',
          },
          {
            trait: 'Innovative',
            description:
              'Forward-thinking and solution-oriented in communication',
          },
          {
            trait: 'Trustworthy',
            description:
              'Reliable, transparent, and honest in all interactions',
          },
          {
            trait: 'Empathetic',
            description: 'Understanding and responsive to customer needs',
          },
        ],
        guidelines: [
          'Use clear, concise language',
          'Maintain a positive and solution-focused tone',
          'Be consistent across all communications',
          'Address audience needs directly',
          'Balance professionalism with approachability',
        ],
      },
      visualGuidelines: {
        photography: [
          {
            title: 'Lighting',
            description:
              'Natural, bright lighting that creates a clean and professional atmosphere',
          },
          {
            title: 'Composition',
            description:
              'Clean, uncluttered compositions with clear focal points',
          },
          {
            title: 'Style',
            description:
              'Modern and professional imagery that reflects industry expertise',
          },
        ],
        imagery: [
          'Use high-quality, professional imagery',
          'Maintain consistent style across all materials',
          'Ensure images reflect brand values',
          'Keep visual elements clean and uncluttered',
        ],
      },
      applications: [
        {
          category: 'Digital Presence',
          description: 'Cohesive online brand representation',
          items: ['Website', 'Social Media', 'Email Templates', 'Digital Ads'],
        },
        {
          category: 'Print Materials',
          description: 'Professional physical brand materials',
          items: [
            'Business Cards',
            'Letterheads',
            'Brochures',
            'Presentations',
          ],
        },
        {
          category: 'Marketing Collateral',
          description: 'Engaging promotional materials',
          items: [
            'Product Catalogs',
            'Banners',
            'Promotional Items',
            'Event Materials',
          ],
        },
        {
          category: 'Brand Assets',
          description: 'Core brand identity elements',
          items: [
            'Logo Variations',
            'Icon Set',
            'Photography Style',
            'Illustration Style',
          ],
        },
      ],
    };
  }

  async generateColorPalette(primaryColor: string): Promise<string[]> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');

    try {
      const prompt = `Generate a professional color palette based on the primary color ${primaryColor}. Return ONLY a JSON array of 5 hex color codes, nothing else. Example format: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF"]`;

      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                'You are a color theory expert. Return ONLY a JSON array of hex color codes, no explanation or other text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
          presence_penalty: 0,
          frequency_penalty: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: this.API_TIMEOUT,
        },
      );

      const content = response.data.choices[0].message.content.trim();

      try {
        const colors = JSON.parse(content);
        if (
          !Array.isArray(colors) ||
          colors.length !== 5 ||
          !colors.every((color) => /^#[0-9A-Fa-f]{6}$/.test(color))
        ) {
          // If the response is not in the expected format, return a default palette
          return [
            primaryColor,
            this.adjustHue(primaryColor, 180), // Complementary
            this.adjustHue(primaryColor, 120), // Accent 1
            this.adjustHue(primaryColor, -120), // Accent 2
            '#F5F5F5', // Neutral
          ];
        }
        return colors;
      } catch (parseError) {
        this.logger.error('Error parsing color palette:', parseError);
        // Return a default palette based on the primary color
        return [
          primaryColor,
          this.adjustHue(primaryColor, 180), // Complementary
          this.adjustHue(primaryColor, 120), // Accent 1
          this.adjustHue(primaryColor, -120), // Accent 2
          '#F5F5F5', // Neutral
        ];
      }
    } catch (error) {
      this.logger.error('Error generating color palette:', error);
      // Return a default palette based on the primary color
      return [
        primaryColor,
        this.adjustHue(primaryColor, 180), // Complementary
        this.adjustHue(primaryColor, 120), // Accent 1
        this.adjustHue(primaryColor, -120), // Accent 2
        '#F5F5F5', // Neutral
      ];
    }
  }

  private adjustHue(hex: string, degrees: number): string {
    // Convert hex to HSL
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Adjust hue
    hsl.h = (hsl.h + degrees) % 360;
    if (hsl.h < 0) hsl.h += 360;

    // Convert back to RGB
    const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);

    // Convert to hex
    return `#${this.componentToHex(newRgb.r)}${this.componentToHex(newRgb.g)}${this.componentToHex(newRgb.b)}`;
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

  private componentToHex(c: number): string {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  private rgbToHsl(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      h *= 60;
    }

    return { h, s, l };
  }

  private hslToRgb(
    h: number,
    s: number,
    l: number,
  ): { r: number; g: number; b: number } {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h / 360 + 1 / 3);
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, h / 360 - 1 / 3);
    }

    return {
      r: r * 255,
      g: g * 255,
      b: b * 255,
    };
  }

  async generateApplicationMockups(
    companyName: string,
    industry: string,
    colorPalette: string[],
  ): Promise<string[]> {
    try {
      const mockupPrompts = [
        `Create a modern business card design for ${companyName} using the brand colors ${colorPalette.join(', ')}. Make it professional and minimal.`,
        `Design a website header for ${companyName}'s homepage, incorporating the brand colors and modern design elements.`,
        `Create a social media post template for ${companyName}, suitable for ${industry} industry content.`,
      ];

      const results = await Promise.allSettled(
        mockupPrompts.map((prompt) =>
          this.geminiService.generateBrandImage(prompt).catch(() => null),
        ),
      );

      // Filter out failed generations and use default mockups if needed
      const mockups = results
        .map((result) => (result.status === 'fulfilled' ? result.value : null))
        .filter((url): url is string => !!url);

      // If we have no successful mockups, return default mockup URLs
      if (mockups.length === 0) {
        return [
          'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
          'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
          'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
        ];
      }

      return mockups;
    } catch (error) {
      this.logger.error('Error generating mockups:', error);
      // Return default mockup URLs instead of throwing
      return [
        'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      ];
    }
  }
}
