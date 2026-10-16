import { ROSTER_VERSION, defaultAgents, emptyStats, levelOf } from '../data/agents';
import { defaultProviders, defaultRouting, modelFor, providerFor } from '../data/providers';
import { DEV_REPLY, MAESTRO_QUOTES, QA_APPROVE, QA_REJECT, pick } from '../data/quotes';
import type { RealEvent, Verdict } from '../../server/runner';
import type { TriageResult as AITriage } from '../../server/triage';
import type { Agent, FeedItem, GameState, ProjectMatch, Provider, RawTask, Task, Tier } from '../types';
import { effortFor, reasonFor, tierOf, triage, type Classification } from './maestro';

let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function initialState(): GameState {
  return {
    agents: defaultAgents(),
    tasks: [],
    feed: [
      {
        id: uid('f'),
        at: Date.now(),
        kind: 'system',
        text: 'Partida iniciada. Adicione tarefas ou importe de uma integração.',
      },
    ],
    providers: defaultProviders(),
    bubbles: [],
    speed: 1,
    startedAt: Date.now(),
    routing: defaultRouting(),
    rosterVersion: ROSTER_VERSION,
    modelsVersion: 3,
  };
}

export type Action =
  | { type: 'tick'; now: number }
  | { type: 'addTasks'; tasks: RawTask[]; projectDir?: string }
  | { type: 'deleteTask'; id: string }
  | { type: 'setSpeed'; speed: GameState['speed'] }
  | { type: 'saveAgent'; agent: Agent }
  | { type: 'deleteAgent'; id: string }
  | { type: 'updateProvider'; provider: Provider }
  | { type: 'setRouting'; tier: Tier; providerId: string; modelId: string }
  | { type: 'jobStarted'; taskId: string; jobId: string }
  | { type: 'jobFailed'; taskId: string; error: string }
  | { type: 'retryTask'; id: string }
  | { type: 'triageStart'; taskId: string }
  | { type: 'triageDone'; taskId: string; result: AITriage }
  | { type: 'triageFailed'; taskId: string; error: string }
  | { type: 'real'; ev: RealEvent }
  | { type: 'setConnected'; ids: string[] }
  | { type: 'switchProject'; dir: string; name: string }
  | { type: 'jobsStopped'; agentId?: string }
  | { type: 'landed'; taskId: string; sha: string; branch: string }
  | { type: 'discarded'; taskId: string }
  | { type: 'resetProject' }
  | { type: 'reset' }
  | { type: 'load'; state: GameState };

const FEED_MAX = 150;

function feed(s: GameState, item: Omit<FeedItem, 'id' | 'at'>) {
  s.feed = [{ ...item, id: uid('f'), at: Date.now() }, ...s.feed].slice(0, FEED_MAX);
}

function say(s: GameState, agentId: string, text: string, ms = 3500, delay = 0) {
  s.bubbles = s.bubbles.filter((b) => b.agentId !== agentId);
  s.bubbles.push({ agentId, text, from: Date.now() + delay, until: Date.now() + delay + ms });
}

/** Tokens REAIS (usage do Claude Code). A execução real sempre roda no Claude. */
function spendReal(s: GameState, agent: Agent | undefined, task: Task | undefined, tokens: number, providerId = 'claude') {
  if (agent) agent.stats.tokens = Math.max(0, agent.stats.tokens + tokens);
  if (task) task.realTokens = Math.max(0, (task.realTokens ?? 0) + tokens);
  const provider = s.providers.find((p) => p.id === providerId);
  if (!provider || tokens <= 0) return;
  const now = Date.now();
  const last = provider.events[provider.events.length - 1];
  if (last && now - last.at < 60_000) last.tokens += tokens;
  else provider.events.push({ at: now, tokens });
}

function gainXp(s: GameState, agent: Agent, xp: number) {
  const before = levelOf(agent.xp);
  agent.xp += Math.round(xp);
  const after = levelOf(agent.xp);
  if (after > before) {
    feed(s, { kind: 'level', agentId: agent.id, text: `${agent.name} subiu para o nível ${after}! ⬆️` });
    say(s, agent.id, `LEVEL UP! Nv ${after} ✨`, 3000);
  }
}

