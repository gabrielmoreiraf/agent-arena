/**
 * Sprites 16x16 em pixel art, definidos como texto.
 * Cada caractere é uma chave de cor da paleta do agente; '.' é transparente.
 *
 * Chaves comuns: o contorno, h cabelo, s pele, e olho, m boca, c roupa,
 * p calça, b bota. A, B, C são acessórios (cores por agente).
 */

const BASE = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohssssssssho..',
  '..ossessssesso..',
  '..osssssssssso..',
  '..ossssmmsssso..',
  '...osssssssso...',
  '...occcccccco...',
  '..occcccccccco..',
  '..osccccccccso..',
  '...occcccccco...',
  '...oppppppppo...',
  '...oppo..oppo...',
  '..obbbo..obbbo..',
];

type Patch = [row: number, col: number, chars: string];

/** Aplica um patch por cima da base. Espaço = mantém o pixel original. */
function patch(base: string[], patches: Patch[]): string[] {
  const grid = base.map((r) => r.split(''));
  for (const [y, x, chars] of patches) {
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ' || x + i > 15) continue;
      grid[y][x + i] = ch;
    }
  }
  return grid.map((r) => r.join(''));
}

export const SPRITES: Record<string, string[]> = {
  // Maestro: coroa, barba branca e batuta
  maestro: patch(BASE, [
    [0, 3, 'A A AA A A'],
    [1, 3, 'AAAAAAAAAA'],
    [2, 3, 'oBhhhhhhBo'],
    [7, 3, 'wwwmmwww'],
    [8, 3, 'owwwwwwwwo'],
    [9, 3, 'ocwwwwwwco'],
    [10, 2, 'C          C'],
    [11, 2, 'C          C'],
    [12, 2, 'C          C'],
    [9, 14, 'A'],
    [10, 14, 'A'],
    [11, 13, 'A'],
  ]),

  // UI/UX: boina, óculos redondos e um pincel
  designer: patch(BASE, [
    [0, 4, ' AAAAA'],
    [1, 3, 'AAAAAAAAA'],
    [1, 12, 'A'],
    [2, 3, 'ohAAAAAAho'],
    [5, 3, 'BeBssssBeB'],
    [5, 7, 'BB'],
    [9, 14, 'C'],
    [10, 14, 'C'],
    [11, 14, 'p'],
    [12, 14, 'p'],
  ]),

  // Dev Júnior: boné de hélice, olhos arregalados, gota de suor
  junior: patch(BASE, [
    [0, 5, 'BB  BB'],
    [0, 7, 'oo'],
    [1, 4, 'AAAAAAAA'],
    [2, 3, 'oAAAAAAAAo'],
    [5, 4, 'ee    ee'],
    [3, 13, 'D'],
    [4, 14, 'D'],
  ]),

  // Dev Pleno: fone de ouvido, moletom com capuz
  pleno: patch(BASE, [
    [1, 4, 'AAAAAAAA'],
    [2, 2, 'A'],
    [2, 13, 'A'],
    [3, 1, 'A'],
    [3, 14, 'A'],
    [4, 0, 'BA'],
    [4, 14, 'AB'],
    [5, 0, 'BA'],
    [5, 14, 'AB'],
    [6, 0, 'BA'],
    [6, 14, 'AB'],
    [9, 6, 'CC'],
    [9, 8, 'CC'],
  ]),

  // Dev Sênior: óculos, barba, caneca de café
  senior: patch(BASE, [
    [5, 3, 'AAeAAAAeAA'],
    [6, 3, ' AA  AA'],
    [7, 3, 'hhhhmmhhhh'],
    [8, 3, 'ohhhhhhhho'],
    [10, 14, 'BB'],
    [11, 13, 'BBB'],
    [12, 13, 'BB'],
    [9, 14, 'w'],
    [8, 14, ' w'],
  ]),

  // DevOps: capacete amarelo e chave inglesa
  devops: patch(BASE, [
    [0, 4, 'oAAAAAAo'],
    [1, 3, 'oAAAAAAAAo'],
    [2, 2, 'oAAAAAAAAAAo'],
    [3, 1, 'BBBBBBBBBBBBBB'],
    [9, 14, 'CC'],
    [10, 14, 'C'],
    [11, 13, 'CC'],
    [12, 13, 'C'],
    [10, 4, 'AA'],
    [11, 4, 'AA'],
  ]),

  // DBA: capuz de mago e cilindro de banco de dados
  dba: patch(BASE, [
    [0, 7, 'AA'],
    [1, 5, 'AAAAAA'],
    [2, 3, 'oAAAAAAAAo'],
    [3, 2, 'oAAhhhhhhAAo'],
    [4, 2, 'oA'],
    [4, 12, 'Ao'],
    [10, 13, 'BBB'],
    [11, 12, 'BCCCB'],
    [12, 12, 'BBBBB'],
    [13, 12, 'BCCCB'],
    [14, 12, 'BBBBB'],
  ]),

  // QA: chapéu de detetive, sobrancelha brava e lupa
  qa: patch(BASE, [
    [0, 3, 'oAAAAAAAAo'],
    [1, 2, 'oAAAAAAAAAAo'],
    [2, 1, 'AAAAAAAAAAAAAA'],
    [3, 3, 'BBBBBBBBBB'],
    [4, 4, 'hh    hh'],
    [7, 6, 'mmmm'],
    [8, 13, ' CCC'],
    [9, 12, 'C  ' + 'C'],
    [10, 12, 'C  C'],
    [11, 12, ' CC'],
    [12, 11, 'D'],
  ]),

  // Robô genérico para agentes personalizados
  bot: patch(BASE, [
    [0, 7, 'AA'],
    [1, 4, 'oooAAooo'],
    [2, 3, 'oBBBBBBBBo'],
    [3, 2, 'oBBBBBBBBBBo'],
    [4, 2, 'oBssssssssBo'],
    [5, 2, 'oBsAssssAsBo'],
    [6, 2, 'oBssssssssBo'],
    [7, 2, 'oBssCCCCssBo'],
    [8, 3, 'oBBBBBBBBo'],
  ]),

  // Ninja (custom)
  ninja: patch(BASE, [
    [2, 3, 'oAAAAAAAAo'],
    [3, 2, 'oAAAAAAAAAAo'],
    [4, 2, 'oAAAAAAAAAAo'],
    [6, 2, 'oAAAAAAAAAAo'],
    [7, 2, 'oAAAAAAAAAAo'],
    [8, 3, 'oAAAAAAAAo'],
    [3, 13, 'BB'],
    [4, 14, 'B'],
  ]),
};

export const SPRITE_CHOICES = ['bot', 'ninja', 'junior', 'pleno', 'senior', 'devops', 'dba', 'designer', 'qa'];

export const BASE_PALETTE: Record<string, string> = {
  o: '#1a1022',
  s: '#f2c79a',
  e: '#1a1022',
  m: '#8b3a3a',
  w: '#f4f1ea',
  b: '#3b2a22',
  D: '#7cc7ff',
};
