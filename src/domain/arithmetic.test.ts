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

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])(
    'returns independently mutable enumeration results (intro=%s, threeNumbers=%s)',
    (intro, threeNumbers) => {
      const first = enumerateEquations(intro, threeNumbers);
      const original = structuredClone(first);
      first[0]!.a = 999;
      first[0]!.d = 999;
      first.pop();
      expect(enumerateEquations(intro, threeNumbers)).toEqual(original);
      const second = enumerateEquations(intro, threeNumbers);
      second[0]!.c = 999;
      expect(enumerateEquations(intro, threeNumbers)).toEqual(original);
    },
  );
});

describe('three-number arithmetic', () => {
  it('matches an independent exhaustive oracle for both steps and all results', () => {
    const candidates = enumerateEquations(false, true);
    const key = (
      a: number,
      op: string,
      b: number,
      op2: string,
      d: number,
      c: number,
    ) => `${a}${op}${b}${op2}${d}=${c}`;
    const actual = new Set(
      candidates.map(({ a, op, b, op2, d, c }) => key(a, op, b, op2!, d!, c)),
    );
    expect(actual.size).toBe(candidates.length);
    const expectedKeys = new Set<string>();
    const mismatches: string[] = [];
    const bands = [
      Array.from({ length: 11 }, (_, i) => i),
      Array.from({ length: 10 }, (_, i) => i + 10),
    ];
    for (let a = -1; a <= 20; a += 1) {
      for (let b = -1; b <= 11; b += 1) {
        for (let d = -1; d <= 11; d += 1) {
          for (const op of ['+', '-'] as const) {
            for (const op2 of ['+', '-'] as const) {
              const intermediate = a + (op === '+' ? b : -b);
              for (let c = 0; c <= 20; c += 1) {
                const expected =
                  a >= 0 &&
                  a < 20 &&
                  b >= 0 &&
                  b <= 10 &&
                  d >= 0 &&
                  d <= 10 &&
                  c >= 1 &&
                  c < 20 &&
                  bands.some(
                    (band) => band.includes(a) && band.includes(intermediate),
                  ) &&
                  bands.some(
                    (band) => band.includes(intermediate) && band.includes(c),
                  ) &&
                  intermediate + (op2 === '+' ? d : -d) === c;
                const equationKey = key(a, op, b, op2, d, c);
                if (expected) expectedKeys.add(equationKey);
                if (
                  isValidEquation({ a, op, b, c, op2, d }, false, true) !==
                  expected
                ) {
                  mismatches.push(equationKey);
                }
              }
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(actual).toEqual(expectedKeys);
    expect(
      [...new Set(candidates.map(({ c }) => c))].sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
  });

  it.each([
    { a: 14, op: '-', b: 4, op2: '-', d: 3, c: 7 },
    { a: 7, op: '+', b: 3, op2: '+', d: 9, c: 19 },
    { a: 19, op: '-', b: 9, op2: '-', d: 9, c: 1 },
    { a: 5, op: '-', b: 5, op2: '+', d: 1, c: 1 },
    { a: 0, op: '+', b: 10, op2: '+', d: 0, c: 10 },
    { a: 10, op: '+', b: 0, op2: '-', d: 0, c: 10 },
  ])(
    'permits closed-band boundaries and left-to-right evaluation %j',
    (equation) => {
      expect(isValidEquation(equation, false, true)).toBe(true);
      expect(isValidEquation(equation)).toBe(false);
    },
  );

  it.each([
    { a: 14, op: '-', b: 5, op2: '+', d: 1, c: 10 },
    { a: 14, op: '-', b: 3, op2: '-', d: 4, c: 7 },
    { a: 19, op: '+', b: 1, op2: '-', d: 1, c: 19 },
    { a: 1, op: '-', b: 2, op2: '+', d: 2, c: 1 },
    { a: 20, op: '-', b: 10, op2: '-', d: 1, c: 9 },
    { a: 10, op: '+', b: 9, op2: '+', d: 1, c: 20 },
    { a: 5, op: '-', b: 3, op2: '-', d: 2, c: 0 },
    { a: 14, op: '-', b: 4, op2: '-', d: 3, c: 13 },
    { a: 1, op: '+', b: 1, c: 2 },
  ])(
    'rejects forbidden ranges, crossing either band, or missing operands %j',
    (equation) => {
      expect(isValidEquation(equation, false, true)).toBe(false);
    },
  );

  it.each([
    { op2: '+' },
    { d: 0 },
    { op2: undefined },
    { d: undefined },
    { op2: undefined, d: undefined },
    { op2: '+', d: undefined },
    { op2: undefined, d: 0 },
    { op2: '*', d: 0 },
    { op2: null, d: 0 },
    { op2: '+', d: '0' },
    { op2: '+', d: null },
    { op2: '+', d: NaN },
    { op2: '+', d: Infinity },
    { op2: '+', d: 0.5 },
    { op2: '+', d: -1 },
    { op2: '+', d: 11 },
  ])('rejects malformed extra operands in every mode %j', (extra) => {
    const value = { a: 1, op: '+', b: 1, c: 2, ...extra };
    expect(isValidEquation(value)).toBe(false);
    expect(isValidEquation(value, true)).toBe(false);
    expect(isValidEquation(value, false, true)).toBe(false);
  });

  it('disallows the new mode for introductory puzzles', () => {
    expect(enumerateEquations(true, true)).toEqual([]);
    expect(
      isValidEquation(
        { a: 1, op: '+', b: 1, op2: '+', d: 1, c: 3 },
        true,
        true,
      ),
    ).toBe(false);
  });
});
