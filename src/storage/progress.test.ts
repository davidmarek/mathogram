import { describe, expect, it, vi } from 'vitest';
import { puzzles } from '../content/animals';
import { createAttempt, isComplete, submitAnswer } from '../domain/game';
import type { Attempt } from '../domain/game';
import {
  emptyProgress,
  loadProgress,
  resetAllProgress,
  resetPuzzle,
  saveProgress,
  STORAGE_KEY,
} from './progress';
import type { Progress } from './progress';

const fish = puzzles[0]!;
const cat = puzzles[2]!;

function memoryStorage(raw: string | null = null) {
  const values = new Map<string, string>([['unrelated-app', 'leave me alone']]);
  if (raw !== null) values.set(STORAGE_KEY, raw);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function inProgress(): Progress {
  const attempt = createAttempt(fish, () => 0.4);
  const current = attempt.queue[0]!;
  return {
    version: 1,
    language: 'cs',
    attempts: {
      fish: submitAnswer(attempt, String(current.equation.c), current.pixelId),
      cat: createAttempt(cat, () => 0.6),
    },
    completed: ['owl'],
  };
}

function load(value: unknown) {
  return loadProgress(memoryStorage(JSON.stringify(value)), 'en');
}

describe('progress persistence', () => {
  it('returns fresh empty state without reporting recovery for absent data', () => {
    const storage = memoryStorage();
    expect(loadProgress(storage, 'cs')).toEqual({
      progress: emptyProgress('cs'),
      notice: null,
    });
    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
    const first = emptyProgress('en');
    const second = emptyProgress('en');
    expect(first.attempts).not.toBe(second.attempts);
    expect(first.completed).not.toBe(second.completed);
  });

  it('round-trips language, exact equations, queue order, solved prefix, and badges', () => {
    const original = inProgress();
    const storage = memoryStorage();
    expect(saveProgress(storage, original)).toEqual({ ok: true });
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
      STORAGE_KEY,
      JSON.stringify(original),
    );
    const restored = loadProgress(storage, 'en');
    expect(restored).toEqual({ progress: original, notice: null });
    expect(restored.progress).not.toBe(original);
    expect(restored.progress.attempts.fish).not.toBe(original.attempts.fish);
    expect(storage.values.get('unrelated-app')).toBe('leave me alone');
    expect(storage.values.size).toBe(2);
  });

  it.each(puzzles)(
    'can persist and resume after every correct pixel in $name',
    (puzzle) => {
      const storage = memoryStorage();
      let progress = emptyProgress('en');
      let attempt = createAttempt(puzzle, () => 0.25);
      const originalQueue = JSON.stringify(attempt.queue);
      for (const current of attempt.queue) {
        attempt = submitAnswer(
          attempt,
          String(current.equation.c),
          current.pixelId,
        );
        progress = {
          ...progress,
          attempts: { [puzzle.id]: attempt },
          completed: isComplete(attempt) ? [puzzle.id] : [],
        };
        expect(saveProgress(storage, progress)).toEqual({ ok: true });
        const result = loadProgress(storage, 'cs');
        expect(result.notice).toBeNull();
        expect(result.progress).toEqual(progress);
        attempt = result.progress.attempts[puzzle.id]!;
        expect(JSON.stringify(attempt.queue)).toBe(originalQueue);
      }
      expect(isComplete(attempt)).toBe(true);
      expect(loadProgress(storage, 'cs').progress.completed).toEqual([
        puzzle.id,
      ]);
    },
  );

  it('persists language changes without losing the active attempt or badge', () => {
    const progress = inProgress();
    progress.language = 'en';
    const storage = memoryStorage();
    saveProgress(storage, progress);
    expect(loadProgress(storage, 'cs').progress).toEqual(progress);
  });

  it('does not implicitly write recovered or missing data', () => {
    const storage = memoryStorage('{broken');
    loadProgress(storage, 'cs');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(STORAGE_KEY)).toBe('{broken');
    expect(storage.values.get('unrelated-app')).toBe('leave me alone');
  });
});

