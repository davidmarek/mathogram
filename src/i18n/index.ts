import { cs } from './cs';
import { en } from './en';
import type { Language } from '../storage/progress';

export const messages = { en, cs };
export function detectLanguage(languages: readonly string[]): Language {
  return languages.some((language) => /^cs(?:-|$)/i.test(language))
    ? 'cs'
    : 'en';
}
