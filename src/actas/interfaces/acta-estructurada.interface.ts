export const TIPOS_ACTA = [
  'CONVIVENCIA',
  'PEDAGOGICA',
  'EMI_INTERNA',
  'GENERAL',
] as const;
export type TipoActa = (typeof TIPOS_ACTA)[number];

export const ROLES_ASISTENTE = [
  'DIRECTIVO',
  'DOCENTE',
  'TUTOR',
  'ALUMNO',
  'GABINETE',
] as const;
export type RolAsistente = (typeof ROLES_ASISTENTE)[number];

export interface Institucion {
  nombre: string;
  subtitulo?: string;
}

export interface MetadatosActa {
  /** Fecha ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Formato `HH:mm`. */
  horaInicio: string;
  horaFin: string;
  lugar: string;
}

export interface Asistente {
  nombre: string;
  rol: RolAsistente;
  dni?: string;
}

export interface Acuerdo {
  compromiso: string;
  responsable: string;
  plazo?: string;
}

export interface CierreActa {
  horaFinalizacion: string;
}

export interface ActaEstructurada {
  institucion: Institucion;
  metadatos: MetadatosActa;
  tipoActa: TipoActa;
  asistentes: Asistente[];
  motivo: string;
  desarrollo: string[];
  acuerdos: Acuerdo[];
  cierre: CierreActa;
}
