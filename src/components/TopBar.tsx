import { realUsage, arenaUsage, type RealUsage } from '../engine/usage';
import type { GameState } from '../types';
import { Bar, clock, fmtTokens, meterColor } from './ui';

interface Props {
  state: GameState;
  real: RealUsage | null;
  now: number;
  onSpeed: (s: GameState['speed']) => void;
  onScore: () => void;
  onAccounts: () => void;
  onIntegrations: () => void;
  onRealConfig: () => void;
  /** pasta alvo da execução real, para o tooltip */
  realTarget?: string;
  realRunning: number;
  onStopAll: () => void;
  onAbout: () => void;
  music: { on: boolean; volume: number };
  onMusic: (patch: Partial<{ on: boolean; volume: number }>) => void;
}

export function TopBar({ state, real, now, onSpeed, onScore, onAccounts, onIntegrations, onRealConfig, realTarget, realRunning, onStopAll, onAbout, music, onMusic }: Props) {
  const done = state.tasks.filter((t) => t.status === 'done').length;
  const doing = state.tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length;
  const queued = state.tasks.filter((t) => t.status === 'backlog').length;
  const bugs = state.agents.reduce((n, a) => n + a.stats.bugsFound, 0);

  return (
    <header className="topbar px">
      <div className="logo">
        <svg width="34" height="34" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
          <rect width="8" height="8" fill="#0a0d18" />
          <rect x="1" y="1" width="1" height="1" fill="#e8b64c" />
          <rect x="3" y="1" width="2" height="1" fill="#e8b64c" />
          <rect x="6" y="1" width="1" height="1" fill="#e8b64c" />
          <rect x="1" y="2" width="6" height="2" fill="#e8b64c" />
          <rect x="2" y="4" width="4" height="3" fill="#a970ff" />
          <rect x="3" y="5" width="2" height="1" fill="#fff3c4" />
        </svg>
        <div>
          AGENT ARENA
          <small>orquestre agentes de IA</small>
        </div>
      </div>

      <span className="clock" title="Tempo de partida">⏱ {clock(now - state.startedAt)}</span>

      <div className="top-stats">
        <div className="stat"><b className="good">{done}</b><span>feitas</span></div>
        <div className="stat"><b style={{ color: 'var(--blue)' }}>{doing}</b><span>em jogo</span></div>
        <div className="stat"><b style={{ color: 'var(--gold)' }}>{queued}</b><span>na fila</span></div>
        <div className="stat"><b className="bad">{bugs}</b><span>bugs pegos</span></div>
      </div>

      <div className="spacer" />

      <div className="token-pills">
        {state.providers
          .filter((p) => p.connected)
          .map((p) => {
            const r = realUsage(real, p.id, '5h', p.limits['5h'] ?? 0);
            const arena = arenaUsage(p, '5h', now).total;
            // % só quando o provedor informa o limite do plano de verdade (Claude); nos demais mostra o gasto do Arena
            const pct = r?.pct ?? null;
            return (
              <button
                key={p.id}
                className="token-pill"
                onClick={onAccounts}
                title={pct != null ? `${p.name}: ${Math.round(pct * 100)}% da janela de 5h (real). O Arena gastou ${fmtTokens(arena)} nas últimas 5h.` : `${p.name}: o provedor não informa o limite do plano. O Arena gastou ${fmtTokens(arena)} nas últimas 5h.`}
              >
                <div className="row">
                  <span className="name" style={{ color: p.color }}>{p.name}</span>
                  <b>{pct != null ? `${Math.round(pct * 100)}%` : fmtTokens(arena)}</b>
                </div>
                {pct != null ? <Bar value={pct} color={meterColor(pct)} className="thin" /> : <div className="muted tiny">tokens do Arena · 5h</div>}
              </button>
            );
          })}
        {!state.providers.some((p) => p.connected) && (
          <button className="token-pill missing" onClick={onAccounts}>
            <div className="row"><span className="name">Sem conta</span></div>
            <div className="muted tiny">conectar</div>
          </button>
        )}
      </div>

      {realRunning > 0 && (
        <div className="btn-group" role="group" aria-label="Agentes em execução">
          {state.speed === 0 ? (
            <button className="btn sm gold" onClick={() => onSpeed(1)} title="Descongela os agentes de onde pararam">▶ Retomar</button>
          ) : (
            <button className="btn sm" onClick={() => onSpeed(0)} title="Congela os agentes onde estão, sem perder nada">⏸ Pausar tudo</button>
          )}
          <button className="btn sm danger" onClick={onStopAll} title="Cancela o que todos os agentes estão fazendo agora">⏹ Parar tudo</button>
        </div>
      )}

      <nav className="top-nav" aria-label="Menu">
        <div className="btn-group">
          <button className="btn" onClick={onScore} title="Placar (tecla Tab)">🏆 Placar</button>
          <button className="btn" onClick={onAccounts}>🔌 Contas & Tokens</button>
          <button className="btn" onClick={onIntegrations} title="Em breve">🧩 Integrações <span className="soon-tag">em breve</span></button>
        </div>
        <div className="spacer" />
        <div className="btn-group">
          <button className="btn" onClick={onRealConfig} title={realTarget ? `Projeto: ${realTarget}` : 'Configurar a execução dos agentes'}>
            ⚙ Execução{realRunning ? ` · ${realRunning} rodando` : ''}
          </button>
          <div className={`music ${music.on ? 'on' : ''}`}>
            <button
              className={`btn ${music.on ? 'on' : ''}`}
              onClick={() => onMusic({ on: !music.on })}
              title={music.on ? 'Desligar a música de batalha' : 'Ligar a música de batalha'}
              aria-pressed={music.on}
              aria-label="Música de batalha"
            >
              {music.on ? '🔊' : '🔇'} Música
            </button>
            {music.on && (
              <input
                className="vol"
                type="range"
                min={0}
                max={100}
                value={Math.round(music.volume * 100)}
                onChange={(e) => onMusic({ volume: Number(e.target.value) / 100 })}
                aria-label="Volume da música"
                title={`Volume ${Math.round(music.volume * 100)}%`}
              />
            )}
          </div>
          <button className="btn" onClick={onAbout} title="O que é o Agent Arena e como funciona" aria-label="Sobre o Agent Arena">?</button>
        </div>
      </nav>
    </header>
  );
}
