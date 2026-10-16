/**
 * Lê o uso REAL de tokens a partir dos logs locais das CLIs:
 *  - Claude Code: ~/.claude/projects/**\/*.jsonl  (campo message.usage)
 *  - Codex CLI:   ~/.codex/sessions/**\/*.jsonl   (eventos com rate_limits)
 *  - Gemini CLI:  só detecta a instalação (~/.gemini)
 * Nada sai da sua máquina: o servidor do Vite roda em localhost.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOUR = 3600_000;

async function walk(dir: string, since: number, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, since, out);
    else if (e.name.endsWith('.jsonl')) {
      try {
        if ((await stat(p)).mtimeMs >= since) out.push(p);
      } catch {
        /* arquivo sumiu no meio da leitura */
      }
    }
  }
  return out;
}

interface ClaudeEvent {
  at: number;
  model: string;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

interface Totals {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  /** input + output + cacheCreate (cache lido é barato e fica de fora) */
  total: number;
  messages: number;
}

const zero = (): Totals => ({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0, messages: 0 });

function add(t: Totals, e: ClaudeEvent) {
  t.input += e.input;
  t.output += e.output;
  t.cacheCreate += e.cacheCreate;
  t.cacheRead += e.cacheRead;
  t.total += e.input + e.output + e.cacheCreate;
  t.messages++;
}

async function claudeUsage() {
  const root = join(homedir(), '.claude', 'projects');
  if (!existsSync(root)) return { detected: false as const };
  const now = Date.now();
  const files = await walk(root, now - 8 * 24 * HOUR);
  const seen = new Set<string>();
  const events: ClaudeEvent[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = await readFile(f, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (!line.includes('"usage"')) continue;
      try {
        const j = JSON.parse(line);
        const u = j?.message?.usage;
        if (!u || !j.timestamp || j.message.model === '<synthetic>') continue;
        const key = `${j.message.id}:${j.requestId ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({
          at: Date.parse(j.timestamp),
          model: j.message.model ?? 'desconhecido',
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheCreate: u.cache_creation_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
        });
      } catch {
        /* linha truncada */
      }
    }
  }
  events.sort((a, b) => a.at - b.at);

  // Bloco de 5h no estilo do ccusage: começa na hora cheia da 1ª mensagem
  // e dura 5h; a próxima mensagem depois disso abre um novo bloco.
  let blockStart = 0;
  let blockEnd = 0;
  for (const e of events) {
    if (e.at >= blockEnd) {
      const d = new Date(e.at);
      d.setMinutes(0, 0, 0);
      blockStart = d.getTime();
      blockEnd = blockStart + 5 * HOUR;
    }
  }
  const blockActive = now < blockEnd;
  const block = zero();
  const day = zero();
  const week = zero();
  const byModel: Record<string, number> = {};
  for (const e of events) {
    if (blockActive && e.at >= blockStart) add(block, e);
    if (e.at >= now - 24 * HOUR) add(day, e);
    if (e.at >= now - 7 * 24 * HOUR) {
      add(week, e);
      byModel[e.model] = (byModel[e.model] ?? 0) + e.input + e.output + e.cacheCreate;
    }
  }
  return {
    detected: true as const,
    windows: {
      '5h': { ...block, resetsAt: blockActive ? blockEnd : null, startedAt: blockActive ? blockStart : null },
      daily: day,
      weekly: week,
    },
    byModel,
    files: files.length,
  };
}

interface RateWindow {
  used_percent?: number;
  window_minutes?: number;
  resets_in_seconds?: number;
  resets_at?: number;
}

async function codexUsage() {
  const root = join(homedir(), '.codex', 'sessions');
  if (!existsSync(join(homedir(), '.codex'))) return { detected: false as const };
  const files = await walk(root, Date.now() - 8 * 24 * HOUR);
  const withTime = await Promise.all(files.map(async (f) => ({ f, m: (await stat(f)).mtimeMs })));
  withTime.sort((a, b) => b.m - a.m);
  for (const { f, m } of withTime.slice(0, 10)) {
    const lines = (await readFile(f, 'utf8')).split('\n').reverse();
    for (const line of lines) {
      if (!line.includes('rate_limits')) continue;
      try {
        const j = JSON.parse(line);
        const rl = j?.payload?.rate_limits ?? j?.rate_limits ?? j?.payload?.info?.rate_limits;
        if (!rl) continue;
        const toWin = (w?: RateWindow) =>
          w && {
            usedPercent: w.used_percent ?? null,
            windowMinutes: w.window_minutes ?? null,
            resetsAt: w.resets_at ? w.resets_at * 1000 : w.resets_in_seconds ? m + w.resets_in_seconds * 1000 : null,
          };
        return { detected: true as const, primary: toWin(rl.primary), secondary: toWin(rl.secondary), seenAt: m };
      } catch {
        /* segue procurando */
      }
    }
  }
  return { detected: true as const, primary: null, secondary: null };
}

let cache: { at: number; data: unknown } | null = null;

export async function readUsage(env: Record<string, string>) {
  if (cache && Date.now() - cache.at < 20_000) return cache.data;
  const [claude, codex] = await Promise.all([claudeUsage(), codexUsage()]);
  const data = {
    claude,
    codex,
    gemini: { detected: existsSync(join(homedir(), '.gemini')) },
    apiKeys: {
      claude: Boolean(env.ANTHROPIC_API_KEY),
      codex: Boolean(env.OPENAI_API_KEY),
      gemini: Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
      openrouter: Boolean(env.OPENROUTER_API_KEY),
    },
    at: Date.now(),
  };
  cache = { at: Date.now(), data };
  return data;
}
