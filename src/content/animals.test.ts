import { describe, expect, it } from 'vitest';
import { enumerateEquations } from '../domain/arithmetic';
import { validatePuzzle } from '../domain/puzzle';
import { puzzles } from './animals';

describe('original animal content', () => {
  it('contains eleven distinct animals with introductory puzzles first', () => {
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
    ]);
    expect(new Set(puzzles.map(({ id }) => id)).size).toBe(11);
    expect(puzzles.map(({ intro }) => intro)).toEqual([
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
    ]);
  });

  it('bridges the difficulty gaps without changing existing puzzle lengths', () => {
    expect(
      Object.fromEntries(
        puzzles
          .filter(({ name }) =>
            ['fish', 'butterfly', 'cat', 'rabbit', 'dog', 'owl'].includes(name),
          )
          .map(({ name, pixels }) => [name, pixels.length]),
      ),
    ).toEqual({
      fish: 28,
      butterfly: 32,
      cat: 48,
      rabbit: 54,
      dog: 63,
      owl: 61,
    });
    const lengths = puzzles
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
        puzzle.intro ? 20 : 40,
      );
      expect(puzzle.pixels.length).toBeLessThanOrEqual(puzzle.intro ? 40 : 65);
      expect(puzzle.width).toBeLessThanOrEqual(20);
      expect(puzzle.height).toBeLessThanOrEqual(20);
      const answers = new Set(
        enumerateEquations(puzzle.intro).map(({ c }) => c),
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
