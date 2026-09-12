export interface Equation {
  a: number;
  op: '+' | '-';
  b: number;
  c: number;
}

export function isValidEquation(
  value: unknown,
  intro = false,
): value is Equation {
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
    a > 20 ||
    b < 0 ||
    b > 10 ||
    c < 1 ||
    c > 20 ||
    (op !== '+' && op !== '-')
  ) {
    return false;
  }
  if (intro && (a > 10 || b > 10 || c > 10)) return false;
  const sharedBand = (a <= 10 && c <= 10) || (a >= 10 && c >= 10);
  return sharedBand && (op === '+' ? a + b : a - b) === c;
}

export function enumerateEquations(intro = false): Equation[] {
  const equations: Equation[] = [];
  for (let a = 0; a <= 20; a += 1) {
    for (let b = 0; b <= 10; b += 1) {
      for (const op of ['+', '-'] as const) {
        const equation = { a, op, b, c: op === '+' ? a + b : a - b };
        if (isValidEquation(equation, intro)) equations.push(equation);
      }
    }
  }
  return equations;
}
