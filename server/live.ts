/**
 * "Ao vivo": observa o que o Claude Code está fazendo AGORA nos seus projetos, lendo os logs locais
 * (~/.claude/projects/<projeto>/<sessão>.jsonl e <sessão>/subagents/agent-*.jsonl). Só leitura, nada sai da máquina.
 * Sessões lançadas pelo próprio Arena (pasta ~/.agent-arena) ficam de fora: essas já aparecem como tarefas.
 */
import { existsSync } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

export type LiveKind = 'edit' | 'bash' | 'test' | 'read' | 'agent' | 'web' | 'think' | 'say' | 'user' | 'other';

export interface LiveAction {
  at: number;
  tool: string;
  kind: LiveKind;
  text: string;
}

export interface LiveWorker {
  id: string;
  /** 'main' = a conversa principal; senão o tipo do subagente (Explore, Plan, ...) */
  name: string;
  title: string;
  state: 'working' | 'idle';
  /** ação em andamento (tool_use ainda sem resultado) */
  now?: LiveAction;
  recent: LiveAction[];
  said?: string;
  lastAt: number;
  model?: string;
}

export interface LiveSession {
  id: string;
  project: string;
  dir: string;
  title: string;
  state: 'working' | 'idle';
  lastAt: number;
  prompt?: string;
  main: LiveWorker;
  subagents: LiveWorker[];
}

const ROOT = join(homedir(), '.claude', 'projects');
const WORKING_MS = 30_000;
const KEEP_MS = 20 * 60_000;
/** ferramenta em execução (comando longo, subagente): conta como trabalhando até este tempo sem escrever no log */
const TOOL_MS = 20 * 60_000;
/** depois de um resultado/pedido o modelo está pensando: o log só é escrito quando ele termina de responder */
const THINK_MS = 4 * 60_000;
const TAIL = 160 * 1024;
const FULL_TAIL = 4 * 1024 * 1024;
const FULL_KEEP = 400;

const clip = (s: string, n = 110) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

async function tail(path: string, bytes = TAIL): Promise<string> {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, size - len);
    const text = buf.toString('utf8');
    // se cortou no meio, descarta a primeira linha (incompleta)
    return size > len ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    await fh.close();
  }
}

function describe(tool: string, input: any): { kind: LiveKind; text: string } {
  const file = (p?: string) => (p ? basename(String(p).replace(/\\/g, '/')) : '');
  switch (tool) {
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { kind: 'edit', text: `Editando ${file(input?.file_path ?? input?.notebook_path)}` };
    case 'Write':
      return { kind: 'edit', text: `Escrevendo ${file(input?.file_path)}` };
    case 'Read':
      return { kind: 'read', text: `Lendo ${file(input?.file_path)}` };
    case 'Grep':
    case 'Glob':
      return { kind: 'read', text: `Buscando ${clip(String(input?.pattern ?? ''), 60)}` };
    case 'Bash':
    case 'PowerShell': {
      const cmd = String(input?.command ?? '');
      const test = /\b(test|jest|vitest|pytest|mocha|cypress|playwright|tsc|lint|eslint|build)\b/i.test(cmd);
      return { kind: test ? 'test' : 'bash', text: `${test ? 'Testando' : 'Rodando'}: ${clip(input?.description || cmd, 90)}` };
    }
    case 'Agent':
    case 'Task':
      return { kind: 'agent', text: `Chamando ${input?.subagent_type ?? 'subagente'}: ${clip(String(input?.description ?? ''), 70)}` };
    case 'WebSearch':
    case 'WebFetch':
      return { kind: 'web', text: `Na web: ${clip(String(input?.query ?? input?.url ?? ''), 80)}` };
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return { kind: 'think', text: 'Planejando as etapas' };
    default:
      return { kind: 'other', text: tool.startsWith('mcp__') ? `Ferramenta ${tool.split('__').slice(-1)[0]}` : tool };
  }
}

interface Parsed {
  cwd?: string;
  title?: string;
  prompt?: string;
  model?: string;
  actions: LiveAction[];
  pending?: LiveAction;
  said?: string;
  /** o que foi escrito por último no log */
  last?: 'prompt' | 'tool_result' | 'tool_use' | 'text' | 'end';
}

