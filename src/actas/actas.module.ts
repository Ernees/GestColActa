import { Module } from '@nestjs/common';
import { ActasController } from './actas.controller';
import { ActaDocxService } from './docx/acta-docx.service';

@Module({
  controllers: [ActasController],
  providers: [ActaDocxService],
  exports: [ActaDocxService],
})
export class ActasModule {}
