import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import {
  SpeechProvider,
  Transcription,
  TranscriptSegment,
  isRecord,
} from '../transcription.types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const TIMEOUT_MS = 10 * 60 * 1000;

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/webm': 'webm',
  'video/webm': 'webm',
};

export function parseWhisper(payload: unknown): TranscriptSegment[] {
  const segments: unknown = isRecord(payload) ? payload.segments : undefined;
  if (!Array.isArray(segments)) {
    throw new BadGatewayException('Respuesta de Whisper sin segments');
  }
  const items: unknown[] = segments;
  return items.flatMap((s): TranscriptSegment[] => {
    if (
      !isRecord(s) ||
      typeof s.text !== 'string' ||
      typeof s.start !== 'number' ||
      typeof s.end !== 'number'
    ) {
      return [];
    }
    return [{ speaker: 0, start: s.start, end: s.end, text: s.text.trim() }];
  });
}

/**
 * Whisper NO realiza diarización: todos los segmentos salen con speaker 0 y el
 * paso de estructuración infiere los hablantes por contexto. Para diarización
 * real usar Deepgram.
 */
@Injectable()
export class OpenAiWhisperProvider implements SpeechProvider {
  readonly name = 'openai-whisper';

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<Transcription> {
    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (!apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY no configurada');

    const ext = EXTENSION_BY_MIME[mimeType] ?? 'mp3';
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: mimeType }),
      `audio.${ext}`,
    );
    form.append('model', 'whisper-1');
    form.append('language', 'es');
    form.append('response_format', 'verbose_json');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new BadGatewayException(`OpenAI respondió ${res.status}`);
    }
    return { provider: this.name, segments: parseWhisper(await res.json()) };
  }
}
