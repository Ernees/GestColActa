import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnvironmentVariables,
  TranscriptionProviderName,
} from '../config/env.validation';
import { DeepgramProvider } from './providers/deepgram.provider';
import { MockSpeechProvider } from './providers/mock.provider';
import { OpenAiWhisperProvider } from './providers/openai-whisper.provider';
import { SpeechProvider, Transcription } from './transcription.types';

export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'video/webm',
  'audio/aac',
  'audio/x-aac',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/x-flac',
] as const;

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly deepgram: DeepgramProvider,
    private readonly whisper: OpenAiWhisperProvider,
    private readonly mock: MockSpeechProvider,
  ) {}

  /** Transcribe con diarización (Deepgram) o sin ella (Whisper); mock sin credenciales. */
  async transcribe(audio: Buffer, mimeType: string): Promise<Transcription> {
    const provider = this.resolveProvider();
    if (provider.name === 'mock') {
      this.logger.warn('Sin credenciales de STT: usando transcripción MOCK');
    }
    return provider.transcribe(audio, mimeType);
  }

  resolveProvider(): SpeechProvider {
    const forced = this.config.get('TRANSCRIPTION_PROVIDER', { infer: true });
    const byName: Record<TranscriptionProviderName, SpeechProvider> = {
      deepgram: this.deepgram,
      openai: this.whisper,
      mock: this.mock,
    };
    if (forced) return byName[forced];
    if (this.config.get('DEEPGRAM_API_KEY', { infer: true })) return this.deepgram;
    if (this.config.get('OPENAI_API_KEY', { infer: true })) return this.whisper;
    return this.mock;
  }
}
