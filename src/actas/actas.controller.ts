import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Header,
  HttpCode,
  ParseEnumPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AiStructuringService } from '../ai/ai-structuring.service';
import { AdvertenciaDto, MapeoHablanteDto } from '../ai/estructuracion-llm.dto';
import {
  AUDIO_MIME_TYPES,
  TranscriptionService,
} from '../transcription/transcription.service';
import { TranscriptSegment } from '../transcription/transcription.types';
import { ActaDocxService } from './docx/acta-docx.service';
import { ActaEstructuradaDto } from './dto/acta-estructurada.dto';
import { MetadataField } from './dto/metadata-field.decorator';
import { SetupReunionDto } from './dto/setup-reunion.dto';
import { SetupReunionPipe } from './dto/setup-reunion.pipe';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export enum FormatoRespuesta {
  DOCX = 'docx',
  JSON = 'json',
}

export interface ProcesarReunionJson {
  acta: ActaEstructuradaDto;
  mapeoHablantes: MapeoHablanteDto[];
  advertencias: AdvertenciaDto[];
  transcripcion: TranscriptSegment[];
}

const ALLOWED_MIMES: readonly string[] = AUDIO_MIME_TYPES;

/** `audio/webm;codecs=opus` -> `audio/webm` (MediaRecorder agrega parámetros). */
function baseMime(mime: string): string {
  return (mime.split(';')[0] ?? mime).trim().toLowerCase();
}

@Controller('actas')
export class ActasController {
  constructor(
    private readonly docx: ActaDocxService,
    private readonly transcription: TranscriptionService,
    private readonly ai: AiStructuringService,
  ) {}

  @Post('preview-docx')
  @HttpCode(200)
  @Header('Content-Type', DOCX_MIME)
  @Header('Content-Disposition', 'attachment; filename="acta.docx"')
  async previewDocx(@Body() acta: ActaEstructuradaDto): Promise<StreamableFile> {
    const buffer = await this.docx.generate(acta);
    return new StreamableFile(buffer);
  }

  /**
   * multipart/form-data: `audio` (archivo) + `metadata` (JSON string de SetupReunionDto).
   * `?formato=docx` (default) devuelve el Word; `?formato=json` devuelve el acta
   * estructurada para revisarla/editarla y luego enviarla a /actas/preview-docx.
   */
  @Post('procesar-reunion')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(baseMime(file.mimetype))) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Tipo de audio no soportado (${file.mimetype}). Permitidos: m4a, mp3, wav, webm`,
            ),
            false,
          );
        }
      },
    }),
  )
  async procesarReunion(
    @UploadedFile() audio: Express.Multer.File | undefined,
    @MetadataField(SetupReunionPipe) setup: SetupReunionDto,
    @Query(
      'formato',
      new DefaultValuePipe(FormatoRespuesta.DOCX),
      new ParseEnumPipe(FormatoRespuesta),
    )
    formato: FormatoRespuesta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | ProcesarReunionJson> {
    if (!audio || audio.size === 0) {
      throw new BadRequestException(
        'El campo "audio" es obligatorio y no puede estar vacío',
      );
    }

    const transcripcion = await this.transcription.transcribe(
      audio.buffer,
      audio.mimetype,
    );
    const { acta, mapeoHablantes, advertencias } = await this.ai.structure(
      transcripcion,
      setup,
    );

    if (formato === FormatoRespuesta.JSON) {
      return {
        acta,
        mapeoHablantes,
        advertencias,
        transcripcion: transcripcion.segments,
      };
    }

    const buffer = await this.docx.generate(acta);
    res.set({
      'Content-Type': DOCX_MIME,
      'Content-Disposition': `attachment; filename="acta-${acta.tipoActa.toLowerCase()}-${acta.metadatos.fecha}.docx"`,
    });
    return new StreamableFile(buffer);
  }
}
