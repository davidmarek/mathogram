import { describe, expect, it, vi } from 'vitest';
import { puzzles } from '../content/animals';
import {
  createAttempt,
  currentExercise,
  deferExercise,
  isComplete,
  submitAnswer,
} from '../domain/game';
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
const cat = puzzles.find(({ id }) => id === 'cat')!;

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
    showRowHints: true,
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
    expect(first.showRowHints).toBe(true);
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
    'preserves saved repeated exercises in $name without regenerating them',
    (puzzle) => {
      const attempt = createAttempt(puzzle, () => 0);
      for (const entry of attempt.queue) {
        entry.equation = {
          a: entry.equation.c,
          op: '+',
          b: 0,
          c: entry.equation.c,
          ...(puzzle.threeNumbers ? { op2: '+' as const, d: 0 } : {}),
        };
      }
      attempt.solved = [attempt.queue[0]!.pixelId];
      const original = {
        ...emptyProgress('en'),
        attempts: { [puzzle.id]: attempt },
      };
      const storage = memoryStorage();
      expect(saveProgress(storage, original)).toEqual({ ok: true });
      expect(loadProgress(storage, 'en')).toEqual({
        progress: original,
        notice: null,
      });
    },
  );

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

  it.each([true, false])('persists row hint preference %s', (showRowHints) => {
    const progress = { ...inProgress(), showRowHints };
    const storage = memoryStorage();
    saveProgress(storage, progress);
    expect(loadProgress(storage, 'en')).toEqual({ progress, notice: null });
  });

  it('migrates a preexisting v1 save without hints silently and preserves gameplay', () => {
    const progress = inProgress();
    const legacy = {
      version: progress.version,
      language: progress.language,
      attempts: progress.attempts,
      completed: progress.completed,
    };
    expect(load(legacy)).toEqual({ progress, notice: null });
  });

  it('resumes a legacy two-number queue without adding optional equation fields', () => {
    const progress = inProgress();
    expect(load(progress)).toEqual({ progress, notice: null });
    for (const attempt of Object.values(load(progress).progress.attempts)) {
      for (const { equation } of attempt.queue) {
        expect(Object.keys(equation).sort()).toEqual(['a', 'b', 'c', 'op']);
      }
      const current = currentExercise(attempt)!;
      expect(
        submitAnswer(attempt, String(current.equation.c), current.pixelId)
          .solved,
      ).toHaveLength(attempt.solved.length + 1);
    }
  });

  it.each(['cheetah', 'german-shepherd', 'ferrari'])(
    'preserves three-number equations, deferral, and review through saves for %s',
    (id) => {
      const puzzle = puzzles.find((candidate) => candidate.id === id)!;
      expect(puzzle.threeNumbers).toBe(true);
      let attempt = createAttempt(puzzle, () => 0.4);
      const originalQueue = structuredClone(attempt.queue);
      attempt = deferExercise(attempt, currentExercise(attempt)!.pixelId);
      const progress = {
        ...inProgress(),
        attempts: { ...inProgress().attempts, [id]: attempt },
      };
      const storage = memoryStorage();
      expect(saveProgress(storage, progress)).toEqual({ ok: true });
      expect(loadProgress(storage, 'en')).toEqual({ progress, notice: null });
      attempt = loadProgress(storage, 'en').progress.attempts[id]!;
      expect(attempt.queue).not.toEqual(originalQueue);
      expect(
        attempt.queue.every(
          ({ equation }) =>
            equation.op2 !== undefined && equation.d !== undefined,
        ),
      ).toBe(true);
      const current = currentExercise(attempt)!;
      attempt = submitAnswer(
        attempt,
        String(current.equation.c),
        current.pixelId,
      );
      expect(attempt.solved).toEqual([current.pixelId]);
      attempt = {
        ...attempt,
        solved: attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId),
      };
      attempt = deferExercise(attempt, currentExercise(attempt)!.pixelId);
      expect(attempt.reviewPixelId).toBeDefined();
      progress.attempts[id] = attempt;
      saveProgress(storage, progress);
      const restored = loadProgress(storage, 'en');
      expect(restored).toEqual({ progress, notice: null });
      const review = currentExercise(restored.progress.attempts[id]!)!;
      const resumed = submitAnswer(
        restored.progress.attempts[id]!,
        String(review.equation.c),
        review.pixelId,
      );
      expect(resumed.solved).toEqual(attempt.solved);
      expect(resumed.reviewPixelId).toBeUndefined();
    },
  );

  it('restores 14 - 4 - 3 exactly while discarding unknown saved equation fields', () => {
    const puzzle = puzzles.find(({ id }) => id === 'cheetah')!;
    const attempt = createAttempt(puzzle, () => 0);
    const target = attempt.queue.find(({ equation }) => equation.c === 7)!;
    target.equation = { a: 14, op: '-', b: 4, c: 7, op2: '-', d: 3 };
    const progress = {
      ...emptyProgress('en'),
      attempts: { [puzzle.id]: attempt },
    };
    const untrusted = structuredClone(progress);
    for (const { equation } of untrusted.attempts[puzzle.id]!.queue) {
      Object.assign(equation, { ignored: true });
    }
    expect(load(untrusted)).toEqual({ progress, notice: null });
    const storage = memoryStorage();
    expect(saveProgress(storage, untrusted)).toEqual({ ok: true });
    expect(loadProgress(storage, 'en')).toEqual({ progress, notice: null });
  });

  it.each([
    { op2: '+' },
    { d: 0 },
    { op2: undefined, d: undefined },
    { op2: '*', d: 0 },
    { op2: '+', d: 11 },
  ])(
    'discards malformed new-mode extras independently on load and rejects save %j',
    (extra) => {
      const puzzle = puzzles.find(({ id }) => id === 'cheetah')!;
      const attempt = createAttempt(puzzle, () => 0);
      const first = attempt.queue[0]!;
      const { a, op, b, c } = first.equation;
      Object.assign(first, { equation: { a, op, b, c, ...extra } });
      const valid = inProgress();
      const progress = {
        ...valid,
        attempts: { ...valid.attempts, [puzzle.id]: attempt },
      };
      expect(load(progress)).toEqual({ progress: valid, notice: 'recovered' });
      const storage = memoryStorage();
      expect(() => saveProgress(storage, progress)).toThrow(TypeError);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('persists exact reordered queues and review state through resumption', () => {
    const progress = inProgress();
    const storage = memoryStorage();
    let attempt = progress.attempts.fish!;
    attempt = deferExercise(attempt, currentExercise(attempt)!.pixelId);
    const reorderedQueue = attempt.queue;
    progress.attempts.fish = attempt;
    saveProgress(storage, progress);
    expect(loadProgress(storage, 'en')).toEqual({ progress, notice: null });
    attempt = loadProgress(storage, 'en').progress.attempts.fish!;
    attempt = {
      ...attempt,
      solved: attempt.queue.slice(0, -1).map(({ pixelId }) => pixelId),
    };
    attempt = deferExercise(attempt, currentExercise(attempt)!.pixelId);
    attempt = deferExercise(attempt, currentExercise(attempt)!.pixelId);
    progress.attempts.fish = attempt;
    saveProgress(storage, progress);
    const restored = loadProgress(storage, 'en');
    expect(restored).toEqual({ progress, notice: null });
    const review = restored.progress.attempts.fish!;
    expect(review.queue).toEqual(reorderedQueue);
    expect(review.queue).not.toBe(attempt.queue);
    expect(review.queue[0]!.equation).not.toBe(attempt.queue[0]!.equation);
    expect(review.reviewPixelId).toBe(attempt.solved[1]);
    const active = currentExercise(review)!;
    progress.attempts.fish = submitAnswer(
      review,
      String(active.equation.c),
      active.pixelId,
    );
    expect(progress.attempts.fish.solved).toEqual(attempt.solved);
    expect(isComplete(progress.attempts.fish)).toBe(false);
    saveProgress(storage, progress);
    const resumed = loadProgress(storage, 'en');
    expect(resumed).toEqual({ progress, notice: null });
    expect(
      Object.hasOwn(resumed.progress.attempts.fish!, 'reviewPixelId'),
    ).toBe(false);
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
  it.each([null, 'false', 0, 1, [], {}])(
    'recovers invalid row hints %j without losing other state',
    (showRowHints) => {
      const valid = inProgress();
      expect(load({ ...valid, showRowHints })).toEqual({
        progress: valid,
        notice: 'recovered',
      });
    },
  );

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
    ['premature review', { ...baseAttempt, reviewPixelId: first.pixelId }],
    [
      'unsolved review',
      {
        ...baseAttempt,
        solved: baseAttempt.queue.slice(0, -1).map(({ pixelId }) => pixelId),
        reviewPixelId: baseAttempt.queue.at(-1)!.pixelId,
      },
    ],
    [
      'completed review',
      {
        ...baseAttempt,
        solved: baseAttempt.queue.map(({ pixelId }) => pixelId),
        reviewPixelId: first.pixelId,
      },
    ],
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
  it.each([undefined, null, 'false', 0, [], {}])(
    'rejects invalid in-memory row hints %j instead of repairing on save',
    (showRowHints) => {
      const progress = inProgress();
      Object.assign(progress, { showRowHints });
      const storage = memoryStorage('previous value');
      expect(() => saveProgress(storage, progress)).toThrow(TypeError);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.values.get(STORAGE_KEY)).toBe('previous value');
    },
  );

  it('rejects an explicitly undefined review field before serialization can omit it', () => {
    const progress = inProgress();
    progress.attempts.fish!.reviewPixelId = undefined;
    const storage = memoryStorage();
    expect(() => saveProgress(storage, progress)).toThrow(TypeError);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

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
  it('resets one attempt without removing its badge, preferences, or other attempts', () => {
    const progress = inProgress();
    progress.showRowHints = false;
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

  it.each([true, false])(
    'resets all attempts/badges while preserving language, hints %s, and unrelated storage',
    (showRowHints) => {
      const progress = { ...inProgress(), showRowHints };
      const before = JSON.stringify(progress);
      const storage = memoryStorage();
      const reset = resetAllProgress(progress);
      expect(reset).toEqual({ ...emptyProgress('cs'), showRowHints });
      expect(JSON.stringify(progress)).toBe(before);
      expect(saveProgress(storage, reset)).toEqual({ ok: true });
      expect(storage.values.get('unrelated-app')).toBe('leave me alone');
      expect(loadProgress(storage, 'en').progress).toEqual(reset);
    },
  );
});
