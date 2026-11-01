import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  FileChild,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  ActaEstructurada,
  Asistente,
  RolAsistente,
  TipoActa,
} from '../interfaces/acta-estructurada.interface';
import { descomponerFecha, fechaLarga } from './fecha.util';

const FONT = 'Times New Roman';
const SIZE = 24; // half-points => 12pt
const BULLETS_REF = 'viñetas';
const NUMBERING_REF = 'acuerdos';

const TITULO_POR_TIPO: Record<TipoActa, string> = {
  CONVIVENCIA: 'ACTA DE CONVIVENCIA',
  PEDAGOGICA: 'ACTA PEDAGÓGICA',
  EMI_INTERNA: 'ACTA DE REUNIÓN INTERNA (EMI)',
  GENERAL: 'ACTA DE REUNIÓN',
};

const ROL_LABEL: Record<RolAsistente, string> = {
  DIRECTIVO: 'Directivo/a',
  DOCENTE: 'Docente',
  TUTOR: 'Tutor/a',
  ALUMNO: 'Alumno/a',
  GABINETE: 'Gabinete',
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
} as const;

@Injectable()
export class ActaDocxService {
  async generate(acta: ActaEstructurada): Promise<Buffer> {
    const doc = new Document({
      creator: 'GestColActa',
      title: `${TITULO_POR_TIPO[acta.tipoActa]} - ${acta.institucion.nombre}`,
      styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
      numbering: {
        config: [
          {
            reference: BULLETS_REF,
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
          {
            reference: NUMBERING_REF,
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, bottom: 1440, left: 1700, right: 1700 },
            },
          },
          children: [
            ...this.encabezado(acta),
            this.fecha(acta),
            this.apertura(acta),
            ...this.motivo(acta),
            ...this.desarrollo(acta),
            ...this.acuerdos(acta),
            this.cierre(acta),
            ...this.firmas(acta),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc);
  }

  private encabezado(acta: ActaEstructurada): Paragraph[] {
    const { nombre, subtitulo } = acta.institucion;
    const out: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: nombre.toUpperCase(), bold: true, size: 28 })],
      }),
    ];
    if (subtitulo) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: subtitulo, italics: true })],
        }),
      );
    }
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 360 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 },
        },
        children: [
          new TextRun({ text: TITULO_POR_TIPO[acta.tipoActa], bold: true, size: 26 }),
        ],
      }),
    );
    return out;
  }

  private fecha(acta: ActaEstructurada): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
      children: [new TextRun(`Buenos Aires, ${fechaLarga(acta.metadatos.fecha)}`)],
    });
  }

  private apertura(acta: ActaEstructurada): Paragraph {
    const { lugar, horaInicio, fecha } = acta.metadatos;
    const { dia, mes, anio } = descomponerFecha(fecha);
    const presentes = this.listaNatural(acta.asistentes.map((a) => this.describir(a)));
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 240, line: 360 },
      children: [
        new TextRun(
          `En la Ciudad de Buenos Aires, en ${lugar}, siendo las ${horaInicio} horas del día ` +
            `${dia} de ${mes} de ${anio}, se reúnen en ${acta.institucion.nombre} los/as ` +
            `siguientes presentes: ${presentes}.`,
        ),
      ],
    });
  }

  private motivo(acta: ActaEstructurada): Paragraph[] {
    return [
      this.titulo('Motivo de la reunión'),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 240, line: 360 },
        children: [new TextRun(acta.motivo)],
      }),
    ];
  }

  private desarrollo(acta: ActaEstructurada): Paragraph[] {
    if (acta.desarrollo.length === 0) return [];
    return [
      this.titulo('Puntos tratados'),
      ...acta.desarrollo.map(
        (punto) =>
          new Paragraph({
            numbering: { reference: BULLETS_REF, level: 0 },
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120, line: 320 },
            children: [new TextRun(punto)],
          }),
      ),
    ];
  }

  private acuerdos(acta: ActaEstructurada): Paragraph[] {
    if (acta.acuerdos.length === 0) return [];
    return [
      this.titulo('Acuerdos y compromisos', 240),
      ...acta.acuerdos.map((a) => {
        const runs: TextRun[] = [
          new TextRun(a.compromiso),
          new TextRun({ text: ' Responsable: ', bold: true }),
          new TextRun(a.responsable),
        ];
        if (a.plazo) {
          runs.push(new TextRun({ text: '. Plazo: ', bold: true }), new TextRun(a.plazo));
        }
        runs.push(new TextRun('.'));
        return new Paragraph({
          numbering: { reference: NUMBERING_REF, level: 0 },
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120, line: 320 },
          children: runs,
        });
      }),
    ];
  }

  private cierre(acta: ActaEstructurada): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 360, after: 480, line: 360 },
      children: [
        new TextRun(
          `Se cierra la reunión siendo las ${acta.cierre.horaFinalizacion} horas, previa lectura ` +
            `y conformidad de los presentes, quienes firman al pie.`,
        ),
      ],
    });
  }

  private firmas(acta: ActaEstructurada): FileChild[] {
    const rows = acta.asistentes.map((a) => this.filaFirma(a));
    const colWidth = 2800;
    return [
      this.titulo('Firmas'),
      new Table({
        width: { size: colWidth * 3, type: WidthType.DXA },
        columnWidths: [colWidth, colWidth, colWidth],
        borders: {
          ...NO_BORDERS,
          insideHorizontal: NO_BORDER,
          insideVertical: NO_BORDER,
        },
        rows: [this.filaEncabezadoFirmas(colWidth), ...rows],
      }),
    ];
  }

  private filaEncabezadoFirmas(width: number): TableRow {
    const cell = (text: string): TableCell =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: NO_BORDERS,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true })],
          }),
        ],
      });
    return new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [cell('Firma'), cell('Aclaración'), cell('DNI / Rol')],
    });
  }

  private filaFirma(a: Asistente): TableRow {
    const width = 2800;
    const cell = (line: string, caption: string): TableCell =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { left: 100, right: 100 },
        children: [
          new Paragraph({
            spacing: { before: 720 },
            alignment: AlignmentType.CENTER,
            border: {
              bottom: { style: BorderStyle.DOTTED, size: 8, color: '000000', space: 1 },
            },
            children: [new TextRun(line)],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: caption, size: 18 })],
          }),
        ],
      });
    const dniRol = a.dni ? `${a.dni} / ${ROL_LABEL[a.rol]}` : ROL_LABEL[a.rol];
    return new TableRow({
      cantSplit: true,
      children: [cell('', 'Firma'), cell('', a.nombre), cell('', dniRol)],
    });
  }

  private titulo(text: string, before = 120): Paragraph {
    return new Paragraph({
      keepNext: true,
      spacing: { before, after: 120 },
      children: [new TextRun({ text, bold: true, allCaps: true })],
    });
  }

  private describir(a: Asistente): string {
    const dni = a.dni ? `, DNI ${a.dni}` : '';
    return `${a.nombre} (${ROL_LABEL[a.rol]}${dni})`;
  }

  private listaNatural(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  }
}
