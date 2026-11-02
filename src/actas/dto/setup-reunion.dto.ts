import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import {
  DETALLES,
  NivelDetalle,
  TIPOS_ACTA,
  TipoActa,
} from '../interfaces/acta-estructurada.interface';
import { AsistenteDto, InstitucionDto, MetadatosDto } from './acta-estructurada.dto';

/** Datos que provee el usuario antes de procesar el audio. */
export class SetupReunionDto {
  @ValidateNested() @Type(() => InstitucionDto) institucion!: InstitucionDto;
  @ValidateNested() @Type(() => MetadatosDto) metadatos!: MetadatosDto;
  @IsIn(TIPOS_ACTA) tipoActa!: TipoActa;

  /** Nivel de síntesis del acta. Por defecto RESUMIDO. */
  @IsOptional() @IsIn(DETALLES) detalle?: NivelDetalle;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AsistenteDto)
  asistentes!: AsistenteDto[];
}
