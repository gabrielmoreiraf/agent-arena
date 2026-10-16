import { TIER_LABEL, WINDOW_LABEL } from '../data/providers';
import { isDetected, realUsage, simulatedUsage, type RealUsage } from '../engine/usage';
import type { GameState, Provider, Tier, WindowMode } from '../types';
import { Bar, fmtDuration, fmtTokens, meterColor, Modal } from './ui';

/** Presets de plano. Números são estimativas — ajuste para o seu caso. */
const PLANS: Record<string, { name: string; limits: Provider['limits'] }[]> = {
  claude: [
    { name: 'Pro', limits: { '5h': 1_200_000, weekly: 15_000_000 } },
    { name: 'Max 5x', limits: { '5h': 4_000_000, weekly: 60_000_000 } },
    { name: 'Max 20x', limits: { '5h': 15_000_000, weekly: 200_000_000 } },
    { name: 'API', limits: { daily: 50_000_000, monthly: 1_000_000_000 } },
  ],
  codex: [
    { name: 'Plus', limits: { '5h': 3_000_000, weekly: 40_000_000 } },
    { name: 'Pro', limits: { '5h': 20_000_000, weekly: 250_000_000 } },
    { name: 'API', limits: { daily: 50_000_000, monthly: 1_000_000_000 } },
  ],
  gemini: [
    { name: 'Gratuito', limits: { daily: 2_000_000, weekly: 12_000_000 } },
    { name: 'Pro', limits: { daily: 6_000_000, weekly: 35_000_000 } },
    { name: 'Ultra', limits: { daily: 20_000_000, weekly: 120_000_000 } },
  ],
  openrouter: [{ name: 'Pay-as-you-go', limits: { monthly: 100_000_000 } }],
};

const MODES: WindowMode[] = ['5h', 'daily', 'weekly', 'monthly'];

interface Props {
  state: GameState;
  real: RealUsage | null;
  now: number;
  onClose: () => void;
  onUpdate: (p: Provider) => void;
  onRouting: (tier: Tier, providerId: string, modelId: string) => void;
  onRefresh: () => void;
}

