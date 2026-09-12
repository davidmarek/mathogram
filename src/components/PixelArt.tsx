import type { CSSProperties } from 'react';
import type { Puzzle } from '../domain/puzzle';
import type { Messages } from '../i18n/en';

export function PixelArt({
  puzzle,
  className = '',
}: {
  puzzle: Puzzle;
  className?: string;
}) {
  return (
    <svg
      className={`pixel-art ${className}`}
      viewBox={`0 0 ${puzzle.width} ${puzzle.height}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {puzzle.pixels.map((pixel) => (
        <rect
          key={pixel.id}
          x={pixel.col - 1}
          y={pixel.row - 1}
          width="1"
          height="1"
          fill={puzzle.palette[pixel.color]}
        />
      ))}
    </svg>
  );
}

export function PixelGrid({
  puzzle,
  solved,
  activeRow,
  latest,
  t,
}: {
  puzzle: Puzzle;
  solved: string[];
  activeRow?: number;
  latest?: string;
  t: Messages;
}) {
  const revealed = new Set(solved);
  const pixels = new Map(puzzle.pixels.map((pixel) => [pixel.id, pixel]));
  return (
    <div className="grid-shell">
      <div
        className="pixel-grid"
        role="img"
        aria-label={`${t.hiddenGrid} ${solved.length} / ${puzzle.pixels.length} ${t.filled}. ${activeRow ? `${t.row} ${String.fromCharCode(64 + activeRow)}.` : ''}`}
        style={{ '--columns': puzzle.width } as CSSProperties}
        data-testid="pixel-grid"
      >
        <span />
        {Array.from({ length: puzzle.width }, (_, col) => (
          <span className="axis" key={`col-${col}`}>
            {col + 1}
          </span>
        ))}
        {Array.from({ length: puzzle.height }, (_, index) => {
          const row = index + 1;
          return [
            <span
              className={`axis row-label ${row === activeRow ? 'active-row-label' : ''}`}
              key={`row-${row}`}
            >
              {String.fromCharCode(64 + row)}
            </span>,
            ...Array.from({ length: puzzle.width }, (_, colIndex) => {
              const id = `${row}:${colIndex + 1}`;
              const pixel = pixels.get(id);
              const filled = revealed.has(id);
              return (
                <span
                  key={id}
                  data-testid={`cell-${id}`}
                  data-filled={filled}
                  className={`grid-cell ${row === activeRow ? 'active-row' : ''} ${id === latest ? 'new-pixel' : ''}`}
                  style={
                    filled && pixel
                      ? { backgroundColor: puzzle.palette[pixel.color] }
                      : undefined
                  }
                />
              );
            }),
          ];
        })}
      </div>
      <div className="picture-progress">
        <span>
          {solved.length}{' '}
          <span className="muted">
            / {puzzle.pixels.length} {t.filled}
          </span>
        </span>
        <span aria-hidden="true">✦</span>
      </div>
      <progress
        value={solved.length}
        max={puzzle.pixels.length}
        aria-label={t.filled}
      />
    </div>
  );
}
