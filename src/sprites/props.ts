/** Pixel art compartilhada pelos mapas: pergaminhos e a mobília do Laboratório. Mesma convenção dos sprites (uma letra por cor). */

// ---------- pergaminhos: a tarefa chega enrolada, o Maestro abre e lê, depois despacha ----------
export const SCROLL_PAL = { o: '#3a2412', p: '#f3dca2', d: '#c9a05a', r: '#c0392b', l: '#6b4a2a' };
export const SCROLL_ROLLED = [
  '..oooooooooo..',
  '.oddppppppddo.',
  'oddpppprrpppdo',
  'oddpppprrpppdo',
  'oddppppppppddo',
  '.oddppppppddo.',
  '..oooooooooo..',
];
export const SCROLL_OPEN = [
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

// ---------- ferramentas para montar sprites sem contar pixel na mão ----------
const grid = (w: number, h: number) => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
const out = (g: string[][]) => g.map((r) => r.join(''));
/** retângulo com contorno `o` e miolo `fill` */
function box(g: string[][], x: number, y: number, w: number, h: number, fill: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[y + j][x + i] = j === 0 || j === h - 1 || i === 0 || i === w - 1 ? 'o' : fill;
}
const dot = (g: string[][], x: number, y: number, c: string) => {
  if (g[y]?.[x] !== undefined) g[y][x] = c;
};

// ---------- computador de bancada ----------
const pc = grid(18, 15);
box(pc, 2, 0, 14, 9, 'm'); // moldura do monitor
box(pc, 3, 1, 12, 7, 's'); // tela acesa
for (const [x, y] of [[5, 3], [6, 3], [7, 3], [5, 5], [6, 5], [8, 5], [9, 5], [10, 5], [11, 3], [12, 3]]) dot(pc, x, y, 'g'); // linhas de código
box(pc, 7, 9, 4, 2, 'm'); // pescoço
box(pc, 5, 11, 8, 2, 'm'); // base
box(pc, 3, 13, 12, 2, 'k'); // teclado
export const PC = out(pc);
export const PC_PAL = { o: '#0a0d18', m: '#3a4256', s: '#1f6f9a', g: '#bff3ff', k: '#8892a8' };

// ---------- cafeteira ----------
const cf = grid(14, 16);
box(cf, 1, 0, 12, 14, 'c');
box(cf, 3, 2, 8, 4, 'd'); // visor
box(cf, 4, 7, 6, 5, 'x'); // bico/saída
dot(cf, 11, 3, 'r');
box(cf, 4, 12, 6, 4, 'w'); // xícara
export const COFFEE = out(cf);
export const COFFEE_PAL = { o: '#14100c', c: '#7a4a2a', d: '#1d1a17', x: '#3a2412', r: '#e5534b', w: '#f4f1ea' };

// ---------- xícara no balcão ----------
const cup = grid(7, 7);
box(cup, 0, 0, 6, 6, 'w');
dot(cup, 6, 2, 'o');
dot(cup, 6, 3, 'o');
dot(cup, 2, 2, 'x');
dot(cup, 3, 2, 'x');
export const CUP = out(cup);
export const CUP_PAL = { o: '#14100c', w: '#f4f1ea', x: '#6b4a2a' };

// ---------- planta ----------
export const PLANT = [
  '...gg..gg...',
  '..gGGggGGg..',
  '.gGGGGGGGGg.',
  '..gGGGGGGg..',
  '...gGGGGg...',
  '....gGGg....',
  '.....gg.....',
  '...oooooo...',
  '...opppppo..',
  '...opppppo..',
  '....oppo....',
  '....oooo....',
];
export const PLANT_PAL = { o: '#2a1a0c', g: '#2f8f45', G: '#5ad16a', p: '#b5651d' };

// ---------- porta com leitor biométrico ----------
const door = grid(22, 28);
box(door, 0, 0, 22, 28, 's'); // folha de aço
box(door, 2, 2, 18, 24, 'e'); // painel
for (let y = 4; y < 24; y += 5) for (let x = 3; x < 19; x++) dot(door, x, y, 'l'); // frisos
dot(door, 4, 14, 'h');
dot(door, 4, 15, 'h');
dot(door, 4, 16, 'h'); // maçaneta
export const DOOR = out(door);
export const DOOR_PAL = { o: '#0a0d18', s: '#7d8aa3', e: '#a6b3cc', l: '#8d9ab3', h: '#ffd166' };

/** leitor de digital; `led` muda de cor (vermelho = trancada, verde = liberada) */
const bio = grid(10, 14);
box(bio, 0, 0, 10, 14, 'b');
box(bio, 1, 1, 8, 3, 'd'); // visor
dot(bio, 2, 2, 'l');
dot(bio, 3, 2, 'l'); // led
// digital: arcos concêntricos
for (const [x, y] of [[4, 6], [5, 6], [3, 7], [6, 7], [4, 8], [5, 8], [3, 9], [6, 9], [4, 10], [5, 10], [3, 11], [6, 11]]) dot(bio, x, y, 'f');
export const BIO = out(bio);
export const bioPalette = (granted: boolean) => ({ o: '#0a0d18', b: '#3a4256', d: '#101624', l: granted ? '#5ad16a' : '#e5534b', f: granted ? '#5ad16a' : '#6b7a99' });

// ---------- alma de monstro derrotado ----------
export const GHOST = [
  '....oooo....',
  '..ooggggoo..',
  '.oggggggggo.',
  '.ogeeggeego.',
  '.ogeeggeego.',
  '.oggggggggo.',
  '.ogggoogggo.',
  '.oggggggggo.',
  '.oggggggggo.',
  '.oggggggggo.',
  '.oggggggggo.',
  '.ogg.gg.ggo.',
  '.oo.oo.oo.o.',
];
export const GHOST_PAL = { o: '#2a2540', g: '#d6e8ff', e: '#14182b' };
/** fiapo de energia que a alma suga do agente */
export const WISP = ['.oo.', 'opwo', 'oppo', '.oo.'];
export const WISP_PAL = { o: '#2a0a3a', p: '#c58cff', w: '#f1dcff' };

// ---------- banheiro ----------
const toilet = grid(12, 16);
box(toilet, 2, 0, 8, 6, 'w'); // caixa acoplada
dot(toilet, 8, 2, 'k'); // botão da descarga
box(toilet, 1, 6, 10, 6, 'w'); // louça
box(toilet, 3, 12, 6, 4, 'w'); // base
export const TOILET = out(toilet);
export const TOILET_PAL = { o: '#2a3350', w: '#e9f0fb', k: '#9aa7bd' };

const sink = grid(14, 12);
box(sink, 0, 2, 14, 6, 'w'); // bancada com cuba
box(sink, 2, 3, 10, 3, 'c'); // cuba
dot(sink, 6, 0, 'k');
dot(sink, 7, 0, 'k');
dot(sink, 6, 1, 'k');
dot(sink, 7, 1, 'k'); // torneira
box(sink, 5, 8, 4, 4, 'w'); // pé
export const SINK = out(sink);
export const SINK_PAL = { o: '#2a3350', w: '#e9f0fb', c: '#8fc7ff', k: '#9aa7bd' };