describe('independent recovery', () => {
  it.each(['', '{broken', 'undefined', '{"version":'])(
    'reports invalid JSON %j',
    (raw) => {
      expect(loadProgress(memoryStorage(raw), 'cs')).toEqual({
        progress: emptyProgress('cs'),
        notice: 'recovered',
      });
    },
  );

  it.each([null, [], 'text', 42, true, {}])(
    'reports an invalid top-level shape %j',
    (value) => {
      expect(load(value)).toEqual({
        progress: emptyProgress('en'),
        notice: 'recovered',
      });
    },
  );

  it.each([0, 2, 999, '1', null, undefined])(
    'reports incompatible top-level version %j but salvages fully validated fields',
    (version) => {
      const valid = inProgress();
      expect(load({ ...valid, version })).toEqual({
        progress: valid,
        notice: 'recovered',
      });
    },
  );

  it.each(['de', '', 1, null, undefined])(
    'recovers an invalid locale %j',
    (language) => {
      const valid = inProgress();
      expect(load({ ...valid, language })).toEqual({
        progress: { ...valid, language: 'en' },
        notice: 'recovered',
      });
    },
  );

  it.each([null, [], 'attempts', undefined])(
    'recovers invalid attempts %j',
    (attempts) => {
      const valid = inProgress();
      expect(load({ ...valid, attempts })).toEqual({
        progress: { ...valid, attempts: {} },
        notice: 'recovered',
      });
    },
  );

  it.each([null, {}, 'fish', undefined])(
    'recovers invalid badge collections %j',
    (completed) => {
      const valid = inProgress();
      expect(load({ ...valid, completed })).toEqual({
        progress: { ...valid, completed: [] },
        notice: 'recovered',
      });
    },
  );

  it('salvages known distinct badges independently of attempts', () => {
    const valid = inProgress();
    expect(
      load({
        ...valid,
        completed: ['fish', 'missing', 'owl', 'fish', 1, null, 'cat'],
      }),
    ).toEqual({
      progress: { ...valid, completed: ['fish', 'owl', 'cat'] },
      notice: 'recovered',
    });
  });

  const baseAttempt = createAttempt(fish, () => 0.4);
  const first = baseAttempt.queue[0]!;
  const badAttempts: [string, unknown][] = [
    ['null', null],
    ['missing puzzle', { ...baseAttempt, puzzleId: 'missing' }],
    ['wrong puzzle', { ...baseAttempt, puzzleId: cat.id }],
    ['old content', { ...baseAttempt, puzzleVersion: 0 }],
    ['future content', { ...baseAttempt, puzzleVersion: 2 }],
    ['string version', { ...baseAttempt, puzzleVersion: '1' }],
    ['missing queue', { ...baseAttempt, queue: undefined }],
    ['short queue', { ...baseAttempt, queue: baseAttempt.queue.slice(1) }],
    ['long queue', { ...baseAttempt, queue: [...baseAttempt.queue, first] }],
    [
      'duplicate pixel',
      {
        ...baseAttempt,
        queue: [baseAttempt.queue[1], ...baseAttempt.queue.slice(1)],
      },
    ],
    [
      'invalid coordinate',
      {
        ...baseAttempt,
        queue: [{ ...first, pixelId: '21:1' }, ...baseAttempt.queue.slice(1)],
      },
    ],
    [
      'background coordinate',
      {
        ...baseAttempt,
        queue: [{ ...first, pixelId: '1:1' }, ...baseAttempt.queue.slice(1)],
      },
    ],
    [
      'equation mismatch',
      {
        ...baseAttempt,
        queue: [
          { ...first, equation: { a: 1, op: '+', b: 1, c: 2 } },
          ...baseAttempt.queue.slice(1),
        ],
      },
    ],
    [
      'crossing ten',
      {
        ...baseAttempt,
        queue: [
          {
            ...first,
            equation: {
              a: first.equation.c + 10,
              op: '-',
              b: 10,
              c: first.equation.c,
            },
          },
          ...baseAttempt.queue.slice(1),
        ],
      },
    ],
    [
      'bad operation',
      {
        ...baseAttempt,
        queue: [
          { ...first, equation: { ...first.equation, op: '*' } },
          ...baseAttempt.queue.slice(1),
        ],
      },
    ],
    [
      'string operand',
      {
        ...baseAttempt,
        queue: [
          {
            ...first,
            equation: { ...first.equation, a: String(first.equation.a) },
          },
          ...baseAttempt.queue.slice(1),
        ],
      },
    ],
    [
      'fractional operand',
      {
        ...baseAttempt,
        queue: [
          { ...first, equation: { ...first.equation, b: 0.5 } },
          ...baseAttempt.queue.slice(1),
        ],
      },
    ],
    ['missing solved', { ...baseAttempt, solved: undefined }],
    [
      'skipped prefix',
      { ...baseAttempt, solved: [baseAttempt.queue[1]!.pixelId] },
    ],
    [
      'duplicate solved',
      { ...baseAttempt, solved: [first.pixelId, first.pixelId] },
    ],
    [
      'extra solved',
      {
        ...baseAttempt,
        solved: [...baseAttempt.queue.map(({ pixelId }) => pixelId), 'extra'],
      },
    ],
    ['unknown solved', { ...baseAttempt, solved: ['1:1'] }],
    ['nonstring solved', { ...baseAttempt, solved: [1] }],
  ];

  it.each(badAttempts)(
    'discards only the attempt with %s',
    (_name, invalid) => {
      const valid = inProgress();
      expect(
        load({
          ...valid,
          attempts: { ...valid.attempts, fish: invalid },
        }),
      ).toEqual({
        progress: { ...valid, attempts: { cat: valid.attempts.cat! } },
        notice: 'recovered',
      });
    },
  );

  it('drops unknown keys and mismatched key/attempt IDs, retaining valid siblings', () => {
    const valid = inProgress();
    expect(
      load({
        ...valid,
        attempts: {
          ...valid.attempts,
          removed: baseAttempt,
          rabbit: baseAttempt,
        },
      }),
    ).toEqual({ progress: valid, notice: 'recovered' });
  });

  it('does not allow prototype property names to create attempts or badges', () => {
    const storage = memoryStorage(
      '{"version":1,"language":"cs","attempts":{"__proto__":{},"constructor":{}},"completed":["__proto__","toString"]}',
    );
    expect(loadProgress(storage, 'en')).toEqual({
      progress: emptyProgress('cs'),
      notice: 'recovered',
    });
    expect(
      Object.getPrototypeOf(loadProgress(storage, 'en').progress.attempts),
    ).toBe(Object.prototype);
  });

  it('rebuilds saved objects without carrying arbitrary unknown properties', () => {
    const valid = inProgress();
    const attempt = valid.attempts.fish!;
    expect(
      load({
        ...valid,
        ignored: true,
        attempts: {
          ...valid.attempts,
          fish: {
            ...attempt,
            ignored: true,
            queue: attempt.queue.map((entry) => ({
              ...entry,
              ignored: true,
              equation: { ...entry.equation, ignored: true },
            })),
          },
        },
      }),
    ).toEqual({ progress: valid, notice: null });
  });

  it('salvages every independent valid portion when several fields are corrupt', () => {
    const valid = inProgress();
    expect(
      load({
        version: 99,
        language: 'cs',
        attempts: { fish: null, cat: valid.attempts.cat, unknown: {} },
        completed: ['owl', null, 'missing', 'owl'],
      }),
    ).toEqual({
      progress: { ...valid, attempts: { cat: valid.attempts.cat! } },
      notice: 'recovered',
    });
  });
});

