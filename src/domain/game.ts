import { enumerateEquations, isValidEquation } from './arithmetic';
import { isRecord, validatePuzzle } from './puzzle';
import type { Equation, Puzzle } from './puzzle';

export interface Attempt {
  puzzleId: string;
  puzzleVersion: number;
  queue: { pixelId: string; equation: Equation }[];
  solved: string[];
  reviewPixelId?: string;
}

function randomIndex(length: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a number in [0, 1).');
  }
  return Math.floor(value * length);
}

function equationKey({ a, op, b, op2, d }: Equation): string {
  return `${a}${op}${b}${op2 === undefined ? '' : `${op2}${d}`}`;
}

export function createAttempt(
  puzzle: Puzzle,
  random: () => number = Math.random,
): Attempt {
  if (!validatePuzzle(puzzle)) throw new TypeError('Invalid puzzle.');
  const pixels = [...puzzle.pixels];
  for (let index = pixels.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, random);
    const current = pixels[index]!;
    pixels[index] = pixels[other]!;
    pixels[other] = current;
  }
  const candidates = enumerateEquations(puzzle.intro, puzzle.threeNumbers);
  const uses = new Map<string, number>();
  let previousOp: Equation['op'] | undefined;
  const queue = pixels.map((pixel) => {
    let choices = candidates.filter(({ c }) => c === pixel.col);
    const leastUsed = Math.min(
      ...choices.map((equation) => uses.get(equationKey(equation)) ?? 0),
    );
    choices = choices.filter(
      (equation) => (uses.get(equationKey(equation)) ?? 0) === leastUsed,
    );
    const nonzero = choices.filter(
      ({ a, b, d }) => a !== 0 && b !== 0 && d !== 0,
    );
    if (nonzero.length > 0) choices = nonzero;
    const alternating = choices.filter(({ op }) => op !== previousOp);
    if (alternating.length > 0) choices = alternating;
    const equation = { ...choices[randomIndex(choices.length, random)]! };
    const key = equationKey(equation);
    uses.set(key, (uses.get(key) ?? 0) + 1);
    previousOp = equation.op;
    return { pixelId: pixel.id, equation };
  });
  return {
    puzzleId: puzzle.id,
    puzzleVersion: puzzle.version,
    queue,
    solved: [],
  };
}

export function currentExercise(
  attempt: Attempt,
): Attempt['queue'][number] | undefined {
  return attempt.reviewPixelId !== undefined
    ? attempt.queue.find(({ pixelId }) => pixelId === attempt.reviewPixelId)
    : attempt.queue[attempt.solved.length];
}

function preferDifferentExercise(
  exercises: Attempt['queue'],
  previous: Equation,
): Attempt['queue'][number] | undefined {
  const previousKey = equationKey(previous);
  return (
    exercises.find(({ equation }) => equationKey(equation) !== previousKey) ??
    exercises[0]
  );
}

export function deferExercise(
  attempt: Attempt,
  expectedPixelId: string,
): Attempt {
  const current = currentExercise(attempt);
  if (!current || isComplete(attempt) || current.pixelId !== expectedPixelId) {
    return attempt;
  }
  if (attempt.reviewPixelId !== undefined) {
    const next = { ...attempt };
    if (attempt.solved.length === 1) {
      delete next.reviewPixelId;
    } else {
      const index = attempt.solved.indexOf(attempt.reviewPixelId);
      const candidates = [
        ...attempt.queue.slice(index + 1, attempt.solved.length),
        ...attempt.queue.slice(0, index),
      ];
      next.reviewPixelId = preferDifferentExercise(
        candidates,
        current.equation,
      )!.pixelId;
    }
    return next;
  }
  if (attempt.queue.length - attempt.solved.length === 1) {
    return attempt.solved.length > 0
      ? {
          ...attempt,
          reviewPixelId: preferDifferentExercise(
            attempt.queue.slice(0, attempt.solved.length),
            current.equation,
          )!.pixelId,
        }
      : attempt;
  }
  const remaining = attempt.queue.slice(attempt.solved.length + 1);
  const next = preferDifferentExercise(remaining, current.equation)!;
  return {
    ...attempt,
    queue: [
      ...attempt.queue.slice(0, attempt.solved.length),
      next,
      ...remaining.filter((entry) => entry !== next),
      current,
    ],
  };
}

export function submitAnswer(
  attempt: Attempt,
  answer: string,
  expectedPixelId: string,
): Attempt {
  const current = currentExercise(attempt);
  if (
    !current ||
    isComplete(attempt) ||
    current.pixelId !== expectedPixelId ||
    !/^[0-9]{1,2}$/.test(answer) ||
    Number(answer) !== current.equation.c
  ) {
    return attempt;
  }
  if (attempt.reviewPixelId !== undefined) {
    const next = { ...attempt };
    delete next.reviewPixelId;
    return next;
  }
  return { ...attempt, solved: [...attempt.solved, current.pixelId] };
}

export function isComplete(attempt: Attempt): boolean {
  return (
    attempt.queue.length > 0 && attempt.solved.length === attempt.queue.length
  );
}

export function validateAttempt(
  value: unknown,
  puzzle: Puzzle,
): value is Attempt {
  if (
    !validatePuzzle(puzzle) ||
    !isRecord(value) ||
    value.puzzleId !== puzzle.id ||
    value.puzzleVersion !== puzzle.version ||
    !Array.isArray(value.queue) ||
    value.queue.length !== puzzle.pixels.length ||
    !Array.isArray(value.solved) ||
    value.solved.length > value.queue.length
  ) {
    return false;
  }
  const pixels = new Map(puzzle.pixels.map((pixel) => [pixel.id, pixel]));
  const seen = new Set<string>();
  for (const entry of value.queue) {
    if (
      !isRecord(entry) ||
      typeof entry.pixelId !== 'string' ||
      seen.has(entry.pixelId) ||
      !isValidEquation(entry.equation, puzzle.intro, puzzle.threeNumbers) ||
      entry.equation.c !== pixels.get(entry.pixelId)?.col
    ) {
      return false;
    }
    seen.add(entry.pixelId);
  }
  for (let index = 0; index < value.solved.length; index += 1) {
    const entry: unknown = value.queue[index];
    if (!isRecord(entry) || value.solved[index] !== entry.pixelId) return false;
  }
  if (
    'reviewPixelId' in value &&
    (typeof value.reviewPixelId !== 'string' ||
      value.queue.length - value.solved.length !== 1 ||
      !value.solved.includes(value.reviewPixelId))
  ) {
    return false;
  }
  return true;
}
