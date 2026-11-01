const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export interface FechaDescompuesta {
  dia: number;
  mes: string;
  anio: number;
}

/** Descompone `YYYY-MM-DD` sin pasar por `Date` (evita desfases de zona horaria). */
export function descomponerFecha(iso: string): FechaDescompuesta {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mes = match ? MESES[Number(match[2]) - 1] : undefined;
  if (!match || !mes) {
    throw new RangeError(`Fecha inválida: "${iso}". Se espera YYYY-MM-DD.`);
  }
  return { dia: Number(match[3]), mes, anio: Number(match[1]) };
}

export function fechaLarga(iso: string): string {
  const { dia, mes, anio } = descomponerFecha(iso);
  return `${dia} de ${mes} de ${anio}`;
}
