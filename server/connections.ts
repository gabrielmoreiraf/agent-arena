/**
 * Conexões com as contas de IA: cada provedor é opcional (conectar / desconectar) e mostra qual conta está logada.
 *
 *  - Claude Code  : `claude auth login` (abre o navegador) · `claude auth status`
 *  - Codex CLI    : `codex login` (abre o navegador)      · `codex login status`
 *  - Gemini CLI   : login com Google acontece no terminal interativo do próprio gemini; ou chave de API
 *  - OpenRouter   : OAuth no navegador (PKCE) ou colar a chave
 *
 * O login roda como um "terminal" dentro do app: a saída do comando aparece na tela, links detectados viram
 * botões e dá para mandar texto de volta (ex.: colar um código). Credenciais próprias do Arena (chaves) ficam em
 * ~/.agent-arena/credentials.json com permissão 0600 e NUNCA são devolvidas ao navegador.
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeAccount } from './claudeAccount';

export type ProviderKey = 'claude' | 'codex' | 'gemini' | 'openrouter';

export interface ConnectionStatus {
  id: ProviderKey;
  /** a CLI existe na máquina (OpenRouter não precisa de CLI) */
  installed: boolean;
  version?: string;
  connected: boolean;
  /** quem está logado: e-mail ou rótulo da chave */
  account?: string;
  plan?: string;
  detail?: string;
  /** como instalar quando a CLI não existe */
  installHint?: string;
  /** formas de conectar disponíveis */
  methods: ('browser' | 'terminal' | 'key')[];
  error?: string;
}

const HOME = homedir();
const DATA = join(HOME, '.agent-arena');
const CRED_FILE = join(DATA, 'credentials.json');

const BIN: Record<Exclude<ProviderKey, 'openrouter'>, string> = { claude: 'claude', codex: 'codex', gemini: 'gemini' };
const INSTALL: Record<ProviderKey, string> = {
  claude: 'npm install -g @anthropic-ai/claude-code',
  codex: 'npm install -g @openai/codex',
  gemini: 'npm install -g @google/gemini-cli',
  openrouter: '',
};

// ---------- credenciais locais do Arena ----------

interface Credentials {
  openrouter?: { key: string; label?: string };
  gemini?: { apiKey: string };
}

