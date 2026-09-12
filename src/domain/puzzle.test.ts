import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import { validatePuzzle } from './puzzle';

describe('runtime puzzle validation', () => {
  const fish = puzzles[0]!;

  it.each([
    null,
    [],
    {},
    { ...fish, id: '' },
    { ...fish, id: '__proto__' },
    { ...fish, name: 'unknown-animal' },
    { ...fish, version: 0 },
    { ...fish, version: 1.5 },
    { ...fish, version: Number.MAX_SAFE_INTEGER + 1 },
    { ...fish, width: 0 },
    { ...fish, width: 21 },
    { ...fish, width: 2.5 },
    { ...fish, height: 0 },
    { ...fish, height: 21 },
    { ...fish, height: NaN },
    { ...fish, intro: 'true' },
    { ...fish, threeNumbers: true },
    { ...fish, threeNumbers: 'false' },
    { ...fish, threeNumbers: undefined },
    { ...fish, threeNumbers: null },
    { ...fish, width: 11 },
    { ...fish, palette: null },
    { ...fish, palette: [] },
    { ...fish, palette: {} },
    { ...fish, palette: { F: 'red' } },
    { ...fish, palette: { F: '#12345G' } },
    { ...fish, palette: { F: 123 } },
    { ...fish, palette: { 'bad key': '#123456' } },
    { ...fish, pixels: [] },
    { ...fish, pixels: null },
    { ...fish, pixels: [null] },
    { ...fish, pixels: [fish.pixels[0], fish.pixels[0]] },
    { ...fish, pixels: [{ id: '0:1', row: 0, col: 1, color: 'F' }] },
    { ...fish, pixels: [{ id: '1:0', row: 1, col: 0, color: 'F' }] },
    { ...fish, pixels: [{ id: '7:1', row: 7, col: 1, color: 'F' }] },
    { ...fish, pixels: [{ id: '1:10', row: 1, col: 10, color: 'F' }] },
    { ...fish, pixels: [{ id: '1:1', row: 1.5, col: 1, color: 'F' }] },
    { ...fish, pixels: [{ id: 'wrong', row: 1, col: 1, color: 'F' }] },
    { ...fish, pixels: [{ id: '1:1', row: 1, col: 1, color: 'unknown' }] },
    { ...fish, pixels: [{ id: '1:1', row: 1, col: 1, color: 'toString' }] },
  ])('rejects invalid puzzle %j', (value) => {
    expect(validatePuzzle(value)).toBe(false);
  });

  it('permits row T, column 20, and a single target', () => {
    expect(
      validatePuzzle({
        ...fish,
        intro: false,
        width: 20,
        height: 20,
        pixels: [{ id: '20:20', row: 20, col: 20, color: 'F' }],
      }),
    ).toBe(true);
  });

  it('rejects more targets than cells and sparse target arrays', () => {
    expect(
      validatePuzzle({ ...fish, pixels: Array(100).fill(fish.pixels[0]) }),
    ).toBe(false);
    expect(validatePuzzle({ ...fish, pixels: Array(2) })).toBe(false);
  });

  it('keeps omitted and explicit false flags compatible with legacy puzzles', () => {
    expect(validatePuzzle(fish)).toBe(true);
    expect(validatePuzzle({ ...fish, threeNumbers: false })).toBe(true);
  });

  it.each(['cheetah', 'german-shepherd', 'ferrari'])(
    'accepts the new name %s and only solvable three-number columns',
    (name) => {
      const puzzle = {
        ...fish,
        name,
        intro: false,
        threeNumbers: true,
        width: 20,
        pixels: [{ id: '1:19', row: 1, col: 19, color: 'F' }],
      };
      expect(validatePuzzle(puzzle)).toBe(true);
      expect(
        validatePuzzle({
          ...puzzle,
          pixels: [{ id: '1:20', row: 1, col: 20, color: 'F' }],
        }),
      ).toBe(false);
    },
  );
});
