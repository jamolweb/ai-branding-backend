import {
  IsArray,
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class GenerateCustomBrandBookDto {
  @IsString()
  companyName: string;

  @IsString()
  tagline: string;

  @IsHexColor()
  preferredColor: string;

  @IsString()
  authorName: string;

  @IsString()
  authorRole: string;

  @IsEmail()
  authorEmail: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  mission?: string;

  @IsOptional()
  @IsString()
  vision?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coreValues?: string[];
}
