import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import { enumerateEquations, isValidEquation } from './arithmetic';
import {
  createAttempt,
  currentExercise,
  deferExercise,
  isComplete,
  submitAnswer,
  validateAttempt,
} from './game';
import type { Attempt } from './game';
import type { Equation, Puzzle } from './puzzle';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const fish = puzzles[0]!;

describe('attempt generation', () => {
  it.each(puzzles)(
    'generates exact stable queues for $name across seeds',
    (puzzle) => {
      const before = JSON.stringify(puzzle);
      for (let seed = 0; seed < 30; seed += 1) {
        const attempt = createAttempt(puzzle, seededRandom(seed));
        expect(attempt).toEqual(createAttempt(puzzle, seededRandom(seed)));
        expect(validateAttempt(attempt, puzzle)).toBe(true);
        expect(attempt.puzzleId).toBe(puzzle.id);
        expect(attempt.puzzleVersion).toBe(puzzle.version);
        expect(attempt.solved).toEqual([]);
        expect(attempt.queue.map(({ pixelId }) => pixelId).sort()).toEqual(
          puzzle.pixels.map(({ id }) => id).sort(),
        );
        for (const { pixelId, equation } of attempt.queue) {
          expect(isValidEquation(equation, puzzle.intro)).toBe(true);
          expect(equation.c).toBe(
            puzzle.pixels.find(({ id }) => id === pixelId)!.col,
          );
        }
      }
      expect(JSON.stringify(puzzle)).toBe(before);
    },
  );

  it('uses supplied randomness for both ordering and equation selection', () => {
    expect(createAttempt(fish, seededRandom(1))).not.toEqual(
      createAttempt(fish, seededRandom(2)),
    );
    expect(validateAttempt(createAttempt(fish), fish)).toBe(true);
  });

  it.each([-1, 1, 2, NaN, Infinity])(
    'rejects invalid RNG output %s',
    (value) => {
      expect(() => createAttempt(fish, () => value)).toThrow(RangeError);
    },
  );

  it.each([0, 0.9999999999999999])('accepts RNG boundary %s', (value) => {
    expect(
      validateAttempt(
        createAttempt(fish, () => value),
        fish,
      ),
    ).toBe(true);
  });

  it('rejects invalid content rather than constructing an empty queue', () => {
    expect(() => createAttempt({ ...fish, pixels: [] })).toThrow(TypeError);
  });

  it.each(puzzles)(
    'selects a different exercise for every pixel in $name',
    (puzzle) => {
      for (let seed = 0; seed < 30; seed += 1) {
        const attempt = createAttempt(puzzle, seededRandom(seed));
        expect(
          new Set(attempt.queue.map(({ equation }) => JSON.stringify(equation)))
            .size,
        ).toBe(puzzle.pixels.length);
      }
    },
  );

  it.each(puzzles)(
    'randomizes the exercise subset for $name, not just its order',
    (puzzle) => {
      const selected = (seed: number) =>
        createAttempt(puzzle, seededRandom(seed))
          .queue.map(({ equation }) => JSON.stringify(equation))
          .sort();
      expect(selected(1)).not.toEqual(selected(2));
    },
  );

  it('favors nonzero operands and alternating operations among least-used exercises', () => {
    for (const puzzle of puzzles) {
      const attempt = createAttempt(puzzle, seededRandom(12));
      let previousOp: '+' | '-' | undefined;
      const candidates = enumerateEquations(puzzle.intro);
      const uses = new Map<string, number>();
      for (const { equation } of attempt.queue) {
        let available = candidates.filter(({ c }) => c === equation.c);
        const leastUsed = Math.min(
          ...available.map(
            (candidate) => uses.get(JSON.stringify(candidate)) ?? 0,
          ),
        );
        expect(uses.get(JSON.stringify(equation)) ?? 0).toBe(leastUsed);
        available = available.filter(
          (candidate) =>
            (uses.get(JSON.stringify(candidate)) ?? 0) === leastUsed,
        );
        const nonzero = available.filter(({ a, b }) => a > 0 && b > 0);
        if (nonzero.length > 0) {
          expect(equation.a).toBeGreaterThan(0);
          expect(equation.b).toBeGreaterThan(0);
          available = nonzero;
        }
        if (available.some(({ op }) => op !== previousOp)) {
          expect(equation.op).not.toBe(previousOp);
        }
        previousOp = equation.op;
        uses.set(JSON.stringify(equation), leastUsed + 1);
      }
    }
  });

  it.each([true, false])(
    'uses the entire result pool before repeating, including zero operands (intro=%s)',
    (intro) => {
      for (let col = 1; col <= (intro ? 10 : 20); col += 1) {
        const puzzle: Puzzle = {
          ...fish,
          intro,
          width: intro ? 10 : 20,
          height: 20,
          pixels: Array.from({ length: 20 }, (_, i) => ({
            id: `${i + 1}:${col}`,
            row: i + 1,
            col,
            color: 'F',
          })),
        };
        const pool = enumerateEquations(intro).filter(({ c }) => c === col);
        for (const random of [
          () => 0,
          () => 0.9999999999999999,
          seededRandom(12),
        ]) {
          const attempt = createAttempt(puzzle, random);
          expect(validateAttempt(attempt, puzzle)).toBe(true);
          const used = new Set<string>();
          for (const { equation } of attempt.queue) {
            if (used.size === pool.length) used.clear();
            const key = JSON.stringify(equation);
            expect(used.has(key)).toBe(false);
            used.add(key);
          }
        }
      }
    },
  );

  it('supports every result column and favors nonzero addition at column 20', () => {
    const puzzle: Puzzle = {
      ...fish,
      width: 20,
      height: 1,
      intro: false,
      pixels: Array.from({ length: 20 }, (_, i) => ({
        id: `1:${i + 1}`,
        row: 1,
        col: i + 1,
        color: 'F',
      })),
    };
    const attempt = createAttempt(puzzle, seededRandom(123));
    expect(validateAttempt(attempt, puzzle)).toBe(true);
    expect(
      attempt.queue.find(({ equation }) => equation.c === 20)?.equation,
    ).toMatchObject({ op: '+', c: 20 });
    expect(
      attempt.queue.find(({ equation }) => equation.c === 20)?.equation.b,
    ).toBeGreaterThan(0);
  });
});

