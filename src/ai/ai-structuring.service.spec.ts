import { BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SetupReunionDto } from '../actas/dto/setup-reunion.dto';
import { setupEjemplo } from '../actas/docx/fixtures';
import { Transcription } from '../transcription/transcription.types';
import { AiStructuringService } from './ai-structuring.service';
import { LlmClient, StructuredRequest } from './llm-client';
import { TOOL_NAME } from './prompts';

const setup = plainToInstance(SetupReunionDto, setupEjemplo);

const transcription: Transcription = {
  provider: 'mock',
  segments: [
    { speaker: 0, start: 0, end: 5, text: 'Buenas tardes, damos comienzo.' },
    { speaker: 1, start: 65, end: 70, text: 'Yo me encargo del seguimiento.' },
  ],
};

const llmOutput = {
  motivo: 'Abordar una situación de convivencia.',
  desarrollo: ['La directora dio inicio a la reunión.'],
  acuerdos: [
    { compromiso: 'Realizar seguimiento.', responsable: 'Juan Gómez', plazo: null },
    {
      compromiso: 'Informar a la familia.',
      responsable: 'María Pérez',
      plazo: '48 horas',
    },
  ],
  mapeoHablantes: [
    { speaker: 0, nombre: 'María Pérez' },
    { speaker: 1, nombre: 'Juan Gómez' },
    { speaker: 2, nombre: 'Persona Inventada' },
  ],
};

class FakeLlm extends LlmClient {
  requests: StructuredRequest[] = [];
  constructor(private readonly output: unknown) {
    super();
  }
  extractStructured(request: StructuredRequest): Promise<unknown> {
    this.requests.push(request);
    return Promise.resolve(this.output);
  }
}

describe('AiStructuringService', () => {
  it('arma un acta válida combinando setup del usuario y salida del LLM', async () => {
    const llm = new FakeLlm(llmOutput);
    const { acta } = await new AiStructuringService(llm).structure(transcription, setup);

    expect(acta.institucion).toEqual(setupEjemplo.institucion);
    expect(acta.asistentes).toEqual(setupEjemplo.asistentes);
    expect(acta.tipoActa).toBe('CONVIVENCIA');
    expect(acta.motivo).toBe(llmOutput.motivo);
    expect(acta.cierre.horaFinalizacion).toBe(setupEjemplo.metadatos.horaFin);
    expect(acta.acuerdos[0]).not.toHaveProperty('plazo', null);
    expect(acta.acuerdos[0]?.plazo).toBeUndefined();
    expect(acta.acuerdos[1]?.plazo).toBe('48 horas');
  });

  it('descarta nombres de hablantes que no son asistentes', async () => {
    const { mapeoHablantes } = await new AiStructuringService(
      new FakeLlm(llmOutput),
    ).structure(transcription, setup);
    expect(mapeoHablantes).toEqual([
      { speaker: 0, nombre: 'María Pérez' },
      { speaker: 1, nombre: 'Juan Gómez' },
      { speaker: 2, nombre: null },
    ]);
  });

  it('envía tool calling forzado con transcripción, asistentes y roles', async () => {
    const llm = new FakeLlm(llmOutput);
    await new AiStructuringService(llm).structure(transcription, setup);
    const req = llm.requests[0];
    expect(req?.toolName).toBe(TOOL_NAME);
    expect(req?.system).toContain('institucional');
    expect(req?.user).toContain('[01:05] Hablante 1: Yo me encargo del seguimiento.');
    expect(req?.user).toContain('María Pérez (rol: DIRECTIVO)');
    expect(req?.inputSchema).toHaveProperty('required');
  });

  it('devuelve advertencias del LLM y marca "A definir" automáticamente', async () => {
    const out = {
      ...llmOutput,
      acuerdos: [
        { compromiso: 'Realizar seguimiento.', responsable: 'A definir' },
        { compromiso: 'Informar a la familia.', responsable: 'María Pérez' },
        { compromiso: 'Armar informe.', responsable: 'Juan Gómez' },
      ],
      advertencias: [
        { indice: 1, razon: 'Voces superpuestas.' },
        { indice: 9, razon: 'Índice fuera de rango.' },
      ],
    };
    const { advertencias } = await new AiStructuringService(new FakeLlm(out)).structure(
      transcription,
      setup,
    );
    expect(advertencias).toEqual([
      { indice: 0, razon: 'No quedó claro quién asume este compromiso.' },
      { indice: 1, razon: 'Voces superpuestas.' },
    ]);
  });

  it('sin advertencias devuelve lista vacía', async () => {
    const { advertencias } = await new AiStructuringService(
      new FakeLlm(llmOutput),
    ).structure(transcription, setup);
    expect(advertencias).toEqual([]);
  });

  it('el nivel de detalle viaja en el prompt (RESUMIDO por defecto)', async () => {
    const llm = new FakeLlm(llmOutput);
    const svc = new AiStructuringService(llm);
    await svc.structure(transcription, setup);
    await svc.structure(
      transcription,
      plainToInstance(SetupReunionDto, { ...setupEjemplo, detalle: 'DETALLADO' }),
    );
    expect(llm.requests[0]?.user).toContain('Nivel de detalle: RESUMIDO');
    expect(llm.requests[1]?.user).toContain('Nivel de detalle: DETALLADO');
  });

  it('el system prompt define los roles y prohíbe "gabinete"', async () => {
    const llm = new FakeLlm(llmOutput);
    await new AiStructuringService(llm).structure(transcription, setup);
    expect(llm.requests[0]?.system).toContain('EOE (Equipo de Orientación Estudiantil)');
    expect(llm.requests[0]?.system).toContain('PADRE');
  });

  it('rechaza salida del LLM con forma inválida', async () => {
    const bad = new FakeLlm({ ...llmOutput, desarrollo: [] });
    await expect(
      new AiStructuringService(bad).structure(transcription, setup),
    ).rejects.toThrow(BadGatewayException);
    const notObject = new FakeLlm('hola');
    await expect(
      new AiStructuringService(notObject).structure(transcription, setup),
    ).rejects.toThrow(BadGatewayException);
  });

  it('rechaza un acuerdo sin responsable', async () => {
    const bad = new FakeLlm({ ...llmOutput, acuerdos: [{ compromiso: 'Algo' }] });
    await expect(
      new AiStructuringService(bad).structure(transcription, setup),
    ).rejects.toThrow(BadGatewayException);
  });

  it('422 si la transcripción está vacía y no llama al LLM', async () => {
    const llm = new FakeLlm(llmOutput);
    await expect(
      new AiStructuringService(llm).structure({ provider: 'mock', segments: [] }, setup),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(llm.requests).toHaveLength(0);
  });
});
