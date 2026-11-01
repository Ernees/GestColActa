import Anthropic from '@anthropic-ai/sdk';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { LlmClient, StructuredRequest } from './llm-client';

const DEFAULT_MODEL = 'claude-sonnet-5-5';

@Injectable()
export class AnthropicLlmClient extends LlmClient {
  private client?: Anthropic;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    super();
  }

  async extractStructured(request: StructuredRequest): Promise<unknown> {
    const model = this.config.get('ANTHROPIC_MODEL', { infer: true }) ?? DEFAULT_MODEL;
    const client = this.getClient();
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 8000,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        tools: [
          {
            name: request.toolName,
            description: request.toolDescription,
            input_schema: { type: 'object', ...request.inputSchema },
          },
        ],
        // El modelo no admite tool_choice forzado (type tool/any): el system prompt exige la herramienta.
        tool_choice: { type: 'auto' },
      });
    } catch (err) {
      throw new BadGatewayException(
        `Error al invocar al LLM: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    }
    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === request.toolName,
    );
    if (!block)
      throw new BadGatewayException('El LLM no devolvió la herramienta esperada');
    return block.input;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
      if (!apiKey)
        throw new ServiceUnavailableException('ANTHROPIC_API_KEY no configurada');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }
}
