import { WINDOW_LABEL } from '../data/providers';
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
            const mode = p.shownModes[0] ?? '5h';
            const limit = p.limits[mode] ?? 0;
            const r = realUsage(real, p.id, mode, limit);
            const used = r?.total ?? arenaUsage(p, mode, now).total;
            const ratio = r?.pct ?? (limit ? used / limit : 0);
            return (
              <button key={p.id} className="token-pill" onClick={onAccounts} title={r ? 'Uso real lido dos logs locais' : 'Uso simulado pela arena'}>
                <div className="row">
                  <span className="name" style={{ color: p.color }}>{p.name}</span>
                  <span>{Math.round(ratio * 100)}%</span>
                </div>
                <Bar value={ratio} color={meterColor(ratio)} className="thin" />
                <div className="row muted" style={{ fontSize: 14 }}>
                  <span>{WINDOW_LABEL[mode]}{r ? ' · real' : ''}</span>
                  <span>{fmtTokens(used)}</span>
                </div>
              </button>
            );
          })}
      </div>

      <div className="btn-group" role="group" aria-label="Execução">
        <button className="btn sm" onClick={onRealConfig} title={realTarget ? `Projeto: ${realTarget}` : 'Configurar a execução dos agentes'}>
          ⚙ Execução{realRunning ? ` (${realRunning} rodando)` : ''}
        </button>
      </div>

      <div className="btn-group music" role="group" aria-label="Música">
        <button
          className={`btn sm ${music.on ? 'on' : ''}`}
          onClick={() => onMusic({ on: !music.on })}
          title={music.on ? 'Desligar a música de batalha' : 'Ligar a música de batalha'}
          aria-pressed={music.on}
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

      <div className="btn-group" role="group" aria-label="Velocidade">
        <button className={`btn sm ${state.speed === 0 ? 'on' : ''}`} onClick={() => onSpeed(0)} title="Pausar tudo (na execução real, congela os agentes onde estão)">❚❚</button>
        <button className={`btn sm ${state.speed === 1 ? 'on' : ''}`} onClick={() => onSpeed(1)} title="Normal">▶</button>
        <button className={`btn sm ${state.speed === 3 ? 'on' : ''}`} onClick={() => onSpeed(3)} title="Rápido">▶▶</button>
        {realRunning > 0 && (
          <button className="btn sm danger" onClick={onStopAll} title="Para todos os agentes agora (cancela o que estão fazendo)">⏹ Parar tudo</button>
        )}
      </div>

      <div className="btn-group">
        <button className="btn" onClick={onScore}>Placar [Tab]</button>
        <button className="btn" onClick={onAccounts}>Contas & Tokens</button>
        <button className="btn" onClick={onIntegrations} title="Em breve">Integrações <span className="soon-tag">em breve</span></button>
        <button className="btn" onClick={onAbout} title="O que é o Agent Arena e como funciona" aria-label="Sobre o Agent Arena">?</button>
      </div>
    </header>
  );
}