describe('explicit persistence failures', () => {
  it.each([
    'SecurityError',
    'QuotaExceededError',
    'NS_ERROR_DOM_QUOTA_REACHED',
  ])('reports expected read/write DOMException %s', (name) => {
    const error = new DOMException('Storage denied', name);
    expect(
      loadProgress(
        {
          getItem: () => {
            throw error;
          },
        },
        'cs',
      ),
    ).toEqual({
      progress: emptyProgress('cs'),
      notice: 'unavailable',
    });
    expect(
      saveProgress(
        {
          setItem: () => {
            throw error;
          },
        },
        inProgress(),
      ),
    ).toEqual({ ok: false, reason: 'unavailable' });
  });

  it.each([
    new Error('Unexpected bug'),
    new TypeError('Wrong implementation'),
    new SyntaxError('Not a parsing failure'),
    new DOMException('Unexpected DOM error', 'NotFoundError'),
    { name: 'SecurityError' },
    'unexpected string',
  ])('propagates unexpected read/write exceptions %j', (error) => {
    expect(() =>
      loadProgress(
        {
          getItem: () => {
            throw error;
          },
        },
        'en',
      ),
    ).toThrow();
    expect(() =>
      saveProgress(
        {
          setItem: () => {
            throw error;
          },
        },
        emptyProgress('en'),
      ),
    ).toThrow();
  });

  it('never claims success or changes stored data when a write is rejected', () => {
    const storage = memoryStorage('previous value');
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(saveProgress(storage, inProgress())).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(storage.values.get(STORAGE_KEY)).toBe('previous value');
    expect(storage.values.get('unrelated-app')).toBe('leave me alone');
  });

  it('rejects malformed in-memory progress rather than silently saving a repaired version', () => {
    const storage = memoryStorage();
    const invalid: Progress = { ...inProgress(), completed: ['missing'] };
    expect(() => saveProgress(storage, invalid)).toThrow(TypeError);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not mutate progress even if the save fails', () => {
    const progress = inProgress();
    const before = JSON.stringify(progress);
    saveProgress(
      {
        setItem: () => {
          throw new DOMException('Full', 'QuotaExceededError');
        },
      },
      progress,
    );
    expect(JSON.stringify(progress)).toBe(before);
  });
});