const isWorker = (a: Agent) => a.role !== 'maestro';

function startNext(s: GameState, agent: Agent) {
  while (!agent.currentTaskId && agent.queue.length) {
    const id = agent.queue[0];
    const task = s.tasks.find((t) => t.id === id);
    // o pergaminho ainda está voando do Maestro até o agente: espera ele chegar
    if (task?.assignedAt && Date.now() - task.assignedAt < SCROLL_HANDOFF_MS) return;
    agent.queue.shift();
    if (!task || task.status === 'done') continue;
    agent.currentTaskId = id;
    if (task.status === 'backlog') {
      task.status = 'in_progress';
      if (task.assignedAt && !task.bounces) say(s, agent.id, pick(['📜 Deixa comigo!', '📜 Recebido, Maestro!', '📜 Bora!']), 2200);
    }
  }
}

/** pergaminho voando do Nexus até a base do Maestro */
export const SCROLL_FLIGHT_MS = 2200;
/** pergaminho voando do Maestro até o agente escolhido */
export const SCROLL_HANDOFF_MS = 1600;

const shortTitle = (t: string) => (t.length > 34 ? `${t.slice(0, 32)}…` : t);

/** pergaminho chegou na base: tarefas que o Maestro já pode ler */
export const scrollArrived = (t: Task, now = Date.now()) =>
  t.status === 'backlog' && !t.assigneeId && now - t.createdAt >= SCROLL_FLIGHT_MS;

function startReading(s: GameState, task: Task) {
  const maestro = s.agents.find((a) => a.role === 'maestro');
  task.readingSince = Date.now();
  if (maestro) say(s, maestro.id, `📜 Lendo: "${shortTitle(task.title)}"`, 6000);
}

function assign(s: GameState, task: Task, agent: Agent, c: Pick<Classification, 'type' | 'complexity' | 'lane'>, why: string) {
  const maestro = s.agents.find((a) => a.role === 'maestro');
  const tier = tierOf(c.complexity, task.bounces);
  const prov = providerFor(s, agent);
  if (!prov) {
    task.readingSince = undefined;
    feed(s, { kind: 'system', text: `⚠️ Nenhuma conta de IA conectada para "${task.title}". Conecte uma em Contas & Tokens.` });
    return;
  }
  const model = modelFor(s, prov.id, tier);
  task.providerId = prov.id;
  task.type = c.type;
  task.complexity = c.complexity;
  task.lane = c.lane;
  task.tier = tier;
  task.model = model?.id;
  task.effort = effortFor(c.complexity);
  task.hp = task.effort;
  task.assigneeId = agent.id;
  task.reason = reasonFor(c, agent.name, `${prov.name} ${model?.label ?? '?'}`.trim(), why);
  task.laneT = 0.3 + Math.random() * 0.45;
  task.readingSince = undefined;
  task.assignedAt = Date.now();
  agent.queue.push(task.id);
  feed(s, { kind: 'maestro', agentId: maestro?.id, text: `📜 "${task.title}" — ${task.reason}` });
  if (maestro) say(s, maestro.id, `${agent.name}, essa é sua! (${model?.label ?? '?'})`, 2800);
}

/** Quem lê o pergaminho é o Maestro de verdade (IA), disparado pelo realRunner; aqui só a fala de espera */
function runMaestro(s: GameState) {
  const maestro = s.agents.find((a) => a.role === 'maestro');
  const pending = s.tasks.some((t) => scrollArrived(t));
  if (maestro && !pending && Math.random() < 0.01) say(s, maestro.id, pick(MAESTRO_QUOTES));
}

function sendToReview(s: GameState, dev: Agent, task: Task) {
  const qas = s.agents.filter((a) => a.role === 'qa' && a.id !== dev.id);
  dev.currentTaskId = undefined;
  if (!qas.length) return finish(s, task, dev);
  const qa = [...qas].sort((a, b) => a.queue.length - b.queue.length)[0];
  task.status = 'review';
  task.reviewerId = qa.id;
  task.hp = reviewMax(task);
  qa.queue.push(task.id);
  feed(s, { kind: 'work', agentId: dev.id, text: `${dev.name} entregou "${task.title}" → revisão do ${qa.name}` });
}

