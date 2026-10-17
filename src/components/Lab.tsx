import { useRef } from 'react';
import { levelOf } from '../data/agents';
import { soulName } from '../data/quotes';
import { SCROLL_FLIGHT_MS, SCROLL_HANDOFF_MS, SOUL_MS, SOUL_TASKS } from '../engine/game';
import { MONSTER_SIZE } from '../sprites/attacks';
import { MONSTERS, MONSTER_BY_TYPE, MONSTER_INFO } from '../sprites/monsters';
import { PixelSprite } from '../sprites/PixelSprite';
import {
  BIO, COFFEE, COFFEE_PAL, CUP, CUP_PAL, GHOST, GHOST_PAL, PC, PC_PAL, PLANT, PLANT_PAL, SCROLL_OPEN, SCROLL_PAL, SCROLL_ROLLED, SINK, SINK_PAL, TOILET, TOILET_PAL, WISP, WISP_PAL, bioPalette,
} from '../sprites/props';
import type { Agent, GameState, Task } from '../types';
import { EmptyArena } from './EmptyArena';

/**
 * Laboratório (vista de cima), desenhado a partir da planta do projeto. Mapa quadrado; coordenadas em % do mapa;
 * [x, y] de agentes/monstros é a posição dos pés.
 *
 *   canto superior esquerdo  = sala do líder (mesa comprida no meio; porta na parede da direita, embaixo)
 *   topo, no meio            = três bancadas em U com computador (os agentes sentam por dentro do U)
 *   canto superior direito   = banheiro (porta na parede de baixo)
 *   embaixo à esquerda       = mesa central em cruz (reunião)
 *   embaixo, no meio         = bancada comprida com computadores dos dois lados
 *   à direita, embaixo       = copa (balcão do café; porta na parede da esquerda)
 *   canto inferior direito   = entrada principal com biometria: é por ela que as tarefas (pergaminhos) chegam
 * Quando uma tarefa vai para revisão, o QA levanta, caminha até a bancada do dev e os dois discutem a task lá.
 * Quem trabalha fica codando no computador (sem atacar o monstro, que é a task em cima da mesa).
 */
type Pt = [number, number];

interface Desk {
  /** onde fica o computador */
  pc: Pt;
  /** onde o dev senta */
  seat: Pt;
  /** onde o QA fica em pé quando vem validar */
  visit: Pt;
  /** o QA fica à direita do dev (vira o sprite para ele) */
  flip: boolean;
  /** onde o monstro (a task) fica em cima da mesa */
  mon: Pt;
}

const DESKS: Desk[] = [
  // U, lado esquerdo (o dev senta por dentro, a leste)
  { pc: [43.4, 17], seat: [49.4, 20], visit: [54.6, 21], flip: true, mon: [43.4, 22.6] },
  { pc: [43.4, 28], seat: [49.4, 31], visit: [54.6, 32], flip: true, mon: [43.4, 33.6] },
  // U, lado direito (a oeste)
  { pc: [67.4, 17], seat: [61.4, 20], visit: [56.6, 21], flip: false, mon: [67.4, 22.6] },
  { pc: [67.4, 28], seat: [61.4, 31], visit: [56.6, 32], flip: false, mon: [67.4, 33.6] },
  // U, barra do topo (o dev senta embaixo)
  { pc: [50.4, 5.4], seat: [50.4, 13], visit: [46.8, 13.5], flip: false, mon: [54.6, 8.8] },
  { pc: [60.4, 5.4], seat: [60.4, 13], visit: [64, 13.5], flip: true, mon: [56.2, 8.8] },
  // bancada comprida, lado esquerdo (o dev senta a oeste)
  { pc: [50.6, 58], seat: [44.6, 61], visit: [39.6, 62], flip: false, mon: [50.6, 63.2] },
  { pc: [50.6, 68.5], seat: [44.6, 71.5], visit: [39.6, 72.5], flip: false, mon: [50.6, 73.7] },
  { pc: [50.6, 79], seat: [44.6, 82], visit: [39.6, 83], flip: false, mon: [50.6, 84.2] },
  // bancada comprida, lado direito (a leste)
  { pc: [56.8, 58], seat: [62.6, 61], visit: [66.4, 62], flip: true, mon: [56.8, 63.2] },
  { pc: [56.8, 68.5], seat: [62.6, 71.5], visit: [66.4, 72.5], flip: true, mon: [56.8, 73.7] },
  { pc: [56.8, 79], seat: [62.6, 82], visit: [66.4, 83], flip: true, mon: [56.8, 84.2] },
  // mesa em cruz: um computador em cada ponta
  { pc: [19.8, 57], seat: [19.8, 51.5], visit: [25.5, 51.5], flip: true, mon: [24.4, 58.5] },
  { pc: [19.8, 78.5], seat: [19.8, 85.5], visit: [25.5, 85.5], flip: true, mon: [24.4, 80] },
  { pc: [9, 67.8], seat: [9, 75.5], visit: [14.5, 75.5], flip: true, mon: [13.2, 69.3] },
  { pc: [30.6, 67.8], seat: [30.6, 75.5], visit: [25.2, 75.5], flip: false, mon: [26.4, 69.3] },
];

