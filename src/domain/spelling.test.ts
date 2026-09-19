import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import {
  czechWords,
  czechWordById,
  wordAudioPath,
} from '../content/czechWords';
import {
  createSpellingAttempt,
  currentWord,
  spellingComplete,
  submitSpelling,
  validateSpellingAttempt,
} from './spelling';
import { createAttempt } from './game';
import {
  emptyProgress,
  loadProgress,
  resetAllProgress,
  saveProgress,
} from '../storage/progress';

const fish = puzzles[0]!;

describe('Czech spelling domain', () => {
  it('provides 105 unique, NFC-normalized words and versioned opaque audio paths', () => {
    expect(czechWords).toHaveLength(105);
    expect(new Set(czechWords.map(({ text }) => text)).size).toBe(105);
    for (const word of czechWords) {
      expect(word.text).toMatch(/^[a-záčďéěíňóřšťúůýž]+$/iu);
      expect(word.text).toBe(word.text.normalize('NFC'));
      expect(wordAudioPath(word.id)).toMatch(/^audio\/cs\/v2\/cs-\d{3}\.mp3$/);
    }
    expect(() => wordAudioPath('unknown')).toThrow(TypeError);
  });

  it.each(puzzles)(
    'assigns and completes every pixel of $id without skipping words',
    (puzzle) => {
      let attempt = createSpellingAttempt(puzzle, () => 0.4);
      expect(validateSpellingAttempt(attempt, puzzle)).toBe(true);
      expect(new Set(attempt.queue.map(({ pixelId }) => pixelId)).size).toBe(
        puzzle.pixels.length,
      );
      expect(
        new Set(
          attempt.queue.slice(0, czechWords.length).map(({ wordId }) => wordId),
        ).size,
      ).toBe(Math.min(czechWords.length, puzzle.pixels.length));
      for (let index = 1; index < attempt.queue.length; index++)
        expect(attempt.queue[index]!.wordId).not.toBe(
          attempt.queue[index - 1]!.wordId,
        );
      for (const exercise of attempt.queue) {
        expect(currentWord(attempt)).toEqual(exercise);
        expect(submitSpelling(attempt, 'wrong', exercise.pixelId)).toBe(
          attempt,
        );
        expect(
          submitSpelling(
            attempt,
            czechWordById.get(exercise.wordId)!.text,
            'stale',
          ),
        ).toBe(attempt);
        const next = submitSpelling(
          attempt,
          ` ${czechWordById.get(exercise.wordId)!.text.toUpperCase()} `,
          exercise.pixelId,
        );
        expect(next.solved.length).toBe(attempt.solved.length + 1);
        expect(validateSpellingAttempt(next, puzzle)).toBe(true);
        attempt = next;
      }
      expect(spellingComplete(attempt)).toBe(true);
      expect(currentWord(attempt)).toBeUndefined();
      expect(submitSpelling(attempt, 'máma', attempt.queue[0]!.pixelId)).toBe(
        attempt,
      );
    },
  );

  it('accepts composed/decomposed accents but does not remove accents or internal spaces', () => {
    const attempt = createSpellingAttempt(fish, () => 0);
    attempt.queue[0]!.wordId = 'cs-005';
    const id = currentWord(attempt)!.pixelId;
    expect(submitSpelling(attempt, 'PA\u0301V', id).solved).toEqual([id]);
    expect(submitSpelling(attempt, 'pav', id)).toBe(attempt);
    expect(submitSpelling(attempt, 'pá v', id)).toBe(attempt);
    expect(spellingComplete({ ...attempt, queue: [], solved: [] })).toBe(false);
  });

  it('uses every workbook word before reshuffling without a boundary repeat', () => {
    const large = puzzles.reduce((current, puzzle) =>
      puzzle.pixels.length > current.pixels.length ? puzzle : current,
    );
    const attempt = createSpellingAttempt(large, () => 0);
    expect(
      new Set(
        attempt.queue.slice(0, czechWords.length).map(({ wordId }) => wordId),
      ).size,
    ).toBe(czechWords.length);
    expect(attempt.queue[czechWords.length - 1]!.wordId).not.toBe(
      attempt.queue[czechWords.length]!.wordId,
    );
  });

  it('accepts proper names case-insensitively', () => {
    const attempt = createSpellingAttempt(fish, () => 0);
    attempt.queue[0]!.wordId = 'cs-018';
    const id = currentWord(attempt)!.pixelId;
    expect(czechWordById.get('cs-018')?.text).toBe('Marek');
    expect(submitSpelling(attempt, 'marek', id).solved).toEqual([id]);
  });

  it('rejects invalid puzzles and random sources', () => {
    expect(() => createSpellingAttempt({ ...fish, pixels: [] })).toThrow(
      TypeError,
    );
    for (const value of [-1, 1, NaN, Infinity])
      expect(() => createSpellingAttempt(fish, () => value)).toThrow(
        RangeError,
      );
    expect(validateSpellingAttempt(createSpellingAttempt(fish), fish)).toBe(
      true,
    );
  });

  it('rejects malformed versions, queues, words, coordinates, and solved prefixes', () => {
    const attempt = createSpellingAttempt(fish, () => 0);
    const first = attempt.queue[0]!;
    const invalid: unknown[] = [
      null,
      [],
      { ...attempt, puzzleId: 'other' },
      { ...attempt, puzzleVersion: 0 },
      { ...attempt, wordVersion: 0 },
      { ...attempt, queue: null },
      { ...attempt, queue: [] },
      { ...attempt, solved: null },
      {
        ...attempt,
        solved: Array(attempt.queue.length + 1).fill(first.pixelId),
      },
      { ...attempt, queue: [null, ...attempt.queue.slice(1)] },
      {
        ...attempt,
        queue: [{ ...first, pixelId: 4 }, ...attempt.queue.slice(1)],
      },
      {
        ...attempt,
        queue: [{ ...first, pixelId: '99:99' }, ...attempt.queue.slice(1)],
      },
      { ...attempt, queue: [first, first, ...attempt.queue.slice(2)] },
      {
        ...attempt,
        queue: [{ ...first, wordId: null }, ...attempt.queue.slice(1)],
      },
      {
        ...attempt,
        queue: [{ ...first, wordId: 'unknown' }, ...attempt.queue.slice(1)],
      },
      { ...attempt, solved: [attempt.queue[1]!.pixelId] },
    ];
    for (const value of invalid)
      expect(validateSpellingAttempt(value, fish)).toBe(false);
  });
});