async function readCreds(): Promise<Credentials> {
  try {
    return JSON.parse(await readFile(CRED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeCreds(c: Credentials) {
  await mkdir(DATA, { recursive: true, mode: 0o700 });
  await writeFile(CRED_FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
  await chmod(CRED_FILE, 0o600).catch(() => undefined);
}

/** chave guardada para um provedor (só o servidor lê; usada para montar o ambiente do agente) */
export async function storedKey(id: ProviderKey): Promise<string | undefined> {
  const c = await readCreds();
  return id === 'openrouter' ? c.openrouter?.key : id === 'gemini' ? c.gemini?.apiKey : undefined;
}

// ---------- utilidades ----------

const run = (bin: string, args: string[], timeout = 15_000) =>
  new Promise<{ ok: boolean; out: string }>((resolve) => {
    const child = execFile(bin, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, out, errOut) => resolve({ ok: !err, out: `${out ?? ''}${errOut ?? ''}`.trim() }));
    child.stdin?.end();
  });

async function version(bin: string) {
  const r = await run(bin, ['--version'], 8_000);
  return r.ok ? r.out.split('\n')[0].slice(0, 60) : undefined;
}

const jwtEmail = (jwt?: string) => {
  try {
    return JSON.parse(Buffer.from(String(jwt).split('.')[1], 'base64url').toString('utf8')).email as string | undefined;
  } catch {
    return undefined;
  }
};

// ---------- status de cada provedor ----------

async function claudeStatus(bin: string): Promise<ConnectionStatus> {
  const v = await version(bin);
  const base: ConnectionStatus = { id: 'claude', installed: !!v, version: v, connected: false, installHint: INSTALL.claude, methods: ['browser'] };
  if (!v) return base;
  const a = await claudeAccount(bin);
  return {
    ...base,
    connected: a.loggedIn,
    account: a.email,
    plan: a.plan ? `${a.plan}${a.authMethod === 'claude.ai' ? ' (assinatura)' : a.authMethod === 'api_key' ? ' (chave de API)' : ''}` : undefined,
    error: a.error,
  };
}

async function codexStatus(): Promise<ConnectionStatus> {
  const v = await version(BIN.codex);
  const base: ConnectionStatus = { id: 'codex', installed: !!v, version: v, connected: false, installHint: INSTALL.codex, methods: ['browser'] };
  if (!v) return base;
  const st = await run(BIN.codex, ['login', 'status']);
  const connected = st.ok && /logged in/i.test(st.out);
  let account: string | undefined;
  try {
    const auth = JSON.parse(readFileSync(join(HOME, '.codex', 'auth.json'), 'utf8'));
    account = jwtEmail(auth?.tokens?.id_token);
  } catch {
    /* sem auth.json */
  }
  return { ...base, connected, account, detail: connected ? st.out.split('\n')[0] : undefined };
}

async function geminiStatus(): Promise<ConnectionStatus> {
  const v = await version(BIN.gemini);
  const base: ConnectionStatus = { id: 'gemini', installed: !!v, version: v, connected: false, installHint: INSTALL.gemini, methods: ['terminal', 'key'] };
  if (!v) return base;
  const creds = await readCreds();
  // o Gemini CLI declara como está autenticado em ~/.gemini/settings.json (security.auth.selectedType)
  let selected: string | undefined;
  try {
    selected = JSON.parse(readFileSync(join(HOME, '.gemini', 'settings.json'), 'utf8'))?.security?.auth?.selectedType;
  } catch {
    /* sem settings */
  }
  let google: string | undefined;
  try {
    google = JSON.parse(readFileSync(join(HOME, '.gemini', 'google_accounts.json'), 'utf8')).active ?? undefined;
  } catch {
    /* sem login Google */
  }
  const envKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (creds.gemini?.apiKey) return { ...base, connected: true, account: 'chave de API', detail: 'chave guardada no Agent Arena' };
  if (selected === 'gemini-api-key' || envKey) return { ...base, connected: true, account: 'chave de API do Gemini', detail: 'configurada no Gemini CLI' };
  if (selected === 'vertex-ai') return { ...base, connected: true, account: 'Vertex AI', detail: 'configurado no Gemini CLI' };
  if (google || (selected === 'oauth-personal' && existsSync(join(HOME, '.gemini', 'oauth_creds.json')))) {
    return { ...base, connected: true, account: google ?? 'conta Google', detail: 'login com Google' };
  }
  return base;
}

async function openrouterStatus(): Promise<ConnectionStatus> {
  const base: ConnectionStatus = { id: 'openrouter', installed: true, connected: false, methods: ['browser', 'key'] };
  const key = (await readCreds()).openrouter?.key;
  if (!key) return base;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return { ...base, error: r.status === 401 ? 'A chave guardada foi recusada pelo OpenRouter.' : `OpenRouter respondeu ${r.status}` };
    const d = (await r.json()).data ?? {};
    const left = d.limit_remaining != null ? ` · saldo ${Number(d.limit_remaining).toFixed(2)} USD` : '';
    return { ...base, connected: true, account: d.label ?? 'chave de API', detail: `uso ${Number(d.usage ?? 0).toFixed(2)} USD${left}` };
  } catch (e) {
    return { ...base, connected: true, account: 'chave de API', error: `Não consegui consultar o OpenRouter: ${e instanceof Error ? e.message : e}` };
  }
}

export async function allStatus(claudeBin: string): Promise<ConnectionStatus[]> {
  return Promise.all([claudeStatus(claudeBin), codexStatus(), geminiStatus(), openrouterStatus()]);
}

// ---------- chaves coladas pelo usuário ----------

export async function saveKey(id: ProviderKey, key: string) {
  const k = key.trim();
  if (k.length < 12 || /\s/.test(k)) throw new Error('Essa chave não parece válida.');
  const c = await readCreds();
  if (id === 'openrouter') {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (r && r.status === 401) throw new Error('O OpenRouter recusou essa chave.');
    c.openrouter = { key: k };
  } else if (id === 'gemini') c.gemini = { apiKey: k };
  else throw new Error('Esse provedor não usa chave colada.');
  await writeCreds(c);
}

/** desconectar: remove o que o Arena guardou e/ou desloga a CLI */
export async function disconnect(id: ProviderKey, claudeBin: string) {
  const c = await readCreds();
  if (id === 'openrouter') {
    delete c.openrouter;
    await writeCreds(c);
    return 'Chave do OpenRouter removida do Agent Arena.';
  }
  if (id === 'gemini') {
    delete c.gemini;
    await writeCreds(c);
    return 'Chave do Gemini removida. Se você entrou com Google, saia dentro do gemini (comando /auth).';
  }
  if (id === 'claude') {
    const r = await run(claudeBin, ['auth', 'logout'], 20_000);
    await claudeAccount(claudeBin, true);
    if (!r.ok) throw new Error(r.out || 'Falha ao sair do Claude Code.');
    return 'Claude Code desconectado (vale para todo o seu computador).';
  }
  const r = await run(BIN.codex, ['logout'], 20_000);
  if (!r.ok) throw new Error(r.out || 'Falha ao sair do Codex.');
  return 'Codex desconectado.';
}

// ---------- terminal de login ----------

export interface LoginSession {
  id: string;
  provider: ProviderKey;
  title: string;
  lines: { t: number; kind: 'out' | 'err' | 'in' | 'info'; text: string }[];
  links: string[];
  running: boolean;
  exitCode: number | null;
  startedAt: number;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;
const sessions = new Map<string, LoginSession & { child?: ChildProcess }>();

/** abre uma URL no navegador padrão (só as que apareceram na saída do login, ou o OAuth do OpenRouter) */
export function openUrl(url: string) {
  if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error('Endereço não permitido.');
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(cmd, args, () => undefined);
}

function push(s: LoginSession, kind: LoginSession['lines'][number]['kind'], text: string) {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trimEnd();
    if (!line.trim()) continue;
    s.lines.push({ t: Date.now(), kind, text: line });
    for (const u of line.match(URL_RE) ?? []) if (!s.links.includes(u)) s.links.push(u);
  }
  if (s.lines.length > 400) s.lines.splice(0, s.lines.length - 400);
}

/** abre o Terminal do macOS rodando um comando (para logins que só existem de forma interativa, como o do Gemini) */
export function openInTerminal(command: string) {
  if (process.platform !== 'darwin') throw new Error('Abra um terminal e rode o comando manualmente.');
  const esc = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  execFile('osascript', ['-e', `tell application "Terminal" to activate`, '-e', `tell application "Terminal" to do script "${esc}"`], () => undefined);
}

export function startLogin(id: ProviderKey, claudeBin: string, method?: string): LoginSession {
  for (const s of sessions.values()) if (s.running && s.provider === id) return s; // uma por provedor
  let bin: string;
  let args: string[];
  let title: string;
  if (id === 'claude') {
    bin = claudeBin;
    args = ['auth', 'login', method === 'console' ? '--console' : '--claudeai'];
    title = 'Login do Claude Code';
  } else if (id === 'codex') {
    bin = BIN.codex;
    args = ['login'];
    title = 'Login do Codex';
  } else throw new Error('Esse provedor não tem login por comando.');

  const s: LoginSession & { child?: ChildProcess } = {
    id: `login_${Date.now().toString(36)}`,
    provider: id,
    title,
    lines: [],
    links: [],
    running: true,
    exitCode: null,
    startedAt: Date.now(),
  };
  sessions.set(s.id, s);
  push(s, 'info', `$ ${bin} ${args.join(' ')}`);
  push(s, 'info', 'O navegador deve abrir para você autorizar. Se não abrir, use o botão com o link abaixo.');
  const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, BROWSER: process.env.BROWSER } });
  s.child = child;
  child.stdout.on('data', (d) => push(s, 'out', d.toString()));
  child.stderr.on('data', (d) => push(s, 'err', d.toString()));
  child.on('error', (e) => {
    push(s, 'err', `Não consegui rodar "${bin}": ${e.message}`);
    s.running = false;
    s.exitCode = -1;
  });
  child.on('close', (code) => {
    s.running = false;
    s.exitCode = code;
    push(s, 'info', code === 0 ? '✔ Concluído.' : `✖ Terminou com código ${code}.`);
    if (id === 'claude') void claudeAccount(claudeBin, true);
  });
  // login que não termina em 10 min é abandonado
  setTimeout(() => s.running && s.child?.kill('SIGTERM'), 10 * 60_000).unref();
  return s;
}