function finish(s: GameState, task: Task, dev: Agent, qa?: Agent) {
  task.status = 'done';
  task.doneAt = Date.now();
  task.hp = 0;
  dev.stats.done++;
  dev.stats.streak++;
  gainXp(s, dev, task.effort * (task.bounces ? 0.6 : 1));
  if (qa) {
    qa.stats.reviews++;
    qa.currentTaskId = undefined;
    gainXp(s, qa, 8 + task.complexity * 3);
  }
  feed(s, { kind: 'done', agentId: dev.id, text: `✅ "${task.title}" concluída por ${dev.name}${task.bounces ? ` (voltou ${task.bounces}x)` : ''}` });
}

/** `verdict` é o veredito do QA (revisor de verdade) */
function review(s: GameState, qa: Agent, task: Task, verdict?: Verdict) {
  const dev = s.agents.find((a) => a.id === task.assigneeId);
  if (!dev) {
    qa.currentTaskId = undefined;
    return finish(s, task, qa);
  }
  const rejected = verdict ? !verdict.aprovado : false;
  if (rejected) {
    task.bounces++;
    task.status = 'in_progress';
    task.hp = Math.round(task.effort * 0.4);
    task.reviewerId = undefined;
    // se voltou 2x, o Maestro sobe o modelo
    const tier: Tier = task.bounces >= 2 && task.tier !== 'pesado' ? (task.tier === 'leve' ? 'medio' : 'pesado') : task.tier;
    if (tier !== task.tier) {
      task.tier = tier;
      task.model = modelFor(s, dev.providerId, tier)?.id ?? task.model;
      feed(s, { kind: 'maestro', text: `Maestro subiu o modelo de "${task.title}" para ${modelFor(s, dev.providerId, tier)?.label}` });
    }
    dev.queue.unshift(task.id);
    dev.stats.bugsCaused++;
    dev.stats.streak = 0;
    qa.stats.bugsFound++;
    qa.currentTaskId = undefined;
    gainXp(s, qa, 15);
    const jab = verdict?.comentario || pick(QA_REJECT);
    const reply = pick(DEV_REPLY);
    if (verdict) task.lastReview = verdict.comentario;
    say(s, qa.id, verdict ? pick(QA_REJECT) : jab, 4000);
    say(s, dev.id, reply, 4000, 900);
    feed(s, { kind: 'qa', agentId: qa.id, text: `🐞 ${qa.name} devolveu "${task.title}": "${jab}"` });
    feed(s, { kind: 'banter', agentId: dev.id, text: `${dev.name}: "${reply}"` });
  } else {
    if (verdict) task.qaNote = verdict.comentario;
    if (verdict) feed(s, { kind: 'qa', agentId: qa.id, text: `👍 ${qa.name} aprovou "${task.title}": "${verdict.comentario}"` });
    if (verdict || Math.random() < 0.4) say(s, qa.id, pick(QA_APPROVE), 3000);
    finish(s, task, dev, qa);
  }
}

/** Conclusão de uma etapa da tarefa (simulada ou real): entrega, revisão ou fim */
function complete(s: GameState, agent: Agent, task: Task, verdict?: Verdict) {
  if (task.status === 'review' && task.reviewerId === agent.id) review(s, agent, task, verdict);
  else if (agent.role === 'qa' || task.type === 'test') {
    agent.currentTaskId = undefined;
    finish(s, task, agent);
  } else sendToReview(s, agent, task);
}

const reviewMax = (t: Task) => 12 + t.complexity * 8;

