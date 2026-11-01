export interface TranscriptSegment {
  /** Identificador numérico del hablante (0..n). Whisper no diariza: siempre 0. */
  speaker: number;
  /** Segundos desde el inicio del audio. */
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  provider: string;
  segments: TranscriptSegment[];
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<Transcription>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