describe('answer submission', () => {
  it.each([
    '',
    ' ',
    ' 4',
    '4 ',
    '-1',
    '+4',
    '4.0',
    '1e1',
    '0xA',
    'NaN',
    '123',
    '４',
    '4\n',
  ])('keeps the same instance for invalid input %j', (answer) => {
    const attempt = createAttempt(fish, () => 0);
    expect(submitAnswer(attempt, answer, attempt.queue[0]!.pixelId)).toBe(
      attempt,
    );
  });

  it('keeps wrong, out-of-range, and stale submissions unchanged', () => {
    const attempt = createAttempt(fish, () => 0);
    const current = attempt.queue[0]!;
    for (const answer of ['0', '21', '99', String(current.equation.c + 1)]) {
      expect(submitAnswer(attempt, answer, current.pixelId)).toBe(attempt);
    }
    expect(submitAnswer(attempt, String(current.equation.c), 'stale')).toBe(
      attempt,
    );
  });

  it('normalizes at most two ASCII digits, including leading zero', () => {
    const attempt = createAttempt(fish, () => 0);
    const current = attempt.queue[0]!;
    const next = submitAnswer(
      attempt,
      String(current.equation.c).padStart(2, '0'),
      current.pixelId,
    );
    expect(next.solved).toEqual([current.pixelId]);
  });

  it.each(puzzles)(
    'solves $name exactly once per pixel without mutation',
    (puzzle) => {
      let attempt = createAttempt(puzzle, seededRandom(100));
      const queue = attempt.queue;
      expect(isComplete(attempt)).toBe(false);
      for (let index = 0; index < queue.length; index += 1) {
        const old = attempt;
        const current = queue[index]!;
        Object.freeze(old.solved);
        Object.freeze(old);
        attempt = submitAnswer(
          old,
          String(current.equation.c),
          current.pixelId,
        );
        expect(attempt).not.toBe(old);
        expect(attempt.queue).toBe(queue);
        expect(old.solved).toHaveLength(index);
        expect(attempt.solved).toEqual(
          queue.slice(0, index + 1).map(({ pixelId }) => pixelId),
        );
        expect(validateAttempt(attempt, puzzle)).toBe(true);
        expect(isComplete(attempt)).toBe(index === queue.length - 1);
        expect(
          submitAnswer(attempt, String(current.equation.c), current.pixelId),
        ).toBe(attempt);
      }
      expect(submitAnswer(attempt, '1', 'complete')).toBe(attempt);
    },
  );

  it('does not skip the next pixel when its result happens to be identical', () => {
    const attempt: Attempt = {
      puzzleId: 'fish',
      puzzleVersion: 1,
      queue: [
        { pixelId: '1:4', equation: { a: 2, op: '+', b: 2, c: 4 } },
        { pixelId: '2:4', equation: { a: 5, op: '-', b: 1, c: 4 } },
      ],
      solved: [],
    };
    const next = submitAnswer(attempt, '4', '1:4');
    expect(submitAnswer(next, '4', '1:4')).toBe(next);
    expect(next.solved).toEqual(['1:4']);
  });

  it('does not consider an empty or over-solved queue complete', () => {
    const attempt = createAttempt(fish, () => 0);
    expect(isComplete({ ...attempt, queue: [] })).toBe(false);
    expect(
      isComplete({
        ...attempt,
        solved: [...attempt.queue.map(({ pixelId }) => pixelId), 'extra'],
      }),
    ).toBe(false);
  });
});

