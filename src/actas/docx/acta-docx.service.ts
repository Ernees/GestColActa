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
  PADRE: 'Padre/Madre',
  EOE: 'EOE',
};

const COL_WIDTH = 2800;
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
          new TextRun(
            /[.!?;:]$/.test(a.compromiso.trim()) ? a.compromiso : `${a.compromiso}.`,
          ),
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
    return [
      this.titulo('Firmas'),
      new Table({
        width: { size: COL_WIDTH * 3, type: WidthType.DXA },
        columnWidths: [COL_WIDTH, COL_WIDTH, COL_WIDTH],
        borders: {
          ...NO_BORDERS,
          insideHorizontal: NO_BORDER,
          insideVertical: NO_BORDER,
        },
        rows: acta.asistentes.map((a) => this.filaFirma(a)),
      }),
    ];
  }

  /** Renglón de firma libre + rótulos "Aclaración" y "DNI / Rol" debajo de su línea. */
  private filaFirma(a: Asistente): TableRow {
    const cell = (caption?: { label: string; value: string }): TableCell =>
      new TableCell({
        width: { size: COL_WIDTH, type: WidthType.DXA },
        borders: NO_BORDERS,
        margins: { left: 100, right: 100, bottom: 360 },
        children: [
          new Paragraph({
            spacing: { before: 1200 },
            border: {
              bottom: { style: BorderStyle.DOTTED, size: 8, color: '000000', space: 1 },
            },
            children: [],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: caption
              ? [
                  new TextRun({ text: `${caption.label}: `, bold: true, size: 18 }),
                  new TextRun({ text: caption.value, size: 18 }),
                ]
              : [],
          }),
        ],
      });
    const dniRol = a.dni ? `${a.dni} / ${ROL_LABEL[a.rol]}` : ROL_LABEL[a.rol];
    return new TableRow({
      cantSplit: true,
      children: [
        cell(),
        cell({ label: 'Aclaración', value: a.nombre }),
        cell({ label: 'DNI / Rol', value: dniRol }),
      ],
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
