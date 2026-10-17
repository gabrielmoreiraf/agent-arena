import { useEffect, useRef, useState } from 'react';
import type { LogLine } from '../../server/runner';
import { TIER_LABEL } from '../data/providers';
import { MONSTERS, MONSTER_BY_TYPE, MONSTER_INFO } from '../sprites/monsters';
import { PixelSprite } from '../sprites/PixelSprite';
import type { GameState } from '../types';
import { time } from './AgentTerminal';
import { Avatar, Bar, fmtTokens, Modal } from './ui';

const SIZE = ['', 'P (leve)', 'M (média)', 'G (pesada)'];
const STATUS: Record<string, string> = { backlog: 'na fila', in_progress: 'em batalha', review: 'em revisão do QA', done: 'concluída' };
const LANE: Record<string, string> = { top: 'Front', mid: 'Back', bot: 'Infra/Dados', jungle: 'Testes' };

/** Detalhes de uma tarefa (o "monstro" da arena) + terminal ao vivo do que está sendo feito nela */
export function TaskDetail({
  taskId,
  state,
  onClose,
  onAgent,
  onControl,
  onRetry,
  onDelete,
}: {
  taskId: string;
  state: GameState;
  onClose: () => void;
  onAgent: (id: string) => void;
  onControl: (a: 'pause' | 'resume' | 'stop', agentId: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const task = state.tasks.find((t) => t.id === taskId);
  const [lines, setLines] = useState<LogLine[]>([]);
  const box = useRef<HTMLPreElement>(null);
  const [stick, setStick] = useState(true);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetch(`/api/real/log?taskId=${encodeURIComponent(taskId)}`)
        .then((r) => r.json())
        .then((d) => alive && setLines(d.lines ?? []))
        .catch(() => undefined);
    pull();
    const id = setInterval(pull, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [taskId]);
  useEffect(() => {
    if (stick && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, stick]);

  if (!task) return null;
  const mKey = MONSTER_BY_TYPE[task.type] ?? 'slime';
  const m = MONSTERS[mKey];
  const info = MONSTER_INFO[task.type];
  const dev = state.agents.find((a) => a.id === task.assigneeId);
  const qa = state.agents.find((a) => a.id === task.reviewerId);
  const worker = task.status === 'review' ? qa : dev;
  const provider = state.providers.find((p) => p.id === (task.providerId ?? dev?.providerId));
  const model = provider?.models.find((p) => p.id === task.model);
  const max = task.status === 'review' ? 12 + task.complexity * 8 : task.effort;
  const hpPct = task.status === 'done' ? 0 : task.hp / Math.max(1, max);
  const sim = state.feed.filter((f) => f.text.includes(task.title)).slice(0, 30).reverse();

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <PixelSprite rows={m.rows} palette={m.palette} size={30} /> {task.title}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          {task.blocked && <button className="btn gold" onClick={() => onRetry(task.id)}>Tentar de novo</button>}
          <button className="btn ghost" onClick={() => { onDelete(task.id); onClose(); }}>🗑 Remover tarefa</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="hint card flow">
        <b>O que é este personagem?</b> Cada monstro é uma <b>tarefa</b> vinda do Backlog. Este é um <b>{info?.name}</b>: tipo{' '}
        <b>{info?.kind}</b> ({info?.hint}). O tamanho dele (P/M/G) é a complexidade que o Maestro mediu, e a barra vermelha é o que
        ainda falta fazer. Quando a barra zera e o QA aprova, a tarefa cai e conta para a torre da lane.
      </div>

      <div className="task-facts">
        <span className="chip">{info?.kind}</span>
        <span className={`chip cx-${task.complexity}`}>{SIZE[task.complexity]}</span>
        <span className="chip">lane {LANE[task.lane ?? 'mid']}</span>
        <span className="chip">{STATUS[task.status]}</span>
        {model && <span className="chip" style={{ color: provider?.color }}>{model.label} · {TIER_LABEL[task.tier]}</span>}
        {task.bounces > 0 && <span className="chip bad">🐞 voltou {task.bounces}x</span>}
        {task.projectDir && <span className="chip" title={task.projectDir}>📁 {task.projectDir.split(/[\\/]/).pop()}</span>}
        {task.worktree && !task.landedSha && !task.discarded && <span className="chip good" title={task.worktree.branch}>🌿 {task.worktree.branch}</span>}
        {task.paused && <span className="chip bad">⏸ pausada</span>}
        {!!task.realTokens && <span className="chip">{fmtTokens(task.realTokens)} tokens</span>}
      </div>

      {task.status !== 'done' && (
        <div className="block">
          <div className="section-label">Progresso (vida do monstro)</div>
          <Bar value={hpPct} color={task.status === 'review' ? 'var(--blue)' : 'var(--red)'} />
        </div>
      )}

      {task.description && (
        <div className="block">
          <div className="section-label">Descrição</div>
          <div className="prose-box">{task.description}</div>
        </div>
      )}

      {task.reason && (
        <div className="block">
          <div className="section-label">🎼 Por que o Maestro escolheu</div>
          <div className="small">{task.reason}</div>
        </div>
      )}

      <div className="block">
        <div className="section-label">Quem está nela</div>
        <div className="task-people">
          {dev && (
            <button className="btn sm" onClick={() => onAgent(dev.id)}>
              <Avatar agent={dev} size={20} /> {dev.name} <span className="muted">(dev)</span>
            </button>
          )}
          {qa && (
            <button className="btn sm" onClick={() => onAgent(qa.id)}>
              <Avatar agent={qa} size={20} /> {qa.name} <span className="muted">(QA)</span>
            </button>
          )}
          {!dev && <span className="muted small">Ainda esperando o Maestro escolher.</span>}
          {task.jobId && worker && (
            <span className="btn-group">
              {task.paused ? (
                <button className="btn sm gold" onClick={() => onControl('resume', worker.id)}>▶ Retomar</button>
              ) : (
                <button className="btn sm" onClick={() => onControl('pause', worker.id)}>⏸ Pausar</button>
              )}
              <button className="btn sm danger" onClick={() => onControl('stop', worker.id)}>⏹ Parar</button>
            </span>
          )}
        </div>
      </div>

      {task.blocked && <div className="small bad">⚠️ {task.blocked}</div>}
      {task.output && (
        <div className="block">
          <div className="section-label">📦 O que o agente entregou</div>
          <div className="prose-box">{task.output}</div>
        </div>
      )}
      {task.qaNote && (
        <div className="block">
          <div className="section-label">🔍 Veredito do QA</div>
          <div className="prose-box">{task.qaNote}</div>
        </div>
      )}
      {!!task.files?.length && (
        <div className="block">
          <div className="section-label">🗂 Arquivos</div>
          <div className="small">{task.files.map((f) => f.path).join(', ')}</div>
        </div>
      )}

      <div className="block">
        <div className="section-label">Terminal da tarefa (ao vivo)</div>
        <pre
          ref={box}
          className="term"
          style={{ height: 240 }}
          onScroll={(e) => {
            const el = e.currentTarget;
            setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
          }}
        >
          {lines.length ? (
            lines.map((l, i) => (
              <span key={i} className={`tl ${l.kind}`}>
                <span className="ts">{time(l.t)}</span>
                {l.kind === 'text' ? '💬 ' : ''}
                {l.text}
                {'\n'}
              </span>
            ))
          ) : sim.length ? (
            sim.map((f) => (
              <span key={f.id} className="tl text">
                <span className="ts">{time(f.at)}</span>
                {f.text}
                {'\n'}
              </span>
            ))
          ) : (
            <span className="tl out">Ainda sem atividade. Na Execução real, cada comando, leitura e edição aparece aqui.{'\n'}</span>
          )}
        </pre>
      </div>
    </Modal>
  );
}
