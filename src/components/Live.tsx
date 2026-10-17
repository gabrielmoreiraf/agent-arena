import { useEffect, useState } from 'react';
import type { LiveAction, LiveKind, LiveSession, LiveWorker } from '../../server/live';
import { ATTACKS } from '../sprites/attacks';
import { PixelSprite } from '../sprites/PixelSprite';
import { Modal } from './ui';

/** ícone de cada tipo de ação: reaproveita os golpes da arena */
const ICON: Record<LiveKind, string> = { edit: 'feature', bash: 'infra', test: 'test', read: 'review', agent: 'refactor', web: 'database', think: 'feature', say: 'feature', user: 'feature', other: 'bug' };
const KIND_LABEL: Record<LiveKind, string> = { edit: 'Editando', bash: 'Comando', test: 'Teste/build', read: 'Lendo', agent: 'Subagente', web: 'Web', think: 'Planejando', say: 'Falando', user: 'Você pediu', other: 'Ferramenta' };

export interface LiveData {
  sessions: LiveSession[];
  at: number;
}

/** consulta o servidor a cada poucos segundos; o servidor só lê os logs locais do Claude Code */
export function useLive(session?: string | null, intervalMs = 3000) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stop = false;
    const pull = () =>
      fetch(session ? `/api/live?session=${encodeURIComponent(session)}` : '/api/live')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => !stop && (setData(d), setError(false)))
        .catch(() => !stop && setError(true));
    void pull();
    const id = setInterval(pull, intervalMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [intervalMs, session]);
  return { data, error };
}

