import { levelOf, xpForLevel } from '../data/agents';
import { providerFor } from '../data/providers';
import type { GameState } from '../types';
import { Avatar, Bar } from './ui';

interface Props {
  state: GameState;
  onAgent: (id: string) => void;
  onNew: () => void;
  onExport: () => void;
}

export function HeroBar({ state, onAgent, onNew, onExport }: Props) {
  return (
    <footer className="herobar px">
      {state.agents.map((a) => {
        const lvl = levelOf(a.xp);
        const lo = xpForLevel(lvl);
        const hi = xpForLevel(lvl + 1);
        const task = state.tasks.find((t) => t.id === a.currentTaskId);
        // na execução real todo agente roda no Claude, qualquer que seja o provedor configurado nele
        const provider = providerFor(state, a);
        const model = provider?.models.find((m) => m.id === task?.model);
        // custo em elixir: peso do modelo que o agente usa (Haiku 2, Sonnet 4, Opus 6 no Claude)
        const tier = task?.tier ?? { 'dev-junior': 'leve', 'dev-senior': 'pesado' }[a.role as string] ?? 'medio';
        const cost = a.role === 'maestro' ? 0 : tier === 'leve' ? 2 : tier === 'pesado' ? 6 : 4;
        let doing = 'ocioso — esperando o Maestro';
        if (a.role === 'maestro') {
          const pending = state.tasks.filter((t) => t.status === 'backlog' && !t.assigneeId).length;
          doing = pending ? `distribuindo ${pending} tarefa(s)` : 'regendo a orquestra';
        } else if (task) {
          doing = `${task.status === 'review' ? '🔍 revisando' : '⚔️'} ${task.title}`;
        }
        return (
          <button key={a.id} className="hero" onClick={() => onAgent(a.id)} title={cost ? `Custo em elixir: ${cost} (peso do modelo)` : undefined}>
            {cost > 0 && <span className="elixir-cost">{cost}</span>}
            <span className={`dot ${task || (a.role === 'maestro' && doing.startsWith('distribuindo')) ? 'busy' : ''}`} />
            <div className="portrait">
              <Avatar agent={a} size={48} />
              <span className="lv">{lvl}</span>
            </div>
            <div className="info">
              <span className="name">{a.name}</span>
              <span className="role">
                {a.title}
                {model ? (
                  <span style={{ color: provider?.color }}> · {model.label}</span>
                ) : (
                  <span style={{ color: provider?.color }}> · {provider?.name}</span>
                )}
              </span>
              <Bar value={(a.xp - lo) / Math.max(1, hi - lo)} className="thin xp" />
              <span className={`doing ${task ? '' : 'idle'}`}>{doing}</span>
              {a.queue.length > 0 && <span className="role">+{a.queue.length} na fila</span>}
            </div>
          </button>
        );
      })}
      <button className="hero add" onClick={onNew}>
        <span style={{ fontSize: 20 }}>＋</span>
        Novo agente
      </button>
      <button className="hero add" onClick={onExport} title="Gera .claude/agents/*.md para usar no Claude Code">
        <span style={{ fontSize: 20 }}>⇪</span>
        Exportar p/ Claude Code
      </button>
    </footer>
  );
}