/** mesas (os retângulos vermelhos da planta): x, y = centro, w, h em % */
const TABLES = [
  { id: 'leader', x: 21, y: 21.3, w: 11.6, h: 29.3 },
  { id: 'u-left', x: 43.4, y: 22.5, w: 5.8, h: 29.3 },
  { id: 'u-top', x: 55.4, y: 5.4, w: 17.4, h: 4.6 },
  { id: 'u-right', x: 67.4, y: 22.5, w: 5.8, h: 29.3 },
  { id: 'long', x: 53.7, y: 67.8, w: 11.6, h: 29.3 },
  { id: 'cross-h', x: 19.8, y: 67.8, w: 29.3, h: 7.1 },
  { id: 'cross-v', x: 19.8, y: 67.8, w: 7.1, h: 29.3 },
  { id: 'counter', x: 84.1, y: 78.1, w: 29.3, h: 11.6 },
];

/** paredes (finas): [x1, y1, x2, y2] em % */
const WALLS: [number, number, number, number][] = [
  // sala do líder
  [1.7, 1.1, 40.1, 1.1], [1.7, 1.1, 1.7, 45.8], [1.7, 45.8, 40.1, 45.8], [40.1, 1.1, 40.1, 34.3],
  // banheiro
  [70.8, 1.9, 99.4, 1.9], [70.8, 1.9, 70.8, 26.6], [99.4, 1.9, 99.4, 26.6], [70.8, 26.6, 79.3, 26.6], [90.9, 26.6, 99.4, 26.6],
  // copa
  [68.4, 45.8, 99.4, 45.8], [68.4, 85, 99.4, 85], [99.4, 45.8, 99.4, 85], [68.4, 45.8, 68.4, 58.4], [68.4, 70, 68.4, 85],
];
const DOORS: { id: string; x: number; y: number; w: number; h: number }[] = [
  { id: 'leader', x: 40.1, y: 40.1, w: 0.9, h: 11.5 },
  { id: 'wc', x: 85.1, y: 26.6, w: 11.6, h: 0.9 },
  { id: 'copa', x: 68.4, y: 64.2, w: 0.9, h: 11.6 },
];
const ENTRANCE: Pt = [97.4, 92];

const LEADER_POS: Pt = [29, 27];
const READING: Pt = [31, 13];
const PILE: Pt = [7, 37];
/** quem está ocioso, sem nada para fazer, vai para a copa; se ela lotar, o resto espera no meio do laboratório */
const COPA_SLOTS: Pt[] = [[76, 55], [84, 55], [92, 55], [80, 63], [88, 63], [76, 68]];
const OVERFLOW_SLOTS: Pt[] = [[35.5, 55], [35.5, 90], [41, 48], [47, 47], [39, 95], [30, 95]];

