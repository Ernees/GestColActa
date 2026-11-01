import { Module } from '@nestjs/common';
import { AiStructuringService } from './ai-structuring.service';
import { AnthropicLlmClient } from './anthropic-llm.client';
import { LlmClient } from './llm-client';

@Module({
  providers: [AiStructuringService, { provide: LlmClient, useClass: AnthropicLlmClient }],
  exports: [AiStructuringService],
})
export class AiModule {}
