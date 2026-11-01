import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { ActasController } from './actas.controller';
import { ActaDocxService } from './docx/acta-docx.service';

@Module({
  imports: [TranscriptionModule, AiModule],
  controllers: [ActasController],
  providers: [ActaDocxService],
  exports: [ActaDocxService],
})
export class ActasModule {}
