import { ActaEstructurada } from '../interfaces/acta-estructurada.interface';

export const actaEjemplo: ActaEstructurada = {
  institucion: { nombre: 'Escuela Técnica N° 7', subtitulo: 'Nivel Secundario' },
  metadatos: {
    fecha: '2026-03-09',
    horaInicio: '09:30',
    horaFin: '10:45',
    lugar: 'la Sala de Directivos',
  },
  tipoActa: 'CONVIVENCIA',
  asistentes: [
    { nombre: 'María Pérez', rol: 'DIRECTIVO', dni: '20.111.222' },
    { nombre: 'Juan Gómez', rol: 'TUTOR' },
    { nombre: 'Lucía Fernández', rol: 'GABINETE', dni: '30.333.444' },
  ],
  motivo: 'Abordar la situación de convivencia ocurrida en el recreo del día 5 de marzo.',
  desarrollo: [
    'La directora expone los hechos informados por preceptoría.',
    'La familia manifiesta su preocupación y aporta su versión.',
  ],
  acuerdos: [
    {
      compromiso: 'Realizar seguimiento semanal del alumno.',
      responsable: 'Tutor',
      plazo: '30 días',
    },
    { compromiso: 'Entrevista de devolución con la familia.', responsable: 'Gabinete' },
  ],
  cierre: { horaFinalizacion: '10:45' },
};

export const setupEjemplo = {
  institucion: actaEjemplo.institucion,
  metadatos: actaEjemplo.metadatos,
  tipoActa: actaEjemplo.tipoActa,
  asistentes: actaEjemplo.asistentes.slice(0, 2),
};
