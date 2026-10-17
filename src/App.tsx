import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ConnectionStatus } from '../server/connections';
import { Accounts } from './components/Accounts';
import { AgentEditor, newAgent } from './components/AgentEditor';
import { Board } from './components/Board';
import { Welcome } from './components/Welcome';
import { TaskDetail } from './components/TaskDetail';
import { AgentTerminal } from './components/AgentTerminal';
import { Deliveries } from './components/Deliveries';
import { Ecosystem } from './components/Ecosystem';
import { Chat } from './components/Chat';
import { Credits } from './components/Credits';
import { Feed } from './components/Feed';
import { Lab } from './components/Lab';
import { HeroBar } from './components/HeroBar';
import { Integrations } from './components/Integrations';
import { Live, LiveHistory, LivePicker, useLive } from './components/Live';
import { mirrorState } from './engine/mirror';
import { Projects, projectName } from './components/Projects';
import { RealConfig } from './components/RealConfig';
import { Scoreboard } from './components/Scoreboard';
import { TaskQueue } from './components/TaskQueue';
import { TopBar } from './components/TopBar';
import { loadState, reducer, saveState } from './engine/game';
import { useBattleMusic } from './audio/useBattleMusic';
import { cancelJob, controlJobs, useRealRunner } from './engine/realRunner';
import type { RealUsage } from './engine/usage';
import type { Agent, RawTask } from './types';

