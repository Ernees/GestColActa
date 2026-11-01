import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export const TRANSCRIPTION_PROVIDERS = ['deepgram', 'openai', 'mock'] as const;
export type TranscriptionProviderName = (typeof TRANSCRIPTION_PROVIDERS)[number];

/** Variables de entorno soportadas. Todas opcionales: sin credenciales se usa el mock. */
export class EnvironmentVariables {
  @IsOptional() @IsInt() @Min(1) @Max(65535) PORT?: number;

  @IsOptional() @IsString() DEEPGRAM_API_KEY?: string;
  @IsOptional() @IsString() OPENAI_API_KEY?: string;
  @IsOptional() @IsString() ANTHROPIC_API_KEY?: string;
  @IsOptional() @IsString() ANTHROPIC_MODEL?: string;

  /** Fuerza el proveedor; si se omite se elige según las API keys presentes. */
  @IsOptional()
  @IsIn(TRANSCRIPTION_PROVIDERS)
  TRANSCRIPTION_PROVIDER?: TranscriptionProviderName;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Las variables vacías (`KEY=`) se tratan como ausentes.
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const env = plainToInstance(EnvironmentVariables, cleaned, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n${errors.toString()}`);
  }
  return env;
}
