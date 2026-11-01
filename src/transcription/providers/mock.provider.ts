import { Injectable } from '@nestjs/common';
import { SpeechProvider, Transcription } from '../transcription.types';

/** Stub determinista para desarrollo local y CI: no llama a ninguna API. */
@Injectable()
export class MockSpeechProvider implements SpeechProvider {
  readonly name = 'mock';

  transcribe(): Promise<Transcription> {
    return Promise.resolve({
      provider: this.name,
      segments: [
        {
          speaker: 0,
          start: 0,
          end: 12.4,
          text: 'Buenas tardes, damos comienzo a la reunión para conversar sobre la situación ocurrida en el recreo.',
        },
        {
          speaker: 1,
          start: 12.9,
          end: 25.1,
          text: 'Desde el curso venimos observando algunos conflictos entre los chicos en los últimos días.',
        },
        {
          speaker: 0,
          start: 25.6,
          end: 38.0,
          text: 'Entonces acordamos hacer una mediación esta semana y avisar a las familias por cuaderno.',
        },
        {
          speaker: 1,
          start: 38.4,
          end: 44.0,
          text: 'Perfecto, yo me encargo de la mediación antes del viernes.',
        },
      ],
    });
  }
}
