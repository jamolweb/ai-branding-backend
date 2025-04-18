import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrandbookService } from './brandbook.service';

@Controller('brandbook')
@UseGuards(JwtAuthGuard)
export class BrandbookController {
  constructor(private readonly brandbookService: BrandbookService) {}
}
