import { validatePuzzle } from '../domain/puzzle';
import type { Puzzle } from '../domain/puzzle';

function picture(
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
    throw new Error(`Invalid picture content: ${name}`);
  }
  return puzzle;
}

// Original hand-drawn sprites. Dots are background, never playable pixels.
export const puzzles: Puzzle[] = [
  picture('fish', 9, true, { F: '#F5A623', T: '#ED765E', E: '#28364A' }, [
    '...FF....',
    '..FFFF...',
    'T.FFEFF..',
    'TTFFFFFF.',
    'T.FFFFF..',
    '...FF....',
  ]),
  picture('butterfly', 9, true, { P: '#B58BE3', B: '#554066' }, [
    '...B.B...',
    'PP..B..PP',
    'PPP.B.PPP',
    '.PPBBBPP.',
    '..P.B.P..',
    '.PP.B.PP.',
    '..P.B.P..',
  ]),
  picture(
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
  picture(
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
  picture(
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
  picture('cat', 13, false, { F: '#E9AC69', E: '#28364A', N: '#D96B86' }, [
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
  picture(
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
  picture(
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
  picture('fox', 14, false, { F: '#DF8850', W: '#F7E4C4', E: '#28364A' }, [
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
  picture(
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
  picture(
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
  picture(
    'watermelon',
    9,
    true,
    { R: '#EF6571', S: '#493B42', W: '#DDE9A8', G: '#46956A' },
    [
      '....R....',
      '...RRR...',
      '..RSRSR..',
      '.RRRRRRR.',
      'WWWWWWWWW',
      '.GGGGGGG.',
    ],
  ),
  picture('fries', 9, true, { Y: '#F5C84C', R: '#DC5555', W: '#FFE8A3' }, [
    '...Y.Y...',
    '.Y.Y.Y...',
    '.Y.Y.Y.Y.',
    '.Y.Y.Y.Y.',
    '.RRRRRRR.',
    '.RRWWWRR.',
    '.RRRWRRR.',
    '..RRRRR..',
  ]),
  picture(
    'cheddar-fingers',
    12,
    false,
    { C: '#C88032', H: '#EDAD4F', Y: '#FFE275' },
    [
      '..YY..YY..YY',
      '.CHC.CHC.CHC',
      '.CYC.CYC.CYC',
      '.CHC.CHC.CHC',
      '.CHC.CHC.CHC',
      '..CC..CC..CC',
    ],
  ),
  picture(
    'hamburger',
    13,
    false,
    {
      B: '#E8AB59',
      S: '#FFF0BA',
      L: '#76A84B',
      T: '#DE5950',
      P: '#754735',
      Y: '#F6CE4D',
    },
    [
      '...BBBBBBB...',
      '..BBBSBBSBB..',
      '..BBBBBBBBB..',
      '..LLLLLLLLL..',
      '...TTTTTTT...',
      '..PPPPYPPPP..',
      '...BBBBBBB...',
    ],
  ),
  picture(
    'sushi',
    13,
    false,
    {
      N: '#304D43',
      R: '#F5E8CE',
      S: '#EF927C',
      A: '#AAC66C',
      V: '#EDAA54',
    },
    [
      '.NNNN...NNNN.',
      'NRRRRN.NRRRRN',
      'NRSSRN.NRAVRN',
      'NRRRRN.NRRRRN',
      '.NNNN...NNNN.',
      '.NNNN...NNNN.',
    ],
  ),
];

if (new Set(puzzles.map(({ id }) => id)).size !== puzzles.length) {
  throw new Error('Picture IDs must be unique.');
}
