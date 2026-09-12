import { describe, expect, it } from 'vitest';
import { enumerateEquations } from '../domain/arithmetic';
import { validatePuzzle } from '../domain/puzzle';
import { puzzles } from './animals';

describe('original picture content', () => {
  it('keeps existing pictures and adds three challenging pictures', () => {
    expect(puzzles.map(({ name }) => name)).toEqual([
      'fish',
      'butterfly',
      'bee',
      'snail',
      'turtle',
      'cat',
      'duck',
      'rabbit',
      'fox',
      'dog',
      'owl',
      'watermelon',
      'fries',
      'cheddar-fingers',
      'hamburger',
      'sushi',
      'cheetah',
      'german-shepherd',
      'ferrari',
    ]);
    expect(new Set(puzzles.map(({ id }) => id)).size).toBe(19);
    expect(puzzles.slice(0, 16).map(({ intro }) => intro)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
  it('offers five food puzzle lengths across both arithmetic levels', () => {
    expect(
      puzzles.slice(11, 16).map(({ id, version, pixels, intro }) => ({
        id,
        version,
        length: pixels.length,
        intro,
      })),
    ).toEqual([
      { id: 'watermelon', version: 1, length: 32, intro: true },
      { id: 'fries', version: 1, length: 39, intro: true },
      { id: 'cheddar-fingers', version: 1, length: 48, intro: false },
      { id: 'hamburger', version: 1, length: 57, intro: false },
      { id: 'sushi', version: 1, length: 60, intro: false },
    ]);
  });
  it('puts the new detailed pictures above the existing difficulty range', () => {
    expect(
      puzzles.slice(0, 16).every(({ threeNumbers }) => !threeNumbers),
    ).toBe(true);
    expect(
      puzzles.slice(16).map(({ id, version, pixels, intro, threeNumbers }) => ({
        id,
        version,
        length: pixels.length,
        intro,
        threeNumbers,
      })),
    ).toEqual([
      {
        id: 'cheetah',
        version: 1,
        length: 106,
        intro: false,
        threeNumbers: true,
      },
      {
        id: 'german-shepherd',
        version: 1,
        length: 133,
        intro: false,
        threeNumbers: true,
      },
      {
        id: 'ferrari',
        version: 1,
        length: 119,
        intro: false,
        threeNumbers: true,
      },
    ]);
  });
  it('bridges the difficulty gaps without changing existing puzzle lengths', () => {
    const originalLengths = {
      fish: 28,
      butterfly: 32,
      cat: 48,
      rabbit: 54,
      owl: 61,
      dog: 63,
    };
    expect(
      Object.fromEntries(
        puzzles
          .filter(({ name }) => Object.hasOwn(originalLengths, name))
          .map(({ name, pixels }) => [name, pixels.length]),
      ),
    ).toEqual(originalLengths);
    const lengths = puzzles
      .filter(({ threeNumbers }) => !threeNumbers)
      .map(({ pixels }) => pixels.length)
      .sort((a, b) => a - b);
    for (let index = 1; index < lengths.length; index++) {
      expect(lengths[index]! - lengths[index - 1]!).toBeLessThanOrEqual(4);
    }
  });

  it.each(puzzles)(
    '$name is valid, playable, and an appropriate length',
    (puzzle) => {
      expect(validatePuzzle(puzzle)).toBe(true);
      expect(puzzle.pixels.length).toBeGreaterThanOrEqual(
        puzzle.threeNumbers ? 100 : puzzle.intro ? 20 : 40,
      );
      expect(puzzle.pixels.length).toBeLessThanOrEqual(
        puzzle.threeNumbers ? 150 : puzzle.intro ? 40 : 65,
      );
      expect(puzzle.width).toBeLessThanOrEqual(20);
      expect(puzzle.height).toBeLessThanOrEqual(20);
      const answers = new Set(
        enumerateEquations(puzzle.intro, puzzle.threeNumbers).map(({ c }) => c),
      );
      for (const pixel of puzzle.pixels) {
        expect(answers.has(pixel.col)).toBe(true);
        expect(pixel.id).toBe(`${pixel.row}:${pixel.col}`);
        expect(pixel.row).toBeGreaterThanOrEqual(1);
        expect(pixel.row).toBeLessThanOrEqual(puzzle.height);
        expect(pixel.col).toBeGreaterThanOrEqual(1);
        expect(pixel.col).toBeLessThanOrEqual(puzzle.width);
        expect(Object.hasOwn(puzzle.palette, pixel.color)).toBe(true);
      }
      expect(puzzle.pixels.some(({ col }) => col > 10)).toBe(!puzzle.intro);
      expect(new Set(puzzle.pixels.map(({ id }) => id)).size).toBe(
        puzzle.pixels.length,
      );
      expect(puzzle.pixels.length).toBeLessThan(puzzle.width * puzzle.height);
    },
  );
});
