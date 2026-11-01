export interface StructuredRequest {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON Schema (type: object) que debe cumplir la salida. */
  inputSchema: Record<string, unknown>;
}

/** Abstracción del LLM (también token de DI): permite mockear en tests. */
export abstract class LlmClient {
  /** Devuelve el objeto que el modelo produjo vía tool calling. Sin validar. */
  abstract extractStructured(request: StructuredRequest): Promise<unknown>;
}
