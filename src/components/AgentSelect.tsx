import { useEffect, useRef, useState } from 'react';
import type { Agent, Role } from '../types';
import { Avatar } from './ui';

const HINT: Partial<Record<Role, string>> = {
  'dev-junior': 'Tarefas leves e bem definidas (P)',
  'dev-pleno': 'Features médias, de ponta a ponta (M)',
  'dev-senior': 'Arquitetura e tarefas pesadas (G)',
  devops: 'Infra, deploy e CI/CD',
  dba: 'Banco de dados, queries e migrações',
  designer: 'UI/UX, layout e acessibilidade',
  qa: 'Escrever e rodar testes',
  custom: 'Agente personalizado',
};

/** Escolha de quem faz a tarefa: Automático (o Maestro decide) ou um agente específico */
export function AgentSelect({ agents, value, onChange }: { agents: Agent[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = agents.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="agent-select" ref={box}>
      <span className="label">Quem faz</span>
      <button type="button" className="as-button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        {current ? <Avatar agent={current} size={26} /> : <span className="as-ico">🎼</span>}
        <span className="as-text">
          <b>{current ? current.name : 'Automático'}</b>
          <small>{current ? current.title : 'o Maestro escolhe'}</small>
        </span>
        <span className="as-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="as-menu" role="listbox">
          <button type="button" role="option" aria-selected={!value} className={`as-opt ${!value ? 'on' : ''}`} onClick={() => pick('')}>
            <span className="as-ico">🎼</span>
            <span className="as-text">
              <b>Automático</b>
              <small>O Maestro lê a tarefa e escolhe o agente e o modelo</small>
            </span>
          </button>
          {agents
            .filter((a) => a.role !== 'maestro')
            .map((a) => (
              <button type="button" role="option" aria-selected={value === a.id} key={a.id} className={`as-opt ${value === a.id ? 'on' : ''}`} onClick={() => pick(a.id)}>
                <Avatar agent={a} size={28} />
                <span className="as-text">
                  <b>{a.name}</b>
                  <small>{a.title} · {HINT[a.role] ?? ''}</small>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
