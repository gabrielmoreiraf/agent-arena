/**
 * Gera as imagens em pixel art do README (docs/img/*.svg) a partir dos sprites reais do app.
 * Uso: npm run art
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { defaultAgents } from '../src/data/agents';
import { MONSTERS, MONSTER_INFO, MONSTER_BY_TYPE } from '../src/sprites/monsters';
import { BASE_PALETTE, SPRITES } from '../src/sprites/sprites';

const OUT = 'docs/img';
mkdirSync(OUT, { recursive: true });

/** um sprite de texto vira retângulos SVG (pixels iguais em sequência viram um só) */
function rects(rows: string[], palette: Record<string, string>, scale: number, ox: number, oy: number) {
  const colors = { ...BASE_PALETTE, ...palette };
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !colors[ch]) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      out += `<rect x="${ox + x * scale}" y="${oy + y * scale}" width="${w * scale}" height="${scale}" fill="${colors[ch]}"/>`;
      x += w;
    }
  });
  return out;
}

const FONT = `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"`;
const PANEL = '#0a0d18';
const GOLD = '#e8b64c';

function svg(w: number, h: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" rx="14" fill="${PANEL}"/>${body}</svg>\n`;
}

// ---- banner: título + elenco ----
const agents = defaultAgents();
const S = 7; // 16px * 7 = 112
const CELL = 128;
const bw = agents.length * CELL + 40;
let crew = '';
agents.forEach((a, i) => {
  const x = 20 + i * CELL + (CELL - 16 * S) / 2;
  crew += rects(SPRITES[a.sprite] ?? SPRITES.bot, a.palette, S, x, 118);
  crew += `<text x="${20 + i * CELL + CELL / 2}" y="258" text-anchor="middle" fill="#e6edf3" font-size="13" font-weight="700" ${FONT}>${a.name}</text>`;
  crew += `<text x="${20 + i * CELL + CELL / 2}" y="276" text-anchor="middle" fill="#7d8590" font-size="11" ${FONT}>${a.title}</text>`;
});
const banner =
  `<text x="${bw / 2}" y="62" text-anchor="middle" fill="${GOLD}" font-size="44" font-weight="900" letter-spacing="6" ${FONT}>AGENT ARENA</text>` +
  `<text x="${bw / 2}" y="92" text-anchor="middle" fill="#a8b0c2" font-size="15" ${FONT}>uma equipe de agentes de IA, do Maestro ao QA, na sua máquina</text>` +
  crew;
writeFileSync(`${OUT}/banner.svg`, svg(bw, 300, banner));

// ---- monstros = tarefas ----
const types = Object.keys(MONSTER_INFO);
const MS = 6;
const MC = 150;
const mw = types.length * MC + 20;
let mons = `<text x="${mw / 2}" y="34" text-anchor="middle" fill="${GOLD}" font-size="16" font-weight="700" ${FONT}>Cada monstro é uma tarefa</text>`;
types.forEach((t, i) => {
  const m = MONSTERS[MONSTER_BY_TYPE[t]];
  const w = Math.max(...m.rows.map((r) => r.length));
  const x = 10 + i * MC + (MC - w * MS) / 2;
  mons += rects(m.rows, m.palette, MS, x, 56);
  mons += `<text x="${10 + i * MC + MC / 2}" y="${56 + m.rows.length * MS + 22}" text-anchor="middle" fill="#e6edf3" font-size="13" font-weight="700" ${FONT}>${MONSTER_INFO[t].kind}</text>`;
  mons += `<text x="${10 + i * MC + MC / 2}" y="${56 + m.rows.length * MS + 40}" text-anchor="middle" fill="#7d8590" font-size="10.5" ${FONT}>${MONSTER_INFO[t].hint}</text>`;
});
writeFileSync(`${OUT}/monsters.svg`, svg(mw, 56 + 12 * MS + 62, mons));

// ---- provedores (logos oficiais em branco sobre a cor da marca) ----
const BRANDS = [
  { file: 'claude', name: 'Claude Code', bg: '#D97757' },
  { file: 'openai', name: 'Codex', bg: '#10A37F' },
  { file: 'googlegemini', name: 'Gemini CLI', bg: '#4285F4' },
  { file: 'openrouter', name: 'OpenRouter', bg: '#6566F1' },
];
const PC = 170;
let prov = '';
BRANDS.forEach((b, i) => {
  const d = (readFileSync(`public/logos/${b.file}.svg`, 'utf8').match(/<path[^>]*\sd="([^"]+)"/) ?? [])[1] ?? '';
  const x = 20 + i * PC;
  prov += `<rect x="${x + 49}" y="22" width="72" height="72" rx="14" fill="${b.bg}"/>`;
  prov += `<g transform="translate(${x + 49 + 16},${22 + 16}) scale(${40 / 24})" fill="#fff" shape-rendering="geometricPrecision"><path d="${d}"/></g>`;
  prov += `<text x="${x + 85}" y="118" text-anchor="middle" fill="#e6edf3" font-size="13" font-weight="700" ${FONT}>${b.name}</text>`;
});
writeFileSync(`${OUT}/providers.svg`, svg(BRANDS.length * PC + 40, 136, prov));
console.log('Imagens geradas em docs/img/');
