import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });
const sprite = [
  '...F...F...',
  '...FF.FF...',
  '...FFFFFF..',
  '...FEFFEF..',
  '....FNNF...',
  '....FFFF...',
  '....FFFF.F.',
  '...FFFFFFF.',
];
const colors = { F: '#e9ac69', E: '#28364a', N: '#b95770' };
const pixels = sprite
  .flatMap((row, y) =>
    [...row].map((color, x) =>
      color === '.'
        ? ''
        : `<rect x="${80 + x * 30}" y="${115 + y * 30}" width="30" height="30" fill="${colors[color]}"/>`,
    ),
  )
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#fff8ec"/><circle cx="256" cy="256" r="192" fill="#f7dfb8"/>${pixels}</svg>`;
const maskable = svg.replace('rx="112"', 'rx="0"');
for (const [name, size, source] of [
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['maskable-512.png', 512, maskable],
  ['apple-touch-icon.png', 180, svg],
]) {
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, output)));
}
await writeFile(new URL('favicon.svg', output), svg);
console.log('Generated 192/512, maskable 512, Apple 180 and SVG icons.');
