import type { LiveKind, LiveSession, LiveWorker } from '../../server/live';
import { MONSTER_NAME, stanceFor, thread, workLine, type Turn } from '../data/quotes';
import type { Agent, Bubble, ChatMsg, FeedItem, FeedKind, GameState, Task, TaskType } from '../types';

/**
 * Modo ao vivo: transforma uma sessão real do Claude Code num GameState só para mostrar.
 *   Maestro  = você (o último pedido vira o balão)
 *   Claude   = a conversa principal
 *   demais   = cada subagente que o Claude chamou
 * Cada agente que está trabalhando enfrenta um monstro que representa a ação em andamento (arquivo, comando, busca...),
 * com o golpe da ferramenta usada. O registro de batalha vira o histórico completo da sessão.
 */
const MONSTER: Record<LiveKind, TaskType> = { edit: 'feature', bash: 'infra', test: 'test', read: 'bug', agent: 'refactor', web: 'database', think: 'feature', say: 'feature', user: 'feature', other: 'bug' };
const FX: Record<LiveKind, string> = { edit: 'feature', bash: 'infra', test: 'test', read: 'review', agent: 'refactor', web: 'database', think: 'feature', say: 'feature', user: 'feature', other: 'bug' };
/** ação maior, monstro maior */
const SIZE: Record<LiveKind, 1 | 2 | 3> = { agent: 3, edit: 2, test: 2, bash: 2, read: 1, web: 1, think: 1, say: 1, user: 1, other: 1 };
const FEED: Record<LiveKind, FeedKind> = { edit: 'work', bash: 'work', test: 'qa', read: 'work', agent: 'maestro', web: 'work', think: 'work', say: 'banter', user: 'maestro', other: 'work' };

/** quem cada subagente "é" na arena, pelo tipo/descrição */
function templateFor(name: string, i: number): string {
  const n = name.toLowerCase();
  if (/review|verif|check|audit|debug|qa|test/.test(n)) return 'qa';
  if (/plan|architect/.test(n)) return 'pleno';
  if (/explor|research|search|map/.test(n)) return 'junior';
  if (/design|ui|ux/.test(n)) return 'designer';
  if (/deploy|infra|ops/.test(n)) return 'devops';
  if (/db|data|sql/.test(n)) return 'dba';
  return ['senior', 'pleno', 'junior', 'devops', 'designer', 'dba'][i % 6];
}

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