describe('isolated resets', () => {
  it('resets one attempt without removing its badge, locale, or other attempts', () => {
    const progress = inProgress();
    progress.completed.push('fish');
    const before = JSON.stringify(progress);
    const result = resetPuzzle(progress, 'fish');
    expect(result).toEqual({
      ...progress,
      attempts: { cat: progress.attempts.cat! },
    });
    expect(result).not.toBe(progress);
    expect(result.attempts).not.toBe(progress.attempts);
    expect(JSON.stringify(progress)).toBe(before);
    expect(resetPuzzle(progress, 'missing')).toEqual(progress);
    expect(resetPuzzle(progress, '__proto__')).toEqual(progress);
  });

  it('allows replay to replace a completed attempt while retaining the badge', () => {
    const progress = inProgress();
    const attempt: Attempt = createAttempt(fish, () => 0);
    attempt.solved = attempt.queue.map(({ pixelId }) => pixelId);
    progress.attempts.fish = attempt;
    progress.completed.push('fish');
    const replay = resetPuzzle(progress, 'fish');
    replay.attempts.fish = createAttempt(fish, () => 0.9);
    const storage = memoryStorage();
    saveProgress(storage, replay);
    expect(loadProgress(storage, 'en').progress).toEqual(replay);
    expect(replay.attempts.fish.solved).toEqual([]);
    expect(replay.completed).toContain('fish');
  });

  it('resets all own attempts/badges while preserving language and unrelated storage', () => {
    const progress = inProgress();
    const before = JSON.stringify(progress);
    const storage = memoryStorage();
    const reset = resetAllProgress(progress);
    expect(reset).toEqual(emptyProgress('cs'));
    expect(JSON.stringify(progress)).toBe(before);
    expect(saveProgress(storage, reset)).toEqual({ ok: true });
    expect(storage.values.get('unrelated-app')).toBe('leave me alone');
    expect(loadProgress(storage, 'en').progress).toEqual(reset);
  });
});
