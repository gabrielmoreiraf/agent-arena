import { PixelSprite } from '../sprites/PixelSprite';
import type { Agent, GameState } from '../types';
import { Avatar, fmtTokens } from './ui';

type Pt = [number, number];

/** Mapa do ecossistema: do Backlog ao Maestro, aos agentes, ao QA e à entrega no projeto. Linhas acesas = trabalho passando por ali agora. */
export function Ecosystem({ state, projectName, onAgent }: { state: GameState; projectName?: string; onAgent: (id: string) => void }) {
  const maestro = state.agents.find((a) => a.role === 'maestro');
  const qas = state.agents.filter((a) => a.role === 'qa');
  const workers = state.agents.filter((a) => a.role !== 'maestro' && a.role !== 'qa');
  const pending = state.tasks.filter((t) => t.status === 'backlog' && !t.assigneeId).length;
  const done = state.tasks.filter((t) => t.status === 'done').length;
  const landed = state.tasks.filter((t) => t.landedSha).length;
  const open = state.tasks.filter((t) => t.status !== 'done').length;

  const col = (n: number, i: number) => (n === 1 ? 50 : 8 + (84 * i) / (n - 1));
  const pos = new Map<string, Pt>();
  if (maestro) pos.set(maestro.id, [27, 50]);
  workers.forEach((a, i) => pos.set(a.id, [52, col(workers.length, i)]));
  qas.forEach((a, i) => pos.set(a.id, [75, col(qas.length, i)]));
  const BACKLOG: Pt = [8, 50];
  const OUT: Pt = [92, 50];

  const edge = (a: Pt, b: Pt, active: boolean, _label?: string, key?: string, dim = false) => {
    const mx = (a[0] + b[0]) / 2;
    return (
      <g key={key}>
        <path d={`M${a[0]} ${a[1]} C${mx} ${a[1]}, ${mx} ${b[1]}, ${b[0]} ${b[1]}`} className={`eco-edge ${active ? 'on' : ''} ${dim ? 'dim' : ''}`} vectorEffect="non-scaling-stroke" fill="none" />
      </g>
    );
  };

  const edgeLabel = (a: Pt, b: Pt, text: string, key: string) => (
    <span key={key} className="eco-edge-label" style={{ left: `${(a[0] + b[0]) / 2}%`, top: `${(a[1] + b[1]) / 2}%` }}>{text}</span>
  );

  const nodeFor = (a: Agent) => {
    const [x, y] = pos.get(a.id)!;
    const task = state.tasks.find((t) => t.id === a.currentTaskId);
    const provider = state.providers.find((p) => p.id === a.providerId);
    const model = provider?.models.find((m) => m.id === task?.model);
    const busy = !!task;
    return (
      <button key={a.id} className={`eco-node ${busy ? 'busy' : ''} ${task?.paused ? 'paused' : ''}`} style={{ left: `${x}%`, top: `${y}%`, borderColor: provider?.color }} onClick={() => onAgent(a.id)} title="Abrir o terminal do agente">
        <span className="av"><Avatar agent={a} size={34} /></span>
        <span className="n">{a.name}</span>
        <span className="r">{a.title}{model ? ` · ${model.label}` : ''}</span>
        <span className="s">{task ? `${task.status === 'review' ? '🔍' : '⚔️'} ${task.title}` : a.queue.length ? `${a.queue.length} na fila` : 'livre'}</span>
        <span className="t">lv {Math.floor(Math.sqrt(a.xp / 60)) + 1} · {a.stats.done} feitas · {fmtTokens(a.stats.tokens)} tok</span>
      </button>
    );
  };

  return (
    <div className="eco px" style={{ minHeight: Math.max(380, Math.max(workers.length, qas.length) * 66 + 50) }}>
      <svg className="eco-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {maestro && edge(BACKLOG, pos.get(maestro.id)!, pending > 0, undefined, 'bm')}
        {maestro && workers.map((w) => edge(pos.get(maestro.id)!, pos.get(w.id)!, !!w.currentTaskId || w.queue.length > 0, undefined, `mw${w.id}`, !w.currentTaskId && !w.queue.length))}
        {workers.flatMap((w) =>
          qas.map((q) => {
            const reviewing = state.tasks.some((t) => t.assigneeId === w.id && t.status === 'review' && t.reviewerId === q.id);
            return edge(pos.get(w.id)!, pos.get(q.id)!, reviewing, undefined, `wq${w.id}${q.id}`, !reviewing);
          }),
        )}
        {qas.map((q) => edge(pos.get(q.id)!, OUT, state.tasks.some((t) => t.reviewerId === q.id && t.status === 'review'), undefined, `qo${q.id}`))}
      </svg>

      {maestro && edgeLabel(BACKLOG, pos.get(maestro.id)!, `${pending} pergaminho(s)`, 'l1')}
      {qas.map((q) => edgeLabel(pos.get(q.id)!, OUT, `${done} ✔`, `l${q.id}`))}

      <div className="eco-node end" style={{ left: `${BACKLOG[0]}%`, top: `${BACKLOG[1]}%` }}>
        <PixelSprite rows={['..oooooo..', '.oddddddo.', 'odpppppdo', 'odpprrppdo', 'odpppppdo', '.oddddddo.', '..oooooo..']} palette={{ o: '#3a2412', p: '#f3dca2', d: '#c9a05a', r: '#c0392b' }} size={32} />
        <span className="n">Backlog</span>
        <span className="s">{open} abertas</span>
      </div>
      <div className="eco-node end ok" style={{ left: `${OUT[0]}%`, top: `${OUT[1]}%` }}>
        <span style={{ fontSize: 26 }}>📁</span>
        <span className="n">{projectName ?? 'Projeto'}</span>
        <span className="s">{landed} aplicada(s) · {done} entregue(s)</span>
      </div>

      {state.agents.filter((a) => pos.has(a.id)).map(nodeFor)}

      <div className="eco-legend small muted">
        <span><i className="lg on" /> trabalho passando agora</span>
        <span><i className="lg" /> conexão parada</span>
        <span>Clique num agente para ver o terminal dele.</span>
      </div>
    </div>
  );
}
