import { Injectable } from '@nestjs/common';
import { CreateBrandbookDto } from '../dto/create-brandbook.dto';
import { BrandbookContent } from '../interfaces/brandbook-content.interface';

@Injectable()
export class MockContentService {
  generateMockContent(input: CreateBrandbookDto): BrandbookContent {
    return {
      typography: {
        primaryFont: input.preferredFont || 'Helvetica Neue',
        secondaryFont: 'Arial',
        fontUsageGuidelines: [
          'Use primary font for headlines and important text',
          'Use secondary font for body text and longer content',
          'Maintain consistent font sizes across platforms',
        ],
      },
      colorPalette: {
        primary: input.preferredColor || '#0066CC',
        secondary: '#2E4057',
        accent: '#FF6B6B',
        neutral: ['#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA'],
        colorUsageGuidelines: [
          'Use primary color for main brand elements',
          'Use secondary color for supporting elements',
          'Use accent color sparingly for calls-to-action',
        ],
      },
      brandIdentity: {
        mission: `To revolutionize ${input.industry} through innovative solutions that empower businesses and individuals.`,
        vision: `To become the leading force in ${input.industry}, setting new standards for excellence and customer satisfaction.`,
        values: ['Innovation', 'Integrity', 'Customer Focus', 'Excellence'],
        personality: ['Professional', 'Innovative', 'Trustworthy', 'Dynamic'],
      },
      logoGuidelines: {
        minimumSize: '30px height for digital, 10mm for print',
        clearSpace: 'Maintain clear space equal to 25% of logo height',
        dosDonts: {
          dos: [
            'Use approved color variations',
            'Maintain aspect ratio',
            'Ensure adequate contrast',
          ],
          donts: [
            "Don't distort or stretch",
            "Don't change colors",
            "Don't add effects",
          ],
        },
      },
      voiceTone: {
        characteristics: ['Professional', 'Approachable', 'Clear', 'Confident'],
        examples: {
          formal: `${input.companyName} is committed to delivering exceptional value through innovative solutions.`,
          casual: `We're here to help you succeed with cutting-edge tools and support.`,
        },
        guidelines: [
          'Be clear and concise',
          'Use active voice',
          'Maintain professional tone',
          'Be inclusive and welcoming',
        ],
      },
    };
  }
}
