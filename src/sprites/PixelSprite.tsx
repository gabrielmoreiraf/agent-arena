import { memo } from 'react';
import { BASE_PALETTE, SPRITES } from './sprites';

interface Props {
  sprite?: string;
  /** Linhas do sprite direto (ex.: monstros), em vez do id */
  rows?: string[];
  palette: Record<string, string>;
  size?: number;
  flip?: boolean;
  className?: string;
}

/** Renderiza um sprite de texto como SVG nítido (shape-rendering crispEdges). */
export const PixelSprite = memo(function PixelSprite({ sprite, rows: rawRows, palette, size = 64, flip, className }: Props) {
  const rows = rawRows ?? SPRITES[sprite ?? 'bot'] ?? SPRITES.bot;
  const colors = { ...BASE_PALETTE, ...palette };
  const rects: JSX.Element[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !colors[ch]) {
        x++;
        continue;
      }
      // junta pixels iguais em sequência num só retângulo
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={colors[ch]} />);
      x += w;
    }
  });
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  return (
    <svg
      className={className}
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      {rects}
    </svg>
  );
});
