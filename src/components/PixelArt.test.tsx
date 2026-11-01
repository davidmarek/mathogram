import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { puzzles } from '../content/animals';
import { PixelArt } from './PixelArt';

describe('PixelArt framing', () => {
  it('centers every preview without changing its colored pixels', () => {
    for (const puzzle of puzzles) {
      const { container, unmount } = render(
        <PixelArt puzzle={puzzle} centered />,
      );
      const frame = container
        .querySelector('svg')!
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number);
      const left = Math.min(...puzzle.pixels.map((pixel) => pixel.col - 1));
      const right = Math.max(...puzzle.pixels.map((pixel) => pixel.col));
      const top = Math.min(...puzzle.pixels.map((pixel) => pixel.row - 1));
      const bottom = Math.max(...puzzle.pixels.map((pixel) => pixel.row));
      expect(frame[0]! + frame[2]! / 2).toBe((left + right) / 2);
      expect(frame[1]! + frame[3]! / 2).toBe((top + bottom) / 2);
      expect(frame[2]).toBe(frame[3]);
      expect(frame[0]).toBeLessThan(left);
      expect(frame[1]).toBeLessThan(top);
      expect(frame[0]! + frame[2]!).toBeGreaterThan(right);
      expect(frame[1]! + frame[3]!).toBeGreaterThan(bottom);
      expect(
        [...container.querySelectorAll('rect')].map((pixel) => [
          pixel.getAttribute('x'),
          pixel.getAttribute('y'),
          pixel.getAttribute('fill'),
        ]),
      ).toEqual(
        puzzle.pixels.map((pixel) => [
          String(pixel.col - 1),
          String(pixel.row - 1),
          puzzle.palette[pixel.color],
        ]),
      );
      unmount();
    }
  });

  it('preserves the original grid viewBox by default', () => {
    const puzzle = puzzles.find((picture) => picture.id === 'rocket')!;
    const { container } = render(<PixelArt puzzle={puzzle} />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(
      `0 0 ${puzzle.width} ${puzzle.height}`,
    );
  });
});