function parse(text: string): Parsed {
  const out: Parsed = { actions: [] };
  const inFlight = new Map<string, LiveAction>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    let j: any;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (j.cwd) out.cwd = j.cwd;
    if (j.type === 'ai-title' && j.aiTitle) out.title = j.aiTitle;
    if (j.type === 'custom-title' && j.customTitle && !out.title) out.title = j.customTitle;
    if (j.type === 'last-prompt' && j.lastPrompt) out.prompt = j.lastPrompt;
    const at = j.timestamp ? Date.parse(j.timestamp) : 0;
    const content = j.message?.content;
    if (j.type === 'user' && typeof content === 'string' && !j.isMeta) {
      if (!out.prompt) out.prompt = content;
      if (!content.startsWith('<')) out.actions.push({ at, tool: 'user', kind: 'user', text: clip(content, 200) });
      if (!content.startsWith('<')) out.last = 'prompt';
    }
    if (j.type === 'assistant' && Array.isArray(content)) {
      if (j.message?.model && j.message.model !== '<synthetic>') out.model = j.message.model;
      for (const b of content) {
        if (b.type === 'tool_use') {
          const a: LiveAction = { at, tool: b.name, ...describe(b.name, b.input) };
          out.actions.push(a);
          inFlight.set(b.id, a);
          out.last = 'tool_use';
        } else if (b.type === 'text' && b.text?.trim()) {
          out.said = clip(b.text, 200);
          out.actions.push({ at, tool: 'text', kind: 'say', text: out.said });
          out.last = 'text';
        }
      }
      if (j.message?.stop_reason === 'end_turn') out.last = 'end';
    }
    if (j.type === 'user' && Array.isArray(content)) {
      for (const b of content) if (b.type === 'tool_result') (inFlight.delete(b.tool_use_id), (out.last = 'tool_result'));
    }
  }
  // a última ação sem resultado é a que está acontecendo agora
  const pend = [...inFlight.values()].sort((a, b) => b.at - a.at)[0];
  out.pending = pend;
  return out;
}

async function worker(path: string, id: string, name: string, fallbackTitle: string, mtime: number, now: number, full = false): Promise<LiveWorker & { cwd?: string; prompt?: string; sessionTitle?: string }> {
  const p = parse(await tail(path, full ? FULL_TAIL : TAIL));
  const age = now - mtime;
  // trabalhando = escreveu há pouco, OU tem ferramenta rodando sem resultado (comando longo/subagente), OU o modelo está pensando depois de um resultado
  const running = !!p.pending && age < TOOL_MS;
  const thinking = !p.pending && (p.last === 'tool_result' || p.last === 'prompt') && age < THINK_MS;
  const working = age < WORKING_MS || running || thinking;
  const nowAct: LiveAction | undefined = p.pending ?? (working && p.last !== 'end' ? { at: mtime, tool: 'thinking', kind: 'think', text: 'Pensando no próximo passo…' } : undefined);
  return {
    id,
    name,
    title: fallbackTitle,
    state: working ? 'working' : 'idle',
    now: working ? nowAct : undefined,
    recent: p.actions.slice(full ? -FULL_KEEP : -8).reverse(),
    said: p.said,
    lastAt: mtime,
    model: p.model,
    cwd: p.cwd,
    prompt: p.prompt,
    sessionTitle: p.title,
  };
}

async function mtimeOf(p: string) {
  try {
    return (await stat(p)).mtimeMs;
  } catch {
    return 0;
  }
}

/** `full` = id da sessão que está espelhada na arena: devolve o histórico longo só dela */
export async function readLive(full?: string): Promise<{ sessions: LiveSession[]; at: number }> {
  const now = Date.now();
  if (!existsSync(ROOT)) return { sessions: [], at: now };
  const sessions: LiveSession[] = [];
  const projects = await readdir(ROOT, { withFileTypes: true }).catch(() => []);
  for (const pr of projects) {
    if (!pr.isDirectory()) continue;
    const pdir = join(ROOT, pr.name);
    const entries = await readdir(pdir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
      const file = join(pdir, e.name);
      const mt = await mtimeOf(file);
      const sid = e.name.slice(0, -6);
      // subagentes podem estar trabalhando mesmo com a conversa principal parada
      const subDir = join(pdir, sid, 'subagents');
      const subFiles = existsSync(subDir) ? (await readdir(subDir).catch(() => [])).filter((n) => n.endsWith('.jsonl')) : [];
      const subs: LiveWorker[] = [];
      let newest = mt;
      for (const sf of subFiles) {
        const smt = await mtimeOf(join(subDir, sf));
        if (now - smt > KEEP_MS) continue;
        newest = Math.max(newest, smt);
        let name = 'subagente';
        let title = '';
        try {
          const meta = JSON.parse(await readFile(join(subDir, sf.replace(/\.jsonl$/, '.meta.json')), 'utf8'));
          name = meta.agentType ?? name;
          title = meta.description ?? '';
        } catch {
          /* sem meta */
        }
        const w = await worker(join(subDir, sf), sf.replace(/\.jsonl$/, ''), name, title, smt, now, sid === full);
        subs.push(w);
      }
      if (now - newest > KEEP_MS) continue;
      const main = await worker(file, sid, 'main', '', mt, now, sid === full);
      const dir = main.cwd ?? '';
      if (dir.includes('.agent-arena')) continue;
      const state: LiveSession['state'] = main.state === 'working' || subs.some((w) => w.state === 'working') ? 'working' : 'idle';
      subs.sort((a, b) => b.lastAt - a.lastAt);
      sessions.push({
        id: sid,
        project: dir ? basename(dir) : pr.name,
        dir,
        title: main.sessionTitle ?? main.prompt?.slice(0, 80) ?? 'Conversa',
        state,
        lastAt: newest,
        prompt: main.prompt ? clip(main.prompt, 160) : undefined,
        main: { ...main, title: main.sessionTitle ?? '' },
        subagents: subs,
      });
    }
  }
  sessions.sort((a, b) => (a.state === b.state ? b.lastAt - a.lastAt : a.state === 'working' ? -1 : 1));
  return { sessions, at: now };
}