function onReal(s: GameState, ev: RealEvent) {
  if (ev.type === 'snapshot') {
    // reconecta com o servidor: aplica o que terminou enquanto o navegador estava fora
    // e solta tarefas cujo job sumiu (servidor reiniciado) para rodarem de novo
    const jobs = new Map(ev.jobs.map((j) => [j.id, j]));
    for (const t of s.tasks) {
      if (!t.jobId) continue;
      const j = jobs.get(t.jobId);
      if (!j) t.jobId = undefined;
      else if (j.end) onReal(s, j.end);
      else t.paused = !!j.paused;
    }
    return;
  }
  if (ev.type === 'start') return;
  const task = s.tasks.find((t) => t.id === ev.taskId);
  const agent = s.agents.find((a) => a.id === ev.agentId);
  // só conta tarefas desta partida (outra aba/curl pode estar usando o mesmo servidor)
  if (ev.type === 'tokens') return task && spendReal(s, agent, task, ev.delta, ev.provider ?? 'claude');
  if (!task || task.jobId !== ev.jobId) return;

  if (ev.type === 'step') {
    const max = ev.phase === 'review' ? reviewMax(task) : task.effort;
    task.hp = Math.max(1, Math.round(max * (1 - ev.progress)));
    if (agent) {
      feed(s, { kind: 'work', agentId: agent.id, text: `${agent.name}: ${ev.text}` });
      if (ev.kind === 'text' || Math.random() < 0.3) say(s, agent.id, ev.text.length > 70 ? `${ev.text.slice(0, 68)}…` : ev.text, 3500);
    }
    return;
  }

  if (ev.type === 'pause') {
    task.paused = ev.paused;
    if (agent) say(s, agent.id, ev.paused ? '⏸ Pausado…' : '▶ Voltando!', 2500);
    return;
  }

  // end
  task.paused = undefined;
  task.jobId = undefined;
  task.costUsd = (task.costUsd ?? 0) + ev.costUsd;
  if (!agent) return;
  if (!ev.ok) {
    task.blocked = ev.error ?? 'Falhou.';
    agent.currentTaskId = undefined;
    agent.queue = agent.queue.filter((id) => id !== task.id);
    feed(s, { kind: 'system', agentId: agent.id, text: `⚠️ ${agent.name} travou em "${task.title}": ${task.blocked}` });
    say(s, agent.id, 'Deu ruim aqui... 😵', 3500);
    return;
  }
  if (ev.phase === 'work' && ev.files?.length) {
    task.files = ev.files;
    feed(s, { kind: 'work', agentId: agent.id, text: `🗂 Arquivos: ${ev.files.map((f) => f.path).join(', ')} (veja em Entregas)` });
  }
  if (ev.phase === 'work' && ev.result) {
    task.output = ev.result;
    feed(s, { kind: 'work', agentId: agent.id, text: `📦 ${agent.name} entregou: ${ev.result.replace(/\s+/g, ' ').slice(0, 220)}` });
  }
  if (ev.worktree) task.worktree = ev.worktree;
  if (ev.commit)
    feed(s, {
      kind: 'done',
      text: ev.worktree ? `🌿 Commit ${ev.commit} na branch ${ev.worktree.branch} (isolada do projeto).` : `📌 Commit ${ev.commit} no projeto alvo.`,
    });
  if (ev.landed) {
    task.landedSha = ev.landed;
    feed(s, { kind: 'done', text: `🚀 "${task.title}" aplicada no projeto (merge ${ev.landed}).` });
  }
  task.hp = 0;
  complete(s, agent, task, ev.verdict);
}

function tick(s: GameState) {
  runMaestro(s);

  for (const agent of s.agents.filter(isWorker)) {
    startNext(s, agent);
    const task = s.tasks.find((t) => t.id === agent.currentTaskId);
    if (!task) {
      agent.currentTaskId = undefined;
      continue;
    }
    // quem move a barra de vida é o Claude Code (eventos SSE do servidor)
  }

  const now = Date.now();
  s.bubbles = s.bubbles.filter((b) => b.until > now);
}

// ---------- uma partida por projeto ----------

const freshFeed = (text: string): FeedItem[] => [{ id: uid('f'), at: Date.now(), kind: 'system', text }];

/** tira a partida aberta do estado (tarefas, registro, placar e XP dos agentes) */
function stash(s: GameState): ProjectMatch {
  return {
    tasks: s.tasks,
    feed: s.feed,
    startedAt: s.startedAt,
    progress: Object.fromEntries(
      s.agents.map((a) => [a.id, { xp: a.xp, stats: a.stats, queue: a.queue, currentTaskId: a.currentTaskId }]),
    ),
  };
}

