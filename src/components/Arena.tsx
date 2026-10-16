import { useRef } from 'react';
import { levelOf } from '../data/agents';
import { SCROLL_FLIGHT_MS, SCROLL_HANDOFF_MS } from '../engine/game';
import { MONSTERS, MONSTER_BY_TYPE, MONSTER_INFO } from '../sprites/monsters';
import { PixelSprite } from '../sprites/PixelSprite';
import type { Agent, GameState, Lane, Task } from '../types';

/**
 * Arena no estilo Clash Royale (campo vertical):
 *   topo    = lado do Backlog: torre do rei + 2 torres princesas, de onde as tarefas (monstros) marcham
 *   meio    = rio da revisão com 2 pontes (uma por lane)
 *   baixo   = lado do Maestro: torre do rei (Maestro), pergaminhos e o acampamento dos agentes
 * Cada lane tem a sua torre inimiga; quando todas as tarefas dela são concluídas a torre cai (👑).
 * Coordenadas em % da arena; [x, y] de unidades/monstros é a posição dos pés.
 */
type Pt = [number, number];
type Side = 'L' | 'R';

const LANE_X: Record<Side, number> = { L: 24, R: 76 };
/** duas lanes: esquerda = front + testes, direita = back + infra/dados */
const SIDE_OF: Record<Lane, Side> = { top: 'L', jungle: 'L', mid: 'R', bot: 'R' };
const LANE_TITLE: Record<Side, string> = { L: 'FRONT · TESTES', R: 'BACK · INFRA/DADOS' };

const RIVER_Y = 50;
const QUEUE_Y = 28;
const FIGHT_Y = [41, 35];
const REVIEW_Y = [64, 70];

const KING_ENEMY: Pt = [50, 14];
const PRINCESS_ENEMY_Y = 24;
const KING_OURS: Pt = [50, 99];
const MAESTRO_POS: Pt = [50, 90];
const PILE: Pt = [64, 95];
const READING: Pt = [50, 74];
const INCOMING_FROM: Pt = [50, 8];
const CAMP: Pt[] = [
  [30, 80], [70, 80], [36, 90], [64, 90], [24, 92], [76, 92], [38, 72], [62, 72], [50, 83],
];

// pergaminhos: a tarefa chega enrolada, o Maestro abre e lê, depois despacha
const SCROLL_PAL = { o: '#3a2412', p: '#f3dca2', d: '#c9a05a', r: '#c0392b', l: '#6b4a2a' };
const SCROLL_ROLLED = [
  '..oooooooooo..',
  '.oddppppppddo.',
  'oddpppprrpppdo',
  'oddpppprrpppdo',
  'oddppppppppddo',
  '.oddppppppddo.',
  '..oooooooooo..',
];
const SCROLL_OPEN = [
  'oooooooooooooo',
  'oddddddddddddo',
  '.oppppppppppo.',
  '.opllllllllpo.',
  '.oppppppppppo.',
  '.oplllllllppo.',
  '.oppppppppppo.',
  '.opllllllpppo.',
  '.oppppppppppo.',
  '.oplllllllppo.',
  '.oppppppppprro',
  'oddddddddddrro',
  'oooooooooooooo',
];

const PRINCESS = [
  '..o.o..o.o..',
  '..oooooooo..',
  '..occcccco..',
  '...occcco...',
  '...ocwwco...',
  '...ocwwco...',
  '...occcco...',
  '..occcccco..',
  '..occcccco..',
  '.occcccccco.',
  '.oooooooooo.',
];
const KING = [
  '...y.yy.y...',
  '...yyyyyy...',
  '..oyoyyoyo..',
  '.oooooooooo.',
  '.occcccccco.',
  '.occwwwwcco.',
  '.occwoowcco.',
  '.occwoowcco.',
  '.occwwwwcco.',
  '.occcccccco.',
  'occcccccccco',
  'occcccccccco',
  'oooooooooooo',
];
const RUBBLE = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '....o..o....',
  '..o.ococo.o.',
  '.ococcccocco',
  'occocccoccco',
  'ooooooooooo.',
];
const TROPHY = [
  'oooooooooo',
  'oyyyyyyyyo',
  'yoyyyyyyoy',
  'yoyywyyyoy',
  '.oyyyyyyo.',
  '..oyyyyo..',
  '...oyyo...',
  '....yy....',
  '..oyyyyo..',
  '..oooooo..',
];

const RED = { o: '#2a0a0a', c: '#e5534b', w: '#fff3c4', y: '#ffd166' };
const BLUE = { o: '#0a0d18', c: '#4aa3ff', w: '#fff3c4', y: '#ffd166' };
const TROPHY_PAL = { o: '#8a5a12', y: '#ffd166', w: '#fff3c4' };

const shortTitle = (t: string, n = 22) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

