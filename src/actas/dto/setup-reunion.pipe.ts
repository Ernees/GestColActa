import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import { SetupReunionDto } from './setup-reunion.dto';

/** Parsea y valida el campo `metadata` (JSON string) de un multipart/form-data. */
@Injectable()
export class SetupReunionPipe implements PipeTransform<
  unknown,
  Promise<SetupReunionDto>
> {
  async transform(value: unknown): Promise<SetupReunionDto> {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException('metadata es obligatorio (JSON string)');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('metadata no es un JSON válido');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new BadRequestException('metadata debe ser un objeto JSON');
    }
    const dto = plainToInstance(SetupReunionDto, parsed);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadRequestException(errors.flatMap((e) => flatten(e.property, e)));
    }
    return dto;
  }
}

function flatten(path: string, node: ValidationError): string[] {
  const own = Object.values(node.constraints ?? {}).map((m) => `${path}: ${m}`);
  const nested = (node.children ?? []).flatMap((c) =>
    flatten(`${path}.${c.property}`, c),
  );
  return [...own, ...nested];
}
