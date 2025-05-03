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

export interface CoreContentInput {
  companyName: string;
  companyDescription: string;
  industry: string;
  targetAudience: string;
  brandPersonalityKeywords: string;
  visualStyleKeywords: string;
  toneOfVoice: string;
  providedMission?: string | null;
  providedVision?: string | null;
}

export interface CoreContentOutput {
  missionStatement: string;
  visionStatement: string;
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
      vision: `To be the leading provider of ${industry} solutions globally, recognized for our commitment to innovation, quality, and customer satisfaction.`,
      coreValues: [
        'Innovation: Continuously seeking new ways to improve and disrupt the status quo.',
        'Integrity: Upholding the highest ethical standards in all our interactions.',
        'Customer Focus: Placing our customers at the center of everything we do.',
        'Excellence: Striving for the highest quality in our products and services.',
      ],
      visualStyle:
        'Modern, clean, professional, with a focus on clarity and approachability.',
      brandVoice: 'Knowledgeable, helpful, confident, and inspiring.',
      applicationExamples:
        'Website, mobile app, social media profiles, marketing brochures, presentations, email signatures, business cards, letterheads, internal documents, merchandise.',
      typography: {
        description:
          'Utilize clean, readable sans-serif fonts like Inter or Lato for primary text, complemented by a distinct serif or display font for headings.',
        guidelines: [
          'Maintain consistent font weights and sizes across applications.',
          'Ensure sufficient contrast between text and background.',
          'Use typography hierarchy to guide the reader.',
          'Avoid excessive use of different font styles.',
        ],
      },
      voiceTone: {
        characteristics: [
          {
            trait: 'Professional',
            description: 'Maintain a knowledgeable and expert tone.',
          },
          {
            trait: 'Approachable',
            description: 'Be friendly, helpful, and easy to understand.',
          },
          {
            trait: 'Confident',
            description: 'Communicate with assurance and clarity.',
          },
          {
            trait: 'Inspiring',
            description: 'Motivate and encourage positive action.',
          },
        ],
        guidelines: [
          'Use clear and concise language.',
          'Avoid jargon where possible, or explain it clearly.',
          'Address the target audience directly.',
          'Maintain a positive and optimistic outlook.',
          'Ensure consistency across all communication channels.',
        ],
      },
      visualGuidelines: {
        photography: [
          {
            title: 'Authentic',
            description:
              'Use genuine photos of people and processes, avoid generic stock images.',
          },
          {
            title: 'Bright & Clean',
            description:
              'Favor well-lit environments with natural light where possible.',
          },
          {
            title: 'Focused',
            description:
              'Highlight key subjects or messages clearly within the composition.',
          },
        ],
        imagery: [
          'Utilize high-quality icons and illustrations that align with the brand style.',
          'Ensure graphics are clean, modern, and easily understandable.',
          'Maintain consistent color usage according to the palette.',
          'Use data visualizations effectively to communicate complex information.',
        ],
      },
      applications: [
        {
          category: 'Digital',
          description: 'Online presence and user interfaces.',
          items: [
            'Website Design',
            'Mobile App UI/UX',
            'Social Media Graphics',
            'Email Templates',
          ],
        },
        {
          category: 'Print',
          description: 'Physical marketing and communication materials.',
          items: [
            'Brochures & Flyers',
            'Business Cards',
            'Letterheads',
            'Posters',
          ],
        },
        {
          category: 'Marketing',
          description: 'Promotional and advertising materials.',
          items: [
            'Ad Banners',
            'Presentation Decks',
            'Trade Show Booths',
            'Case Studies',
          ],
        },
        {
          category: 'Brand Assets',
          description: 'Core visual elements and internal use.',
          items: [
            'Logo Variations',
            'Iconography Set',
            'Internal Templates',
            'Brand Style Guide Document',
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

      const rawContent = response.data.choices[0].message.content.trim();
      let jsonContent = rawContent;

      // Updated regex to find content between ```json and ```
      const jsonMatch = rawContent.match(/```json\s*([\s\S]+?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1].trim();
        this.logger.debug('Extracted JSON content from markdown fences.');
      } else {
        // Fallback attempt: If no fences, assume the whole string might be JSON (or fail parsing)
        this.logger.debug(
          'No markdown fences detected, attempting to parse raw content.',
        );
      }

      this.logger.debug(`Attempting to parse content: ${jsonContent}`);

      try {
        const colors = JSON.parse(jsonContent);
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

  async generateCoreContent(
    input: CoreContentInput,
  ): Promise<CoreContentOutput> {
    this.logger.log(`Generating core content for ${input.companyName}`);
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      this.logger.error('Deepseek API key not configured.');
      throw new Error('AI service configuration error.');
    }

    let missionToGenerate = !input.providedMission;
    let visionToGenerate = !input.providedVision;

    // If both are provided, return them directly
    if (!missionToGenerate && !visionToGenerate) {
      this.logger.log(
        'Mission and Vision provided by user, skipping generation.',
      );
      return {
        missionStatement: input.providedMission!,
        visionStatement: input.providedVision!,
      };
    }

    // Construct a focused prompt
    let promptParts: string[] = [
      `Given the following information about the company "${input.companyName}":`,
      `- Industry: ${input.industry}`,
      `- Description: ${input.companyDescription}`,
      `- Target Audience: ${input.targetAudience}`,
      `- Brand Personality Keywords: ${input.brandPersonalityKeywords}`,
      `- Tone of Voice: ${input.toneOfVoice}`,
    ];

    if (missionToGenerate && visionToGenerate) {
      promptParts.push(
        `\nPlease generate a concise and impactful Mission Statement and Vision Statement.`,
      );
      promptParts.push(
        `\nProvide the output ONLY as a JSON object with keys "mission" and "vision". Example: {"mission": "...", "vision": "..."}`,
      );
    } else if (missionToGenerate) {
      promptParts.push(
        `\nPlease generate a concise and impactful Mission Statement.`,
      );
      if (input.providedVision)
        promptParts.push(`- Existing Vision: ${input.providedVision}`);
      promptParts.push(
        `\nProvide the output ONLY as a JSON object with the key "mission". Example: {"mission": "..."}`,
      );
    } else {
      // Only vision to generate
      promptParts.push(
        `\nPlease generate a concise and impactful Vision Statement.`,
      );
      if (input.providedMission)
        promptParts.push(`- Existing Mission: ${input.providedMission}`);
      promptParts.push(
        `\nProvide the output ONLY as a JSON object with the key "vision". Example: {"vision": "..."}`,
      );
    }

    const fullPrompt = promptParts.join('\n');
    this.logger.debug(`Constructed AI prompt: ${fullPrompt}`);

    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant skilled in writing concise and impactful mission and vision statements based on company details. Output ONLY the requested JSON.',
            },
            {
              role: 'user',
              content: fullPrompt,
            },
          ],
          temperature: 0.6,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: this.API_TIMEOUT,
        },
      );

      let generatedJson: any;
      try {
        const responseContent = response.data.choices[0].message.content.trim();
        this.logger.debug(`Raw AI response content: ${responseContent}`);
        generatedJson = JSON.parse(responseContent);
        this.logger.debug('Parsed AI response JSON:', generatedJson);
      } catch (parseError) {
        this.logger.error(
          'Error parsing core content AI response:',
          parseError,
        );
        // Fallback if parsing fails
        return {
          missionStatement:
            input.providedMission || `Default Mission for ${input.companyName}`,
          visionStatement:
            input.providedVision || `Default Vision for ${input.companyName}`,
        };
      }

      // Combine provided and generated content
      const finalOutput: CoreContentOutput = {
        missionStatement:
          input.providedMission ||
          generatedJson?.mission ||
          `Failed to generate mission for ${input.companyName}`,
        visionStatement:
          input.providedVision ||
          generatedJson?.vision ||
          `Failed to generate vision for ${input.companyName}`,
      };

      this.logger.log(
        'Successfully generated/retrieved core content.',
        finalOutput,
      );
      return finalOutput;
    } catch (error) {
      this.logger.error(
        'Error calling Deepseek API for core content:',
        error?.response?.data || error.message,
      );
      // Fallback on API error
      return {
        missionStatement:
          input.providedMission ||
          `Default Mission (API Error) for ${input.companyName}`,
        visionStatement:
          input.providedVision ||
          `Default Vision (API Error) for ${input.companyName}`,
      };
    }
  }
}