/** coloca uma partida guardada (ou uma nova, zerada) no estado */
function unstash(s: GameState, m: ProjectMatch | undefined, name: string) {
  s.tasks = m ? m.tasks.map((t) => ({ ...t })) : [];
  s.feed = m ? [...m.feed] : freshFeed(`Partida do projeto "${name}" iniciada. Adicione tarefas ou importe de uma integração.`);
  s.startedAt = m?.startedAt ?? Date.now();
  s.agents = s.agents.map((a) => {
    const p = m?.progress[a.id];
    return { ...a, xp: p?.xp ?? 0, stats: p ? { ...p.stats } : emptyStats(), queue: p ? [...p.queue] : [], currentTaskId: p?.currentTaskId };
  });
  s.bubbles = [];
}

/**
 * Aplica um evento numa tarefa de outro projeto (ex.: o job terminou depois que você trocou de projeto):
 * abre aquela partida por um instante, aplica e guarda de volta.
 */
function withTaskProject(state: GameState, taskId: string, fn: (s: GameState) => void): GameState {
  const s = clone(state);
  const dir = s.tasks.some((t) => t.id === taskId)
    ? undefined
    : Object.keys(s.matches ?? {}).find((d) => s.matches![d].tasks.some((t) => t.id === taskId));
  if (dir === undefined) {
    fn(s);
    return s;
  }
  const current = stash(s);
  const bubbles = s.bubbles;
  s.matches = { ...s.matches };
  unstash(s, s.matches[dir], dir);
  fn(s);
  s.matches[dir] = stash(s);
  unstash(s, current, '');
  s.bubbles = bubbles;
  return s;
}