describe('exercise deferral and practice review', () => {
  function withRemaining(count: number): Attempt {
    const attempt = createAttempt(fish, seededRandom(42));
    return {
      ...attempt,
      solved: attempt.queue
        .slice(0, attempt.queue.length - count)
        .map(({ pixelId }) => pixelId),
    };
  }

  it.each([0, 1, 5])(
    'rotates only unsolved exercises after a prefix of %i without mutation',
    (solvedCount) => {
      const attempt = createAttempt(fish, seededRandom(7));
      attempt.solved = attempt.queue
        .slice(0, solvedCount)
        .map(({ pixelId }) => pixelId);
      const before = JSON.stringify(attempt);
      const active = currentExercise(attempt)!;
      Object.freeze(attempt.queue);
      Object.freeze(attempt.solved);
      Object.freeze(attempt);
      const next = deferExercise(attempt, active.pixelId);
      expect(next).not.toBe(attempt);
      expect(next.solved).toBe(attempt.solved);
      expect(next.queue).toEqual([
        ...attempt.queue.slice(0, solvedCount),
        ...attempt.queue.slice(solvedCount + 1),
        active,
      ]);
      for (const entry of next.queue) {
        expect(entry).toBe(
          attempt.queue.find(({ pixelId }) => pixelId === entry.pixelId),
        );
      }
      expect(JSON.stringify(attempt)).toBe(before);
      expect(validateAttempt(next, fish)).toBe(true);
      expect(isComplete(next)).toBe(false);
    },
  );

  it('returns the exact original question and queue after one rotation round', () => {
    const original = withRemaining(4);
    let attempt = original;
    for (let index = 0; index < 4; index += 1) {
      const active = currentExercise(attempt)!;
      expect(active).toBe(original.queue[original.solved.length + index]);
      attempt = deferExercise(attempt, active.pixelId);
      expect(validateAttempt(attempt, fish)).toBe(true);
    }
    expect(attempt).toEqual(original);
    expect(currentExercise(attempt)).toBe(currentExercise(original));
    const active = currentExercise(attempt)!;
    expect(
      submitAnswer(attempt, String(active.equation.c), active.pixelId).solved,
    ).toEqual([...original.solved, active.pixelId]);
  });

  it('ignores stale deferrals and submissions, including a deferred question', () => {
    const attempt = withRemaining(3);
    const active = currentExercise(attempt)!;
    expect(deferExercise(attempt, 'stale')).toBe(attempt);
    const next = deferExercise(attempt, active.pixelId);
    expect(deferExercise(next, active.pixelId)).toBe(next);
    expect(submitAnswer(next, String(active.equation.c), active.pixelId)).toBe(
      next,
    );
  });

  it('reviews the first solved pixel at the last target without filling another pixel', () => {
    const attempt = withRemaining(1);
    const remaining = currentExercise(attempt)!;
    const review = deferExercise(attempt, remaining.pixelId);
    expect(review.reviewPixelId).toBe(attempt.solved[0]);
    expect(currentExercise(review)).toBe(attempt.queue[0]);
    expect(review.queue).toBe(attempt.queue);
    expect(review.solved).toBe(attempt.solved);
    expect(validateAttempt(review, fish)).toBe(true);
    expect(isComplete(review)).toBe(false);
    expect(deferExercise(review, remaining.pixelId)).toBe(review);
    expect(
      submitAnswer(review, String(remaining.equation.c), remaining.pixelId),
    ).toBe(review);
    const active = currentExercise(review)!;
    for (const answer of ['', 'invalid', '0', '99']) {
      expect(submitAnswer(review, answer, active.pixelId)).toBe(review);
    }
    const before = JSON.stringify(review);
    Object.freeze(review);
    const next = submitAnswer(
      review,
      String(active.equation.c),
      active.pixelId,
    );
    expect(JSON.stringify(review)).toBe(before);
    expect(next).toEqual(attempt);
    expect(Object.hasOwn(next, 'reviewPixelId')).toBe(false);
    expect(next.solved).toBe(attempt.solved);
    expect(next.queue).toBe(attempt.queue);
    expect(currentExercise(next)).toBe(remaining);
    expect(isComplete(next)).toBe(false);
    expect(validateAttempt(next, fish)).toBe(true);
    expect(submitAnswer(next, String(active.equation.c), active.pixelId)).toBe(
      next,
    );
    const complete = submitAnswer(
      next,
      String(remaining.equation.c),
      remaining.pixelId,
    );
    expect(isComplete(complete)).toBe(true);
    expect(validateAttempt(complete, fish)).toBe(true);
    expect(currentExercise(complete)).toBeUndefined();
    expect(deferExercise(complete, remaining.pixelId)).toBe(complete);
  });

  it('advances wrong reviews through the solved prefix and wraps', () => {
    const original = withRemaining(1);
    let attempt = deferExercise(original, currentExercise(original)!.pixelId);
    for (let index = 0; index < original.solved.length; index += 1) {
      const active = currentExercise(attempt)!;
      expect(active.pixelId).toBe(original.solved[index]);
      const next = deferExercise(attempt, active.pixelId);
      expect(currentExercise(next)?.pixelId).not.toBe(active.pixelId);
      expect(deferExercise(next, active.pixelId)).toBe(next);
      expect(next.queue).toBe(original.queue);
      expect(next.solved).toBe(original.solved);
      expect(validateAttempt(next, fish)).toBe(true);
      attempt = next;
    }
    expect(attempt.reviewPixelId).toBe(original.solved[0]);
  });

  it('alternates a sole solved review with the remaining target', () => {
    const puzzle = { ...fish, pixels: fish.pixels.slice(0, 2) };
    const original = createAttempt(puzzle, () => 0);
    original.solved = [original.queue[0]!.pixelId];
    const remaining = currentExercise(original)!;
    const review = deferExercise(original, remaining.pixelId);
    expect(currentExercise(review)).toBe(original.queue[0]);
    const next = deferExercise(review, currentExercise(review)!.pixelId);
    expect(next).toEqual(original);
    expect(Object.hasOwn(next, 'reviewPixelId')).toBe(false);
    expect(validateAttempt(next, puzzle)).toBe(true);
    expect(deferExercise(next, remaining.pixelId)).toEqual(review);
  });

  it('leaves a lone unsolved target or empty queue unchanged when deferred', () => {
    const puzzle = { ...fish, pixels: fish.pixels.slice(0, 1) };
    const attempt = createAttempt(puzzle, () => 0);
    const active = currentExercise(attempt)!;
    expect(deferExercise(attempt, active.pixelId)).toBe(attempt);
    expect(validateAttempt(attempt, puzzle)).toBe(true);
    const empty = { ...attempt, queue: [] };
    expect(currentExercise(empty)).toBeUndefined();
    expect(deferExercise(empty, active.pixelId)).toBe(empty);
  });
});

