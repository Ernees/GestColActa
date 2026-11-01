import { Body, Controller, Header, HttpCode, Post, StreamableFile } from '@nestjs/common';
import { ActaDocxService } from './docx/acta-docx.service';
import { ActaEstructuradaDto } from './dto/acta-estructurada.dto';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('actas')
export class ActasController {
  constructor(private readonly docx: ActaDocxService) {}

  @Post('preview-docx')
  @HttpCode(200)
  @Header('Content-Type', DOCX_MIME)
  @Header('Content-Disposition', 'attachment; filename="acta.docx"')
  async previewDocx(@Body() acta: ActaEstructuradaDto): Promise<StreamableFile> {
    const buffer = await this.docx.generate(acta);
    return new StreamableFile(buffer);
  }
}
