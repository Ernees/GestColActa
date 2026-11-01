import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EnvironmentVariables } from '../config/env.validation';
import { DeepgramProvider } from './providers/deepgram.provider';
import { MockSpeechProvider } from './providers/mock.provider';
import { OpenAiWhisperProvider } from './providers/openai-whisper.provider';
import { TranscriptionService } from './transcription.service';

type Env = Partial<EnvironmentVariables>;

async function build(env: Env): Promise<TranscriptionService> {
  const mod = await Test.createTestingModule({
    providers: [
      TranscriptionService,
      DeepgramProvider,
      OpenAiWhisperProvider,
      MockSpeechProvider,
      {
        provide: ConfigService,
        useValue: { get: (key: keyof EnvironmentVariables) => env[key] },
      },
    ],
  }).compile();
  return mod.get(TranscriptionService);
}

function mockFetch(body: unknown, status = 200): jest.SpyInstance {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

const audio = Buffer.from('fake-audio');

afterEach(() => jest.restoreAllMocks());

describe('TranscriptionService', () => {
  describe('selección de proveedor', () => {
    it('usa el mock sin credenciales y no llama a la red', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const svc = await build({});
      const out = await svc.transcribe(audio, 'audio/mpeg');
      expect(out.provider).toBe('mock');
      expect(out.segments.length).toBeGreaterThan(0);
      expect(new Set(out.segments.map((s) => s.speaker)).size).toBeGreaterThan(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('prefiere Deepgram si hay DEEPGRAM_API_KEY, luego OpenAI', async () => {
      expect(
        (await build({ DEEPGRAM_API_KEY: 'k', OPENAI_API_KEY: 'o' })).resolveProvider()
          .name,
      ).toBe('deepgram');
      expect((await build({ OPENAI_API_KEY: 'o' })).resolveProvider().name).toBe(
        'openai-whisper',
      );
    });

    it('TRANSCRIPTION_PROVIDER fuerza el proveedor', async () => {
      const svc = await build({ DEEPGRAM_API_KEY: 'k', TRANSCRIPTION_PROVIDER: 'mock' });
      expect(svc.resolveProvider().name).toBe('mock');
    });
  });

  describe('Deepgram', () => {
    it('envía el audio con diarización y mapea utterances', async () => {
      const spy = mockFetch({
        results: {
          utterances: [
            { start: 0, end: 2.5, transcript: ' Hola a todos ', speaker: 0 },
            { start: 3, end: 5, transcript: 'Buenas', speaker: 1 },
            { start: 6, end: 7 },
          ],
        },
      });
      const svc = await build({ DEEPGRAM_API_KEY: 'dg-key' });
      const out = await svc.transcribe(audio, 'audio/mp4');

      expect(out.segments).toEqual([
        { speaker: 0, start: 0, end: 2.5, text: 'Hola a todos' },
        { speaker: 1, start: 3, end: 5, text: 'Buenas' },
      ]);
      const [url, init] = spy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('diarize=true');
      expect(url).toContain('language=es');
      expect(init.headers).toMatchObject({
        Authorization: 'Token dg-key',
        'Content-Type': 'audio/mp4',
      });
    });

    it('502 si la API falla', async () => {
      mockFetch({}, 500);
      const svc = await build({ DEEPGRAM_API_KEY: 'k' });
      await expect(svc.transcribe(audio, 'audio/mpeg')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('502 si la respuesta no trae utterances', async () => {
      mockFetch({ results: {} });
      const svc = await build({ DEEPGRAM_API_KEY: 'k' });
      await expect(svc.transcribe(audio, 'audio/mpeg')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('503 si se fuerza sin API key', async () => {
      const svc = await build({ TRANSCRIPTION_PROVIDER: 'deepgram' });
      await expect(svc.transcribe(audio, 'audio/mpeg')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('OpenAI Whisper', () => {
    it('mapea segments con speaker 0 (sin diarización)', async () => {
      const spy = mockFetch({ segments: [{ start: 0, end: 4, text: ' Texto uno ' }] });
      const svc = await build({ OPENAI_API_KEY: 'sk' });
      const out = await svc.transcribe(audio, 'audio/webm');
      expect(out).toEqual({
        provider: 'openai-whisper',
        segments: [{ speaker: 0, start: 0, end: 4, text: 'Texto uno' }],
      });
      const [, init] = spy.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.headers).toMatchObject({ Authorization: 'Bearer sk' });
    });

    it('502 ante respuesta inválida', async () => {
      mockFetch({ text: 'sin segments' });
      const svc = await build({ OPENAI_API_KEY: 'sk' });
      await expect(svc.transcribe(audio, 'audio/mpeg')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