/** monstro menor no laboratório: ele é a task na mesa, não um adversário */
const LAB_MONSTER = 0.62;
const shortTitle = (t: string, n = 22) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

interface Props {
  state: GameState;
  onAgent: (id: string) => void;
  onAccounts: () => void;
  onProjects: () => void;
  connected?: boolean;
  hasProject?: boolean;
  onControl?: (action: 'pause' | 'resume' | 'stop', agentId: string) => void;
  onTask?: (taskId: string) => void;
  /** modo ao vivo: faixa no topo com a sessão espelhada */
  banner?: React.ReactNode;
}

export function Lab({ state, onAgent, onAccounts, onProjects, onControl, onTask, banner, connected = false, hasProject = false }: Props) {
  const now = Date.now();
  const handingOff = (t: Task) => !!t.assignedAt && now - t.assignedAt < SCROLL_HANDOFF_MS;

  // bancada de cada agente (o líder não tem: ele tem a sala)
  const crew = state.agents.filter((a) => a.role !== 'maestro');
  const deskOf = new Map<string, Desk>(crew.map((a, i) => [a.id, DESKS[i % DESKS.length]]));
  const key = (d: Desk) => `${d.pc[0]}:${d.pc[1]}`;

  // ---- pergaminhos: entram pela porta da entrada, vão para a sala do líder, ele lê e despacha para a bancada ----
  const unassigned = state.tasks.filter((t) => t.status === 'backlog' && !t.assigneeId);
  const incoming = unassigned.filter((t) => now - t.createdAt < SCROLL_FLIGHT_MS);
  const pile = unassigned.filter((t) => now - t.createdAt >= SCROLL_FLIGHT_MS);
  const readingTask = pile.find((t) => t.readingSince);
  const waiting = pile.filter((t) => t !== readingTask);
  const handoffs = state.tasks.filter((t) => t.status !== 'done' && handingOff(t));

  // ---- monstros: a task fica em cima da mesa, ao lado do computador; a fila vira monstrinhos na beirada ----
  const onMap = state.tasks.filter((t) => t.status !== 'done' && t.assigneeId && !handingOff(t));
  const monsterPos = new Map<string, Pt>();
  const queuedCount = new Map<string, number>();
  for (const t of onMap) {
    const d = deskOf.get(t.assigneeId!);
    if (!d) continue;
    if (t.status === 'backlog') {
      const i = queuedCount.get(key(d)) ?? 0;
      queuedCount.set(key(d), i + 1);
      monsterPos.set(t.id, [d.pc[0] + (i % 3) * 2.6 - 2.6, d.pc[1] + 8.4]);
    } else monsterPos.set(t.id, d.mon);
  }

  // ---- agentes: sentados codando; o QA em revisão vai até a bancada do dev; só quem está ocioso vai à copa ----
  const unitPos = new Map<string, Pt>();
  let idle = 0;
  for (const agent of state.agents) {
    if (agent.role === 'maestro') {
      unitPos.set(agent.id, LEADER_POS);
      continue;
    }
    const task = state.tasks.find((t) => t.id === agent.currentTaskId);
    if (task) {
      const devDesk = task.status === 'review' && task.reviewerId === agent.id ? deskOf.get(task.assigneeId ?? '') : undefined;
      unitPos.set(agent.id, devDesk ? devDesk.visit : deskOf.get(agent.id)!.seat);
    } else {
      const k = idle++;
      unitPos.set(agent.id, k < COPA_SLOTS.length ? COPA_SLOTS[k] : OVERFLOW_SLOTS[(k - COPA_SLOTS.length) % OVERFLOW_SLOTS.length]);
    }
  }
  const visiting = (a: Agent) => {
    const t = state.tasks.find((x) => x.id === a.currentTaskId);
    return t?.status === 'review' && t.reviewerId === a.id ? deskOf.get(t.assigneeId ?? '') : undefined;
  };

  // ---- bancadas em uso: quem trabalha fica codando; quando o QA valida, a tela do dev mostra a revisão ----
  const deskUse = new Map<string, 'code' | 'review'>();
  for (const a of crew) {
    const t = state.tasks.find((x) => x.id === a.currentTaskId);
    if (!t || t.paused) continue;
    if (t.status === 'review' && t.reviewerId === a.id) {
      const dd = deskOf.get(t.assigneeId ?? '');
      if (dd) deskUse.set(key(dd), 'review');
    } else deskUse.set(key(deskOf.get(a.id)!), 'code');
  }

  // ---- almas: cada monstro derrotado vira 2 almas que rondam o laboratório, enchem o pessoal e sugam a energia ----
  const TYPES = ['feature', 'bug', 'infra', 'database', 'test', 'refactor'];
  const dead = state.tasks
    .filter((t) => t.status === 'done' && t.doneAt && now - t.doneAt < SOUL_MS)
    .sort((a, b) => b.doneAt! - a.doneAt!)
    .slice(0, SOUL_TASKS);
  const souls = dead.flatMap((t, i) => [1, 2].map((n) => ({ id: `s:${t.id}:${n}`, type: t.type, k: i * 2 + n })));
  // quem está conversando com quem (a conversa dura alguns segundos depois da fala da alma)
  const haunting = new Map<string, string>();
  for (const m of state.chat ?? []) {
    if (m.at > now || now - m.at > 7000 || !m.toId) continue;
    if (m.agentId.startsWith('s:')) haunting.set(m.agentId, m.toId);
    else if (m.toId.startsWith('s:')) haunting.set(m.toId, m.agentId);
  }
  const soulPos = new Map<string, Pt>();
  for (const sl of souls) {
    const target = haunting.get(sl.id);
    const ap = target ? unitPos.get(target) : undefined;
    soulPos.set(sl.id, ap ? [ap[0] + 6, ap[1] - 7] : [50 + 34 * Math.sin(now / 7000 + sl.k * 2.1), 56 + 28 * Math.sin(now / 5300 + sl.k * 1.3 + 1)]);
  }
  const drained = new Set(souls.map((sl) => haunting.get(sl.id)).filter(Boolean) as string[]);

  // ---- voos dos pergaminhos (origem/destino e atraso congelados na montagem, para não pular) ----
  const flights = useRef(new Map<string, { from: Pt; to: Pt }>());
  const started = useRef(new Map<string, number>());
  for (const t of handoffs) {
    if (flights.current.has(t.id)) continue;
    const d = deskOf.get(t.assigneeId!);
    const to = d ? d.seat : LEADER_POS;
    flights.current.set(t.id, { from: READING, to: [to[0], to[1] - 8] });
  }
  for (const id of flights.current.keys()) if (!handoffs.some((t) => t.id === id)) flights.current.delete(id);
  const live = new Set([...incoming.map((t) => `in-${t.id}`), ...handoffs.map((t) => `out-${t.id}`)]);
  for (const k of started.current.keys()) if (!live.has(k)) started.current.delete(k);
  const scrollFly = (k: string, from: Pt, to: Pt, ms: number, elapsedNow: number) => {
    if (!started.current.has(k)) started.current.set(k, elapsedNow);
    const elapsed = started.current.get(k)!;
    return {
      '--x0': `${from[0]}%`,
      '--y0': `${from[1]}%`,
      '--x1': `${to[0]}%`,
      '--y1': `${to[1]}%`,
      animationDuration: `${ms}ms`,
      animationDelay: `-${Math.min(ms, Math.max(0, elapsed))}ms`,
    } as React.CSSProperties;
  };

  const granted = incoming.length > 0;
  const working = state.tasks.filter((t) => t.status === 'in_progress').length;
  const reviewing = state.tasks.filter((t) => t.status === 'review').length;
  const at = (p: Pt) => ({ left: `${p[0]}%`, top: `${p[1]}%` });
  const used = Math.max(crew.length, 1);

  return (
    <div className="arena cr lab">
      {banner}

      {/* ---- cômodos: pisos e paredes da planta ---- */}
      <div className="lab-floor room" style={{ left: '1.7%', top: '1.1%', width: '38.4%', height: '44.7%' }} />
      <div className="lab-floor wc" style={{ left: '70.8%', top: '1.9%', width: '28.6%', height: '24.7%' }} />
      <div className="lab-floor copa" style={{ left: '68.4%', top: '45.8%', width: '31%', height: '39.2%' }} />
      {WALLS.map(([x1, y1, x2, y2], i) => (
        <i
          key={i}
          className="lab-wall"
          style={{
            left: `${Math.min(x1, x2) - (x1 === x2 ? 0.35 : 0)}%`,
            top: `${Math.min(y1, y2) - (y1 === y2 ? 0.35 : 0)}%`,
            width: x1 === x2 ? '0.7%' : `${Math.abs(x2 - x1)}%`,
            height: y1 === y2 ? '0.7%' : `${Math.abs(y2 - y1)}%`,
          }}
        />
      ))}
      <span className="lab-label" style={{ left: '3%', top: '41%' }}>SALA DO LÍDER</span>
      <span className="lab-label" style={{ left: '72%', top: '21.5%' }}>BANHEIRO</span>
      <span className="lab-label" style={{ left: '70%', top: '47%' }}>☕ COPA</span>

      {/* portas */}
      {DOORS.map((d) => (
        <i key={d.id} className="lab-doorway" style={{ left: `${d.x - d.w / 2}%`, top: `${d.y - d.h / 2}%`, width: `${d.w}%`, height: `${d.h}%` }} />
      ))}

      {/* ---- mesas ---- */}
      {TABLES.map((t) => (
        <i key={t.id} className={`lab-tablerect ${t.id === 'counter' ? 'counter' : ''}`} style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }} />
      ))}
      <div className="lab-central-info" style={at([19.8, 92])}>
        <span>MESA CENTRAL</span>
        <small>
          ⚔️ {working} em andamento · 🔍 {reviewing} em revisão
        </small>
      </div>

      {/* ---- sala do líder: computador, quadro e planta ---- */}
      {[10, 31].map((y) => (
        <div key={`leader-pc-${y}`}>
          <div className="lab-prop" style={at([21, y])}>
            <PixelSprite rows={PC} palette={PC_PAL} size={46} />
            {(readingTask || handoffs.length > 0 || granted) && <i className="lab-code code" />}
          </div>
        </div>
      ))}
      <div className="lab-whiteboard" style={at([8, 6])} title="Quadro de tarefas">
        <b className="c1" />
        <b className="c2" />
        <b className="c3" />
      </div>
      <div className="lab-prop" style={at([4.5, 43])}>
        <PixelSprite rows={PLANT} palette={PLANT_PAL} size={30} />
      </div>

      {/* ---- banheiro ---- */}
      <div className="lab-prop" style={at([77, 9])} title="Vaso">
        <PixelSprite rows={TOILET} palette={TOILET_PAL} size={26} />
      </div>
      <div className="lab-prop" style={at([94, 8])} title="Pia">
        <PixelSprite rows={SINK} palette={SINK_PAL} size={34} />
      </div>

      {/* ---- copa ---- */}
      <div className="lab-prop" style={at([91, 74.5])}>
        <PixelSprite rows={COFFEE} palette={COFFEE_PAL} size={42} />
      </div>
      <div className="lab-prop" style={at([77, 76.5])}>
        <PixelSprite rows={CUP} palette={CUP_PAL} size={16} />
      </div>
      <div className="lab-prop" style={at([83, 76.5])}>
        <PixelSprite rows={CUP} palette={CUP_PAL} size={16} />
      </div>
      <div className="lab-prop" style={at([96, 50])}>
        <PixelSprite rows={PLANT} palette={PLANT_PAL} size={28} />
      </div>

      {/* ---- computadores das bancadas (os livres ficam desligados) ---- */}
      {DESKS.map((d, i) => {
        const use = i < used ? deskUse.get(key(d)) : undefined;
        return (
          <div key={`pc-${key(d)}`}>
            <div className={`lab-prop ${i >= used ? 'off' : ''}`} style={at(d.pc)}>
              <PixelSprite rows={PC} palette={PC_PAL} size={42} />
              {use && <i className={`lab-code ${use}`} />}
            </div>
            {use === 'code' &&
              ['{ }', '</>', ';', '=>', '( )'].map((g, gi) => (
                <span key={g} className="code-glyph" style={{ left: `${d.pc[0] + (gi - 2) * 1.2}%`, top: `${d.pc[1] + 2}%`, animationDelay: `${-gi * 0.55}s` }}>
                  {g}
                </span>
              ))}
          </div>
        );
      })}

      {/* ---- entrada principal com biometria ---- */}
      <div className={`lab-entrance ${granted ? 'granted' : ''}`} style={at(ENTRANCE)}>
        <span className="lab-label door">{granted ? '✔ ACESSO LIBERADO' : '🔒 ENTRADA · BIOMETRIA'}</span>
        <div className="lab-bio" title="Leitor biométrico">
          <PixelSprite rows={BIO} palette={bioPalette(granted)} size={18} />
        </div>
        <i className="lab-doorpanel" />
      </div>

      {/* ---- pergaminhos ---- */}
      {incoming.map((t) => (
        <div key={`in-${t.id}`} className="scroll-fx fly" style={scrollFly(`in-${t.id}`, [ENTRANCE[0] - 3, ENTRANCE[1] - 2], PILE, SCROLL_FLIGHT_MS - 500, now - t.createdAt)} title={t.title}>
          <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={30} />
        </div>
      ))}
      {waiting.map((t, i) => (
        <div key={`pile-${t.id}`} className="scroll-fx pile" style={{ left: `${PILE[0] + (i % 3) * 3}%`, top: `${PILE[1] - Math.floor(i / 3) * 3}%` }} title={`Na fila do líder: ${t.title}`}>
          <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={24} />
        </div>
      ))}
      {readingTask && (
        <div className="scroll-fx reading" style={at(READING)} title={readingTask.title}>
          <span className="scroll-title">{readingTask.title}</span>
          <PixelSprite rows={SCROLL_OPEN} palette={SCROLL_PAL} size={36} />
        </div>
      )}
      {handoffs.map((t) => {
        const f = flights.current.get(t.id)!;
        return (
          <div key={`out-${t.id}`} className="scroll-fx fly handoff" style={scrollFly(`out-${t.id}`, f.from, f.to, SCROLL_HANDOFF_MS - 300, now - t.assignedAt!)} title={t.title}>
            <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={30} />
          </div>
        );
      })}

      {/* ---- monstros (a task em cima da mesa) ---- */}
      {onMap.map((task) => {
        const pos = monsterPos.get(task.id);
        if (!pos) return null;
        const m = MONSTERS[MONSTER_BY_TYPE[task.type] ?? 'slime'];
        const queued = task.status === 'backlog';
        const size = queued ? 14 + task.complexity * 3 : Math.round(MONSTER_SIZE[task.complexity] * LAB_MONSTER);
        const max = task.status === 'review' ? 12 + task.complexity * 8 : task.effort;
        return (
          <div
            key={task.id}
            className={`monster c${task.complexity} ${task.status === 'review' ? 'review' : ''} ${queued ? 'queued' : ''}`}
            style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, zIndex: queued ? 1 : 2 }}
            title={`${MONSTER_INFO[task.type]?.name} = tarefa de ${MONSTER_INFO[task.type]?.kind}\n${task.title}\n${task.reason ?? ''}\n(clique para ver detalhes)`}
            onClick={() => onTask?.(task.id)}
            role="button"
          >
            {!queued && <span className="label">{shortTitle(task.title)}</span>}
            <PixelSprite className="sprite" rows={m.rows} palette={m.palette} size={size} />
            {!queued && (
              <div className="bar">
                <i style={{ width: `${(task.hp / Math.max(1, max)) * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}

      {/* ---- almas dos monstros derrotados: rondam e sugam a energia de quem estão enchendo ---- */}
      {souls.map((sl) => {
        const pos = soulPos.get(sl.id)!;
        const target = haunting.get(sl.id);
        const ap = target ? unitPos.get(target) : undefined;
        return (
          <div key={sl.id}>
            <div className={`soul ${target ? 'talking' : ''}`} style={{ ...at(pos), filter: `hue-rotate(${TYPES.indexOf(sl.type) * 55}deg)` }} title={soulName(sl.type)}>
              <PixelSprite className="sprite" rows={GHOST} palette={GHOST_PAL} size={26} />
            </div>
            {ap &&
              [0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="atk drain"
                  style={
                    {
                      '--x0': `${ap[0]}%`,
                      '--y0': `${ap[1] - 3}%`,
                      '--x1': `${pos[0]}%`,
                      '--y1': `${pos[1] - 2}%`,
                      '--arc': '6px',
                      '--spin': '0deg',
                      '--glow': '#c58cff',
                      animationDuration: '1100ms',
                      animationDelay: `${-i * 366}ms`,
                    } as React.CSSProperties
                  }
                >
                  <PixelSprite rows={WISP} palette={WISP_PAL} size={10} />
                </span>
              ))}
          </div>
        );
      })}

      {/* ---- agentes ---- */}
      {state.agents.map((agent: Agent) => {
        const [x, y] = unitPos.get(agent.id)!;
        const bubble = state.bubbles.find((b) => b.agentId === agent.id && b.from <= now);
        const task = state.tasks.find((t) => t.id === agent.currentTaskId);
        const visit = visiting(agent);
        return (
          <button
            key={agent.id}
            className={`unit ${agent.currentTaskId ? 'working' : ''} ${agent.role === 'maestro' && readingTask ? 'reading' : ''} ${drained.has(agent.id) ? 'drained' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onAgent(agent.id)}
            title={`${agent.name} · ${agent.title}${task ? `\n${visit ? '🔍 validando com o dev: ' : ''}${task.title}` : '\nLivre'}`}
          >
            {bubble && (
              <span className={`bubble ${agent.role === 'qa' ? 'qa' : ''} ${x > 80 ? 'to-left' : x < 14 ? 'to-right' : ''} ${y < 22 ? 'below' : ''}`}>{bubble.text}</span>
            )}
            <PixelSprite className="sprite" sprite={agent.sprite} palette={agent.palette} size={agent.role === 'maestro' ? 48 : 38} flip={visit?.flip} />
            <span className="tag">
              <span className="lvl">{levelOf(agent.xp)}</span> {agent.name}
            </span>
          </button>
        );
      })}

      {/* ---- controles por agente (só quem tem um processo rodando) ---- */}
      {onControl &&
        state.agents.map((agent) => {
          const task = state.tasks.find((t) => t.id === agent.currentTaskId);
          if (!task?.jobId) return null;
          const [x, y] = unitPos.get(agent.id)!;
          return (
            <span key={`ctl-${agent.id}`} className="unit-ctl" style={{ left: `${x}%`, top: `${y}%` }}>
              {task.paused ? (
                <button title="Retomar" onClick={() => onControl('resume', agent.id)}>▶</button>
              ) : (
                <button title="Pausar" onClick={() => onControl('pause', agent.id)}>⏸</button>
              )}
              <button title="Parar" className="stop" onClick={() => onControl('stop', agent.id)}>⏹</button>
            </span>
          );
        })}

      {state.tasks.length === 0 && <EmptyArena title="Laboratório vazio" connected={connected} hasProject={hasProject} onAccounts={onAccounts} onProjects={onProjects} />}
    </div>
  );
}
