import { IsNotEmpty, IsUUID } from 'class-validator';

export class FavoriteLogoDto {
  @IsUUID()
  @IsNotEmpty()
  logoId: string;
}
