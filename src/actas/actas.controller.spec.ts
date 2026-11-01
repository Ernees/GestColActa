import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { ActasModule } from './actas.module';
import { DOCX_MIME } from './actas.controller';
import { actaEjemplo } from './docx/fixtures';

describe('POST /actas/preview-docx', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [ActasModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());

  it('devuelve el docx con headers de descarga', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/actas/preview-docx')
      .send(actaEjemplo)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(DOCX_MIME);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('400 ante payload inválido', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/actas/preview-docx')
      .send({ ...actaEjemplo, tipoActa: 'OTRO' });
    expect(res.status).toBe(400);
  });
});
