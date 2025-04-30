import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateSimpleBrandbookDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  authorName: string;

  @IsString()
  @IsNotEmpty()
  authorRole: string;

  @IsString()
  @IsNotEmpty()
  authorEmail: string;
}
