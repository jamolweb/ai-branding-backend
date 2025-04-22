import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateBrandbookDto {
  @IsString()
  companyName: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  industry: string;

  @IsString()
  description: string;

  @IsString()
  authorName: string;

  @IsString()
  authorRole: string;

  @IsEmail()
  authorEmail: string;

  @IsString()
  @IsOptional()
  preferredColor?: string;

  @IsString()
  @IsOptional()
  preferredFont?: string;
}
