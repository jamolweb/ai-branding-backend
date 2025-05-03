import { Type, Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsArray,
  ValidateNested,
  IsHexColor,
  MaxLength,
} from 'class-validator';

// Define and EXPORT a DTO for the BrandColor structure used in the array
export class BrandColorDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsHexColor()
  value: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  usageNote?: string;
}

export class CreateBrandbookDto {
  @IsString()
  companyName: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  industry: string;

  // Renamed from 'description' in old DTO to match schema/frontend
  @IsString()
  companyDescription: string;

  // New fields for AI guidance
  @IsString()
  targetAudience: string;

  @IsString()
  brandPersonalityKeywords: string;

  @IsString()
  visualStyleKeywords: string;

  @IsString()
  toneOfVoice: string;

  // Optional user-provided mission/vision
  @IsString()
  @IsOptional()
  missionStatement?: string;

  @IsString()
  @IsOptional()
  visionStatement?: string;

  // New fields for visual identity (logo handled separately via file upload)
  @IsString()
  primaryFontName: string;

  @IsString()
  @IsOptional()
  secondaryFontName?: string;

  // Handle brandColors received as JSON string
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch (e) {
      return undefined;
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrandColorDto)
  brandColors: BrandColorDto[];

  // Contact Info fields
  @IsEmail()
  @IsOptional() // Made optional to match frontend validation
  contactEmail?: string;

  @IsUrl()
  @IsOptional() // Made optional to match frontend validation
  contactWebsite?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactAddress?: string;

  // Deprecated fields from old DTO (can be removed if no longer sent)
  // @IsString()
  // description: string;

  // @IsString()
  // authorName: string;

  // @IsString()
  // authorRole: string;

  // @IsEmail()
  // authorEmail: string;

  // @IsString()
  // @IsOptional()
  // preferredColor?: string;

  // @IsString()
  // @IsOptional()
  // preferredFont?: string;

  // Logo is handled as a file, not part of DTO validation here
}
