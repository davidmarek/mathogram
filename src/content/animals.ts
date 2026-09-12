import { validatePuzzle } from '../domain/puzzle';
import type { Puzzle } from '../domain/puzzle';

function animal(
  name: Puzzle['name'],
  width: number,
  intro: boolean,
  palette: Puzzle['palette'],
  rows: string[],
): Puzzle {
  if (rows.some((row) => row.length > width)) {
    throw new Error(`Artwork exceeds the grid: ${name}`);
  }
  const puzzle: Puzzle = {
    id: name,
    version: 1,
    name,
    width,
    height: rows.length,
    intro,
    palette,
    pixels: rows.flatMap((line, rowIndex) =>
      [...line].flatMap((color, colIndex) =>
        color === '.'
          ? []
          : [
              {
                id: `${rowIndex + 1}:${colIndex + 1}`,
                row: rowIndex + 1,
                col: colIndex + 1,
                color,
              },
            ],
      ),
    ),
  };
  if (!validatePuzzle(puzzle)) {
    throw new Error(`Invalid animal content: ${name}`);
  }
  return puzzle;
}

// Original hand-drawn sprites. Dots are background, never playable pixels.
export const puzzles: Puzzle[] = [
  animal('fish', 9, true, { F: '#F5A623', T: '#ED765E', E: '#28364A' }, [
    '...FF....',
    '..FFFF...',
    'T.FFEFF..',
    'TTFFFFFF.',
    'T.FFFFF..',
    '...FF....',
  ]),
  animal('butterfly', 9, true, { P: '#B58BE3', B: '#554066' }, [
    '...B.B...',
    'PP..B..PP',
    'PPP.B.PPP',
    '.PPBBBPP.',
    '..P.B.P..',
    '.PP.B.PP.',
    '..P.B.P..',
  ]),
  animal(
    'bee',
    10,
    true,
    { Y: '#F5C84C', B: '#70513A', W: '#B5DDEB', E: '#28364A' },
    [
      '..WW.WW...',
      '.WWWWWWW..',
      '..YBYBYY..',
      '.YBYBYEY..',
      '..YBYBYY..',
      '...YBYY...',
      '...B..B...',
    ],
  ),
  animal(
    'snail',
    10,
    true,
    { S: '#D99065', P: '#965B48', G: '#91BA73', E: '#28364A' },
    [
      '.......E.E',
      '..SSS..GGG',
      '.SSPSS..G.',
      '.SPPPS..G.',
      '.SSPSS.GG.',
      '..SSSGGGG.',
      '.GGGGGG...',
    ],
  ),
  animal(
    'turtle',
    12,
    false,
    { S: '#559B78', P: '#B1CE78', G: '#9FC985', E: '#28364A' },
    [
      '....SSSS....',
      '...SSPPSSS..',
      '..SSPPSPSS..',
      '..SPSSPSSSGG',
      '.GSSSSSSSGEG',
      '...GG..GG...',
    ],
  ),
  animal('cat', 13, false, { F: '#E9AC69', E: '#28364A', N: '#D96B86' }, [
    '...F...F.....',
    '...FF.FF.....',
    '...FFFFFF....',
    '...FEFFEF....',
    '....FNNF.....',
    '....FFFF...F.',
    '....FFFF..FF.',
    '...FFFFFF.F..',
    '...FFFFFFFF..',
  ]),
  animal(
    'duck',
    13,
    false,
    { Y: '#F3CD58', W: '#E7AE43', O: '#E88945', E: '#28364A' },
    [
      '.......YYY...',
      '......YYYYY..',
      '......YEYYOO.',
      '......YYYY...',
      '.Y....YYY....',
      '.YY..YYYY....',
      '.YYYYWWYYY...',
      '..YYYYYYY....',
      '...YYYY......',
      '....O.O......',
    ],
  ),
  animal(
    'rabbit',
    13,
    false,
    { F: '#D6C6E8', P: '#E99EBC', E: '#28364A', N: '#CC668A' },
    [
      '.....F.F.....',
      '....FP.PF....',
      '....FP.PF....',
      '....FF.FF....',
      '....FFFFFF...',
      '....FEFFEF...',
      '.....FNNF....',
      '.....FFFF....',
      '....FFFFFF...',
      '...FFFFFFFFF.',
      '....FF..FFF..',
    ],
  ),
  animal('fox', 14, false, { F: '#DF8850', W: '#F7E4C4', E: '#28364A' }, [
    '...F...F......',
    '...FF.FF......',
    '...FFFFFF.....',
    '...FEFFEF.....',
    '...FWEEWF.....',
    '.....WW.......',
    '....FFFF...W..',
    '....FFFF..WW..',
    '...FFFFFF.FF..',
    '...FFFFFFFFF..',
    '....EE..EE....',
  ]),
  animal(
    'dog',
    14,
    false,
    { F: '#DCA66A', B: '#926447', E: '#28364A', N: '#E78699' },
    [
      '....BBFFBB....',
      '...BBFFFFBB...',
      '...BFEFFEFB...',
      '...BFFEEFFB...',
      '....FFNNFF....',
      '.....FFFF.....',
      '.....FFFF...B.',
      '.....FFFF..BB.',
      '....FFFFFFFF..',
      '....FF...FF...',
    ],
  ),
  animal(
    'owl',
    15,
    false,
    { F: '#AC8CBE', W: '#F7E4B8', E: '#28364A', N: '#E9A34B' },
    [
      '....F.....F....',
      '....FF...FF....',
      '....FFFFFFF....',
      '...FWWEFEWWF...',
      '...FWWWNWWWF...',
      '...FFFFFFFFF...',
      '....FWFWFWF....',
      '....FFFFFFF....',
      '.....FFFFF.....',
      '.....N...N.....',
    ],
  ),
];

if (new Set(puzzles.map(({ id }) => id)).size !== puzzles.length) {
  throw new Error('Animal IDs must be unique.');
}
