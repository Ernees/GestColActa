import { ExecutionContext, createParamDecorator } from '@nestjs/common';

interface MultipartRequest {
  body?: { metadata?: unknown };
}

/**
 * Extrae el campo `metadata` del multipart. Se usa un decorador custom (en vez de
 * `@Body('metadata')`) para que el ValidationPipe global no intente validar el
 * string crudo contra el tipo del parámetro; lo valida `SetupReunionPipe`.
 */
export const MetadataField = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown =>
    ctx.switchToHttp().getRequest<MultipartRequest>().body?.metadata,
);
