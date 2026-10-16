/**
 * Ponte entre o jogo e o servidor de execução real (server/runner.ts).
 * - Escuta o SSE /api/real/events e repassa cada evento para o reducer.
 * - No modo "Execução real", sempre que um agente está com uma tarefa e ela
 *   ainda não tem job, pede ao servidor para rodar o Claude Code.
 */
import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { RealConfig, RealEvent, RunRequest } from '../../server/runner';
import { modelFor } from '../data/providers';
import type { Agent, GameState, Task } from '../types';
import { scrollArrived, type Action } from './game';

export interface RealStatus {
  config: RealConfig;
  exists: boolean;
  isGit: boolean;
  claude: string | null;
  running: number;
  account?: { loggedIn: boolean; email?: string; plan?: string; authMethod?: string } | null;
}

export async function fetchRealStatus(): Promise<RealStatus | null> {
  try {
    const r = await fetch('/api/real/config');
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function saveRealConfig(patch: Partial<RealConfig>): Promise<RealStatus> {
  const r = await fetch('/api/real/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}

/** pausar (congela o processo), retomar ou parar os agentes: todos ou só um */
export function controlJobs(action: 'pause' | 'resume' | 'stop', agentId?: string) {
  return fetch('/api/real/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, agentId }),
  }).catch(() => undefined);
}

export function cancelJob(jobId: string) {
  return fetch('/api/real/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  }).catch(() => undefined);
}

/** Execução real sempre roda no Claude: agentes de outro provedor usam o modelo Claude do mesmo peso */
export function claudeModelFor(state: GameState, agent: Agent, task: Task) {
  if (agent.providerId === 'claude' && task.model?.startsWith('claude')) return task.model;
  return modelFor(state, 'claude', task.tier)?.id ?? 'sonnet';
}

function request(state: GameState, agent: Agent, task: Task): RunRequest {
  const phase = task.status === 'review' && task.reviewerId === agent.id ? 'review' : 'work';
  const dev = state.agents.find((a) => a.id === task.assigneeId);
  return {
    taskId: task.id,
    cwd: task.projectDir,
    phase,
    model: claudeModelFor(state, agent, task),
    agent: { id: agent.id, name: agent.name, role: agent.role, title: agent.title, instructions: agent.instructions },
    task: {
      title: task.title,
      description: task.description,
      complexity: task.complexity,
      bounces: task.bounces,
      lastReview: task.lastReview,
      devName: dev?.name,
    },
  };
}

export function useRealRunner(state: GameState, dispatch: Dispatch<Action>, onJobEnd: () => void) {
  const [status, setStatus] = useState<RealStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const launching = useRef(new Set<string>());
  const reading = useRef<string | null>(null);
  const onEnd = useRef(onJobEnd);
  onEnd.current = onJobEnd;

  useEffect(() => {
    fetchRealStatus().then(setStatus);
  }, []);

  // SSE: fica sempre ligado, para não perder o fim de um job se o modo mudar no meio
  useEffect(() => {
    const es = new EventSource('/api/real/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      let ev: RealEvent;
      try {
        ev = JSON.parse(m.data);
      } catch {
        return;
      }
      dispatch({ type: 'real', ev });
      if (ev.type === 'end') {
        onEnd.current();
        fetchRealStatus().then(setStatus);
      }
    };
    return () => es.close();
  }, [dispatch]);

  // ❚❚ no topo congela os agentes que estão rodando; ▶ descongela
  const prevSpeed = useRef(state.speed);
  useEffect(() => {
    if (prevSpeed.current === state.speed) return;
    const wasPaused = prevSpeed.current === 0;
    prevSpeed.current = state.speed;
    if (state.speed === 0) void controlJobs('pause');
    else if (wasPaused) void controlJobs('resume');
  }, [state.speed]);

  // Maestro de verdade: lê um pergaminho por vez assim que ele chega na base
  useEffect(() => {
    if (state.speed === 0 || reading.current) return;
    const now = Date.now();
    // readingSince antigo = triagem que se perdeu num reload: lê de novo
    const task = state.tasks.find((t) => scrollArrived(t, now) && (!t.readingSince || now - t.readingSince > 120_000));
    if (!task) return;
    reading.current = task.id;
    dispatch({ type: 'triageStart', taskId: task.id });
    const agents = state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      title: a.title,
      instructions: a.instructions,
      keywords: a.keywords,
      load: a.queue.length + (a.currentTaskId ? 1 : 0),
    }));
    fetch('/api/real/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: { title: task.title, description: task.description }, agents }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        dispatch({ type: 'triageDone', taskId: task.id, result: data });
        onEnd.current();
      })
      .catch((e) => dispatch({ type: 'triageFailed', taskId: task.id, error: e instanceof Error ? e.message : String(e) }))
      .finally(() => (reading.current = null));
  }, [state, dispatch]);

  // dispara jobs para quem está com tarefa e ainda não começou
  useEffect(() => {
    if (state.speed === 0 || !connected) return;
    const max = status?.config.maxParallel ?? 1;
    let running = state.tasks.filter((t) => t.jobId).length + launching.current.size;
    for (const agent of state.agents) {
      if (running >= max) break;
      if (agent.role === 'maestro' || !agent.currentTaskId) continue;
      const task = state.tasks.find((t) => t.id === agent.currentTaskId);
      if (!task || task.status === 'done' || task.jobId || task.blocked) continue;
      const key = `${task.id}:${task.status}:${task.bounces}`;
      if (launching.current.has(key)) continue;
      launching.current.add(key);
      running++;
      fetch('/api/real/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request(state, agent, task)),
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          dispatch({ type: 'jobStarted', taskId: task.id, jobId: data.job.id });
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          // fila cheia no servidor não é erro da tarefa: tenta de novo no próximo tick
          if (!msg.startsWith('Limite')) dispatch({ type: 'jobFailed', taskId: task.id, error: msg });
        })
        .finally(() => launching.current.delete(key));
    }
  }, [state, status, connected, dispatch]);

  return { status, setStatus, connected };
}
