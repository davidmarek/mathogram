import type { Puzzle } from './puzzle';

export const difficulties = ['beginner', 'standard', 'advanced'] as const;
export const sizes = ['small', 'medium', 'large', 'extraLarge'] as const;

export type Difficulty = (typeof difficulties)[number];
export type PuzzleSize = (typeof sizes)[number];

export function getDifficulty(puzzle: Puzzle): Difficulty {
  return puzzle.threeNumbers
    ? 'advanced'
    : puzzle.intro
      ? 'beginner'
      : 'standard';
}

export function getSize(puzzle: Pick<Puzzle, 'pixels'>): PuzzleSize {
  const count = puzzle.pixels.length;
  if (count <= 40) return 'small';
  if (count <= 70) return 'medium';
  if (count <= 100) return 'large';
  return 'extraLarge';
}
