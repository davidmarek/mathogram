import { describe, expect, it } from 'vitest';
import { enumerateEquations, isValidEquation } from '../domain/arithmetic';
import { getDifficulty, getSize } from '../domain/categories';
import { createAttempt, validateAttempt } from '../domain/game';
import { validatePuzzle } from '../domain/puzzle';
import { puzzles } from './animals';

describe('original picture content', () => {
  it('keeps existing pictures and appends ten original pictures', () => {
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
      'rocket',
      'robot-face',
      'octopus',
      'dinosaur',
      'train',
      'lighthouse',
      'hot-air-balloon',
      'dragon',
      'space-shuttle',
      'sunflower',
    ]);
    expect(new Set(puzzles.map(({ id }) => id)).size).toBe(29);
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
  it('preserves the original three detailed pictures and their arithmetic', () => {
    expect(
      puzzles.slice(0, 16).every(({ threeNumbers }) => !threeNumbers),
    ).toBe(true);
    expect(
      puzzles
        .slice(16, 19)
        .map(({ id, version, pixels, intro, threeNumbers }) => ({
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
  it('preserves all original puzzle lengths and their introductory length gaps', () => {
    const originalLengths = {
      fish: 28,
      butterfly: 32,
      bee: 36,
      snail: 40,
      turtle: 44,
      cat: 48,
      duck: 50,
      rabbit: 54,
      fox: 58,
      dog: 63,
      owl: 61,
      watermelon: 32,
      fries: 39,
      'cheddar-fingers': 48,
      hamburger: 57,
      sushi: 60,
      cheetah: 106,
      'german-shepherd': 133,
      ferrari: 119,
    };
    expect(
      Object.fromEntries(
        puzzles.slice(0, 19).map(({ name, pixels }) => [name, pixels.length]),
      ),
    ).toEqual(originalLengths);
    const lengths = puzzles
      .slice(0, 16)
      .map(({ pixels }) => pixels.length)
      .sort((a, b) => a - b);
    for (let index = 1; index < lengths.length; index++) {
      expect(lengths[index]! - lengths[index - 1]!).toBeLessThanOrEqual(4);
    }
  });

  it('adds pictures in the requested independent arithmetic and size categories', () => {
    expect(
      puzzles.slice(19).map((puzzle) => ({
        id: puzzle.id,
        version: puzzle.version,
        length: puzzle.pixels.length,
        difficulty: getDifficulty(puzzle),
        size: getSize(puzzle),
      })),
    ).toEqual([
      {
        id: 'rocket',
        version: 1,
        length: 32,
        difficulty: 'advanced',
        size: 'small',
      },
      {
        id: 'robot-face',
        version: 1,
        length: 40,
        difficulty: 'advanced',
        size: 'small',
      },
      {
        id: 'octopus',
        version: 1,
        length: 50,
        difficulty: 'advanced',
        size: 'medium',
      },
      {
        id: 'dinosaur',
        version: 1,
        length: 68,
        difficulty: 'advanced',
        size: 'medium',
      },
      {
        id: 'train',
        version: 1,
        length: 79,
        difficulty: 'standard',
        size: 'large',
      },
      {
        id: 'lighthouse',
        version: 1,
        length: 83,
        difficulty: 'standard',
        size: 'large',
      },
      {
        id: 'hot-air-balloon',
        version: 1,
        length: 94,
        difficulty: 'standard',
        size: 'large',
      },
      {
        id: 'dragon',
        version: 1,
        length: 86,
        difficulty: 'advanced',
        size: 'large',
      },
      {
        id: 'space-shuttle',
        version: 1,
        length: 95,
        difficulty: 'advanced',
        size: 'large',
      },
      {
        id: 'sunflower',
        version: 1,
        length: 50,
        difficulty: 'beginner',
        size: 'medium',
      },
    ]);
  });

  it.each(puzzles)(
    '$name has valid artwork within independent grid bounds',
    (puzzle) => {
      expect(validatePuzzle(puzzle)).toBe(true);
      expect(puzzle.pixels.length).toBeGreaterThanOrEqual(1);
      expect(puzzle.pixels.length).toBeLessThanOrEqual(400);
      expect(puzzle.width).toBeLessThanOrEqual(20);
      expect(puzzle.height).toBeLessThanOrEqual(20);
      if (puzzle.intro) expect(puzzle.width).toBeLessThanOrEqual(10);
      for (const pixel of puzzle.pixels) {
        expect(pixel.id).toBe(`${pixel.row}:${pixel.col}`);
        expect(pixel.row).toBeGreaterThanOrEqual(1);
        expect(pixel.row).toBeLessThanOrEqual(puzzle.height);
        expect(pixel.col).toBeGreaterThanOrEqual(1);
        expect(pixel.col).toBeLessThanOrEqual(puzzle.width);
        if (puzzle.threeNumbers) expect(pixel.col).toBeLessThanOrEqual(19);
        expect(Object.hasOwn(puzzle.palette, pixel.color)).toBe(true);
      }
      expect(puzzle.pixels.some(({ col }) => col > 10)).toBe(!puzzle.intro);
      expect(new Set(puzzle.pixels.map(({ id }) => id)).size).toBe(
        puzzle.pixels.length,
      );
      expect(puzzle.pixels.length).toBeLessThan(puzzle.width * puzzle.height);
    },
  );

  it.each(puzzles)(
    '$name has valid, distinct arithmetic for every playable pixel',
    (puzzle) => {
      const candidates = enumerateEquations(puzzle.intro, puzzle.threeNumbers);
      const byColumn = new Map<number, number>();
      for (const pixel of puzzle.pixels) {
        byColumn.set(pixel.col, (byColumn.get(pixel.col) ?? 0) + 1);
      }
      for (const [col, count] of byColumn) {
        expect(
          candidates.filter(({ c }) => c === col).length,
        ).toBeGreaterThanOrEqual(count);
      }
      for (const random of [() => 0, () => 0.5, () => 0.999]) {
        const attempt = createAttempt(puzzle, random);
        expect(validateAttempt(attempt, puzzle)).toBe(true);
        expect(attempt.queue).toHaveLength(puzzle.pixels.length);
        expect(new Set(attempt.queue.map(({ pixelId }) => pixelId))).toEqual(
          new Set(puzzle.pixels.map(({ id }) => id)),
        );
        const pixels = new Map(puzzle.pixels.map((pixel) => [pixel.id, pixel]));
        const expressions = attempt.queue.map(({ pixelId, equation }) => {
          expect(
            isValidEquation(equation, puzzle.intro, puzzle.threeNumbers),
          ).toBe(true);
          expect(equation.c).toBe(pixels.get(pixelId)!.col);
          return `${equation.a}${equation.op}${equation.b}${equation.op2 ?? ''}${equation.d ?? ''}`;
        });
        expect(new Set(expressions).size).toBe(puzzle.pixels.length);
      }
    },
  );
});