/** Copia rasa o suficiente para o React enxergar a mudança */
function clone(s: GameState): GameState {
  return {
    ...s,
    agents: s.agents.map((a) => ({ ...a, stats: { ...a.stats }, queue: [...a.queue] })),
    tasks: s.tasks.map((t) => ({ ...t })),
    providers: s.providers.map((p) => ({ ...p, events: p.events.map((e) => ({ ...e })) })),
    bubbles: [...s.bubbles],
    feed: [...s.feed],
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'tick': {
      if (state.speed === 0) return state;
      const s = clone(state);
      tick(s);
      return s;
    }
    case 'addTasks': {
      const s = clone(state);
      const now = Date.now();
      const created: Task[] = action.tasks.map((r, i) => ({
        id: uid('t'),
        title: r.title,
        description: r.description ?? '',
        source: r.source,
        externalKey: r.externalKey,
        url: r.url,
        type: 'feature',
        complexity: 2,
        tier: 'medio',
        effort: 1,
        hp: 1,
        status: 'backlog',
        lane: 'mid',
        laneT: 0.5,
        bounces: 0,
        createdAt: now + i,
        projectDir: action.projectDir,
        forcedAgentId: r.agentId,
      }));
      // ignora duplicadas vindas da mesma integração
      const keys = new Set(s.tasks.map((t) => t.externalKey).filter(Boolean));
      const fresh = created.filter((t) => !t.externalKey || !keys.has(t.externalKey));
      s.tasks.push(...fresh);
      feed(s, { kind: 'system', text: `${fresh.length} tarefa(s) entraram na fila do Maestro.` });
      return s;
    }
    case 'deleteTask': {
      const s = clone(state);
      s.tasks = s.tasks.filter((t) => t.id !== action.id);
      for (const a of s.agents) {
        a.queue = a.queue.filter((id) => id !== action.id);
        if (a.currentTaskId === action.id) a.currentTaskId = undefined;
      }
      return s;
    }
    case 'setSpeed':
      return { ...state, speed: action.speed };
    case 'saveAgent': {
      const s = clone(state);
      const i = s.agents.findIndex((a) => a.id === action.agent.id);
      if (i >= 0) {
        // só os campos editáveis: o resto (xp, fila, tarefa atual) segue vivo na partida
        const { name, title, role, sprite, palette, providerId, instructions, keywords, power, bugRate } = action.agent;
        s.agents[i] = { ...s.agents[i], name, title, role, sprite, palette, providerId, instructions, keywords, power, bugRate };
      }
      else {
        s.agents.push({ ...action.agent, xp: 0, stats: emptyStats(), queue: [], builtin: false });
        feed(s, { kind: 'system', agentId: action.agent.id, text: `${action.agent.name} entrou na partida!` });
      }
      return s;
    }
    case 'deleteAgent': {
      const s = clone(state);
      const gone = s.agents.find((a) => a.id === action.id);
      s.agents = s.agents.filter((a) => a.id !== action.id);
      // tarefas dele voltam para o Maestro redistribuir
      for (const t of s.tasks) {
        if (t.status === 'done') continue;
        if (t.assigneeId === action.id) {
          t.assigneeId = undefined;
          t.status = 'backlog';
          t.reviewerId = undefined;
        } else if (t.reviewerId === action.id) {
          t.reviewerId = undefined;
          t.status = 'backlog';
          t.assigneeId = undefined;
        }
      }
      if (gone) feed(s, { kind: 'system', text: `${gone.name} saiu da partida. Tarefas devolvidas ao Maestro.` });
      return s;
    }
    case 'updateProvider': {
      const s = clone(state);
      s.providers = s.providers.map((p) => (p.id === action.provider.id ? action.provider : p));
      return s;
    }
    case 'setRouting': {
      const routing = { ...state.routing, [action.tier]: { ...state.routing[action.tier], [action.providerId]: action.modelId } };
      return { ...state, routing };
    }
    case 'jobStarted':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        if (task) task.jobId = action.jobId;
      });
    case 'jobFailed':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        if (task) {
          task.blocked = action.error;
          feed(s, { kind: 'system', text: `⚠️ Não deu para iniciar "${task.title}": ${action.error}` });
        }
      });
    case 'retryTask': {
      const s = clone(state);
      const task = s.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      task.blocked = undefined;
      const who = s.agents.find((a) => a.id === (task.status === 'review' ? task.reviewerId : task.assigneeId));
      if (who && who.currentTaskId !== task.id && !who.queue.includes(task.id)) who.queue.unshift(task.id);
      return s;
    }
    case 'real': {
      const ev = action.ev;
      if (ev.type === 'snapshot') {
        // reconexão: vale para o projeto aberto e para os guardados
        let s = clone(state);
        onReal(s, ev);
        for (const dir of Object.keys(s.matches ?? {})) {
          const anyTask = s.matches![dir].tasks.find((t) => t.jobId);
          if (anyTask) s = withTaskProject(s, anyTask.id, (x) => onReal(x, ev));
        }
        return s;
      }
      if (ev.type === 'start') return state;
      return withTaskProject(state, ev.taskId, (s) => onReal(s, ev));
    }
    case 'triageStart': {
      const s = clone(state);
      const task = s.tasks.find((t) => t.id === action.taskId);
      if (task) startReading(s, task);
      return s;
    }
    case 'triageDone':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        // se você escolheu o agente ao criar a tarefa, o Maestro só mede tipo e tamanho
        const forced = task?.forcedAgentId ? s.agents.find((a) => a.id === task.forcedAgentId) : undefined;
        const agent = forced ?? s.agents.find((a) => a.id === action.result.agentId);
        const maestro = s.agents.find((a) => a.role === 'maestro');
        if (!task || task.assigneeId || !agent) return;
        spendReal(s, maestro, task, action.result.tokens);
        task.costUsd = (task.costUsd ?? 0) + action.result.costUsd;
        assign(s, task, agent, action.result, forced ? ` · agente escolhido por você · "${action.result.motivo}"` : ` · "${action.result.motivo}"`);
      });
    case 'triageFailed':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        if (!task || task.assigneeId) return;
        const r = triage(s, task);
        feed(s, { kind: 'system', text: `⚠️ Maestro (IA) falhou: ${action.error}. Usando as regras de palavras-chave.` });
        if (r.agent) assign(s, task, r.agent, r.classification, ' · regras locais');
        else task.readingSince = undefined;
      });
    case 'switchProject': {
      if (action.dir === state.projectDir) return state;
      const s = clone(state);
      // partida antiga, de antes dos projetos: vira a partida do primeiro projeto aberto
      if (state.projectDir === undefined) {
        s.projectDir = action.dir;
        return s;
      }
      s.matches = { ...s.matches, [state.projectDir]: stash(s) };
      const saved = s.matches[action.dir];
      delete s.matches[action.dir];
      unstash(s, saved, action.name);
      s.projectDir = action.dir;
      if (saved) feed(s, { kind: 'system', text: `📁 De volta ao projeto "${action.name}".` });
      return s;
    }
    case 'setConnected': {
      // só provedores realmente conectados (conta logada) aparecem e recebem tarefas
      if (state.providers.every((p) => p.connected === action.ids.includes(p.id))) return state;
      return { ...state, providers: state.providers.map((p) => ({ ...p, connected: action.ids.includes(p.id) })) };
    }
    case 'jobsStopped': {
      // parar vale na hora na tela, mesmo que o servidor tenha perdido o job (reinício)
      const s = clone(state);
      for (const t of s.tasks) {
        if (!t.jobId || t.status === 'done') continue;
        const a = s.agents.find((x) => x.currentTaskId === t.id);
        if (action.agentId && a?.id !== action.agentId) continue;
        t.jobId = undefined;
        t.paused = undefined;
        t.blocked = 'Parado por você.';
        if (a) {
          a.currentTaskId = undefined;
          a.queue = a.queue.filter((id) => id !== t.id);
          say(s, a.id, '⏹ Parei.', 2500);
        }
        feed(s, { kind: 'system', agentId: a?.id, text: `⏹ "${t.title}" parada. Use "Tentar de novo" para retomar do zero.` });
      }
      return s;
    }
    case 'landed':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        if (!task) return;
        task.landedSha = action.sha;
        feed(s, { kind: 'done', text: `🚀 "${task.title}" aplicada no projeto (merge ${action.sha} da branch ${action.branch}).` });
      });
    case 'discarded':
      return withTaskProject(state, action.taskId, (s) => {
        const task = s.tasks.find((t) => t.id === action.taskId);
        if (!task) return;
        task.discarded = true;
        feed(s, { kind: 'system', text: `🗑 Branch de "${task.title}" descartada; o projeto não foi alterado.` });
      });
    case 'resetProject': {
      const s = clone(state);
      unstash(s, undefined, state.projectDir?.split('/').pop() ?? 'novo');
      return s;
    }
    case 'reset':
      return initialState();
    case 'load':
      return action.state;
  }
}

