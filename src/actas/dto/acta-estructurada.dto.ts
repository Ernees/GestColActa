import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  Acuerdo,
  ActaEstructurada,
  Asistente,
  CierreActa,
  Institucion,
  MetadatosActa,
  ROLES_ASISTENTE,
  RolAsistente,
  TIPOS_ACTA,
  TipoActa,
} from '../interfaces/acta-estructurada.interface';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class InstitucionDto implements Institucion {
  @IsString() @IsNotEmpty() nombre!: string;
  @IsOptional() @IsString() subtitulo?: string;
}

export class MetadatosDto implements MetadatosActa {
  @Matches(FECHA_REGEX, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;

  @IsString() @IsNotEmpty() lugar!: string;
}

export class AsistenteDto implements Asistente {
  @IsString() @IsNotEmpty() nombre!: string;
  @IsIn(ROLES_ASISTENTE) rol!: RolAsistente;
  @IsOptional() @IsString() dni?: string;
}

export class AcuerdoDto implements Acuerdo {
  @IsString() @IsNotEmpty() compromiso!: string;
  @IsString() @IsNotEmpty() responsable!: string;
  @IsOptional() @IsString() plazo?: string;
}

export class CierreDto implements CierreActa {
  @Matches(HORA_REGEX, { message: 'horaFinalizacion debe tener formato HH:mm' })
  horaFinalizacion!: string;
}

export class ActaEstructuradaDto implements ActaEstructurada {
  @ValidateNested() @Type(() => InstitucionDto) institucion!: InstitucionDto;
  @ValidateNested() @Type(() => MetadatosDto) metadatos!: MetadatosDto;
  @IsIn(TIPOS_ACTA) tipoActa!: TipoActa;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsistenteDto)
  asistentes!: AsistenteDto[];

  @IsString() @IsNotEmpty() motivo!: string;

  @IsArray() @IsString({ each: true }) @IsNotEmpty({ each: true }) desarrollo!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcuerdoDto)
  acuerdos!: AcuerdoDto[];

  @ValidateNested() @Type(() => CierreDto) cierre!: CierreDto;
}