const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}min` : `${Math.round(s / 3600)}h`;
};

function Icon({ kind, size = 20, anim }: { kind: LiveKind; size?: number; anim?: boolean }) {
  const a = ATTACKS[ICON[kind]];
  return (
    <span className={`live-ico ${anim ? 'on' : ''}`}>
      <PixelSprite rows={a.rows} palette={a.palette} size={size} />
    </span>
  );
}

function Doing({ w, now }: { w: LiveWorker; now: number }) {
  const act: LiveAction | undefined = w.now ?? (w.state === 'working' ? w.recent[0] : undefined);
  if (!act) return <div className="live-doing idle">{w.said ? `💬 ${w.said}` : 'Parado, esperando você'}</div>;
  return (
    <div className="live-doing">
      <Icon kind={act.kind} anim={w.state === 'working'} />
      <span className="grow">
        <b>{KIND_LABEL[act.kind]}</b> · {act.text}
      </span>
      <span className="small">{ago(act.at || w.lastAt, now)}</span>
    </div>
  );
}

function Worker({ w, now }: { w: LiveWorker; now: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`live-worker ${w.state}`}>
      <div className="live-worker-head" onClick={() => setOpen((o) => !o)} role="button">
        <span className={`dot ${w.state}`} />
        <b>{w.name === 'main' ? 'Claude (conversa principal)' : w.name}</b>
        {w.title && <span className="small grow">{w.title}</span>}
        {w.model && <span className="chip">{w.model.replace('claude-', '')}</span>}
        <span className="small">{open ? '▾' : '▸'}</span>
      </div>
      <Doing w={w} now={now} />
      {open && (
        <ul className="live-recent">
          {w.recent.map((a, i) => (
            <li key={i}>
              <Icon kind={a.kind} size={14} /> <span className="grow">{a.text}</span>
              <span className="small">{a.at ? ago(a.at, now) : ''}</span>
            </li>
          ))}
          {!w.recent.length && <li className="small">Sem ações recentes.</li>}
        </ul>
      )}
    </div>
  );
}

interface Props {
  data: LiveData | null;
  error: boolean;
  /** pastas que já são projetos do Arena */
  known: string[];
  onUse: (dir: string) => void;
  /** sessão espelhada na arena */
  mirrorId?: string | null;
  onMirror: (id: string | null) => void;
}

export function Live({ data, error, known, onUse, mirrorId, onMirror }: Props) {
  const now = data?.at ?? Date.now();
  const sessions = data?.sessions ?? [];
  return (
    <div className="live">
      <div className="live-head">
        <div>
          <div className="px-title">Claude ao vivo</div>
          <div className="hint">
            Lê os logs do seu Claude Code (<code>~/.claude/projects</code>) e mostra o que cada conversa e cada subagente está fazendo agora, em qualquer projeto. Só leitura, tudo local.
          </div>
        </div>
        <span className={`live-badge ${error ? 'off' : sessions.some((s) => s.state === 'working') ? 'on' : ''}`}>
          {error ? 'sem conexão com o servidor' : `${sessions.filter((s) => s.state === 'working').length} trabalhando`}
        </span>
      </div>

      {data && !sessions.length && (
        <div className="px live-empty">
          Nenhuma sessão do Claude Code nos últimos 20 minutos. Abra o Claude Code em qualquer projeto e peça algo: ele aparece aqui sozinho, sem configurar nada.
        </div>
      )}

      <div className="live-grid">
        {sessions.map((s) => (
          <article key={s.id} className={`px live-card ${s.state}`}>
            <header>
              <span className={`dot ${s.state}`} />
              <b className="grow" title={s.dir}>📁 {s.project}</b>
              <span className="small">{s.state === 'working' ? 'trabalhando' : `parado há ${ago(s.lastAt, now)}`}</span>
            </header>
            <div className="live-title" title={s.dir}>{s.title}</div>
            {s.prompt && <div className="small live-prompt">“{s.prompt}”</div>}
            <Worker w={s.main} now={now} />
            {s.subagents.length > 0 && <div className="section-label">Subagentes ({s.subagents.filter((w) => w.state === 'working').length}/{s.subagents.length} ativos)</div>}
            {s.subagents.map((w) => (
              <Worker key={w.id} w={w} now={now} />
            ))}
            <button className={`btn sm ${mirrorId === s.id ? 'on' : 'gold'}`} onClick={() => onMirror(mirrorId === s.id ? null : s.id)}>
              {mirrorId === s.id ? '🎮 Na arena agora (clique para sair)' : '🎮 Mostrar na arena'}
            </button>
            {s.dir && !known.includes(s.dir) && (
              <button className="btn sm" onClick={() => onUse(s.dir)} title="Anexa essa pasta como projeto do Arena para mandar tarefas pra ela">
                ➕ Usar como projeto no Arena
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

/** ao entrar: escolha qual sessão do Claude Code que está rodando você quer ver na arena */
export function LivePicker({ data, onPick, onClose }: { data: LiveData; onPick: (id: string) => void; onClose: () => void }) {
  const now = data.at;
  return (
    <Modal title="Claude rodando agora" onClose={onClose} footer={<button className="btn" onClick={onClose}>Agora não</button>}>
      <div className="hint">
        Escolha uma sessão para ver os agentes dela trabalhando na arena. O histórico de tudo que eles fazem aparece no registro de batalha.
      </div>
      <div className="live-pick">
        {data.sessions.map((s) => (
          <button key={s.id} className={`live-pick-row ${s.state}`} onClick={() => onPick(s.id)}>
            <span className={`dot ${s.state}`} />
            <span className="grow">
              <b>📁 {s.project}</b>
              <span className="small"> · {s.title}</span>
              <span className="small live-pick-sub">
                {s.state === 'working' ? (s.main.now?.text ?? 'trabalhando') : `parado há ${ago(s.lastAt, now)}`}
                {s.subagents.length ? ` · ${s.subagents.filter((w) => w.state === 'working').length}/${s.subagents.length} subagentes ativos` : ''}
              </span>
            </span>
            <span className="btn sm gold">Usar na arena</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** histórico completo de um agente da sessão espelhada */
export function LiveHistory({ worker, onClose }: { worker: LiveWorker; onClose: () => void }) {
  return (
    <Modal title={`Histórico · ${worker.name === 'main' ? 'Claude' : worker.name}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Fechar</button>}>
      {worker.title && <div className="hint">{worker.title}</div>}
      <ul className="live-recent live-history">
        {worker.recent.map((a, i) => (
          <li key={i} className={`k-${a.kind}`}>
            <Icon kind={a.kind} size={14} />
            <time className="small">{a.at ? new Date(a.at).toLocaleTimeString('pt-BR') : ''}</time>
            <span className="grow">{a.text}</span>
          </li>
        ))}
        {!worker.recent.length && <li className="small">Sem ações registradas.</li>}
      </ul>
    </Modal>
  );
}