describe('separate spelling persistence and recovery', () => {
  function load(value: unknown) {
    return loadProgress({ getItem: () => JSON.stringify(value) }, 'en');
  }
  function saved() {
    return {
      ...emptyProgress('cs'),
      subject: 'czech' as const,
      attempts: { fish: createAttempt(fish, () => 0) },
      czech: {
        attempts: { fish: createSpellingAttempt(fish, () => 0) },
        completed: ['fish'],
      },
    };
  }
  it('round-trips each subject independently and resets both while retaining preferences', () => {
    const original = saved();
    const current = currentWord(original.czech.attempts.fish)!;
    original.czech.attempts.fish = submitSpelling(
      original.czech.attempts.fish,
      czechWordById.get(current.wordId)!.text,
      current.pixelId,
    );
    let raw = '';
    expect(
      saveProgress(
        {
          setItem: (_key, value) => {
            raw = value;
          },
        },
        original,
      ),
    ).toEqual({ ok: true });
    expect(loadProgress({ getItem: () => raw }, 'en')).toEqual({
      progress: original,
      notice: null,
    });
    expect(resetAllProgress(original)).toEqual({
      ...emptyProgress('cs'),
      subject: 'czech',
    });
    expect(load(emptyProgress('en')).notice).toBeNull();
  });
  it('sanitizes unknown fields and retains math when a spelling attempt is stale', () => {
    const original = saved();
    const restored = load({
      ...original,
      czech: {
        ...original.czech,
        attempts: {
          fish: {
            ...original.czech.attempts.fish,
            secret: 'remove',
            queue: original.czech.attempts.fish.queue.map((entry) => ({
              ...entry,
              extra: true,
            })),
          },
        },
      },
    });
    expect(restored).toEqual({ progress: original, notice: null });
    original.czech.attempts.fish.wordVersion = 0;
    const stale = load(original);
    expect(stale.notice).toBe('recovered');
    expect(stale.progress.attempts).toEqual(original.attempts);
    expect(stale.progress.czech).toEqual({ attempts: {}, completed: ['fish'] });
    expect(() => saveProgress({ setItem: () => {} }, original)).toThrow(
      TypeError,
    );
  });
  it('recovers invalid optional envelopes, attempts, subjects and badge lists', () => {
    const original = saved();
    for (const czech of [
      null,
      {},
      { attempts: null, completed: null },
      {
        attempts: { unknown: original.czech.attempts.fish },
        completed: ['unknown', null, 'fish', 'fish'],
      },
    ]) {
      const result = load({ ...original, subject: 'invalid', czech });
      expect(result.notice).toBe('recovered');
      expect(result.progress.subject).toBeUndefined();
      expect(result.progress.attempts).toEqual(original.attempts);
    }
    expect(load({ ...original, subject: 'math' }).progress.subject).toBe(
      'math',
    );
  });
});
