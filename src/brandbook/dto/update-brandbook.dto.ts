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
import { CreateBrandbookDto } from './create-brandbook.dto'; // Import base DTO and BrandColorDto

// Manually define UpdateBrandbookDto making fields optional
export class UpdateBrandbookDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  companyDescription?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  brandPersonalityKeywords?: string;

  @IsString()
  @IsOptional()
  visualStyleKeywords?: string;

  @IsString()
  @IsOptional()
  toneOfVoice?: string;

  @IsString()
  @IsOptional()
  missionStatement?: string;

  @IsString()
  @IsOptional()
  visionStatement?: string;

  @IsString()
  @IsOptional()
  primaryFontName?: string;

  @IsString()
  @IsOptional()
  secondaryFontName?: string;

  // Keep color validation similar to Create DTO, but make the array optional
  @IsOptional()
  @IsString() // Still received as JSON string potentially if updated?
  @Transform(({ value }) => {
    // Need to handle cases where it might be already parsed or still a string
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch (e) {
        return undefined;
      }
    } else if (Array.isArray(value)) {
      // If already an array (e.g., from internal processing), pass it through
      return value;
    }
    return undefined;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBrandbookDto) // Use the same BrandColorDto
  brandColors?: CreateBrandbookDto[];

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsUrl()
  @IsOptional()
  contactWebsite?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactAddress?: string;
}
