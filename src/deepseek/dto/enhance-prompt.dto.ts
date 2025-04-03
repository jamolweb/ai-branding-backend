import { IsNotEmpty, IsString } from 'class-validator';

export class EnhancePromptDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
