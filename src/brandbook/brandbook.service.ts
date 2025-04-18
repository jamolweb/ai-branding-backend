import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandbookService {
  constructor(private prisma: PrismaService) {}
}
