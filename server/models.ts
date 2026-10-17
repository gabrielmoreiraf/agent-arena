/**
 * Modelos que realmente existem para cada provedor (nada fixo no código):
 *  - OpenRouter : API pública /api/v1/models
 *  - Gemini     : API de modelos do Google (se houver chave) ou os ids embutidos na Gemini CLI instalada
 *  - Claude     : aliases do Claude Code (sempre o mais novo) + ids vistos nos seus logs de uso
 *  - Codex      : cache da própria CLI, se existir; senão uma lista de referência
 * O resultado fica em cache por 10 minutos.
 */
import { execFile } from 'node:child_process';
import { winCmd } from './winbin';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { storedKey } from './connections';

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ModelList {
  provider: string;
  models: ModelInfo[];
  /** de onde veio a lista */
  source: 'api' | 'cli' | 'logs' | 'referência';
  note?: string;
}

const cache = new Map<string, { at: number; value: ModelList }>();
const TTL = 10 * 60_000;

const CLAUDE_ALIASES: ModelInfo[] = [
  { id: 'haiku', label: 'Haiku (alias: o mais novo)' },
  { id: 'sonnet', label: 'Sonnet (alias: o mais novo)' },
  { id: 'opus', label: 'Opus (alias: o mais novo)' },
  { id: 'fable', label: 'Fable (alias: o mais novo)' },
];

const niceClaude = (id: string) => id.replace(/^claude-/, '').replace(/-(\d)-(\d)$/, ' $1.$2').replace(/-/g, ' ');

async function openrouter(): Promise<ModelList> {
  const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`OpenRouter respondeu ${r.status}`);
  const data = ((await r.json()) as { data: { id: string; name?: string }[] }).data ?? [];
  const models = data
    .filter((m) => !m.id.includes(':batch'))
    .map((m) => ({ id: m.id, label: m.name ?? m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { provider: 'openrouter', models, source: 'api' };
}

const run = (cmd0: string, args0: string[]) =>
  new Promise<string>((res) => {
    const { bin: cmd, args } = winCmd(cmd0, args0);
    const c = execFile(cmd, args, { timeout: 8_000 }, (_e, out) => res(String(out ?? '').trim()));
    c.stdin?.end();
  });

/** ids de chat do Gemini: gemini-2.5-pro, gemini-3-flash-preview, ... (sem imagem, áudio, embedding etc.) */
const GEMINI_CHAT = /^gemini-\d+(\.\d+)?-(pro|flash|flash-lite)(-preview(-\d+)?)?$/;

async function gemini(): Promise<ModelList> {
  const key = (await storedKey('gemini')) ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (key) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(12_000) });
      if (r.ok) {
        const d = (await r.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
        const models = (d.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }))
          .filter((m) => GEMINI_CHAT.test(m.id))
          .sort((a, b) => a.id.localeCompare(b.id));
        if (models.length) return { provider: 'gemini', models, source: 'api' };
      }
    } catch {
      /* cai para a CLI */
    }
  }
  // ids embutidos na Gemini CLI instalada
  const bin = await run('/bin/sh', ['-c', 'command -v gemini']);
  if (bin) {
    try {
      const real = realpathSync(bin);
      const dir = existsSync(join(dirname(real), 'gemini.js')) ? dirname(real) : join(dirname(dirname(real)), 'bundle');
      const found = new Set<string>();
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
        const text = readFileSync(join(dir, f), 'utf8');
        for (const m of text.match(/gemini-\d+(?:\.\d+)?-(?:pro|flash-lite|flash)(?:-preview(?:-\d+)?)?(?![\w.-])/g) ?? []) found.add(m);
      }
      const models = [...found].filter((id) => GEMINI_CHAT.test(id)).sort().map((id) => ({ id, label: id }));
      if (models.length) return { provider: 'gemini', models, source: 'cli', note: 'Ids encontrados na Gemini CLI instalada. Com uma chave de API a lista vem direto do Google.' };
    } catch {
      /* sem acesso à CLI */
    }
  }
  return { provider: 'gemini', models: [], source: 'referência', note: 'Não consegui listar: digite o id do modelo.' };
}

function claude(seen: string[]): ModelList {
  const real = seen.filter((id) => /^claude-/.test(id)).map((id) => ({ id, label: niceClaude(id) }));
  return { provider: 'claude', models: [...CLAUDE_ALIASES, ...real], source: 'logs', note: 'Aliases acompanham o modelo mais novo; os ids vêm dos seus logs de uso.' };
}

function codex(): ModelList {
  const file = join(homedir(), '.codex', 'models_cache.json');
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'));
    const arr: { slug?: string; id?: string; display_name?: string }[] = d.models ?? d;
    const models = arr
      .map((m) => ({ id: String(m.slug ?? m.id), label: m.display_name ?? String(m.slug ?? m.id) }))
      .filter((m) => m.id && m.id !== 'undefined' && !/reserve|auto-review/.test(m.id));
    if (models.length) return { provider: 'codex', models, source: 'cli' };
  } catch {
    /* sem cache */
  }
  return {
    provider: 'codex',
    models: [
      { id: 'gpt-5-codex', label: 'GPT-5 Codex' },
      { id: 'gpt-5-codex-mini', label: 'GPT-5 Codex Mini' },
      { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
    ],
    source: 'referência',
    note: 'A Codex CLI não informou os modelos: lista de referência. Digite o id exato se precisar.',
  };
}

export async function listModels(provider: string, claudeSeen: string[] = [], force = false): Promise<ModelList> {
  const hit = cache.get(provider);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value;
  let value: ModelList;
  if (provider === 'openrouter') value = await openrouter();
  else if (provider === 'gemini') value = await gemini();
  else if (provider === 'codex') value = codex();
  else value = claude(claudeSeen);
  cache.set(provider, { at: Date.now(), value });
  return value;
}
