import type { Task } from '../types';

/** Golpes que o agente lança no monstro enquanto trabalha: cada tipo de tarefa tem o seu; o QA revisa com a lupa. */
export interface Attack {
  name: string;
  rows: string[];
  palette: Record<string, string>;
  /** tamanho base em px (cresce com a complexidade) */
  size: number;
  /** altura do arco do voo em px (0 = reto) */
  arc: number;
  /** giro total em graus durante o voo */
  spin: number;
  /** duração de um ciclo em ms */
  ms: number;
  /** cor do brilho do impacto */
  glow: string;
}

const SWORD = [
  '.......oo',
  '......owo',
  '.....owo.',
  '....owo..',
  '.y.owo...',
  '.yyyo....',
  '..yyy....',
  '.byo.yy..',
  'bo.......',
];
const BOLT = ['...oyyo', '..oyyo.', '.oyyo..', 'oyyyyyo', '.ooyyo.', '..oyyo.', '..oyo..', '..oo...'];
const GEAR = ['...ooo...', '.o.oso.o.', '.ossssso.', 'ossooosso', '.ossssso.', '.o.oso.o.', '...ooo...'];
const ORB = ['..ooo..', '.occco.', 'occwcco', 'occccco', 'occcdco', '.oddco.', '..ooo..'];
const CHECK = ['......oo.', '.....ogo.', 'o...ogo..', 'og.ogo...', '.ogogo...', '..ogo....', '...o.....'];
const SHURIKEN = ['....o....', '...owo...', '...owo...', '.ooowooo.', 'owwwcwwwo', '.ooowooo.', '...owo...', '...owo...', '....o....'];
const LENS = ['..oooo...', '.owwwwo..', 'owccccwo.', 'owccccwo.', 'owccccwo.', '.owwwwo..', '..ooooo..', '.....obo.', '......bo.'];

export const ATTACKS: Record<string, Attack> = {
  feature: { name: 'Espadada', rows: SWORD, palette: { o: '#14182b', w: '#e8f0ff', y: '#ffd166', b: '#8a5a12' }, size: 22, arc: 18, spin: 540, ms: 1500, glow: '#bfe3ff' },
  bug: { name: 'Raio', rows: BOLT, palette: { o: '#3a2a00', y: '#ffe14d' }, size: 20, arc: 0, spin: 0, ms: 1000, glow: '#ffe14d' },
  infra: { name: 'Engrenagem', rows: GEAR, palette: { o: '#1b1f2a', s: '#9aa7bd' }, size: 22, arc: 30, spin: 720, ms: 1700, glow: '#cdd6e6' },
  database: { name: 'Query', rows: ORB, palette: { o: '#062a3a', c: '#3ec6ff', w: '#e6fbff', d: '#1b7fb0' }, size: 20, arc: 6, spin: 0, ms: 1100, glow: '#3ec6ff' },
  test: { name: 'Check', rows: CHECK, palette: { o: '#0c2a14', g: '#5ad16a' }, size: 22, arc: 0, spin: 0, ms: 1200, glow: '#5ad16a' },
  refactor: { name: 'Shuriken', rows: SHURIKEN, palette: { o: '#2a0a2a', w: '#e8c8ff', c: '#b266ff' }, size: 22, arc: 14, spin: 1080, ms: 1300, glow: '#b266ff' },
  review: { name: 'Lupa do QA', rows: LENS, palette: { o: '#2a0a0a', w: '#ffd166', c: '#ff8a80', b: '#8a5a12' }, size: 22, arc: 10, spin: 0, ms: 1400, glow: '#ff8a80' },
};

export const attackFor = (task: Pick<Task, 'type' | 'status' | 'fx'>): Attack => ATTACKS[task.fx ?? (task.status === 'review' ? 'review' : task.type)] ?? ATTACKS.feature;

/** tamanho do monstro em px: o salto entre P, M e G é grande de propósito */
export const MONSTER_SIZE: Record<1 | 2 | 3, number> = { 1: 24, 2: 40, 3: 62 };
/** quantos golpes por ciclo: tarefa maior, mais pancadaria */
export const HITS_PER_CYCLE: Record<1 | 2 | 3, number> = { 1: 1, 2: 2, 3: 3 };
/** golpe pesado em tarefa grande */
export const ATTACK_SCALE: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.25, 3: 1.6 };
