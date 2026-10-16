import { levelOf, rankOf } from '../data/agents';
import type { Agent, GameState } from '../types';
import { Avatar, fmtTokens, Modal } from './ui';

export function scoreOf(a: Agent) {
  const s = a.stats;
  return s.done * 100 + s.reviews * 20 + s.bugsFound * 30 - s.bugsCaused * 40 + levelOf(a.xp) * 50 + s.streak * 10;
}

export function Scoreboard({ state, onClose, onAgent }: { state: GameState; onClose: () => void; onAgent: (id: string) => void }) {
  const ranked = state.agents.filter((a) => a.role !== 'maestro').sort((a, b) => scoreOf(b) - scoreOf(a));
  const mvp = ranked[0] && scoreOf(ranked[0]) > 0 ? ranked[0].id : undefined;
  const qa = state.agents.filter((a) => a.role === 'qa');
  const devs = state.agents.filter((a) => a.role.startsWith('dev') || a.role === 'custom');
  const bugsFound = qa.reduce((n, a) => n + a.stats.bugsFound, 0);
  const bugsCaused = devs.reduce((n, a) => n + a.stats.bugsCaused, 0);
  const shipped = devs.reduce((n, a) => n + a.stats.done, 0);

  return (
    <Modal title="Placar da partida" onClose={onClose}>
      <div className="card">
        <div className="section-label" style={{ margin: 0 }}>Rivalidade eterna</div>
        <div className="rivalry">
          <div>
            <div className="big good">{shipped}</div>
            <div className="muted">entregas dos Devs</div>
          </div>
          <div className="vs">VS</div>
          <div>
            <div className="big bad">{bugsFound}</div>
            <div className="muted">bugs achados pelo QA</div>
          </div>
        </div>
        <div className="hint" style={{ textAlign: 'center' }}>
          {bugsCaused === 0
            ? 'Nenhum bug devolvido ainda. O QA está desconfiado.'
            : `O QA já devolveu ${bugsCaused} entrega(s). Os devs juram que era feature.`}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="score-table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Nível</th>
              <th>Elo</th>
              <th title="Tarefas concluídas">Feitas</th>
              <th title="Bugs que o QA achou nas entregas dele">Bugs causados</th>
              <th title="Bugs achados (QA)">Bugs achados</th>
              <th>Revisões</th>
              <th>Sequência</th>
              <th>Tokens</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((a) => (
              <tr key={a.id} className={a.id === mvp ? 'mvp' : ''} onClick={() => onAgent(a.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="who">
                    <Avatar agent={a} size={32} />
                    <div>
                      <div>
                        {a.name} {a.id === mvp && <span className="chip" style={{ color: 'var(--gold)' }}>👑 MVP</span>}
                      </div>
                      <div className="muted small">{a.title}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{levelOf(a.xp)}</td>
                <td>{rankOf(levelOf(a.xp))}</td>
                <td className="num good">{a.stats.done}</td>
                <td className="num bad">{a.stats.bugsCaused}</td>
                <td className="num">{a.stats.bugsFound}</td>
                <td className="num">{a.stats.reviews}</td>
                <td className="num">{a.stats.streak ? `🔥${a.stats.streak}` : '—'}</td>
                <td className="num">{fmtTokens(a.stats.tokens)}</td>
                <td className="num" style={{ color: 'var(--gold)' }}>{scoreOf(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint">
        Score = feitas×100 + revisões×20 + bugs achados×30 − bugs causados×40 + nível×50 + sequência×10.
      </div>
    </Modal>
  );
}
