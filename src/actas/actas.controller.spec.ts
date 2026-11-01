import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import JSZip from 'jszip';
import { Server } from 'node:http';
import request, { Response } from 'supertest';
import { LlmClient, StructuredRequest } from '../ai/llm-client';
import { AppConfigModule } from '../config/app-config.module';
import { ActasModule } from './actas.module';
import { DOCX_MIME } from './actas.controller';
import { actaEjemplo, setupEjemplo } from './docx/fixtures';

class FakeLlm extends LlmClient {
  requests: StructuredRequest[] = [];
  extractStructured(request: StructuredRequest): Promise<unknown> {
    this.requests.push(request);
    return Promise.resolve({
      motivo: 'Abordar una situación de convivencia entre alumnos.',
      desarrollo: ['La directora dio inicio a la reunión.', 'Se analizó la situación.'],
      acuerdos: [{ compromiso: 'Realizar una mediación.', responsable: 'Juan Gómez' }],
      mapeoHablantes: [{ speaker: 0, nombre: 'María Pérez' }],
    });
  }
}

const binaryParser = (
  r: Response,
  cb: (err: Error | null, body: Buffer) => void,
): void => {
  const chunks: Buffer[] = [];
  r.on('data', (c: Buffer) => chunks.push(c));
  r.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('ActasController', () => {
  let app: INestApplication;
  let server: Server;
  const llm = new FakeLlm();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppConfigModule, ActasModule],
    })
      // Sin credenciales: TranscriptionService cae al MockSpeechProvider
      .overrideProvider(ConfigService)
      .useValue({ get: () => undefined })
      .overrideProvider(LlmClient)
      .useValue(llm)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(() => app.close());
  beforeEach(() => {
    llm.requests = [];
  });

  describe('POST /actas/preview-docx', () => {
    it('devuelve el docx con headers de descarga', async () => {
      const res = await request(server)
        .post('/actas/preview-docx')
        .send(actaEjemplo)
        .buffer(true)
        .parse(binaryParser);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(DOCX_MIME);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    });

    it('400 ante payload inválido', async () => {
      const res = await request(server)
        .post('/actas/preview-docx')
        .send({ ...actaEjemplo, tipoActa: 'OTRO' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /actas/procesar-reunion', () => {
    const audio = Buffer.from('audio-simulado');
    const post = (query = ''): request.Test =>
      request(server).post(`/actas/procesar-reunion${query}`);

    it('orquesta transcripción -> IA -> docx', async () => {
      const res: Response = await post()
        .field('metadata', JSON.stringify(setupEjemplo))
        .attach('audio', audio, { filename: 'reunion.m4a', contentType: 'audio/mp4' })
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(DOCX_MIME);
      expect(res.headers['content-disposition']).toContain(
        'filename="acta-convivencia-2026-03-09.docx"',
      );
      const zip = await JSZip.loadAsync(res.body as Buffer);
      const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
      expect(xml).toContain('Abordar una situación de convivencia entre alumnos.');
      expect(xml).toContain('Realizar una mediación.');
      // el LLM recibió la transcripción del mock
      expect(llm.requests[0]?.user).toContain('Hablante 1');
    });

    it('?formato=json devuelve acta estructurada, mapeo y transcripción', async () => {
      const res = await post('?formato=json')
        .field('metadata', JSON.stringify(setupEjemplo))
        .attach('audio', audio, { filename: 'r.mp3', contentType: 'audio/mpeg' });
      expect(res.status).toBe(200);
      const body = res.body as {
        acta: { motivo: string; cierre: { horaFinalizacion: string } };
        mapeoHablantes: unknown[];
        transcripcion: unknown[];
      };
      expect(body.acta.motivo).toContain('convivencia');
      expect(body.acta.cierre.horaFinalizacion).toBe('10:45');
      expect(body.mapeoHablantes).toHaveLength(1);
      expect(body.transcripcion.length).toBeGreaterThan(0);
    });

    it('400 si falta el audio', async () => {
      const res = await post().field('metadata', JSON.stringify(setupEjemplo));
      expect(res.status).toBe(400);
    });

    it('400 si el mime no es de audio permitido', async () => {
      const res = await post()
        .field('metadata', JSON.stringify(setupEjemplo))
        .attach('audio', audio, { filename: 'x.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(llm.requests).toHaveLength(0);
    });

    it('400 si metadata falta, no es JSON o no valida', async () => {
      const file = { filename: 'a.mp3', contentType: 'audio/mpeg' };
      expect((await post().attach('audio', audio, file)).status).toBe(400);
      expect(
        (await post().field('metadata', '{no-json').attach('audio', audio, file)).status,
      ).toBe(400);
      const res = await post()
        .field('metadata', JSON.stringify({ ...setupEjemplo, tipoActa: 'OTRO' }))
        .attach('audio', audio, file);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('tipoActa');
    });

    it('400 con formato desconocido', async () => {
      const res = await post('?formato=pdf')
        .field('metadata', JSON.stringify(setupEjemplo))
        .attach('audio', audio, { filename: 'a.mp3', contentType: 'audio/mpeg' });
      expect(res.status).toBe(400);
    });
  });
});
