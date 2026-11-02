import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActaEstructuradaDto } from '../actas/dto/acta-estructurada.dto';
import { SetupReunionDto } from '../actas/dto/setup-reunion.dto';
import { Transcription } from '../transcription/transcription.types';
import {
  AdvertenciaDto,
  EstructuracionLlmDto,
  MapeoHablanteDto,
} from './estructuracion-llm.dto';
import { LlmClient } from './llm-client';
import { INPUT_SCHEMA, SYSTEM_PROMPT, TOOL_NAME, buildUserPrompt } from './prompts';

export interface ActaProcesada {
  acta: ActaEstructuradaDto;
  mapeoHablantes: MapeoHablanteDto[];
  /** Acuerdos que conviene revisar manualmente antes de firmar. */
  advertencias: AdvertenciaDto[];
}

export const RESPONSABLE_A_DEFINIR = 'A definir';

@Injectable()
export class AiStructuringService {
  constructor(private readonly llm: LlmClient) {}

  async structure(
    transcription: Transcription,
    setup: SetupReunionDto,
  ): Promise<ActaProcesada> {
    if (transcription.segments.length === 0) {
      throw new UnprocessableEntityException('La transcripción no contiene segmentos');
    }

    const raw = await this.llm.extractStructured({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(setup, transcription.segments),
      toolName: TOOL_NAME,
      toolDescription: 'Registra el contenido estructurado del acta de la reunión.',
      inputSchema: INPUT_SCHEMA,
    });

    const llmOut = await this.validateLlmOutput(raw);

    // Institución, metadatos, tipo y asistentes son autoridad del usuario, no del LLM.
    const candidate = plainToInstance(ActaEstructuradaDto, {
      institucion: setup.institucion,
      metadatos: setup.metadatos,
      tipoActa: setup.tipoActa,
      asistentes: setup.asistentes,
      motivo: llmOut.motivo,
      desarrollo: llmOut.desarrollo,
      acuerdos: llmOut.acuerdos,
      cierre: { horaFinalizacion: setup.metadatos.horaFin },
    });
    const errors = await validate(candidate, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new UnprocessableEntityException(
        `El acta generada no supera la validación: ${errors.toString()}`,
      );
    }

    const nombres = new Set(setup.asistentes.map((a) => a.nombre));
    const mapeoHablantes = llmOut.mapeoHablantes.map((m): MapeoHablanteDto => ({
      speaker: m.speaker,
      nombre: m.nombre !== null && nombres.has(m.nombre) ? m.nombre : null,
    }));
    return {
      acta: candidate,
      mapeoHablantes,
      advertencias: this.advertencias(llmOut, candidate),
    };
  }

  /** Combina las advertencias del LLM con las deterministas ("A definir"). */
  private advertencias(
    llmOut: EstructuracionLlmDto,
    acta: ActaEstructuradaDto,
  ): AdvertenciaDto[] {
    const total = acta.acuerdos.length;
    const byIndex = new Map<number, string>();
    for (const a of llmOut.advertencias ?? []) {
      if (a.indice < total) byIndex.set(a.indice, a.razon);
    }
    acta.acuerdos.forEach((ac, i) => {
      if (ac.responsable.trim().toLowerCase() === RESPONSABLE_A_DEFINIR.toLowerCase()) {
        byIndex.set(i, byIndex.get(i) ?? 'No quedó claro quién asume este compromiso.');
      }
    });
    return [...byIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([indice, razon]) => ({ indice, razon }));
  }

  private async validateLlmOutput(raw: unknown): Promise<EstructuracionLlmDto> {
    if (typeof raw !== 'object' || raw === null) {
      throw new BadGatewayException('Salida del LLM no es un objeto');
    }
    const dto = plainToInstance(EstructuracionLlmDto, this.normalize(raw));
    const errors = await validate(dto, { whitelist: true });
    if (errors.length > 0) {
      throw new BadGatewayException(`Salida del LLM inválida: ${errors.toString()}`);
    }
    return dto;
  }

  /** El LLM a veces devuelve `plazo: null`; lo tratamos como ausente. */
  private normalize(raw: object): object {
    const obj = raw as { acuerdos?: unknown };
    if (!Array.isArray(obj.acuerdos)) return raw;
    const acuerdos: unknown[] = obj.acuerdos;
    return {
      ...raw,
      acuerdos: acuerdos.map((a) => {
        if (typeof a !== 'object' || a === null) return a;
        const { plazo, ...rest } = a as { plazo?: unknown };
        return plazo === null || plazo === '' ? rest : a;
      }),
    };
  }
}
