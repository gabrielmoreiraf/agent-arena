import type { GameState, Task } from '../types';
import { TaskCard } from './TaskCard';

const COLUMNS: { key: string; label: string; match: (t: Task) => boolean }[] = [
  { key: 'triage', label: '🎼 Fila do Maestro', match: (t) => t.status === 'backlog' },
  { key: 'doing', label: '⚔️ Em andamento', match: (t) => t.status === 'in_progress' },
  { key: 'review', label: '🔍 Revisão do QA', match: (t) => t.status === 'review' },
  { key: 'done', label: '✅ Concluído', match: (t) => t.status === 'done' },
];

export function Board({ state, onDelete, onRetry }: { state: GameState; onDelete: (id: string) => void; onRetry: (id: string) => void }) {
  return (
    <div className="board">
      {COLUMNS.map((c) => {
        const tasks = state.tasks.filter(c.match);
        if (c.key === 'done') tasks.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
        return (
          <section key={c.key} className="col px">
            <div className="col-head">
              <span className="px-title">{c.label}</span>
              <span className="chip">{tasks.length}</span>
            </div>
            <div className="scroll">
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} state={state} onDelete={() => onDelete(t.id)} onRetry={() => onRetry(t.id)} />
              ))}
              {!tasks.length && <div className="hint">Vazio</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
