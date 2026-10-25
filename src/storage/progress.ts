import { puzzles } from '../content/animals';
import { isValidRules } from '../domain/arithmetic';
import type { ArithmeticRules } from '../domain/arithmetic';
import { validateAttempt } from '../domain/game';
import type { Attempt } from '../domain/game';
import { isRecord } from '../domain/puzzle';

export const STORAGE_KEY = 'mathogram.progress';

export type Language = 'en' | 'cs';
export type Theme = 'system' | 'light' | 'dark';
/** `picture` keeps each picture's own exercises; rules override them for new attempts. */
export type ExercisePreference = 'picture' | ArithmeticRules;

export interface Progress {
  version: 1;
  language: Language;
  showRowHints: boolean;
  theme: Theme;
  exercises: ExercisePreference;
  attempts: Record<string, Attempt>;
  completed: string[];
}

export interface LoadResult {
  progress: Progress;
  notice: 'recovered' | 'unavailable' | null;
}

export function emptyProgress(language: Language): Progress {
  return {
    version: 1,
    language,
    showRowHints: true,
    theme: 'system',
    exercises: 'picture',
    attempts: {},
    completed: [],
  };
}

function recover(value: unknown, fallbackLanguage: Language): LoadResult {
  const progress = emptyProgress(fallbackLanguage);
  if (!isRecord(value)) return { progress, notice: 'recovered' };
  let recovered = value.version !== 1;
  if (value.language === 'en' || value.language === 'cs') {
    progress.language = value.language;
  } else {
    recovered = true;
  }
  if ('showRowHints' in value) {
    if (typeof value.showRowHints === 'boolean') {
      progress.showRowHints = value.showRowHints;
    } else {
      recovered = true;
    }
  }
  if ('theme' in value) {
    if (
      value.theme === 'system' ||
      value.theme === 'light' ||
      value.theme === 'dark'
    ) {
      progress.theme = value.theme;
    } else {
      recovered = true;
    }
  }
  if ('exercises' in value) {
    if (value.exercises === 'picture') {
      progress.exercises = 'picture';
    } else if (isValidRules(value.exercises)) {
      progress.exercises = {
        maxNumber: value.exercises.maxNumber,
        crossTen: value.exercises.crossTen,
        operations: value.exercises.operations,
      };
    } else {
      recovered = true;
    }
  }
  if (isRecord(value.attempts)) {
    for (const [id, attempt] of Object.entries(value.attempts)) {
      const puzzle = puzzles.find((candidate) => candidate.id === id);
      if (!puzzle || !validateAttempt(attempt, puzzle)) {
        recovered = true;
        continue;
      }
      // Rebuild from validated fields; never carry unknown saved properties forward.
      progress.attempts[id] = {
        puzzleId: attempt.puzzleId,
        puzzleVersion: attempt.puzzleVersion,
        queue: attempt.queue.map(({ pixelId, equation }) => ({
          pixelId,
          equation: {
            a: equation.a,
            op: equation.op,
            b: equation.b,
            c: equation.c,
            ...(equation.op2 !== undefined
              ? { op2: equation.op2, d: equation.d }
              : {}),
          },
        })),
        solved: [...attempt.solved],
        ...(attempt.reviewPixelId !== undefined
          ? { reviewPixelId: attempt.reviewPixelId }
          : {}),
        ...(attempt.rules !== undefined
          ? {
              rules: {
                maxNumber: attempt.rules.maxNumber,
                crossTen: attempt.rules.crossTen,
                operations: attempt.rules.operations,
              },
            }
          : {}),
      };
    }
  } else {
    recovered = true;
  }
  if (Array.isArray(value.completed)) {
    for (const id of value.completed) {
      if (
        typeof id !== 'string' ||
        !puzzles.some((puzzle) => puzzle.id === id) ||
        progress.completed.includes(id)
      ) {
        recovered = true;
      } else {
        progress.completed.push(id);
      }
    }
  } else {
    recovered = true;
  }
  return { progress, notice: recovered ? 'recovered' : null };
}

function isStorageFailure(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    [
      'SecurityError',
      'QuotaExceededError',
      'NS_ERROR_DOM_QUOTA_REACHED',
    ].includes(error.name)
  );
}

export function loadProgress(
  storage: Pick<Storage, 'getItem'>,
  fallbackLanguage: Language,
): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error: unknown) {
    if (!isStorageFailure(error)) throw error;
    return { progress: emptyProgress(fallbackLanguage), notice: 'unavailable' };
  }
  if (raw === null) {
    return { progress: emptyProgress(fallbackLanguage), notice: null };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
    return { progress: emptyProgress(fallbackLanguage), notice: 'recovered' };
  }
  return recover(value, fallbackLanguage);
}

export function sameExercises(
  first: ExercisePreference,
  second: ExercisePreference,
): boolean {
  return first === 'picture' || second === 'picture'
    ? first === second
    : first.maxNumber === second.maxNumber &&
        first.crossTen === second.crossTen &&
        first.operations === second.operations;
}

export function saveProgress(
  storage: Pick<Storage, 'setItem'>,
  progress: Progress,
): { ok: true } | { ok: false; reason: 'unavailable' } {
  const validated = recover(progress, 'en');
  if (
    validated.notice !== null ||
    typeof progress.showRowHints !== 'boolean' ||
    progress.theme !== validated.progress.theme ||
    !sameExercises(progress.exercises, validated.progress.exercises)
  ) {
    throw new TypeError('Cannot save invalid progress.');
  }
  const serialized = JSON.stringify(validated.progress);
  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (error: unknown) {
    if (!isStorageFailure(error)) throw error;
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true };
}

export function resetPuzzle(progress: Progress, puzzleId: string): Progress {
  return {
    ...progress,
    attempts: Object.fromEntries(
      Object.entries(progress.attempts).filter(([id]) => id !== puzzleId),
    ),
  };
}

export function resetAllProgress(progress: Progress): Progress {
  return {
    ...emptyProgress(progress.language),
    showRowHints: progress.showRowHints,
    theme: progress.theme,
    exercises: progress.exercises,
  };
}