describe('deferring repeated displayed equations', () => {
  const repeated: Equation = { a: 1, op: '+', b: 3, c: 4 };
  const swapped: Equation = { a: 3, op: '+', b: 1, c: 4 };
  const subtraction: Equation = { a: 5, op: '-', b: 1, c: 4 };

  function fixture(equations: Equation[], solvedCount: number) {
    const puzzle: Puzzle = {
      ...fish,
      height: equations.length,
      pixels: equations.map(({ c }, index) => ({
        id: `${index + 1}:${c}`,
        row: index + 1,
        col: c,
        color: 'F',
      })),
    };
    const attempt: Attempt = {
      puzzleId: puzzle.id,
      puzzleVersion: puzzle.version,
      queue: equations.map((equation, index) => ({
        pixelId: puzzle.pixels[index]!.id,
        equation: { ...equation },
      })),
      solved: puzzle.pixels.slice(0, solvedCount).map(({ id }) => id),
    };
    expect(validateAttempt(attempt, puzzle)).toBe(true);
    return { attempt, puzzle };
  }

  it.each([swapped, subtraction])(
    'promotes the first different expression $a$op$b without changing equations or other order',
    (different) => {
      const { attempt, puzzle } = fixture(
        [
          subtraction,
          repeated,
          repeated,
          repeated,
          different,
          subtraction,
          repeated,
        ],
        1,
      );
      const before = JSON.stringify(attempt);
      const active = currentExercise(attempt)!;
      Object.freeze(attempt);
      Object.freeze(attempt.queue);
      Object.freeze(attempt.solved);
      const next = deferExercise(attempt, active.pixelId);
      expect(next.queue).toEqual(
        [0, 4, 2, 3, 5, 6, 1].map((index) => attempt.queue[index]),
      );
      expect(next.solved).toBe(attempt.solved);
      expect(next.queue.at(-1)).toBe(active);
      for (const entry of next.queue) {
        expect(entry).toBe(
          attempt.queue.find(({ pixelId }) => pixelId === entry.pixelId),
        );
      }
      expect(JSON.stringify(attempt)).toBe(before);
      expect(validateAttempt(next, puzzle)).toBe(true);
      expect(deferExercise(next, active.pixelId)).toBe(next);
      expect(submitAnswer(next, '4', active.pixelId)).toBe(next);
    },
  );

  it('falls back to normal rotation when all remaining expressions match', () => {
    const { attempt, puzzle } = fixture(
      [subtraction, repeated, repeated, repeated],
      1,
    );
    let next = attempt;
    for (const index of [1, 2, 3]) {
      expect(currentExercise(next)).toBe(attempt.queue[index]);
      next = deferExercise(next, currentExercise(next)!.pixelId);
      expect(validateAttempt(next, puzzle)).toBe(true);
    }
    expect(next).toEqual(attempt);
  });

  it('returns to a deferred question after solving the other remaining targets', () => {
    const { attempt, puzzle } = fixture(
      [repeated, repeated, swapped, subtraction],
      0,
    );
    const missed = currentExercise(attempt)!;
    let next = deferExercise(attempt, missed.pixelId);
    for (const index of [2, 1, 3]) {
      const active = currentExercise(next)!;
      expect(active).toBe(attempt.queue[index]);
      next = submitAnswer(next, String(active.equation.c), active.pixelId);
      expect(validateAttempt(next, puzzle)).toBe(true);
    }
    expect(currentExercise(next)).toBe(missed);
    expect(next.solved).toHaveLength(3);
    expect(isComplete(next)).toBe(false);
  });

  it('starts review at the first solved expression different from the missed target', () => {
    const { attempt, puzzle } = fixture(
      [repeated, repeated, swapped, subtraction, repeated],
      4,
    );
    const next = deferExercise(attempt, currentExercise(attempt)!.pixelId);
    expect(currentExercise(next)).toBe(attempt.queue[2]);
    expect(next.queue).toBe(attempt.queue);
    expect(next.solved).toBe(attempt.solved);
    expect(validateAttempt(next, puzzle)).toBe(true);
  });

  it('skips matching review expressions in cyclic order, including across the wrap', () => {
    const { attempt, puzzle } = fixture(
      [repeated, swapped, repeated, repeated, repeated, subtraction],
      5,
    );
    let review: Attempt = { ...attempt, reviewPixelId: attempt.solved[2]! };
    for (const index of [1, 2, 1]) {
      const old = review;
      const active = currentExercise(old)!;
      review = deferExercise(old, active.pixelId);
      expect(currentExercise(review)).toBe(attempt.queue[index]);
      expect(review.queue).toBe(attempt.queue);
      expect(review.solved).toBe(attempt.solved);
      expect(validateAttempt(review, puzzle)).toBe(true);
      expect(deferExercise(review, active.pixelId)).toBe(review);
    }
  });

  it('retains first/next solved review fallback when no solved expression differs', () => {
    const { attempt, puzzle } = fixture(
      [repeated, repeated, repeated, repeated],
      3,
    );
    let next = deferExercise(attempt, currentExercise(attempt)!.pixelId);
    for (const index of [0, 1, 2, 0]) {
      expect(currentExercise(next)).toBe(attempt.queue[index]);
      next = deferExercise(next, currentExercise(next)!.pixelId);
      expect(validateAttempt(next, puzzle)).toBe(true);
    }
    expect(next.queue).toBe(attempt.queue);
    expect(next.solved).toBe(attempt.solved);
  });
});