type Panel = null | 'score' | 'accounts' | 'integrations' | 'real' | 'projects' | 'livepick' | { liveWorker: string } | { term: string } | { task: string } | { agentId: string } | { draft: Agent };

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [view, setView] = useState<'board' | 'done' | 'eco' | 'live' | 'lab'>('lab');
  // sessão do Claude Code espelhada na arena (fica salva no navegador)
  const [mirrorId, setMirrorId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('agent-arena:mirror');
    } catch {
      return null;
    }
  });
  const live = useLive(mirrorId);
  const liveWorking = live.data?.sessions.filter((s) => s.state === 'working').length ?? 0;
  const [panel, setPanel] = useState<Panel>(null);
  const setMirror = (id: string | null) => {
    setMirrorId(id);
    try {
      if (id) localStorage.setItem('agent-arena:mirror', id);
      else localStorage.removeItem('agent-arena:mirror');
    } catch {
      /* sem storage: vale só nesta sessão */
    }
    if (id) {
      setView('lab');
      setPanel(null);
    }
  };
  const [real, setReal] = useState<RealUsage | null>(null);
  // tela de boas-vindas: aparece sempre que abre (a menos que a pessoa peça para não mostrar) e pelo botão ? no topo
  const [welcome, setWelcome] = useState(() => {
    try {
      return !localStorage.getItem('agent-arena:welcome-hidden');
    } catch {
      return true;
    }
  });
  const closeWelcome = (dontShowAgain = false) => {
    setWelcome(false);
    try {
      if (dontShowAgain) localStorage.setItem('agent-arena:welcome-hidden', '1');
      else localStorage.removeItem('agent-arena:welcome-hidden');
    } catch {
      /* sem storage: aparece de novo na próxima visita */
    }
  };
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // relógio do jogo
  useEffect(() => {
    if (state.speed === 0) return;
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000 / state.speed);
    return () => clearInterval(id);
  }, [state.speed]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // salva no navegador a cada 2s
  const latest = useRef(state);
  // as tarefas novas vão para o projeto selecionado (pasta fora do Arena)
  const projectRef = useRef<string | undefined>(undefined);
  latest.current = state;
  useEffect(() => {
    const id = setInterval(() => saveState(latest.current), 2000);
    return () => clearInterval(id);
  }, []);

  // uso real de tokens (logs locais) a cada 60s
  const refreshUsage = useCallback((fresh?: boolean) => {
    fetch(fresh === true ? '/api/usage?fresh=1' : '/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then(setReal)
      .catch(() => setReal(null));
  }, []);
  useEffect(() => {
    refreshUsage();
    const id = setInterval(refreshUsage, 60_000);
    return () => clearInterval(id);
  }, [refreshUsage]);

  // execução real: SSE + disparo dos jobs do Claude Code
  const runner = useRealRunner(state, dispatch, refreshUsage);
  projectRef.current = runner.status?.config.targetDir || undefined;
  // cada projeto tem a sua partida: trocar de projeto troca tarefas, registro e placar
  const currentDir = runner.status?.config.targetDir;
  useEffect(() => {
    if (currentDir) dispatch({ type: 'switchProject', dir: currentDir, name: projectName(runner.status, currentDir) ?? currentDir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDir]);
  // anexa a pasta de uma sessão ao vivo como projeto do Arena
  const attachLive = async (dir: string) => {
    try {
      const r = await fetch('/api/real/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'attach', dir }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      runner.setStatus(data);
      flash(`Projeto anexado: ${dir}`);
    } catch (e) {
      flash(`Não deu para anexar: ${e instanceof Error ? e.message : e}`);
    }
  };
  const deleteTask = (id: string) => {
    const jobId = latest.current.tasks.find((t) => t.id === id)?.jobId;
    if (jobId) cancelJob(jobId);
    dispatch({ type: 'deleteTask', id });
  };

  // Tab abre o placar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'Tab' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        e.preventDefault();
        setPanel((p) => (p === 'score' ? null : 'score'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // contas conectadas de verdade (lidas das CLIs); só elas recebem tarefas
  const [conns, setConns] = useState<ConnectionStatus[] | null>(null);
  const applyConns = useCallback((list: ConnectionStatus[]) => {
    setConns(list);
    dispatch({ type: 'setConnected', ids: list.filter((c) => c.connected).map((c) => c.id) });
  }, []);
  useEffect(() => {
    const pull = () =>
      fetch('/api/connections')
        .then((r) => (r.ok ? r.json() : null))
        .then((l) => l && applyConns(l))
        .catch(() => undefined);
    void pull();
    const id = setInterval(pull, 30_000);
    return () => clearInterval(id);
  }, [applyConns]);

  // música de batalha (opcional): ligada/desligada e volume ficam salvos no navegador
  const [music, setMusic] = useState<{ on: boolean; volume: number }>(() => {
    try {
      return { on: false, volume: 0.5, ...JSON.parse(localStorage.getItem('agent-arena:music') ?? '{}') };
    } catch {
      return { on: false, volume: 0.5 };
    }
  });
  const updateMusic = (patch: Partial<{ on: boolean; volume: number }>) =>
    setMusic((m) => {
      const next = { ...m, ...patch };
      try {
        localStorage.setItem('agent-arena:music', JSON.stringify(next));
      } catch {
        /* sem storage: vale só nesta sessão */
      }
      return next;
    });
  useBattleMusic(music.on, music.volume, state.tasks.some((t) => t.jobId));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const addTasks = (tasks: RawTask[]) => dispatch({ type: 'addTasks', tasks, projectDir: projectRef.current });
  const openAgent = (id: string) => setPanel({ term: id });
  // sem janela de confirmação do navegador (pode ser bloqueada no app): para na hora
  const control = (action: 'pause' | 'resume' | 'stop', agentId?: string) => {
    void controlJobs(action, agentId);
    if (action === 'stop') dispatch({ type: 'jobsStopped', agentId });
  };
  const stopAll = () => control('stop');

  const exportAgents = async () => {
    try {
      const res = await fetch('/api/agents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: state.agents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash(`Exportado: ${data.written.length} arquivo(s) em .claude/ — o Claude Code já enxerga esses subagentes.`);
    } catch (e) {
      flash(`Erro ao exportar: ${e instanceof Error ? e.message : e}`);
    }
  };

  const mirrored = useMemo(() => {
    const sess = mirrorId ? live.data?.sessions.find((x) => x.id === mirrorId) : undefined;
    return sess ? mirrorState(state, sess) : null;
  }, [mirrorId, live.data, state]);
  const mirrorSession = mirrorId ? live.data?.sessions.find((x) => x.id === mirrorId) : undefined;
  const shown = mirrored ?? state;
  const mirrorEnded = !!mirrorId && !!live.data && !mirrorSession;

  // ao entrar: se há Claude rodando e nada espelhado, pergunta qual mostrar na arena (uma vez por abertura)
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || welcome || mirrorId || panel || !live.data) return;
    asked.current = true;
    if (live.data.sessions.length) setPanel('livepick');
  }, [live.data, welcome, mirrorId, panel]);
  const liveWorker = panel && typeof panel === 'object' && 'liveWorker' in panel && mirrorSession
    ? [mirrorSession.main, ...mirrorSession.subagents].find((w) => `live-${w.id}` === panel.liveWorker)
    : undefined;

  const editing =
    panel && typeof panel === 'object'
      ? 'draft' in panel
        ? { agent: panel.draft, isNew: true }
        : 'agentId' in panel
          ? { agent: state.agents.find((a) => a.id === panel.agentId), isNew: false }
          : null
      : null;

  return (
    <div className="app">
      <TopBar
        state={state}
        real={real}
        now={now}
        onSpeed={(speed) => dispatch({ type: 'setSpeed', speed })}
        onScore={() => setPanel('score')}
        onAccounts={() => setPanel('accounts')}
        onIntegrations={() => setPanel('integrations')}
        onRealConfig={() => setPanel('real')}
        realTarget={runner.status?.config.targetDir}
        realRunning={state.tasks.filter((t) => t.jobId).length}
        onStopAll={stopAll}
        music={music}
        onMusic={updateMusic}
        onAbout={() => setWelcome(true)}
      />

      <div className="main">
        <TaskQueue
          state={state}
          onAdd={addTasks}
          onDelete={deleteTask}
          onRetry={(id) => dispatch({ type: 'retryTask', id })}
          project={projectName(runner.status)}
          onProjects={() => setPanel('projects')}
          onIntegrations={() => setPanel('integrations')}
          noAccount={!!conns && !conns.some((c) => c.connected)}
          onAccounts={() => setPanel('accounts')}
        />

        <section className="arena-wrap">
          <div className="arena-tabs">
            <button className={`btn sm ${view === 'lab' ? 'on' : ''}`} onClick={() => setView('lab')} title="O laboratório: sala do líder, café, mesa central e porta biométrica">Laboratório</button>
            <button className={`btn sm ${view === 'board' ? 'on' : ''}`} onClick={() => setView('board')}>Quadro</button>
            <button className={`btn sm ${view === 'eco' ? 'on' : ''}`} onClick={() => setView('eco')}>Ecossistema</button>
            <button className={`btn sm ${view === 'live' ? 'on' : ''}`} onClick={() => setView('live')} title="O que o seu Claude Code está fazendo agora, em qualquer projeto">
              {liveWorking > 0 && <span className="dot working" />} Ao vivo{liveWorking > 0 ? ` (${liveWorking})` : ''}
            </button>
            <button className={`btn sm ${view === 'done' ? 'on' : ''}`} onClick={() => setView('done')}>
              Entregas ({state.tasks.filter((t) => t.status === 'done').length})
            </button>
            <span className="spacer" />
            <button
              className="btn sm ghost"
              onClick={() =>
                confirm(`Recomeçar a partida${projectName(runner.status) ? ` do projeto "${projectName(runner.status)}"` : ''}? As tarefas, o registro de batalha e o placar dele serão apagados. Os agentes e os outros projetos ficam.`) &&
                dispatch({ type: 'resetProject' })
              }
            >
              Recomeçar projeto
            </button>
          </div>
          {view === 'lab' ? (
            (() => {
              // o Laboratório é a vista principal do jogo (a Arena antiga está desativada, o código segue em components/Arena.tsx)
              const common = {
                state: shown,
                connected: conns ? conns.some((c) => c.connected) : state.providers.some((p) => p.connected),
                hasProject: !!runner.status?.config.targetDir,
                onAgent: mirrored ? (id: string) => setPanel({ liveWorker: id }) : openAgent,
                onAccounts: () => setPanel('accounts'),
                onProjects: () => setPanel('projects'),
                onControl: mirrored ? undefined : (a: 'pause' | 'resume' | 'stop', id: string) => control(a, id),
                onTask: mirrored ? undefined : (id: string) => setPanel({ task: id }),
                banner: mirrorId && (
                  <div className={`live-banner ${mirrorEnded ? 'ended' : ''}`}>
                    <span className={`dot ${mirrorSession?.state ?? 'idle'}`} />
                    <span className="grow">
                      {mirrorEnded ? 'A sessão espelhada parou de aparecer (sem atividade há 20 min).' : `Ao vivo · 📁 ${mirrorSession?.project ?? '…'} · ${mirrorSession?.title ?? ''}`}
                    </span>
                    <button className="btn sm" onClick={() => setPanel('livepick')}>Trocar</button>
                    <button className="btn sm ghost" onClick={() => setMirror(null)}>Sair</button>
                  </div>
                ),
              };
              return <Lab {...common} />;
            })()
          ) : view === 'live' ? (
            <Live data={live.data} error={live.error} known={runner.status?.config.projects.map((p) => p.dir) ?? []} onUse={attachLive} mirrorId={mirrorId} onMirror={setMirror} />
          ) : view === 'eco' ? (
            <Ecosystem state={state} projectName={projectName(runner.status)} onAgent={openAgent} />
          ) : view === 'done' ? (
            <Deliveries
              state={state}
              targetDir={runner.status?.config.targetDir}
              onLanded={(taskId, sha, branch) => dispatch({ type: 'landed', taskId, sha, branch })}
              onDiscarded={(taskId) => dispatch({ type: 'discarded', taskId })}
            />
          ) : (
            <Board state={state} onDelete={deleteTask} onRetry={(id) => dispatch({ type: 'retryTask', id })} />
          )}
        </section>

        <div className="side-stack">
          <Feed state={shown} />
          <Chat state={shown} onMuted={(muted) => dispatch({ type: 'setMuted', muted })} />
        </div>
      </div>

      <HeroBar state={shown} onAgent={mirrored ? (id) => setPanel({ liveWorker: id }) : openAgent} onNew={() => setPanel({ draft: newAgent() })} onExport={exportAgents} />

      <Credits />

      {panel === 'livepick' && live.data && <LivePicker data={live.data} onPick={setMirror} onClose={() => setPanel(null)} />}
      {liveWorker && <LiveHistory worker={liveWorker} onClose={() => setPanel(null)} />}
      {panel === 'score' && <Scoreboard state={state} onClose={() => setPanel(null)} onAgent={openAgent} />}
      {panel === 'accounts' && (
        <Accounts
          state={state}
          real={real}
          now={now}
          onClose={() => setPanel(null)}
          onConnections={applyConns}
          onRouting={(tier, providerId, modelId) => dispatch({ type: 'setRouting', tier, providerId, modelId })}
          onRefresh={() => refreshUsage(true)}
        />
      )}
      {panel === 'real' && (
        <RealConfig
          status={runner.status}
          connected={runner.connected}
          onClose={() => setPanel(null)}
          onSaved={runner.setStatus}
          onProjects={() => setPanel('projects')}
        />
      )}
      {panel === 'projects' && <Projects status={runner.status} onClose={() => setPanel(null)} onSaved={runner.setStatus} />}
      {panel === 'integrations' && <Integrations onClose={() => setPanel(null)} />}
      {panel && typeof panel === 'object' && 'task' in panel && (
        <TaskDetail
          key={panel.task}
          taskId={panel.task}
          state={state}
          onClose={() => setPanel(null)}
          onAgent={openAgent}
          onControl={control}
          onRetry={(id) => dispatch({ type: 'retryTask', id })}
          onDelete={deleteTask}
        />
      )}
      {panel && typeof panel === 'object' && 'term' in panel && state.agents.find((a) => a.id === panel.term) && (
        <AgentTerminal
          key={panel.term}
          agent={state.agents.find((a) => a.id === panel.term)!}
          state={state}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ agentId: panel.term })}
          onControl={control}
        />
      )}
      {editing?.agent && (
        <AgentEditor
          key={editing.agent.id}
          state={state}
          agent={editing.agent}
          isNew={editing.isNew}
          onClose={() => setPanel(null)}
          onSave={(agent) => dispatch({ type: 'saveAgent', agent })}
          onDelete={(id) => dispatch({ type: 'deleteAgent', id })}
        />
      )}

      {welcome && <Welcome agents={state.agents} onClose={closeWelcome} />}

      {toast && <div className="toast px">{toast}</div>}
    </div>
  );
}
