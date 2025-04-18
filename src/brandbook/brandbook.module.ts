import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { BrandbookController } from './brandbook.controller';
import { BrandbookService } from './brandbook.service';

@Module({
  imports: [AuthModule],
  controllers: [BrandbookController],
  providers: [BrandbookService, PrismaService],
  exports: [BrandbookService],
})
export class BrandbookModule {}
