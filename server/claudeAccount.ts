/**
 * Conta do Claude Code, direto da CLI (nada estimado):
 *  - `claude auth status`  → logado? e-mail, método (assinatura ou API), plano
 *  - `claude -p /usage`    → % usado da sessão de 5h e da semana, e quando reseta (não gasta tokens)
 * O resultado é guardado por 45s para não rodar a CLI a cada abertura de tela.
 */
import { execFile } from 'node:child_process';
import { winCmd } from './winbin';

export interface UsageWindow {
  label: string;
  pct: number;
  resets?: string;
}

export interface ClaudeAccount {
  loggedIn: boolean;
  email?: string;
  authMethod?: string;
  plan?: string;
  org?: string;
  windows: UsageWindow[];
  error?: string;
  at: number;
}

const run = (bin0: string, args0: string[], timeout: number) =>
  new Promise<string>((resolve, reject) => {
    const { bin, args } = winCmd(bin0, args0);
    execFile(bin, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, out, errOut) => (err && !out ? reject(new Error(errOut || err.message)) : resolve(out))).stdin?.end();
  });

let cache: { at: number; value: ClaudeAccount } | null = null;
let inflight: Promise<ClaudeAccount> | null = null;

/** "Current session: 11% used · resets Oct 16 at 7:29pm (America/Fortaleza)" → linhas estruturadas */
export function parseUsage(text: string): UsageWindow[] {
  const out: UsageWindow[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(Current [^:]+):\s*(\d+(?:\.\d+)?)%\s*used(?:\s*·\s*resets\s*(.+?))?\s*$/i);
    if (m) out.push({ label: m[1], pct: Number(m[2]) / 100, resets: m[3] });
  }
  return out;
}

async function load(bin: string): Promise<ClaudeAccount> {
  const account: ClaudeAccount = { loggedIn: false, windows: [], at: Date.now() };
  try {
    const auth = JSON.parse(await run(bin, ['auth', 'status'], 15_000));
    account.loggedIn = !!auth.loggedIn;
    account.email = auth.email;
    account.authMethod = auth.authMethod;
    account.plan = auth.subscriptionType;
    account.org = auth.orgName;
  } catch (e) {
    account.error = e instanceof Error ? e.message.slice(0, 200) : String(e);
    return account;
  }
  if (account.loggedIn) {
    try {
      const out = JSON.parse(await run(bin, ['-p', '/usage', '--output-format', 'json', '--setting-sources', 'project', '--no-session-persistence'], 30_000));
      account.windows = parseUsage(String(out.result ?? ''));
    } catch (e) {
      account.error = `Não consegui ler o /usage: ${e instanceof Error ? e.message.slice(0, 160) : e}`;
    }
  }
  return account;
}

export async function claudeAccount(bin: string, force = false): Promise<ClaudeAccount> {
  if (!force && cache && Date.now() - cache.at < 45_000) return cache.value;
  inflight ??= load(bin).finally(() => (inflight = null));
  const value = await inflight;
  cache = { at: Date.now(), value };
  return value;
}
