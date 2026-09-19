import {
  czechWordById,
  czechWords,
  czechWordVersion,
} from '../content/czechWords';
import { isRecord, validatePuzzle } from './puzzle';
import type { Puzzle } from './puzzle';

export interface SpellingAttempt {
  puzzleId: string;
  puzzleVersion: number;
  wordVersion: number;
  queue: { pixelId: string; wordId: string }[];
  solved: string[];
}

export interface SpellingProgress {
  attempts: Record<string, SpellingAttempt>;
  completed: string[];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new RangeError('Random source must return a number in [0, 1).');
    const other = Math.floor(value * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function createSpellingAttempt(
  puzzle: Puzzle,
  random: () => number = Math.random,
): SpellingAttempt {
  if (!validatePuzzle(puzzle)) throw new TypeError('Invalid puzzle.');
  let deck: typeof czechWords = [];
  let previous: string | undefined;
  const queue = shuffle(puzzle.pixels, random).map(({ id: pixelId }) => {
    if (deck.length === 0) {
      deck = shuffle(czechWords, random);
      if (deck[0]!.id === previous) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
    }
    const wordId = deck.shift()!.id;
    previous = wordId;
    return { pixelId, wordId };
  });
  return {
    puzzleId: puzzle.id,
    puzzleVersion: puzzle.version,
    wordVersion: czechWordVersion,
    queue,
    solved: [],
  };
}

export function currentWord(attempt: SpellingAttempt) {
  return attempt.queue[attempt.solved.length];
}

export function spellingComplete(attempt: SpellingAttempt): boolean {
  return (
    attempt.queue.length > 0 && attempt.solved.length === attempt.queue.length
  );
}

export function normalizeSpelling(answer: string): string {
  return answer.normalize('NFC').trim().toLocaleLowerCase('cs');
}

export function submitSpelling(
  attempt: SpellingAttempt,
  answer: string,
  expectedPixelId: string,
): SpellingAttempt {
  const current = currentWord(attempt);
  if (
    !current ||
    current.pixelId !== expectedPixelId ||
    normalizeSpelling(answer) !==
      normalizeSpelling(czechWordById.get(current.wordId)?.text ?? '')
  )
    return attempt;
  return { ...attempt, solved: [...attempt.solved, current.pixelId] };
}

export function validateSpellingAttempt(
  value: unknown,
  puzzle: Puzzle,
): value is SpellingAttempt {
  if (
    !isRecord(value) ||
    value.puzzleId !== puzzle.id ||
    value.puzzleVersion !== puzzle.version ||
    value.wordVersion !== czechWordVersion ||
    !Array.isArray(value.queue) ||
    value.queue.length !== puzzle.pixels.length ||
    !Array.isArray(value.solved) ||
    value.solved.length > value.queue.length
  )
    return false;
  const pixels = new Set(puzzle.pixels.map(({ id }) => id));
  const seen = new Set<string>();
  for (const entry of value.queue) {
    if (
      !isRecord(entry) ||
      typeof entry.pixelId !== 'string' ||
      !pixels.has(entry.pixelId) ||
      seen.has(entry.pixelId) ||
      typeof entry.wordId !== 'string' ||
      !czechWordById.has(entry.wordId)
    )
      return false;
    seen.add(entry.pixelId);
  }
  const queue = value.queue;
  return value.solved.every((id, index) => {
    const entry: unknown = queue[index];
    return isRecord(entry) && id === entry.pixelId;
  });
}
