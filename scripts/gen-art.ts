/**
 * Gera as imagens em pixel art do README (docs/img/*.svg) a partir dos sprites reais do app.
 * Uso: npm run art
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { defaultAgents } from '../src/data/agents';
import { MONSTERS, MONSTER_BY_TYPE } from '../src/sprites/monsters';
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

type Lang = 'en' | 'pt-BR';
const T = {
  en: {
    tagline: 'a team of AI agents, from Maestro to QA, running on your machine',
    titles: { maestro: 'Orchestrator', junior: 'Junior Dev', pleno: 'Mid Dev', senior: 'Senior Dev', devops: 'DevOps', dba: 'Database', designer: 'UI/UX', qa: 'QA (hates devs)' } as Record<string, string>,
    monstersTitle: 'Every monster is a task',
    kinds: { feature: ['Feature', 'new functionality'], bug: ['Bug', 'something broken to fix'], infra: ['Infra', 'deploy, CI, servers'], database: ['Database', 'schema, queries, migrations'], test: ['Test', 'write or run tests'], refactor: ['Refactor', 'architecture, tech debt'] } as Record<string, string[]>,
    suffix: '',
  },
  'pt-BR': {
    tagline: 'uma equipe de agentes de IA, do Maestro ao QA, na sua máquina',
    titles: { maestro: 'Orquestrador', junior: 'Dev Júnior', pleno: 'Dev Pleno', senior: 'Dev Sênior', devops: 'DevOps', dba: 'Banco de Dados', designer: 'UI/UX', qa: 'QA (odeia devs)' } as Record<string, string>,
    monstersTitle: 'Cada monstro é uma tarefa',
    kinds: { feature: ['Feature', 'funcionalidade nova'], bug: ['Bug', 'algo quebrado para corrigir'], infra: ['Infra', 'deploy, CI, servidor'], database: ['Banco', 'schema, query, migração'], test: ['Teste', 'escrever ou rodar testes'], refactor: ['Refatoração', 'arquitetura e dívida técnica'] } as Record<string, string[]>,
    suffix: '.pt-BR',
  },
};

for (const lang of ['en', 'pt-BR'] as Lang[]) {
const L = T[lang];

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
  crew += `<text x="${20 + i * CELL + CELL / 2}" y="276" text-anchor="middle" fill="#7d8590" font-size="11" ${FONT}>${L.titles[a.id] ?? a.title}</text>`;
});
const banner =
  `<text x="${bw / 2}" y="62" text-anchor="middle" fill="${GOLD}" font-size="44" font-weight="900" letter-spacing="6" ${FONT}>AGENT ARENA</text>` +
  `<text x="${bw / 2}" y="92" text-anchor="middle" fill="#a8b0c2" font-size="15" ${FONT}>${L.tagline}</text>` +
  crew;
writeFileSync(`${OUT}/banner${L.suffix}.svg`, svg(bw, 300, banner));

// ---- monstros = tarefas ----
const types = Object.keys(L.kinds);
const MS = 6;
const MC = 150;
const mw = types.length * MC + 20;
let mons = `<text x="${mw / 2}" y="34" text-anchor="middle" fill="${GOLD}" font-size="16" font-weight="700" ${FONT}>${L.monstersTitle}</text>`;
types.forEach((t, i) => {
  const m = MONSTERS[MONSTER_BY_TYPE[t]];
  const w = Math.max(...m.rows.map((r) => r.length));
  const x = 10 + i * MC + (MC - w * MS) / 2;
  mons += rects(m.rows, m.palette, MS, x, 56);
  mons += `<text x="${10 + i * MC + MC / 2}" y="${56 + m.rows.length * MS + 22}" text-anchor="middle" fill="#e6edf3" font-size="13" font-weight="700" ${FONT}>${L.kinds[t][0]}</text>`;
  mons += `<text x="${10 + i * MC + MC / 2}" y="${56 + m.rows.length * MS + 40}" text-anchor="middle" fill="#7d8590" font-size="10.5" ${FONT}>${L.kinds[t][1]}</text>`;
});
writeFileSync(`${OUT}/monsters${L.suffix}.svg`, svg(mw, 56 + 12 * MS + 62, mons));

}

// ---- providers (official logos in white on the brand color) ----
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
