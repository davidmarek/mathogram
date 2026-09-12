import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import { enumerateEquations, isValidEquation } from './arithmetic';
import {
  createAttempt,
  isComplete,
  submitAnswer,
  validateAttempt,
} from './game';
import type { Attempt } from './game';
import type { Puzzle } from './puzzle';

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

  it('favors nonzero operands and alternating operations whenever possible', () => {
    for (const puzzle of puzzles) {
      const attempt = createAttempt(puzzle, seededRandom(12));
      let previousOp: '+' | '-' | undefined;
      const candidates = enumerateEquations(puzzle.intro);
      for (const { equation } of attempt.queue) {
        let available = candidates.filter(({ c }) => c === equation.c);
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
      }
    }
  });

  it('avoids repeating expressions until same-operation alternatives are used', () => {
    const puzzle: Puzzle = {
      ...fish,
      width: 10,
      height: 20,
      pixels: Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}:5`,
        row: i + 1,
        col: 5,
        color: 'F',
      })),
    };
    const attempt = createAttempt(puzzle, () => 0);
    const additions = attempt.queue.filter(
      ({ equation }) => equation.op === '+',
    );
    const subtractions = attempt.queue.filter(
      ({ equation }) => equation.op === '-',
    );
    expect(
      new Set(additions.slice(0, 4).map(({ equation }) => equation.a)).size,
    ).toBe(4);
    expect(
      new Set(subtractions.slice(0, 5).map(({ equation }) => equation.a)).size,
    ).toBe(5);
  });

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

describe('saved attempt validation', () => {
  const valid = createAttempt(fish, () => 0);

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