interface Props {
  state: GameState;
  onAgent: (id: string) => void;
  onAccounts: () => void;
  onProjects: () => void;
  onIntegrations: () => void;
  /** elixir = fração de tokens que ainda sobra na janela de 5h do Claude (0..1) */
  elixir?: number;
  elixirLabel?: string;
  /** pausar/retomar/parar o agente que está trabalhando (execução real) */
  onControl?: (action: 'pause' | 'resume' | 'stop', agentId: string) => void;
  /** abre os detalhes de uma tarefa (monstro) */
  onTask?: (taskId: string) => void;
}

export function Arena({ state, onAgent, onAccounts, onProjects, onIntegrations, elixir = 1, elixirLabel, onControl, onTask }: Props) {
  const now = Date.now();
  const handingOff = (t: Task) => !!t.assignedAt && now - t.assignedAt < SCROLL_HANDOFF_MS;
  const sideOf = (t: Task) => SIDE_OF[t.lane ?? 'mid'];

  // ---- pergaminhos ----
  const unassigned = state.tasks.filter((t) => t.status === 'backlog' && !t.assigneeId);
  const incoming = unassigned.filter((t) => now - t.createdAt < SCROLL_FLIGHT_MS);
  const pile = unassigned.filter((t) => now - t.createdAt >= SCROLL_FLIGHT_MS);
  const readingTask = pile.find((t) => t.readingSince);
  const waiting = pile.filter((t) => t !== readingTask);
  const handoffs = state.tasks.filter((t) => t.status !== 'done' && handingOff(t));

  // ---- monstros por lane: saem da torre → batalha → cruzam a ponte para a revisão ----
  const onMap = state.tasks.filter((t) => t.status !== 'done' && t.assigneeId && !handingOff(t));
  const monsterPos = new Map<string, Pt>();
  const byTime = (a: Task, b: Task) => (a.assignedAt ?? a.createdAt) - (b.assignedAt ?? b.createdAt);
  for (const side of ['L', 'R'] as Side[]) {
    const x0 = LANE_X[side];
    const here = onMap.filter((t) => sideOf(t) === side);
    const queued = here.filter((t) => t.status === 'backlog').sort(byTime);
    const fighting = here.filter((t) => t.status === 'in_progress').sort(byTime);
    const review = here.filter((t) => t.status === 'review').sort(byTime);
    queued.forEach((t, i) => monsterPos.set(t.id, [x0 + ((i % 5) - 2) * 5, QUEUE_Y]));
    fighting.forEach((t, i) => monsterPos.set(t.id, [x0 + ((i % 2) * 2 - 1) * 9, FIGHT_Y[Math.min(1, Math.floor(i / 2))]]));
    review.forEach((t, i) => monsterPos.set(t.id, [x0 + ((i % 2) * 2 - 1) * 9, REVIEW_Y[Math.min(1, Math.floor(i / 2))]]));
  }

  // ---- torres: cada lane cai quando todas as tarefas dela terminam; o rei, quando termina tudo ----
  const total = state.tasks.length;
  const open = state.tasks.filter((t) => t.status !== 'done').length;
  const tower = (side: Side) => {
    const mine = state.tasks.filter((t) => sideOf(t) === side);
    const left = mine.filter((t) => t.status !== 'done').length;
    return { total: mine.length, left, down: mine.length > 0 && left === 0 };
  };
  const towers = { L: tower('L'), R: tower('R') };
  const kingDown = total > 0 && open === 0;
  const crowns = (towers.L.down ? 1 : 0) + (towers.R.down ? 1 : 0) + (kingDown ? 1 : 0);

  // ---- agentes: marcham até o monstro (ao lado dele) ou ficam no acampamento ----
  const unitPos = new Map<string, Pt>();
  let idle = 0;
  for (const agent of state.agents) {
    if (agent.role === 'maestro') {
      unitPos.set(agent.id, MAESTRO_POS);
      continue;
    }
    const task = state.tasks.find((t) => t.id === agent.currentTaskId);
    const m = task ? monsterPos.get(task.id) : undefined;
    if (m && task) unitPos.set(agent.id, [m[0] + (task.status === 'review' ? 5.5 : -5.5), m[1] + 1.5]);
    else unitPos.set(agent.id, CAMP[idle++ % CAMP.length]);
  }
  const busyIds = new Set(state.agents.map((a) => a.currentTaskId).filter(Boolean));

  // ---- voos (origem/destino e atraso congelados na montagem, para não pular) ----
  const flights = useRef(new Map<string, { from: Pt; to: Pt }>());
  const started = useRef(new Map<string, number>());
  for (const t of handoffs) {
    if (flights.current.has(t.id)) continue;
    const to = unitPos.get(t.assigneeId!) ?? MAESTRO_POS;
    flights.current.set(t.id, { from: READING, to: [to[0], to[1] - 8] });
  }
  for (const id of flights.current.keys()) if (!handoffs.some((t) => t.id === id)) flights.current.delete(id);
  const live = new Set([...incoming.map((t) => `in-${t.id}`), ...handoffs.map((t) => `out-${t.id}`)]);
  for (const k of started.current.keys()) if (!live.has(k)) started.current.delete(k);
  const scrollFly = (key: string, from: Pt, to: Pt, ms: number, elapsedNow: number) => {
    if (!started.current.has(key)) started.current.set(key, elapsedNow);
    const elapsed = started.current.get(key)!;
    return {
      '--x0': `${from[0]}%`,
      '--y0': `${from[1]}%`,
      '--x1': `${to[0]}%`,
      '--y1': `${to[1]}%`,
      animationDuration: `${ms}ms`,
      animationDelay: `-${Math.min(ms, Math.max(0, elapsed))}ms`,
    } as React.CSSProperties;
  };

  const hpBar = (ratio: number) => (
    <div className="tower-hp">
      <i style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
  const elixirSegs = 10;
  const full = Math.round(Math.max(0, Math.min(1, elixir)) * elixirSegs);

  return (
    <div className="arena cr">
      {/* ---- cenário ---- */}
      <div className="cr-half cr-enemy" />
      <div className="cr-half cr-ours" />
      {(['L', 'R'] as Side[]).map((side) => (
        <div key={side} className="cr-lane" style={{ left: `${LANE_X[side]}%` }}>
          <span className="lane-tag">{LANE_TITLE[side]}</span>
        </div>
      ))}
      <div className="cr-river" style={{ top: `${RIVER_Y - 4}%` }}>
        <span className="river-label">🔍 Rio da Revisão</span>
      </div>
      {(['L', 'R'] as Side[]).map((side) => (
        <div key={`b${side}`} className="cr-bridge" style={{ left: `${LANE_X[side]}%`, top: `${RIVER_Y - 5}%` }} />
      ))}

      {/* ---- torres do Backlog (inimigas) ---- */}
      {(['L', 'R'] as Side[]).map((side) => {
        const t = towers[side];
        return (
          <div key={`et${side}`} className={`cr-tower ${t.down ? 'down' : ''}`} style={{ left: `${LANE_X[side]}%`, top: `${PRINCESS_ENEMY_Y}%` }}>
            {hpBar(t.total ? t.left / t.total : 1)}
            <PixelSprite rows={t.down ? RUBBLE : PRINCESS} palette={RED} size={46} />
            <span className="tower-tag">{t.total ? `${t.left}/${t.total}` : '—'}</span>
          </div>
        );
      })}
      <div className={`cr-tower king ${kingDown ? 'down' : ''}`} style={{ left: `${KING_ENEMY[0]}%`, top: `${KING_ENEMY[1]}%` }}>
        {hpBar(total ? open / total : 1)}
        <PixelSprite rows={kingDown ? RUBBLE : KING} palette={RED} size={58} />
        <span className="tower-tag">Backlog</span>
      </div>

      {/* ---- torres do lado do Maestro ---- */}
      {(['L', 'R'] as Side[]).map((side) => (
        <div key={`ot${side}`} className="cr-tower ours" style={{ left: `${LANE_X[side]}%`, top: '82%' }}>
          <PixelSprite rows={PRINCESS} palette={BLUE} size={42} />
        </div>
      ))}
      <div className="cr-tower king ours" style={{ left: `${KING_OURS[0]}%`, top: `${KING_OURS[1]}%` }}>
        <PixelSprite rows={KING} palette={BLUE} size={58} />
      </div>

      <div className="cr-crowns" title="Torres derrubadas: uma por lane concluída e o rei do Backlog">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < crowns ? 'on' : ''}>
            <PixelSprite rows={TROPHY} palette={TROPHY_PAL} size={16} />
          </span>
        ))}
      </div>

      {kingDown && (
        <div className="cr-victory px">
          <div className="px-title">👑 VITÓRIA!</div>
          <div className="hint">Backlog zerado. Todas as torres caíram.</div>
        </div>
      )}

      {/* ---- pergaminhos ---- */}
      {incoming.map((t) => (
        <div
          key={`in-${t.id}`}
          className="scroll-fx fly"
          style={scrollFly(`in-${t.id}`, INCOMING_FROM, PILE, SCROLL_FLIGHT_MS - 500, now - t.createdAt)}
          title={t.title}
        >
          <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={30} />
        </div>
      ))}

      {waiting.map((t, i) => (
        <div
          key={`pile-${t.id}`}
          className="scroll-fx pile"
          style={{ left: `${PILE[0] + (i % 3) * 3}%`, top: `${PILE[1] - Math.floor(i / 3) * 3}%` }}
          title={`Na fila do Maestro: ${t.title}`}
        >
          <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={24} />
        </div>
      ))}

      {readingTask && (
        <div className="scroll-fx reading" style={{ left: `${READING[0]}%`, top: `${READING[1]}%` }} title={readingTask.title}>
          <span className="scroll-title">{readingTask.title}</span>
          <PixelSprite rows={SCROLL_OPEN} palette={SCROLL_PAL} size={36} />
        </div>
      )}

      {handoffs.map((t) => {
        const f = flights.current.get(t.id)!;
        return (
          <div
            key={`out-${t.id}`}
            className="scroll-fx fly handoff"
            style={scrollFly(`out-${t.id}`, f.from, f.to, SCROLL_HANDOFF_MS - 300, now - t.assignedAt!)}
            title={t.title}
          >
            <PixelSprite rows={SCROLL_ROLLED} palette={SCROLL_PAL} size={30} />
          </div>
        );
      })}

      {/* ---- monstros ---- */}
      {onMap.map((task) => {
        const [x, y] = monsterPos.get(task.id) ?? [LANE_X.L, FIGHT_Y[0]];
        const m = MONSTERS[MONSTER_BY_TYPE[task.type] ?? 'slime'];
        const queued = task.status === 'backlog';
        const size = queued ? 18 : 20 + task.complexity * 6;
        const max = task.status === 'review' ? 12 + task.complexity * 8 : task.effort;
        return (
          <div
            key={task.id}
            className={`monster ${busyIds.has(task.id) ? 'hit' : ''} ${task.status === 'review' ? 'review' : ''} ${queued ? 'queued' : ''} ${
              task.assignedAt && now - task.assignedAt < SCROLL_HANDOFF_MS + 1500 ? 'spawn' : ''
            }`}
            style={{ left: `${x}%`, top: `${y}%`, zIndex: queued ? 1 : 2 }}
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

      {/* ---- agentes ---- */}
      {state.agents.map((agent: Agent) => {
        const [x, y] = unitPos.get(agent.id)!;
        const bubble = state.bubbles.find((b) => b.agentId === agent.id && b.from <= now);
        const task = state.tasks.find((t) => t.id === agent.currentTaskId);
        return (
          <button
            key={agent.id}
            className={`unit ${agent.currentTaskId ? 'working' : ''} ${agent.role === 'maestro' && readingTask ? 'reading' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onAgent(agent.id)}
            title={`${agent.name} · ${agent.title}${task ? `\n${task.title}` : '\nLivre'}`}
          >
            {bubble && (
              <span className={`bubble ${agent.role === 'qa' ? 'qa' : ''} ${x > 80 ? 'to-left' : x < 14 ? 'to-right' : ''} ${y < 22 ? 'below' : ''}`}>
                {bubble.text}
              </span>
            )}
            <PixelSprite
              className="sprite"
              sprite={agent.sprite}
              palette={agent.palette}
              size={agent.role === 'maestro' ? 48 : 38}
              flip={task?.status === 'review'}
            />
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

      <div className="cr-legend" title="Cada monstro é uma tarefa. Clique num monstro para ver os detalhes.">
        {Object.entries(MONSTER_INFO).map(([type, i]) => (
          <span key={type} title={`${i.name}: ${i.hint}`}>
            <PixelSprite rows={MONSTERS[MONSTER_BY_TYPE[type]].rows} palette={MONSTERS[MONSTER_BY_TYPE[type]].palette} size={14} /> {i.kind}
          </span>
        ))}
      </div>

      {/* ---- elixir = tokens que sobram na janela de 5h ---- */}
      <div className="cr-elixir" title={elixirLabel ?? 'Tokens restantes na janela de 5h do Claude'}>
        <span className="drop">💧</span>
        <div className="segs">
          {Array.from({ length: elixirSegs }, (_, i) => (
            <i key={i} className={i < full ? 'on' : ''} />
          ))}
        </div>
        <span className="n">{full}</span>
      </div>

      {state.tasks.length === 0 && (
        <div className="arena-empty">
          <div className="px">
            <div className="px-title">Arena vazia</div>
            <ol className="empty-steps">
              <li><b>Conecte uma conta</b> de IA (Claude, Codex, Gemini ou OpenRouter): só as que você quiser.</li>
              <li><b>Escolha o projeto</b>: crie uma pasta nova ou anexe uma que já existe.</li>
              <li><b>Escreva uma tarefa</b> na fila (ou importe do ClickUp, Jira, Linear ou GitHub).</li>
            </ol>
            <div className="btn-group">
              <button className="btn gold" onClick={onAccounts}>1 · Contas</button>
              <button className="btn gold" onClick={onProjects}>2 · Projeto</button>
              <button className="btn" onClick={onIntegrations}>Importar tarefas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
