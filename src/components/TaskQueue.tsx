import { useState } from 'react';
import type { GameState, RawTask } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  state: GameState;
  onAdd: (tasks: RawTask[]) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onIntegrations: () => void;
  /** nome do projeto (pasta) onde as tarefas novas vão rodar */
  project?: string;
  onProjects: () => void;
  /** nenhuma conta de IA conectada: as tarefas não têm quem execute */
  noAccount?: boolean;
  onAccounts: () => void;
}

export function TaskQueue({ state, onAdd, onDelete, onRetry, onIntegrations, project, onProjects, noAccount, onAccounts }: Props) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [agentId, setAgentId] = useState('');

  const submit = () => {
    const lines = title
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    onAdd(lines.map((t) => ({ title: t, description: desc.trim(), source: 'manual', agentId: agentId || undefined })));
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

      {noAccount && (
        <button className="project-pick missing" onClick={onAccounts} title="Conectar uma conta de IA">
          <span>🔌</span>
          <span className="grow">Conecte uma conta de IA para começar</span>
        </button>
      )}
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
        <label className="agent-pick" title="Deixe em Automático para o Maestro decidir, ou escolha quem faz">
          <span>Quem faz</span>
          <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">🎼 Automático (o Maestro escolhe)</option>
            {state.agents
              .filter((a) => a.role !== 'maestro')
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {a.title}</option>
              ))}
          </select>
        </label>
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
        </div>
      </div>

      <details className="how">
        <summary>Como o Maestro decide quem faz?</summary>
        <ol>
          <li><b>Lê</b> o título e os detalhes da tarefa e mede o <b>tipo</b> (feature, bug, infra, banco, teste, refatoração) e o <b>tamanho</b>: P (leve), M (média) ou G (pesada). Quanto mais claro o texto, melhor a escolha.</li>
          <li><b>Escolhe o agente</b>: banco → Dona Query, infra/deploy → Ops Rocha, design/UX → Lia Pixel, testes → QA. Para o resto, um dev pela senioridade: P → Juninho, M → Plenão, G → Seu Sênior (agentes seus, com palavras-chave, têm prioridade). Empate: o menos ocupado.</li>
          <li><b>Escolhe o modelo</b> pelo tamanho, na tabela de <i>Contas & Tokens</i> (P → leve, M → médio, G → pesado), usando o provedor do agente (ou outro conectado).</li>
          <li>O <b>motivo</b> aparece no card da tarefa e no registro de batalha. Se o QA devolver 2 vezes, ele sobe um nível de modelo.</li>
          <li>Prefere decidir você? Em <b>Quem faz</b> escolha o agente: o Maestro só mede tipo e tamanho.</li>
        </ol>
      </details>

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
