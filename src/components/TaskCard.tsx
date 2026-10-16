import { TIER_LABEL } from '../data/providers';
import type { Agent, GameState, Task } from '../types';
import { Avatar, Bar, SourceBadge, fmtTokens } from './ui';

const TYPE_LABEL: Record<Task['type'], string> = {
  feature: 'feature',
  bug: 'bug',
  infra: 'infra',
  database: 'banco',
  test: 'teste',
  refactor: 'refator',
};
const SIZE = ['', 'P', 'M', 'G'];

export function TaskCard({ task, state, onDelete, onRetry }: { task: Task; state: GameState; onDelete?: () => void; onRetry?: () => void }) {
  const agent: Agent | undefined = state.agents.find((a) => a.id === task.assigneeId);
  const reviewer = state.agents.find((a) => a.id === task.reviewerId);
  const provider = state.providers.find((p) => p.id === (task.providerId ?? agent?.providerId));
  const model = provider?.models.find((m) => m.id === task.model);
  const max = task.status === 'review' ? 12 + task.complexity * 8 : task.effort;
  const thinking = !task.assigneeId && task.status === 'backlog';

  return (
    <div className={`task ${task.status === 'done' ? 'done' : ''} ${thinking ? 'thinking' : ''}`} title={task.reason}>
      {onDelete && (
        <button className="del" onClick={onDelete} aria-label="Remover tarefa">
          ✕
        </button>
      )}
      <div className="meta">
        <SourceBadge source={task.source} />
        {task.externalKey && task.url && (
          <a className="chip" href={task.url} target="_blank" rel="noreferrer">
            abrir ↗
          </a>
        )}
        {!thinking && (
          <>
            <span className="chip">{TYPE_LABEL[task.type]}</span>
            <span className={`chip cx-${task.complexity}`}>{SIZE[task.complexity]}</span>
            {model && (
              <span className="chip" style={{ color: provider?.color }}>
                {model.label} · {TIER_LABEL[task.tier]}
              </span>
            )}
            {task.bounces > 0 && <span className="chip bad">🐞 x{task.bounces}</span>}
            {task.projectDir && <span className="chip" title={task.projectDir}>📁 {task.projectDir.split('/').pop()}</span>}
            {task.worktree && !task.landedSha && !task.discarded && (
              <span className="chip good" title={`Branch isolada: ${task.worktree.branch}`}>🌿 branch</span>
            )}
            {task.landedSha && <span className="chip" title={`Merge ${task.landedSha}`}>🚀 aplicada</span>}
            {task.paused && <span className="chip bad">⏸ pausado</span>}
            {task.jobId && !task.paused && <span className="chip live" title="Claude Code rodando de verdade">⚡ ao vivo</span>}
            {!!task.realTokens && (
              <span className="chip" title={task.costUsd ? `Custo de API equivalente: US$ ${task.costUsd.toFixed(3)}` : 'Tokens reais'}>
                {fmtTokens(task.realTokens)} tok
              </span>
            )}
          </>
        )}
      </div>
      <div className="title">{task.title}</div>
      {thinking ? (
        <div className="who">🎼 Maestro analisando...</div>
      ) : (
        <>
          <div className="who">
            <Avatar agent={agent} size={22} />
            <span>{agent?.name ?? '—'}</span>
            {task.status === 'review' && reviewer && (
              <>
                <span>→</span>
                <Avatar agent={reviewer} size={22} />
                <span>{reviewer.name} revisando</span>
              </>
            )}
            {task.status === 'backlog' && <span>· na fila dele</span>}
          </div>
          {task.reason && task.status !== 'done' && (
            <div className="reason" title={task.reason}>
              {task.forcedAgentId ? '👤' : '🎼'} {task.reason}
            </div>
          )}
          {task.blocked && (
            <div className="small bad blocked">
              ⚠️ {task.blocked}
              {onRetry && (
                <button className="btn sm" onClick={onRetry}>Tentar de novo</button>
              )}
            </div>
          )}
          {task.output && task.status === 'done' && <div className="hint output">{task.output.replace(/\s+/g, ' ').slice(0, 180)}</div>}
          {task.status !== 'done' && (
            <Bar value={task.hp / Math.max(1, max)} color={task.status === 'review' ? 'var(--blue)' : 'var(--red)'} className="thin" />
          )}
        </>
      )}
    </div>
  );
}
