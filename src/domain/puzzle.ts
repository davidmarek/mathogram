export type { Equation } from './arithmetic';

const puzzleNames = [
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
] as const;

type PuzzleName = (typeof puzzleNames)[number];

export interface Pixel {
  id: string;
  row: number;
  col: number;
  color: string;
}

export interface Puzzle {
  id: string;
  version: number;
  name: PuzzleName;
  width: number;
  height: number;
  intro: boolean;
  threeNumbers?: boolean;
  palette: Record<string, string>;
  pixels: Pixel[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= maximum
  );
}

export function validatePuzzle(value: unknown): value is Puzzle {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[a-z][a-z0-9-]*$/.test(value.id) ||
    !boundedInteger(value.version, Number.MAX_SAFE_INTEGER) ||
    !puzzleNames.some((name) => name === value.name) ||
    !boundedInteger(value.width, 20) ||
    !boundedInteger(value.height, 20) ||
    typeof value.intro !== 'boolean' ||
    ('threeNumbers' in value && typeof value.threeNumbers !== 'boolean') ||
    (value.intro && value.threeNumbers === true) ||
    (value.intro && value.width > 10) ||
    !isRecord(value.palette) ||
    Object.keys(value.palette).length === 0 ||
    !Array.isArray(value.pixels) ||
    value.pixels.length === 0 ||
    value.pixels.length > value.width * value.height
  ) {
    return false;
  }
  for (const [name, color] of Object.entries(value.palette)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) ||
      typeof color !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(color)
    ) {
      return false;
    }
  }
  // Every column in this range has a valid equation in the selected mode.
  const maximumColumn = value.intro ? 10 : value.threeNumbers ? 19 : 20;
  const seen = new Set<string>();
  for (const pixel of value.pixels) {
    if (
      !isRecord(pixel) ||
      !boundedInteger(pixel.row, value.height) ||
      !boundedInteger(pixel.col, value.width) ||
      pixel.id !== `${pixel.row}:${pixel.col}` ||
      typeof pixel.color !== 'string' ||
      !Object.hasOwn(value.palette, pixel.color) ||
      pixel.col > maximumColumn ||
      seen.has(pixel.id)
    ) {
      return false;
    }
    seen.add(pixel.id);
  }
  return true;
}
