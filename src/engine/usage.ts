import { WINDOW_MS } from '../data/providers';
import type { Provider, ProviderId, WindowMode } from '../types';

/** Formato devolvido por GET /api/usage (server/usage.ts) */
export interface RealUsage {
  claude:
    | { detected: false }
    | {
        detected: true;
        windows: {
          '5h': { total: number; input: number; output: number; cacheCreate: number; cacheRead: number; messages: number; resetsAt: number | null };
          daily: { total: number; messages: number };
          weekly: { total: number; messages: number };
        };
        byModel: Record<string, number>;
        files: number;
      };
  codex:
    | { detected: false }
    | {
        detected: true;
        primary: { usedPercent: number | null; windowMinutes: number | null; resetsAt: number | null } | null;
        secondary: { usedPercent: number | null; windowMinutes: number | null; resetsAt: number | null } | null;
      };
  gemini: { detected: boolean };
  apiKeys: Record<ProviderId, boolean>;
  at: number;
}

export function simulatedUsage(p: Provider, mode: WindowMode, now = Date.now()) {
  const since = now - WINDOW_MS[mode];
  let total = 0;
  let first: number | null = null;
  for (const e of p.events) {
    if (e.at < since) continue;
    total += e.tokens;
    if (first === null) first = e.at;
  }
  return { total, resetsAt: first === null ? null : first + WINDOW_MS[mode] };
}

/** Uso real (logs locais) quando existe para aquele provedor/janela */
export function realUsage(real: RealUsage | null, id: ProviderId, mode: WindowMode, limit?: number) {
  if (!real) return null;
  if (id === 'claude' && real.claude.detected) {
    if (mode === '5h') return { total: real.claude.windows['5h'].total, resetsAt: real.claude.windows['5h'].resetsAt, pct: null };
    if (mode === 'daily') return { total: real.claude.windows.daily.total, resetsAt: null, pct: null };
    if (mode === 'weekly') return { total: real.claude.windows.weekly.total, resetsAt: null, pct: null };
  }
  if (id === 'codex' && real.codex.detected) {
    const w = mode === '5h' ? real.codex.primary : mode === 'weekly' ? real.codex.secondary : null;
    if (w?.usedPercent != null)
      return { total: limit ? (w.usedPercent / 100) * limit : 0, resetsAt: w.resetsAt, pct: w.usedPercent / 100 };
  }
  return null;
}

export function isDetected(real: RealUsage | null, id: ProviderId) {
  if (!real) return false;
  if (id === 'claude') return real.claude.detected;
  if (id === 'codex') return real.codex.detected;
  if (id === 'gemini') return real.gemini.detected;
  return false;
}
