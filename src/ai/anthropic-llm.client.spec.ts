import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicLlmClient } from './anthropic-llm.client';

const request = {
  system: 's',
  user: 'u',
  toolName: 't',
  toolDescription: 'd',
  inputSchema: {},
};

describe('AnthropicLlmClient', () => {
  it('503 sin ANTHROPIC_API_KEY (no llama a la red)', async () => {
    const client = new AnthropicLlmClient({
      get: () => undefined,
    } as unknown as ConfigService<never, true>);
    await expect(client.extractStructured(request)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