export function getSession(id: string) {
  const s = sessions.get(id);
  if (!s) return null;
  const { child: _c, ...pub } = s;
  return pub;
}

export function sendInput(id: string, text: string) {
  const s = sessions.get(id);
  if (!s?.running || !s.child?.stdin?.writable) throw new Error('A sessão não está mais ativa.');
  push(s, 'in', '> (enviado)');
  s.child.stdin.write(`${text}\n`);
}

export function cancelSession(id: string) {
  const s = sessions.get(id);
  if (s?.running) s.child?.kill('SIGTERM');
}

// ---------- OpenRouter: OAuth no navegador (PKCE) ----------

const pending = new Map<string, { verifier: string; at: number }>();

export function openrouterAuthUrl(origin: string) {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(8).toString('hex');
  pending.set(state, { verifier, at: Date.now() });
  const callback = `${origin}/api/auth/openrouter/callback?state=${state}`;
  return `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${challenge}&code_challenge_method=S256`;
}

export async function openrouterCallback(state: string, code: string) {
  const p = pending.get(state);
  pending.delete(state);
  if (!p || Date.now() - p.at > 15 * 60_000) throw new Error('Pedido de login expirado. Tente conectar de novo.');
  const r = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: p.verifier, code_challenge_method: 'S256' }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await r.json().catch(() => ({}))) as { key?: string; error?: { message?: string } };
  if (!r.ok || !data.key) throw new Error(data.error?.message ?? `OpenRouter respondeu ${r.status}`);
  const c = await readCreds();
  c.openrouter = { key: data.key };
  await writeCreds(c);
}

export const dataDirExists = () => existsSync(DATA) && statSync(DATA).isDirectory();
