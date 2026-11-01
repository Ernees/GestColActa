import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AcuerdoDto } from '../actas/dto/acta-estructurada.dto';

export class MapeoHablanteDto {
  @IsInt() @Min(0) speaker!: number;

  /** Nombre exacto de un asistente, o null si no se pudo identificar. */
  @ValidateIf((o: MapeoHablanteDto) => o.nombre !== null)
  @IsString()
  nombre!: string | null;
}

/** Salida esperada del LLM (lo que NO viene del usuario). */
export class EstructuracionLlmDto {
  @IsString() @IsNotEmpty() motivo!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  desarrollo!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcuerdoDto)
  acuerdos!: AcuerdoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MapeoHablanteDto)
  mapeoHablantes!: MapeoHablanteDto[];
}
