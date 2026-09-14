import groups from './czech-words.json' with { type: 'json' };

// Bump when words or their order change: IDs also identify versioned recordings.
export const czechWordVersion = 1;
export const czechWords = groups
  .flatMap(({ words }) => words)
  .map((text, index) => ({
    id: `cs-${String(index + 1).padStart(3, '0')}`,
    text,
  }));
export const czechWordById = new Map(czechWords.map((word) => [word.id, word]));

export function wordAudioPath(wordId: string): string {
  if (!czechWordById.has(wordId)) throw new TypeError('Unknown Czech word.');
  return `audio/cs/v${czechWordVersion}/${wordId}.mp3`;
}
