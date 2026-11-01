import JSZip from 'jszip';
import { Test } from '@nestjs/testing';
import { ActaDocxService } from './acta-docx.service';
import { actaEjemplo } from './fixtures';
import { descomponerFecha, fechaLarga } from './fecha.util';

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml no encontrado');
  return file.async('string');
}

describe('ActaDocxService', () => {
  let service: ActaDocxService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [ActaDocxService],
    }).compile();
    service = mod.get(ActaDocxService);
  });

  it('genera un buffer ZIP/docx válido', async () => {
    const buf = await service.generate(actaEjemplo);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });

  it('incluye encabezado, fecha, apertura, motivo y cierre', async () => {
    const xml = await documentXml(await service.generate(actaEjemplo));
    expect(xml).toContain('ESCUELA TÉCNICA N° 7');
    expect(xml).toContain('Nivel Secundario');
    expect(xml).toContain('ACTA DE CONVIVENCIA');
    expect(xml).toContain('Buenos Aires, 9 de marzo de 2026');
    expect(xml).toContain('siendo las 09:30 horas');
    expect(xml).toContain('María Pérez (Directivo/a, DNI 20.111.222)');
    expect(xml).toContain('Juan Gómez (Tutor/a) y Lucía Fernández');
    expect(xml).toContain(actaEjemplo.motivo);
    expect(xml).toContain('Se cierra la reunión siendo las 10:45 horas');
  });

  it('incluye puntos tratados y acuerdos con responsable y plazo', async () => {
    const xml = await documentXml(await service.generate(actaEjemplo));
    for (const p of actaEjemplo.desarrollo) expect(xml).toContain(p);
    expect(xml).toContain('Realizar seguimiento semanal del alumno.');
    expect(xml).toContain('30 días');
    expect(xml).toContain('Gabinete');
  });

  it('genera un bloque de firma con línea punteada por asistente', async () => {
    const xml = await documentXml(await service.generate(actaEjemplo));
    // 3 asistentes x 3 columnas
    expect(xml.match(/w:val="dotted"/g)).toHaveLength(9);
    expect(xml).toContain('Aclaración');
    expect(xml).toContain('DNI / Rol');
    expect(xml).toContain('20.111.222 / Directivo/a');
    // el renglón de firma queda libre: sin rótulo "Firma" debajo de la línea
    expect(xml).not.toMatch(/<w:t[^>]*>Firma<\/w:t>/);
  });

  it('agrega punto final al compromiso si falta, antes de "Responsable"', async () => {
    const xml = await documentXml(
      await service.generate({
        ...actaEjemplo,
        acuerdos: [{ compromiso: 'Realizar una mediación', responsable: 'Tutor' }],
      }),
    );
    expect(xml).toContain('Realizar una mediación.');
  });

  it('omite secciones vacías sin romperse', async () => {
    const xml = await documentXml(
      await service.generate({ ...actaEjemplo, desarrollo: [], acuerdos: [] }),
    );
    expect(xml).not.toContain('Puntos tratados');
    expect(xml).not.toContain('Acuerdos y compromisos');
  });

  it('rechaza fechas inválidas', async () => {
    await expect(
      service.generate({
        ...actaEjemplo,
        metadatos: { ...actaEjemplo.metadatos, fecha: '09/03/2026' },
      }),
    ).rejects.toThrow(RangeError);
  });
});

describe('fecha.util', () => {
  it('descompone y formatea', () => {
    expect(descomponerFecha('2026-12-01')).toEqual({
      dia: 1,
      mes: 'diciembre',
      anio: 2026,
    });
    expect(fechaLarga('2026-01-31')).toBe('31 de enero de 2026');
  });
  it('lanza en mes inexistente', () => {
    expect(() => descomponerFecha('2026-13-01')).toThrow(RangeError);
  });
});
