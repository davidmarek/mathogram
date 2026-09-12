import { describe, expect, it } from 'vitest';
import { enumerateEquations, isValidEquation } from './arithmetic';

describe('arithmetic', () => {
  it.each([false, true])(
    'exhaustively validates the bounded operand/operator/result space (intro=%s)',
    (intro) => {
      const candidates = enumerateEquations(intro);
      const keys = new Set(candidates.map((entry) => JSON.stringify(entry)));
      expect(keys.size).toBe(candidates.length);
      for (let a = -1; a <= 21; a += 1) {
        for (let b = -1; b <= 11; b += 1) {
          for (const op of ['+', '-'] as const) {
            for (let c = 0; c <= 21; c += 1) {
              const equation = { a, op, b, c };
              const crossesTen = Math.min(a, c) < 10 && Math.max(a, c) > 10;
              const expected =
                a >= 0 &&
                a <= 20 &&
                b >= 0 &&
                b <= 10 &&
                c >= 1 &&
                c <= 20 &&
                !crossesTen &&
                (op === '+' ? a + b : a - b) === c &&
                (!intro || Math.max(a, b, c) <= 10);
              expect(isValidEquation(equation, intro)).toBe(expected);
              expect(keys.has(JSON.stringify(equation))).toBe(expected);
            }
          }
        }
      }
      expect(
        [...new Set(candidates.map(({ c }) => c))].sort((a, b) => a - b),
      ).toEqual(Array.from({ length: intro ? 10 : 20 }, (_, i) => i + 1));
    },
  );

  it.each([
    { a: 12, op: '+', b: 5, c: 17 },
    { a: 8, op: '+', b: 2, c: 10 },
    { a: 10, op: '-', b: 3, c: 7 },
    { a: 13, op: '-', b: 3, c: 10 },
    { a: 20, op: '-', b: 5, c: 15 },
    { a: 10, op: '+', b: 10, c: 20 },
    { a: 20, op: '-', b: 0, c: 20 },
    { a: 0, op: '+', b: 1, c: 1 },
  ])('permits boundary equation %j', (equation) => {
    expect(isValidEquation(equation)).toBe(true);
  });

  it.each([
    null,
    [],
    '8+2',
    {},
    { a: 7, op: '+', b: 8, c: 15 },
    { a: 12, op: '-', b: 5, c: 7 },
    { a: 0, op: '+', b: 20, c: 20 },
    { a: 1, op: '-', b: 1, c: 0 },
    { a: 2, op: '*', b: 2, c: 4 },
    { a: 2, op: '+', b: 2, c: 5 },
    { a: '2', op: '+', b: 2, c: 4 },
    { a: 1.5, op: '+', b: 0.5, c: 2 },
    { a: 2, op: '+', b: 0.5, c: 2.5 },
    { a: NaN, op: '+', b: 1, c: 1 },
    { a: Infinity, op: '-', b: 1, c: 1 },
    { a: 1, op: '+', b: NaN, c: 1 },
    { a: 1, op: '+', b: 1, c: NaN },
  ])('rejects malformed or forbidden equation %j', (equation) => {
    expect(isValidEquation(equation)).toBe(false);
  });

  it('returns independently mutable enumeration results', () => {
    const first = enumerateEquations();
    first[0]!.a = 999;
    first.pop();
    expect(enumerateEquations().every((entry) => isValidEquation(entry))).toBe(
      true,
    );
    expect(enumerateEquations().length).toBe(first.length + 1);
  });
});