export function mirrorState(base: GameState, s: LiveSession): GameState {
  const byId = new Map(base.agents.map((a) => [a.id, a]));
  const tpl = (id: string) => byId.get(id) ?? base.agents[0];
  const clone = (t: Agent, id: string, name: string, title: string): Agent => ({ ...t, id, name, title, xp: 0, queue: [], currentTaskId: undefined, builtin: false });

  const maestro = clone(tpl('maestro'), 'live-you', 'Você', 'Quem pediu');
  const workers: { w: LiveWorker; agent: Agent }[] = [
    { w: s.main, agent: clone(tpl('senior'), `live-${s.main.id}`, 'Claude', 'Conversa principal') },
    ...s.subagents.map((w, i) => ({ w, agent: clone(tpl(templateFor(`${w.name} ${w.title}`, i)), `live-${w.id}`, w.name === 'subagente' ? 'Subagente' : w.name, w.title || 'Subagente') })),
  ];

  const tasks: Task[] = [];
  const bubbles: Bubble[] = [];
  const now = Date.now();
  for (const { w, agent } of workers) {
    const act = w.state === 'working' ? (w.now ?? w.recent.find((a) => a.kind !== 'say' && a.kind !== 'user')) : undefined;
    if (!act) continue;
    const id = `live-t-${w.id}`;
    tasks.push({
      id,
      title: act.text,
      description: act.text,
      source: 'manual',
      type: MONSTER[act.kind],
      complexity: SIZE[act.kind],
      tier: 'medio',
      effort: 10,
      hp: 7,
      status: 'in_progress',
      assigneeId: agent.id,
      lane: ['edit', 'read', 'think', 'say'].includes(act.kind) ? 'top' : 'mid',
      laneT: 0,
      bounces: 0,
      createdAt: now - 60_000,
      assignedAt: now - 60_000,
      fx: FX[act.kind],
    });
    agent.currentTaskId = id;
    // alterna a cada 8s entre o que ele está fazendo de verdade e uma piada (estável dentro de cada janela, para o balão não piscar)
    const bucket = Math.floor(now / 8000);
    const say = bucket % 2 === 0 ? act.text : workLine(agent.role, `${agent.id}-${bucket}`);
    bubbles.push({ agentId: agent.id, text: say.length > 70 ? `${say.slice(0, 68)}…` : say, from: 0, until: now + 60_000 });
  }
  if (s.prompt) bubbles.push({ agentId: maestro.id, text: s.prompt.length > 70 ? `${s.prompt.slice(0, 68)}…` : s.prompt, from: 0, until: now + 60_000 });

  // histórico de tudo: ações de todos os agentes, do mais novo para o mais antigo
  const feed: FeedItem[] = workers
    .flatMap(({ w, agent }) => w.recent.map((a, i) => ({ id: `lf-${w.id}-${a.at}-${i}`, at: a.at || w.lastAt, kind: FEED[a.kind], agentId: a.kind === 'user' ? maestro.id : agent.id, text: a.kind === 'user' ? `Você: ${a.text}` : a.text })))
    .sort((a, b) => b.at - a.at);

  // papo: o que o Claude e os subagentes disseram de verdade + resenha entre eles, sorteada de forma estável (mesma semente = mesma conversa)
  const all = [maestro, ...workers.map((x) => x.agent)];
  const chat: ChatMsg[] = workers.flatMap(({ w, agent }) =>
    w.recent.filter((a) => a.kind === 'say' || a.kind === 'user').slice(0, 25).map((a, i) => ({ id: `lc-${w.id}-${a.at}-${i}`, at: a.at || w.lastAt, agentId: a.kind === 'user' ? maestro.id : agent.id, text: a.text })),
  );
  // uma conversa vira mensagens espaçadas de 2,7s, cada uma endereçada a quem falou antes
  const pushThread = (key: string, ids: string[], turns: Turn[], at0: number, monster?: string) =>
    turns.forEach((t, i) => {
      if (!ids[t.who]) return;
      chat.push({ id: `${key}-${i}`, at: at0 + i * 2700, agentId: ids[t.who], toId: i === 0 ? ids[1] : ids[turns[i - 1].who], monster, text: t.text });
    });
  if (all.length >= 2) {
    const STEP = 20_000;
    const end = Math.floor(Math.min(now, s.lastAt + 60_000) / STEP);
    for (let b = end; b > end - 18; b--) {
      const rnd = Math.abs(hash(`${s.id}-${b}`));
      if (rnd % 3 === 0) continue; // nem todo intervalo tem conversa
      const A = all[rnd % all.length];
      const B = all[(rnd >> 3) % all.length];
      if (A.id === B.id) continue;
      const task = tasks.find((t) => t.id === A.currentTaskId) ?? tasks.find((t) => t.id === B.currentTaskId);
      pushThread(`lt-${b}`, [A.id, B.id], thread(rnd % 2 === 0 ? 'farpa' : 'work', { a: A, b: B, type: task?.type }, `${A.id}-${b}`), b * STEP);
    }
  }
  // tudo que aparece no balão também vai para o papo: ações recentes e as piadas de cada janela de 8s
  for (const { w, agent } of workers) {
    w.recent.filter((a) => a.kind !== 'say' && a.kind !== 'user').slice(0, 12).forEach((a, i) => chat.push({ id: `la-${w.id}-${a.at}-${i}`, at: a.at || w.lastAt, agentId: agent.id, text: a.text }));
    if (w.state === 'working') {
      const cur = Math.floor(now / 8000);
      for (let b = cur; b > cur - 10; b--) if (b % 2 === 1) chat.push({ id: `lj-${w.id}-${b}`, at: b * 8000, agentId: agent.id, text: workLine(agent.role, `${agent.id}-${b}`) });
    }
  }
  // o monstro também conversa: provoca o agente, os dois trocam golpes de palavra (sorteio estável por janela de 8s)
  const curB = Math.floor(now / 8000);
  for (const t of tasks) {
    const ag = all.find((a) => a.currentTaskId === t.id);
    if (!ag) continue;
    for (let b = curB; b > curB - 14; b--) {
      if (Math.abs(hash(`${t.id}-${b}`)) % 3 !== 0) continue;
      const turns = thread('monster', { a: { name: MONSTER_NAME[t.type] ?? 'Monstro', role: 'custom', providerId: '' }, b: ag, type: t.type }, `${t.id}-${b}`);
      pushThread(`lm-${t.id}-${b}`, [`m:${t.id}`, ag.id], turns, b * 8000, t.type);
    }
  }
  // plateia: os outros agentes torcem, criticam ou cobram quem está na luta, e a conversa segue (sorteio estável por janela de 8s)
  for (const t of tasks) {
    const worker = all.find((a) => a.currentTaskId === t.id);
    if (!worker) continue;
    for (let b = curB; b > curB - 14; b--) {
      const h = Math.abs(hash(`${t.id}-crowd-${b}`));
      if (h % 4 !== 1) continue;
      const crowd = all.filter((a) => a.id !== worker.id);
      if (!crowd.length) continue;
      const first = crowd[h % crowd.length];
      const second = crowd.filter((a) => a.id !== first.id)[(h >> 3) % Math.max(1, crowd.length - 1)];
      const st = stanceFor(first.role, () => ((h >> 4) % 100) / 100);
      const turns = thread(st, { a: first, b: worker, c: second, type: t.type }, `${t.id}-${b}`);
      pushThread(`lc-${t.id}-${b}`, [first.id, worker.id, second?.id ?? ''], turns, b * 8000);
      if (b === curB && !bubbles.some((x) => x.agentId === first.id)) bubbles.push({ agentId: first.id, text: turns[0].text, from: 0, until: now + 60_000 });
    }
  }
  chat.sort((a, b) => a.at - b.at);

  return { ...base, agents: all, tasks, bubbles, feed, chat: chat.slice(-120), speed: 1, projectDir: s.dir };
}
