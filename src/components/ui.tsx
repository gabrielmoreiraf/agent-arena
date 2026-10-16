import { useEffect, type ReactNode } from 'react';
import { PixelSprite } from '../sprites/PixelSprite';
import type { Agent, Source } from '../types';

export function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function fmtDuration(ms: number) {
  if (ms <= 0) return 'agora';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m % 60}min`;
  return `${m}min`;
}

export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const hh = Math.floor(s / 3600);
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Bar({ value, color, className = '' }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`bar ${className}`}>
      <i style={{ width: `${pct}%`, ...(color ? ({ '--c': color } as React.CSSProperties) : {}) }} />
    </div>
  );
}

/** Cor do medidor: verde → amarelo → vermelho */
export const meterColor = (r: number) => (r > 0.9 ? 'var(--red)' : r > 0.7 ? 'var(--orange)' : 'var(--green)');

const SOURCE_LABEL: Record<Source, string> = {
  manual: 'manual',
  clickup: 'clickup',
  jira: 'jira',
  linear: 'linear',
  github: 'github',
  demo: 'demo',
};

export function SourceBadge({ source }: { source: Source }) {
  return <span className={`src src-${source}`}>{SOURCE_LABEL[source]}</span>;
}

export function Avatar({ agent, size = 28 }: { agent?: Agent; size?: number }) {
  if (!agent) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return <PixelSprite sprite={agent.sprite} palette={agent.palette} size={size} />;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  narrow,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal>
        <div className="modal-head">
          <div className="px-title">{title}</div>
          <button className="close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
