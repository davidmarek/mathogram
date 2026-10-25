export interface Equation {
  a: number;
  op: '+' | '-';
  b: number;
  c: number;
  op2?: '+' | '-';
  d?: number;
}

function sharesTenBand(start: number, end: number): boolean {
  return (start <= 10 && end <= 10) || (start >= 10 && end >= 10);
}

export function isValidEquation(
  value: unknown,
  intro = false,
  threeNumbers = false,
): value is Equation {
  if (intro && threeNumbers) return false;
  if (typeof value !== 'object' || value === null) return false;
  if (!('a' in value && 'op' in value && 'b' in value && 'c' in value)) {
    return false;
  }
  const { a, op, b, c } = value;
  if (
    typeof a !== 'number' ||
    typeof b !== 'number' ||
    typeof c !== 'number' ||
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    !Number.isInteger(c) ||
    a < 0 ||
    a > (threeNumbers ? 19 : 20) ||
    b < 0 ||
    b > 10 ||
    c < 1 ||
    c > (threeNumbers ? 19 : 20) ||
    (op !== '+' && op !== '-')
  ) {
    return false;
  }
  if (threeNumbers) {
    if (!('op2' in value && 'd' in value)) return false;
    const { op2, d } = value;
    if (
      (op2 !== '+' && op2 !== '-') ||
      typeof d !== 'number' ||
      !Number.isInteger(d) ||
      d < 0 ||
      d > 10
    ) {
      return false;
    }
    const intermediate = op === '+' ? a + b : a - b;
    return (
      intermediate >= 0 &&
      intermediate < 20 &&
      sharesTenBand(a, intermediate) &&
      sharesTenBand(intermediate, c) &&
      (op2 === '+' ? intermediate + d : intermediate - d) === c
    );
  }
  if ('op2' in value || 'd' in value) return false;
  if (intro && (a > 10 || b > 10 || c > 10)) return false;
  return sharesTenBand(a, c) && (op === '+' ? a + b : a - b) === c;
}

export const operationChoices = ['both', 'add', 'subtract'] as const;

/** Two-number exercises chosen in Settings instead of a picture's own mode. */
export interface ArithmeticRules {
  maxNumber: number;
  crossTen: boolean;
  operations: (typeof operationChoices)[number];
}

export const MIN_LIMIT = 10;
export const MAX_LIMIT = 20;

export function isValidRules(value: unknown): value is ArithmeticRules {
  if (typeof value !== 'object' || value === null) return false;
  if (!('maxNumber' in value && 'crossTen' in value && 'operations' in value))
    return false;
  const { maxNumber, crossTen, operations } = value;
  return (
    typeof maxNumber === 'number' &&
    Number.isInteger(maxNumber) &&
    maxNumber >= MIN_LIMIT &&
    maxNumber <= MAX_LIMIT &&
    typeof crossTen === 'boolean' &&
    operationChoices.some((choice) => choice === operations)
  );
}

export function crossesTen({ a, op, b }: Equation): boolean {
  return !sharesTenBand(a, op === '+' ? a + b : a - b);
}

export function isValidRuleEquation(
  value: unknown,
  rules: ArithmeticRules,
): value is Equation {
  if (!isValidRules(rules) || !isValidEquationShape(value)) return false;
  const { a, op, b, c } = value;
  return (
    a <= rules.maxNumber &&
    c <= rules.maxNumber &&
    (rules.operations === 'both' ||
      (rules.operations === 'add') === (op === '+')) &&
    (op === '+' ? a + b : a - b) === c &&
    (rules.crossTen || sharesTenBand(a, c))
  );
}

function isValidEquationShape(value: unknown): value is Equation {
  if (typeof value !== 'object' || value === null) return false;
  if (!('a' in value && 'op' in value && 'b' in value && 'c' in value)) {
    return false;
  }
  if ('op2' in value || 'd' in value) return false;
  const { a, op, b, c } = value;
  return (
    typeof a === 'number' &&
    typeof b === 'number' &&
    typeof c === 'number' &&
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    Number.isInteger(c) &&
    a >= 0 &&
    b >= 0 &&
    b <= 10 &&
    c >= 1 &&
    (op === '+' || op === '-')
  );
}

export function enumerateRuleEquations(rules: ArithmeticRules): Equation[] {
  const equations: Equation[] = [];
  for (let a = 0; a <= rules.maxNumber; a += 1) {
    for (let b = 0; b <= 10; b += 1) {
      for (const op of ['+', '-'] as const) {
        const equation = { a, op, b, c: op === '+' ? a + b : a - b };
        if (isValidRuleEquation(equation, rules)) equations.push(equation);
      }
    }
  }
  return equations;
}

const pools = new Map<number, readonly Readonly<Equation>[]>();

export function enumerateEquations(
  intro = false,
  threeNumbers = false,
): Equation[] {
  if (intro && threeNumbers) return [];
  const mode = threeNumbers ? 2 : intro ? 1 : 0;
  const cached = pools.get(mode);
  if (cached) return cached.map((equation) => ({ ...equation }));
  const equations: Equation[] = [];
  for (let a = 0; a <= 20; a += 1) {
    for (let b = 0; b <= 10; b += 1) {
      for (const op of ['+', '-'] as const) {
        const intermediate = op === '+' ? a + b : a - b;
        if (threeNumbers) {
          for (let d = 0; d <= 10; d += 1) {
            for (const op2 of ['+', '-'] as const) {
              const equation = {
                a,
                op,
                b,
                c: op2 === '+' ? intermediate + d : intermediate - d,
                op2,
                d,
              };
              if (isValidEquation(equation, intro, threeNumbers)) {
                equations.push(equation);
              }
            }
          }
        } else {
          const equation = { a, op, b, c: intermediate };
          if (isValidEquation(equation, intro)) equations.push(equation);
        }
      }
    }
  }
  pools.set(
    mode,
    Object.freeze(equations.map((equation) => Object.freeze({ ...equation }))),
  );
  return equations;
}
