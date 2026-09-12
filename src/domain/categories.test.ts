import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import {
  difficulties,
  getDifficulty,
  getSize,
  sizes,
  type Difficulty,
  type PuzzleSize,
} from './categories';

describe('puzzle categories', () => {
  it('keeps difficulty and size orders stable', () => {
    expect(difficulties).toEqual(['beginner', 'standard', 'advanced']);
    expect(sizes).toEqual(['small', 'medium', 'large', 'extraLarge']);
  });

  it.each<[number, PuzzleSize]>([
    [1, 'small'],
    [40, 'small'],
    [41, 'medium'],
    [70, 'medium'],
    [71, 'large'],
    [100, 'large'],
    [101, 'extraLarge'],
    [400, 'extraLarge'],
  ])('classifies %i playable pixels as %s', (count, size) => {
    const pixels = Array.from({ length: count }, (_, index) => ({
      id: `${Math.floor(index / 20) + 1}:${(index % 20) + 1}`,
      row: Math.floor(index / 20) + 1,
      col: (index % 20) + 1,
      color: 'F',
    }));
    expect(getSize({ pixels })).toBe(size);
  });

  it.each<[boolean, boolean | undefined, Difficulty]>([
    [true, undefined, 'beginner'],
    [true, false, 'beginner'],
    [false, undefined, 'standard'],
    [false, false, 'standard'],
    [false, true, 'advanced'],
  ])(
    'derives difficulty only from intro=%s and threeNumbers=%s',
    (intro, threeNumbers, difficulty) => {
      for (const puzzle of puzzles) {
        const candidate = { ...puzzle, intro };
        delete candidate.threeNumbers;
        if (threeNumbers !== undefined) candidate.threeNumbers = threeNumbers;
        expect(getDifficulty(candidate)).toBe(difficulty);
        expect(getSize(candidate)).toBe(getSize(puzzle));
      }
    },
  );

  it('offers all 29 pictures in the expected difficulty/size matrix', () => {
    const matrix = difficulties.map((difficulty) =>
      sizes.map(
        (size) =>
          puzzles.filter(
            (puzzle) =>
              getDifficulty(puzzle) === difficulty && getSize(puzzle) === size,
          ).length,
      ),
    );
    expect(matrix).toEqual([
      [6, 1, 0, 0],
      [0, 10, 3, 0],
      [2, 2, 2, 3],
    ]);
    expect(
      matrix.map((row) => row.reduce((sum, count) => sum + count, 0)),
    ).toEqual([7, 13, 9]);
    expect(matrix.flat().reduce((sum, count) => sum + count, 0)).toBe(29);
    expect(puzzles).toHaveLength(29);
  });
});