export function Accounts({ state, real, now, onClose, onUpdate, onRouting, onRefresh }: Props) {
  return (
    <Modal
      title="Contas & Tokens"
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ marginRight: 'auto' }}>
            {real ? `Logs locais lidos às ${new Date(real.at).toLocaleTimeString('pt-BR')}` : 'Lendo logs locais...'}
          </span>
          <button className="btn ghost" onClick={onRefresh}>↻ Atualizar uso real</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="hint">
        <b>Real</b> = lido dos logs das CLIs na sua máquina (Claude Code em <code>~/.claude</code>, Codex em <code>~/.codex</code>).{' '}
        <b>Arena</b> = o que os agentes gastaram na simulação. Os limites dos planos são estimativas editáveis: os provedores não publicam um número exato.
      </div>

      <div className="grid2">
        {state.providers.map((p) => (
          <ProviderCard key={p.id} p={p} real={real} now={now} onUpdate={onUpdate} />
        ))}
      </div>

      <div className="card">
        <div className="px-title">Como o Maestro escolhe o modelo</div>
        <div className="hint">
          O Maestro mede a complexidade (P → Leve, M → Médio, G → Pesado) e usa o modelo desta tabela para o provedor do agente.
          Se o QA devolver a mesma tarefa 2 vezes, ele sobe um nível.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="routing">
            <thead>
              <tr>
                <th>Peso</th>
                {state.providers.map((p) => (
                  <th key={p.id} style={{ color: p.color }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['leve', 'medio', 'pesado'] as Tier[]).map((tier) => (
                <tr key={tier}>
                  <td>
                    <span className={`chip cx-${tier === 'leve' ? 1 : tier === 'medio' ? 2 : 3}`}>
                      {TIER_LABEL[tier]} · {tier === 'leve' ? 'P' : tier === 'medio' ? 'M' : 'G'}
                    </span>
                  </td>
                  {state.providers.map((p) => (
                    <td key={p.id}>
                      <select className="select" value={state.routing[tier][p.id] ?? ''} onChange={(e) => onRouting(tier, p.id, e.target.value)}>
                        {p.models.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function ProviderCard({ p, real, now, onUpdate }: { p: Provider; real: RealUsage | null; now: number; onUpdate: (p: Provider) => void }) {
  const detected = isDetected(real, p.id);
  const hasKey = real?.apiKeys?.[p.id];
  const toggleMode = (m: WindowMode) => {
    const shown = p.shownModes.includes(m) ? p.shownModes.filter((x) => x !== m) : [...p.shownModes, m];
    onUpdate({ ...p, shownModes: MODES.filter((x) => shown.includes(x)), limits: { ...p.limits, [m]: p.limits[m] ?? 1_000_000 } });
  };

  return (
    <div className="card provider">
      <div className="provider-head">
        <span className="provider-logo" style={{ background: p.color }}>{p.name[0]}</span>
        <div>
          <div className="px-title" style={{ color: 'var(--text)' }}>{p.name}</div>
          <div className="small muted">{p.models.map((m) => m.label).join(' · ')}</div>
        </div>
        <span className="spacer" />
        <button className={`btn sm ${p.connected ? 'on' : ''}`} onClick={() => onUpdate({ ...p, connected: !p.connected })}>
          {p.connected ? 'Conectado' : 'Conectar'}
        </button>
      </div>

      <div className="btn-group" style={{ flexWrap: 'wrap' }}>
        <span className={`status ${detected ? 'ok' : 'off'}`}>CLI {detected ? 'detectada' : 'não encontrada'}</span>
        <span className={`status ${hasKey ? 'ok' : 'warn'}`}>API key {hasKey ? 'no .env.local' : 'ausente'}</span>
      </div>

      <label className="field">
        <span>Plano</span>
        <select
          className="select"
          value={p.plan}
          onChange={(e) => {
            const plan = PLANS[p.id]?.find((x) => x.name === e.target.value);
            if (plan) onUpdate({ ...p, plan: plan.name, limits: plan.limits, shownModes: MODES.filter((m) => plan.limits[m]) });
          }}
        >
          {(PLANS[p.id] ?? []).map((x) => (
            <option key={x.name}>{x.name}</option>
          ))}
        </select>
      </label>

      <div>
        <div className="section-label" style={{ marginTop: 0 }}>Modos de monitoramento</div>
        <div className="mode-toggle">
          {MODES.map((m) => (
            <button key={m} className={`btn sm ${p.shownModes.includes(m) ? 'on' : 'ghost'}`} onClick={() => toggleMode(m)}>
              {WINDOW_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {p.shownModes.map((mode) => {
        const limit = p.limits[mode] ?? 0;
        const r = realUsage(real, p.id, mode, limit);
        const sim = simulatedUsage(p, mode, now);
        const realRatio = r ? r.pct ?? (limit ? r.total / limit : 0) : 0;
        return (
          <div key={mode} className="meter">
            <div className="row">
              <b>{WINDOW_LABEL[mode]}</b>
              <span className="muted small">
                limite{' '}
                <input
                  className="input"
                  style={{ width: 90, padding: '2px 6px', display: 'inline-block' }}
                  key={limit}
                  defaultValue={fmtTokens(limit)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const v = parseTokens(e.target.value);
                    if (v != null) onUpdate({ ...p, limits: { ...p.limits, [mode]: v } });
                    else e.target.value = fmtTokens(limit);
                  }}
                  title="Ex.: 500k, 4M, 1.5M"
                />
              </span>
            </div>
            {r && (
              <>
                <Bar value={realRatio} color={meterColor(realRatio)} />
                <div className="row small">
                  <span>
                    Real: {r.pct != null ? `${Math.round(r.pct * 100)}%` : `${fmtTokens(r.total)} (${Math.round(realRatio * 100)}%)`}
                  </span>
                  <span className="muted">{r.resetsAt ? `reseta em ${fmtDuration(r.resetsAt - now)}` : mode === '5h' ? 'sem janela ativa' : 'janela móvel'}</span>
                </div>
              </>
            )}
            <Bar value={limit ? sim.total / limit : 0} color="var(--purple)" className="thin" />
            <div className="row small muted">
              <span>Arena: {fmtTokens(sim.total)}</span>
              <span>{sim.resetsAt ? `libera em ${fmtDuration(sim.resetsAt - now)}` : ''}</span>
            </div>
          </div>
        );
      })}

      {p.id === 'claude' && real?.claude.detected && Object.keys(real.claude.byModel).length > 0 && (
        <div className="small">
          <div className="section-label">Últimos 7 dias por modelo (real)</div>
          {Object.entries(real.claude.byModel)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([m, n]) => (
              <div key={m} className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="mono">{m}</span>
                <span>{fmtTokens(n)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function parseTokens(s: string): number | null {
  const m = s.trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*([km]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return Math.round(n * (m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1));
}
