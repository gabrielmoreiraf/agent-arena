import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '../../server/connections';
import { TIER_LABEL } from '../data/providers';
import { arenaUsage, type RealUsage } from '../engine/usage';
import type { GameState, Provider, Tier } from '../types';
import { BrandLogo } from './BrandLogo';
import { Bar, fmtTokens, meterColor, Modal } from './ui';

async function api<T = any>(url: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Não encontrei o servidor local. Abra o painel por http://127.0.0.1:5178 (npm run dev).');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

interface Session {
  id: string;
  title: string;
  lines: { t: number; kind: 'out' | 'err' | 'in' | 'info'; text: string }[];
  links: string[];
  running: boolean;
  exitCode: number | null;
}

interface Props {
  state: GameState;
  real: RealUsage | null;
  now: number;
  onClose: () => void;
  onRouting: (tier: Tier, providerId: string, modelId: string) => void;
  onRefresh: () => void;
  /** avisa o app quais provedores estão conectados (só eles recebem tarefas) */
  onConnections: (list: ConnectionStatus[]) => void;
}

export function Accounts({ state, real, now, onClose, onRouting, onRefresh, onConnections }: Props) {
  const [list, setList] = useState<ConnectionStatus[] | null>(null);
  const [err, setErr] = useState('');
  const [login, setLogin] = useState<{ provider: string; id: string } | null>(null);
  const cb = useRef(onConnections);
  cb.current = onConnections;

  const refresh = useCallback(async () => {
    try {
      const l = await api<ConnectionStatus[]>('/api/connections');
      setList(l);
      setErr('');
      cb.current(l);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    // quem conecta pelo navegador (OpenRouter) ou pelo Terminal (Gemini) termina fora do app: confere de tempos em tempos
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const by = (id: string) => list?.find((c) => c.id === id);
  const connected = state.providers.filter((p) => by(p.id)?.connected);

  return (
    <Modal
      title="Contas & Tokens"
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ marginRight: 'auto' }}>
            {real ? `Uso lido às ${new Date(real.at).toLocaleTimeString('pt-BR')}` : 'Lendo o uso...'}
          </span>
          <button className="btn ghost" onClick={() => { onRefresh(); void refresh(); }}>↻ Atualizar</button>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="hint">
        Conecte <b>só as contas que quiser</b>. Cada agente usa o provedor configurado nele; se esse provedor não estiver conectado, a tarefa
        vai para um que esteja. As contas ficam na sua máquina: o Agent Arena só chama as CLIs que você já instalou.
      </div>
      {err && <div className="small bad">{err}</div>}

      <div className="grid2">
        {state.providers.map((p) => (
          <ProviderCard key={p.id} p={p} c={by(p.id)} real={real} now={now} onChanged={refresh} onLogin={(id) => setLogin({ provider: p.id, id })} />
        ))}
      </div>

      {connected.length > 0 && (
        <div className="card">
          <div className="px-title">Como o Maestro escolhe o modelo</div>
          <div className="hint">
            O Maestro mede a complexidade (P → Leve, M → Médio, G → Pesado) e usa o modelo desta tabela para o provedor do agente. Se o QA
            devolver a mesma tarefa 2 vezes, ele sobe um nível.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="routing">
              <thead>
                <tr>
                  <th>Peso</th>
                  {connected.map((p) => (
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
                    {connected.map((p) => (
                      <td key={p.id}>
                        {p.id === 'claude' ? (
                          <select className="select" value={state.routing[tier][p.id] ?? ''} onChange={(e) => onRouting(tier, p.id, e.target.value)}>
                            {p.models.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          // os modelos mudam com frequência: dá para digitar o id exato que a CLI/OpenRouter aceita
                          <>
                            <input
                              className="input"
                              list={`models-${p.id}`}
                              key={state.routing[tier][p.id]}
                              defaultValue={state.routing[tier][p.id] ?? ''}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                              onBlur={(e) => e.target.value.trim() && onRouting(tier, p.id, e.target.value.trim())}
                              title="Id do modelo (ex.: gemini-2.5-pro)"
                            />
                            <datalist id={`models-${p.id}`}>
                              {p.models.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </datalist>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {login && <LoginTerminal sessionId={login.id} onClose={() => { setLogin(null); void refresh(); }} />}
    </Modal>
  );
}

function ProviderCard({
  p,
  c,
  real,
  now,
  onChanged,
  onLogin,
}: {
  p: Provider;
  c?: ConnectionStatus;
  real: RealUsage | null;
  now: number;
  onChanged: () => void;
  onLogin: (sessionId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const id = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(id);
  }, [confirm]);

  const act = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg('');
    try {
      const m = await fn();
      if (m) setMsg(m);
      onChanged();
    } catch (e) {
      setMsg(`Erro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const connect = (method?: string) =>
    act(async () => {
      const r = await api('/api/connections/login', { provider: p.id, method });
      if (r.session) onLogin(r.session.id);
      else if (r.terminal) return 'Abri o Terminal rodando "gemini". Escolha "Login with Google", conclua no navegador e volte aqui.';
      else if (r.opened) return 'Abri o OpenRouter no navegador. Autorize e volte aqui: esta tela atualiza sozinha.';
    });

  const sent5 = arenaUsage(p, '5h', now).total;
  const week = arenaUsage(p, 'weekly', now).total;
  const claudeWindows = p.id === 'claude' && c?.connected ? real?.account?.windows ?? [] : [];

  const status = !c ? '…' : !c.installed ? 'não instalado' : c.connected ? 'conectado' : 'desconectado';
  const statusClass = !c ? 'off' : c.connected ? 'ok' : !c.installed ? 'off' : 'warn';

  return (
    <div className="card provider">
      <div className="provider-head">
        <BrandLogo id={p.id} />
        <div>
          <div className="px-title" style={{ color: 'var(--text)' }}>{p.name}</div>
          <div className="small muted">{p.models.map((m) => m.label).join(' · ')}</div>
        </div>
        <span className="spacer" />
        {p.id !== 'claude' && <span className="status warn" title="Execução ainda pouco testada com este provedor">experimental</span>}
        <span className={`status ${statusClass}`}>{status}</span>
      </div>

      {c?.connected ? (
        <div className="small">
          <div>
            <b>{c.account ?? 'conta conectada'}</b>
          </div>
          <div className="muted">
            {[c.plan && `plano ${c.plan}`, c.detail, c.version].filter(Boolean).join(' · ')}
          </div>
        </div>
      ) : c && !c.installed ? (
        <div className="hint card flow">
          A CLI do {p.name} não está instalada nesta máquina. Para usar, instale e volte aqui:
          <div className="cmd">
            <code>{c.installHint}</code>
            <button
              className="btn sm"
              onClick={() => {
                void navigator.clipboard?.writeText(c.installHint ?? '').then(() => setCopied(true));
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      ) : (
        c && <div className="small muted">Não conectado. Conecte para os agentes desse provedor poderem trabalhar.</div>
      )}
      {c?.error && <div className="small bad">{c.error}</div>}

      {claudeWindows.map((w) => (
        <div key={w.label} className="meter">
          <div className="row">
            <b>{w.label.replace('Current session', 'Sessão (janela de 5h)').replace('Current week', 'Semana')}</b>
            <span>{Math.round(w.pct * 100)}% usado</span>
          </div>
          <Bar value={w.pct} color={meterColor(w.pct)} />
          <div className="row small muted"><span>reseta {w.resets ?? '—'}</span></div>
        </div>
      ))}

      {c?.connected && (
        <div className="meter">
          <div className="row small">
            <span>Gasto pelo Agent Arena</span>
            <b>{fmtTokens(sent5)} nas últimas 5h · {fmtTokens(week)} na semana</b>
          </div>
          <div className="small muted">
            {p.id === 'claude' ? 'Tokens reais das execuções (dev, QA e Maestro) feitas por este painel.' : 'Este provedor não informa o limite do plano: aqui aparece só o que o Agent Arena gastou.'}
          </div>
        </div>
      )}

      {p.id === 'claude' && c?.connected && real?.claude.detected && Object.keys(real.claude.byModel).length > 0 && (
        <div className="small">
          <div className="section-label">Últimos 7 dias por modelo (todos os usos do Claude Code)</div>
          {Object.entries(real.claude.byModel)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([m, n]) => (
              <div key={m} className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="mono">{m}</span>
                <span>{fmtTokens(n)}</span>
              </div>
            ))}
        </div>
      )}

      {c && c.installed && (
        <div className="conn-actions">
          {c.connected ? (
            <button
              className={`btn sm ${confirm ? 'danger' : 'ghost'}`}
              disabled={busy}
              onClick={() => (confirm ? void act(async () => (await api('/api/connections/disconnect', { provider: p.id })).message) : setConfirm(true))}
              title={p.id === 'claude' ? 'Sai do Claude Code em todo o seu computador' : undefined}
            >
              {confirm ? (p.id === 'claude' ? 'Confirmar: sair do Claude Code?' : 'Confirmar desconexão') : 'Desconectar'}
            </button>
          ) : (
            <>
              {c.methods.includes('browser') && (
                <button className="btn gold sm" disabled={busy} onClick={() => connect()}>
                  Conectar pelo navegador
                </button>
              )}
              {c.methods.includes('terminal') && (
                <button className="btn gold sm" disabled={busy} onClick={() => connect()}>
                  Entrar com Google (abre o Terminal)
                </button>
              )}
              {c.methods.includes('key') && (
                <button className="btn sm" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? 'Esconder' : 'Usar chave de API'}
                </button>
              )}
              {p.id === 'claude' && (
                <button className="btn sm ghost" disabled={busy} onClick={() => connect('console')} title="Cobrança por uso de API, em vez da assinatura">
                  Via Console (API)
                </button>
              )}
            </>
          )}
        </div>
      )}
      {showKey && !c?.connected && (
        <div className="row-input">
          <input className="input" type="password" autoComplete="off" placeholder="Cole a chave de API" value={key} onChange={(e) => setKey(e.target.value)} />
          <button
            className="btn sm gold"
            disabled={busy || !key.trim()}
            onClick={() =>
              act(async () => {
                await api('/api/connections/key', { provider: p.id, key });
                setKey('');
                setShowKey(false);
                return 'Chave guardada só na sua máquina (~/.agent-arena).';
              })
            }
          >
            Salvar
          </button>
        </div>
      )}
      {msg && <div className={`small ${msg.startsWith('Erro') ? 'bad' : 'good'}`}>{msg}</div>}
    </div>
  );
}

/** Terminal do login: mostra a saída do comando, transforma links em botões e deixa colar um código */
function LoginTerminal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [s, setS] = useState<Session | null>(null);
  const [text, setText] = useState('');
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetch(`/api/connections/session?id=${sessionId}`)
        .then((r) => r.json())
        .then((d) => alive && setS(d))
        .catch(() => undefined);
    void pull();
    const id = setInterval(pull, 800);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sessionId]);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [s?.lines.length]);

  const done = s && !s.running;
  return (
    <Modal
      title={s?.title ?? 'Login'}
      onClose={onClose}
      narrow
      footer={
        <>
          {s?.running && (
            <button className="btn ghost" onClick={() => api('/api/connections/cancel', { id: sessionId })}>Cancelar login</button>
          )}
          <button className={`btn ${done ? 'gold' : ''}`} onClick={onClose}>{done ? 'Fechar' : 'Fechar (continua em segundo plano)'}</button>
        </>
      }
    >
      <div className="term-head">
        <span className={`status ${!s ? 'off' : s.running ? 'warn' : s.exitCode === 0 ? 'ok' : 'off'}`}>
          {!s ? '…' : s.running ? 'aguardando você autorizar' : s.exitCode === 0 ? 'conectado' : 'não concluído'}
        </span>
      </div>
      {s && s.links.length > 0 && s.running && (
        <div className="btn-group">
          {s.links.map((l) => (
            <button key={l} className="btn sm gold" onClick={() => api('/api/connections/open', { id: sessionId, url: l })} title={l}>
              Abrir link de login no navegador
            </button>
          ))}
        </div>
      )}
      <pre ref={box} className="term" style={{ height: 220 }}>
        {(s?.lines ?? []).map((l, i) => (
          <span key={i} className={`tl ${l.kind === 'err' ? 'error' : l.kind === 'info' ? 'start' : l.kind === 'in' ? 'text' : 'out'}`}>
            {l.text}
            {'\n'}
          </span>
        ))}
      </pre>
      {s?.running && (
        <form
          className="row-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void api('/api/connections/input', { id: sessionId, text }).then(() => setText(''));
          }}
        >
          <input className="input" autoComplete="off" placeholder="Se o login pedir um código, cole aqui e tecle Enter" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn sm" type="submit">Enviar</button>
        </form>
      )}
    </Modal>
  );
}