describe('saved attempt validation', () => {
  const valid = createAttempt(fish, () => 0);
  const lastTarget = {
    ...valid,
    solved: valid.queue.slice(0, -1).map(({ pixelId }) => pixelId),
  };

  it.each(lastTarget.solved)(
    'accepts solved review ID %s at the last target',
    (reviewPixelId) => {
      expect(validateAttempt({ ...lastTarget, reviewPixelId }, fish)).toBe(
        true,
      );
    },
  );

  it.each([
    undefined,
    null,
    '',
    'missing',
    0,
    true,
    {},
    [],
    valid.queue.at(-1)!.pixelId,
  ])('rejects a present invalid review ID %j', (reviewPixelId) => {
    expect(validateAttempt({ ...lastTarget, reviewPixelId }, fish)).toBe(false);
  });

  it.each([0, 1, valid.queue.length - 2, valid.queue.length])(
    'rejects review when %i pixels are solved instead of all but one',
    (count) => {
      expect(
        validateAttempt(
          {
            ...valid,
            solved: valid.queue.slice(0, count).map(({ pixelId }) => pixelId),
            reviewPixelId: valid.queue[0]!.pixelId,
          },
          fish,
        ),
      ).toBe(false);
    },
  );

  it.each([
    null,
    {},
    { ...valid, puzzleId: 'missing' },
    { ...valid, puzzleVersion: 2 },
    { ...valid, queue: null },
    { ...valid, queue: [] },
    { ...valid, queue: valid.queue.slice(1) },
    { ...valid, queue: [...valid.queue, valid.queue[0]] },
    { ...valid, queue: [valid.queue[1], ...valid.queue.slice(1)] },
    { ...valid, queue: [null, ...valid.queue.slice(1)] },
    {
      ...valid,
      queue: [{ ...valid.queue[0], pixelId: '0:0' }, ...valid.queue.slice(1)],
    },
    {
      ...valid,
      queue: [
        { ...valid.queue[0], equation: { a: 1, op: '+', b: 1, c: 2 } },
        ...valid.queue.slice(1),
      ],
    },
    {
      ...valid,
      queue: [{ ...valid.queue[0], equation: null }, ...valid.queue.slice(1)],
    },
    { ...valid, solved: null },
    { ...valid, solved: [valid.queue[1]!.pixelId] },
    { ...valid, solved: [valid.queue[0]!.pixelId, valid.queue[0]!.pixelId] },
    { ...valid, solved: ['missing'] },
    { ...valid, solved: Array(valid.queue.length + 1).fill('extra') },
    { ...valid, solved: Array(1) },
    { ...valid, queue: Array(valid.queue.length) },
  ])('rejects corrupt attempt %j', (value) => {
    expect(validateAttempt(value, fish)).toBe(false);
  });

  it('rejects a mathematically valid but non-introductory equation', () => {
    const queue = valid.queue.map((entry) => ({ ...entry }));
    const index = queue.findIndex(({ equation }) => equation.c === 4);
    queue[index] = {
      pixelId: queue[index]!.pixelId,
      equation: { a: 11, op: '-', b: 7, c: 4 },
    };
    expect(validateAttempt({ ...valid, queue }, fish)).toBe(false);
    const tenPuzzle: Puzzle = {
      ...fish,
      width: 10,
      pixels: [{ id: '1:10', row: 1, col: 10, color: 'F' }],
    };
    expect(
      validateAttempt(
        {
          puzzleId: fish.id,
          puzzleVersion: fish.version,
          queue: [
            { pixelId: '1:10', equation: { a: 15, op: '-', b: 5, c: 10 } },
          ],
          solved: [],
        },
        tenPuzzle,
      ),
    ).toBe(false);
  });

  it('rejects attempts against invalid content', () => {
    expect(validateAttempt(valid, { ...fish, palette: {} })).toBe(false);
  });
});
