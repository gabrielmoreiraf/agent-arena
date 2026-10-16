import { useState } from 'react';
import type { RawTask } from '../data/seedTasks';
import type { GameState } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  state: GameState;
  onAdd: (tasks: RawTask[]) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onDemo: () => void;
  onIntegrations: () => void;
  /** nome do projeto (pasta) onde as tarefas novas vão rodar */
  project?: string;
  onProjects: () => void;
}

export function TaskQueue({ state, onAdd, onDelete, onRetry, onDemo, onIntegrations, project, onProjects }: Props) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [showDesc, setShowDesc] = useState(false);

  const submit = () => {
    const lines = title
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onAdd(lines.map((t) => ({ title: t, description: desc.trim(), source: 'manual' })));
    setTitle('');
    setDesc('');
    setShowDesc(false);
  };

  const waiting = state.tasks.filter((t) => t.status === 'backlog' && !t.assigneeId);
  const queued = state.tasks.filter((t) => t.status === 'backlog' && t.assigneeId);
  const done = state.tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  return (
    <aside className="col px queue-col">
      <div className="col-head">
        <span className="px-title">Fila de tarefas</span>
        <button className="btn sm" onClick={onIntegrations}>⇩ Importar</button>
      </div>

      <div className="add-task">
        <button className={`project-pick ${project ? '' : 'missing'}`} onClick={onProjects} title="Escolher, criar ou anexar a pasta do projeto">
          <span>📁</span>
          <span className="grow">{project ?? 'Escolher projeto…'}</span>
          <span className="muted">▾</span>
        </button>
        <input
          className="input"
          placeholder="Nova tarefa... (Enter)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onPaste={(e) => {
            // colar várias linhas cria várias tarefas
            const text = e.clipboardData.getData('text');
            if (text.includes('\n')) {
              e.preventDefault();
              onAdd(
                text
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((t) => ({ title: t, source: 'manual' as const })),
              );
              setTitle('');
            }
          }}
        />
        {showDesc && (
          <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Detalhes (opcional) — ajudam o Maestro a medir a complexidade" value={desc} onChange={(e) => setDesc(e.target.value)} />
        )}
        <div className="row">
          <button className="btn gold sm" onClick={submit} disabled={!title.trim()}>
            + Enviar ao Maestro
          </button>
          <button className="btn ghost sm" onClick={() => setShowDesc((v) => !v)}>
            {showDesc ? '− detalhes' : '+ detalhes'}
          </button>
          <button className="btn ghost sm" onClick={onDemo} title="Carregar tarefas de exemplo">
            demo
          </button>
        </div>
      </div>

      <div className="scroll">
        {waiting.length > 0 && <div className="section-label">🎼 Maestro analisando ({waiting.length})</div>}
        {waiting.map((t) => (
          <TaskCard key={t.id} task={t} state={state} onDelete={() => onDelete(t.id)} onRetry={() => onRetry(t.id)} />
        ))}
        {queued.length > 0 && <div className="section-label">⏳ Na fila dos agentes ({queued.length})</div>}
        {queued.map((t) => (
          <TaskCard key={t.id} task={t} state={state} onDelete={() => onDelete(t.id)} onRetry={() => onRetry(t.id)} />
        ))}
        {done.length > 0 && <div className="section-label">✅ Concluídas ({done.length})</div>}
        {done.slice(0, 15).map((t) => (
          <TaskCard key={t.id} task={t} state={state} onDelete={() => onDelete(t.id)} onRetry={() => onRetry(t.id)} />
        ))}
        {!state.tasks.length && <div className="hint">Nenhuma tarefa ainda. Cole uma lista (uma por linha) para criar várias de uma vez.</div>}
      </div>
    </aside>
  );
}
