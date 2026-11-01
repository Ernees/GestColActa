import { Module } from '@nestjs/common';
import { DeepgramProvider } from './providers/deepgram.provider';
import { MockSpeechProvider } from './providers/mock.provider';
import { OpenAiWhisperProvider } from './providers/openai-whisper.provider';
import { TranscriptionService } from './transcription.service';

@Module({
  providers: [
    TranscriptionService,
    DeepgramProvider,
    OpenAiWhisperProvider,
    MockSpeechProvider,
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
