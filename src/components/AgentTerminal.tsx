import { useEffect, useRef, useState } from 'react';
import type { LogLine } from '../../server/runner';
import type { Agent, GameState } from '../types';
import { Avatar, fmtTokens, Modal } from './ui';

interface Current {
  jobId: string;
  taskId: string;
  title: string;
  paused: boolean;
  progress: number;
  tokens: number;
}

export const time = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour12: false });

/** "Terminal" ao vivo do agente: o que ele está fazendo agora (ferramentas, saídas e falas) + pausar/retomar/parar */
export function AgentTerminal({ agent, state, onClose, onEdit, onControl }: { agent: Agent; state: GameState; onClose: () => void; onEdit: () => void; onControl: (a: 'pause' | 'resume' | 'stop', agentId: string) => void }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [stick, setStick] = useState(true);
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetch(`/api/real/log?agentId=${encodeURIComponent(agent.id)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setLines(d.lines ?? []);
          setCurrent(d.current ?? null);
        })
        .catch(() => undefined);
    pull();
    const id = setInterval(pull, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [agent.id]);

  useEffect(() => {
    if (stick && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, stick]);

  // sem execução real (simulação): mostra o registro de batalha do agente
  const sim = state.feed.filter((f) => f.agentId === agent.id).slice(0, 40).reverse();
  const task = state.tasks.find((t) => t.id === agent.currentTaskId);
  const act = (a: 'pause' | 'resume' | 'stop') => {
    onControl(a, agent.id);
    setTimeout(() => setCurrent((c) => (c && a === 'pause' ? { ...c, paused: true } : c && a === 'resume' ? { ...c, paused: false } : c)), 50);
  };

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Avatar agent={agent} size={28} /> {agent.name} · terminal
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onEdit}>✏️ Editar agente</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="term-head">
        <span className={`status ${current ? (current.paused ? 'warn' : 'ok') : 'off'}`}>{current ? (current.paused ? 'pausado' : 'trabalhando') : task ? 'na fila' : 'livre'}</span>
        <span className="grow small">{current?.title ?? task?.title ?? 'Nenhuma tarefa agora.'}</span>
        {current && <span className="chip">{fmtTokens(current.tokens)} tok</span>}
        {current && (
          <div className="btn-group">
            {current.paused ? (
              <button className="btn sm gold" onClick={() => act('resume')}>▶ Retomar</button>
            ) : (
              <button className="btn sm" onClick={() => act('pause')}>⏸ Pausar</button>
            )}
            <button className="btn sm danger" onClick={() => act('stop')}>⏹ Parar</button>
          </div>
        )}
      </div>

      <pre
        ref={box}
        className="term"
        onScroll={(e) => {
          const el = e.currentTarget;
          setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {lines.length ? (
          lines.map((l, i) => (
            <span key={i} className={`tl ${l.kind}`}>
              <span className="ts">{time(l.t)}</span>
              {l.kind === 'tool' ? '' : l.kind === 'text' ? '💬 ' : ''}
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
          <span className="tl out">Nada por aqui ainda. Na Execução real, cada comando, leitura e edição do agente aparece neste terminal em tempo real.{'\n'}</span>
        )}
      </pre>
      {!stick && (
        <button className="btn sm" onClick={() => setStick(true)}>↓ Ir para o fim</button>
      )}
    </Modal>
  );
}
