import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerateSimpleBrandbookDto {
  @IsString()
  companyName: string;

  @IsString()
  tagline: string;

  @IsHexColor()
  preferredColor: string;

  @IsString()
  industry: string;

  @IsString()
  preferredFont: string;

  @IsString()
  authorName: string;

  @IsString()
  authorRole: string;

  @IsEmail()
  authorEmail: string;

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
  @Transform(({ value }) => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  })
  @IsArray()
  @IsString({ each: true })
  coreValues?: string[];
}
