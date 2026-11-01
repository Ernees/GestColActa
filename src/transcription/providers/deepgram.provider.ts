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

const ENDPOINT = 'https://api.deepgram.com/v1/listen';
const TIMEOUT_MS = 10 * 60 * 1000;

export function parseDeepgram(payload: unknown): TranscriptSegment[] {
  const utterances: unknown =
    isRecord(payload) && isRecord(payload.results)
      ? payload.results.utterances
      : undefined;
  if (!Array.isArray(utterances)) {
    throw new BadGatewayException('Respuesta de Deepgram sin utterances');
  }
  const items: unknown[] = utterances;
  return items.flatMap((u): TranscriptSegment[] => {
    if (
      !isRecord(u) ||
      typeof u.transcript !== 'string' ||
      typeof u.start !== 'number' ||
      typeof u.end !== 'number'
    ) {
      return [];
    }
    return [
      {
        speaker: typeof u.speaker === 'number' ? u.speaker : 0,
        start: u.start,
        end: u.end,
        text: u.transcript.trim(),
      },
    ];
  });
}

@Injectable()
export class DeepgramProvider implements SpeechProvider {
  readonly name = 'deepgram';

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<Transcription> {
    const apiKey = this.config.get('DEEPGRAM_API_KEY', { infer: true });
    if (!apiKey) throw new ServiceUnavailableException('DEEPGRAM_API_KEY no configurada');

    const query = new URLSearchParams({
      model: 'nova-3',
      language: 'es',
      diarize: 'true',
      utterances: 'true',
      punctuate: 'true',
      smart_format: 'true',
    });
    const res = await fetch(`${ENDPOINT}?${query.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': mimeType },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new BadGatewayException(`Deepgram respondió ${res.status}`);
    }
    return { provider: this.name, segments: parseDeepgram(await res.json()) };
  }
}
