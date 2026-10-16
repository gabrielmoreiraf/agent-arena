import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Accounts } from './components/Accounts';
import { AgentEditor, newAgent } from './components/AgentEditor';
import { Arena } from './components/Arena';
import { Board } from './components/Board';
import { Welcome } from './components/Welcome';
import { TaskDetail } from './components/TaskDetail';
import { AgentTerminal } from './components/AgentTerminal';
import { Deliveries } from './components/Deliveries';
import { Ecosystem } from './components/Ecosystem';
import { Feed } from './components/Feed';
import { HeroBar } from './components/HeroBar';
import { Integrations } from './components/Integrations';
import { Projects, projectName } from './components/Projects';
import { RealConfig } from './components/RealConfig';
import { realUsage, simulatedUsage } from './engine/usage';
import { Scoreboard } from './components/Scoreboard';
import { TaskQueue } from './components/TaskQueue';
import { TopBar } from './components/TopBar';
import { DEMO_TASKS, type RawTask } from './data/seedTasks';
import { loadState, reducer, saveState } from './engine/game';
import { cancelJob, controlJobs, useRealRunner } from './engine/realRunner';
import type { RealUsage } from './engine/usage';
import type { Agent, RunMode } from './types';

type Panel = null | 'score' | 'accounts' | 'integrations' | 'real' | 'projects' | { term: string } | { task: string } | { agentId: string } | { draft: Agent };

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [view, setView] = useState<'arena' | 'board' | 'done' | 'eco'>('arena');
  const [panel, setPanel] = useState<Panel>(null);
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
  const refreshUsage = useCallback(() => {
    fetch('/api/usage')
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
  const setMode = (mode: RunMode) => {
    if (mode === state.mode) return;
    const cfg = runner.status;
    if (mode === 'real' && !(cfg?.exists && cfg.claude)) return setPanel('real');
    dispatch({ type: 'setMode', mode });
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

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const addTasks = (tasks: RawTask[]) => dispatch({ type: 'addTasks', tasks, projectDir: projectRef.current });
  const demo = () => addTasks(DEMO_TASKS);

  // ?demo na URL já começa com as tarefas de exemplo
  useEffect(() => {
    if (new URLSearchParams(location.search).has('demo') && !latest.current.tasks.length) demo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // elixir = o que sobra da janela de 5h do Claude
  const claude = state.providers.find((p) => p.id === 'claude');
  const limit5h = claude?.limits['5h'] ?? 0;
  const r5 = claude ? realUsage(real, 'claude', '5h', limit5h) : null;
  const used5 = r5?.total ?? (claude ? simulatedUsage(claude, '5h', now).total : 0);
  const elixir = limit5h ? Math.max(0, 1 - (r5?.pct ?? used5 / limit5h)) : 1;

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
        onMode={setMode}
        onRealConfig={() => setPanel('real')}
        realTarget={runner.status?.config.targetDir}
        realRunning={state.tasks.filter((t) => t.jobId).length}
        onStopAll={stopAll}
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
          onDemo={demo}
          onIntegrations={() => setPanel('integrations')}
        />

        <section className="arena-wrap">
          <div className="arena-tabs">
            <button className={`btn sm ${view === 'arena' ? 'on' : ''}`} onClick={() => setView('arena')}>Arena</button>
            <button className={`btn sm ${view === 'board' ? 'on' : ''}`} onClick={() => setView('board')}>Quadro</button>
            <button className={`btn sm ${view === 'eco' ? 'on' : ''}`} onClick={() => setView('eco')}>Ecossistema</button>
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
          {view === 'arena' ? (
            <Arena state={state} onAgent={openAgent} onDemo={demo} onIntegrations={() => setPanel('integrations')} onControl={(a, id) => control(a, id)} onTask={(id) => setPanel({ task: id })} elixir={elixir} elixirLabel={`Elixir: ${Math.round(elixir * 100)}% da janela de 5h do Claude`} />
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

        <Feed state={state} />
      </div>

      <HeroBar state={state} onAgent={openAgent} onNew={() => setPanel({ draft: newAgent() })} onExport={exportAgents} />

      {panel === 'score' && <Scoreboard state={state} onClose={() => setPanel(null)} onAgent={openAgent} />}
      {panel === 'accounts' && (
        <Accounts
          state={state}
          real={real}
          now={now}
          onClose={() => setPanel(null)}
          onUpdate={(provider) => dispatch({ type: 'updateProvider', provider })}
          onRouting={(tier, providerId, modelId) => dispatch({ type: 'setRouting', tier, providerId, modelId })}
          onRefresh={refreshUsage}
        />
      )}
      {panel === 'real' && (
        <RealConfig
          status={runner.status}
          connected={runner.connected}
          enabled={state.mode === 'real'}
          onClose={() => setPanel(null)}
          onSaved={runner.setStatus}
          onEnable={() => dispatch({ type: 'setMode', mode: 'real' })}
          onProjects={() => setPanel('projects')}
        />
      )}
      {panel === 'projects' && <Projects status={runner.status} onClose={() => setPanel(null)} onSaved={runner.setStatus} />}
      {panel === 'integrations' && <Integrations onClose={() => setPanel(null)} onImport={addTasks} onDemo={demo} />}
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

      {welcome && <Welcome agents={state.agents} onClose={closeWelcome} onDemo={demo} hosted={runner.status === null} />}

      {toast && <div className="toast px">{toast}</div>}
    </div>
  );
}