const KEY = 'agent-arena:v1';

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState & { mode?: string };
      delete s.mode;
      // modelos reais por provedor (v2): troca as listas e os ids de roteamento antigos
      if ((s.modelsVersion ?? 1) < 3) {
        const fresh = defaultProviders();
        s.providers = (s.providers ?? []).map((p) => ({ ...(fresh.find((f) => f.id === p.id) ?? p), events: p.events ?? [], connected: false }));
        s.routing = defaultRouting();
        s.modelsVersion = 3;
      }
      // sobras de versões antigas: tarefas de demonstração e simulação ficam para trás
      const real = <T extends { source?: string }>(list: T[]) => list.filter((t) => (t.source as string) !== 'demo');
      s.tasks = real(s.tasks ?? []);
      for (const m of Object.values(s.matches ?? {})) m.tasks = real(m.tasks);
      if (s.agents && s.tasks && s.providers) {
        // partidas antigas: traz os agentes padrão que entraram depois (ex.: UI/UX)
        if ((s.rosterVersion ?? 1) < ROSTER_VERSION) {
          for (const a of defaultAgents()) if (!s.agents.some((x) => x.id === a.id)) s.agents.push(a);
          s.rosterVersion = ROSTER_VERSION;
        }
        return { ...initialState(), ...s, bubbles: [] };
      }
    }
  } catch {
    /* estado corrompido ou storage bloqueado: começa do zero */
  }
  return initialState();
}

export function saveState(s: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, bubbles: [] }));
  } catch {
    /* sem storage, segue sem persistir */
  }
}
