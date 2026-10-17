import type { Agent, AgentStats, Role } from '../types';

export const emptyStats = (): AgentStats => ({
  done: 0,
  bugsCaused: 0,
  bugsFound: 0,
  reviews: 0,
  tokens: 0,
  streak: 0,
});

type Seed = Omit<Agent, 'xp' | 'stats' | 'queue' | 'builtin' | 'currentTaskId'>;

const seeds: Seed[] = [
  {
    id: 'maestro',
    name: 'Dotor',
    role: 'maestro',
    title: 'Orquestrador',
    sprite: 'maestro',
    palette: { h: '#c9c3d6', c: '#eef1f6', p: '#2c1847', A: '#ffd166', B: '#2a9d8f', C: '#b8c0d0' },
    providerId: 'claude',
    instructions:
      'Você é o Maestro. Lê cada tarefa, classifica tipo e complexidade (P/M/G), escolhe o agente certo e o modelo certo para o custo/benefício. Nunca escreve código: só distribui, acompanha e cobra.',
    keywords: [],
    power: 0,
    bugRate: 0,
  },
  {
    id: 'junior',
    name: 'Juninho',
    role: 'dev-junior',
    title: 'Dev Júnior',
    sprite: 'junior',
    palette: { h: '#7a4a2a', c: '#2fa86b', p: '#2b3a67', A: '#e5534b', B: '#ffd166' },
    providerId: 'claude',
    instructions:
      'Dev júnior entusiasmado. Pega tarefas pequenas e bem definidas (ajuste de texto, cor, campo, bug simples). Sempre lê o código ao redor antes de mexer e pergunta quando a tarefa não está clara.',
    keywords: [],
    power: 3,
    bugRate: 0.35,
  },
  {
    id: 'pleno',
    name: 'Plenão',
    role: 'dev-pleno',
    title: 'Dev Pleno',
    sprite: 'pleno',
    palette: { h: '#2b1d14', c: '#3f5fbf', p: '#22283d', A: '#22283d', B: '#ff8c42', C: '#f4f1ea' },
    providerId: 'claude',
    instructions:
      'Dev pleno. Entrega features completas de ponta a ponta (tela + API), escreve testes do que muda e segue os padrões do projeto.',
    keywords: [],
    power: 5,
    bugRate: 0.2,
  },
  {
    id: 'senior',
    name: 'Seu Sênior',
    role: 'dev-senior',
    title: 'Dev Sênior',
    sprite: 'senior',
    palette: { h: '#9aa0a6', c: '#3a3f4b', p: '#1f2229', A: '#ffd166', B: '#c0392b' },
    providerId: 'claude',
    instructions:
      'Dev sênior. Fica com arquitetura, refatorações grandes, segurança e performance. Explica o porquê das decisões e deixa o código mais simples do que encontrou.',
    keywords: [],
    power: 8,
    bugRate: 0.08,
  },
  {
    id: 'devops',
    name: 'Ops Rocha',
    role: 'devops',
    title: 'DevOps',
    sprite: 'devops',
    palette: { h: '#5a3a22', c: '#ff8c42', p: '#2b3a67', A: '#ffd166', B: '#c99a1e', C: '#9aa0a6' },
    providerId: 'codex',
    instructions:
      'DevOps. Cuida de CI/CD, Docker, infraestrutura, deploy, observabilidade e custos. Nunca faz deploy em produção sem checklist e plano de rollback.',
    keywords: [],
    power: 5,
    bugRate: 0.12,
  },
  {
    id: 'dba',
    name: 'Dona Query',
    role: 'dba',
    title: 'Banco de Dados',
    sprite: 'dba',
    palette: { h: '#d35d8f', c: '#1f6f78', p: '#183b40', s: '#e8b48a', A: '#2a9d8f', B: '#e9c46a', C: '#264653' },
    providerId: 'gemini',
    instructions:
      'Especialista em banco de dados. Modela schemas, escreve migrações reversíveis, cria índices e otimiza queries. Sempre mede antes e depois (EXPLAIN).',
    keywords: [],
    power: 5,
    bugRate: 0.1,
  },
  {
    id: 'designer',
    name: 'Lia Pixel',
    role: 'designer',
    title: 'UI/UX',
    sprite: 'designer',
    palette: { h: '#2a1a3a', c: '#e76f9a', p: '#3a2f5c', s: '#f1c7a0', A: '#ffd166', B: '#4fc3c8', C: '#7a4dd8' },
    providerId: 'claude',
    instructions:
      'Designer de UI/UX. Cuida da experiência e do visual: layout, hierarquia, espaçamento, tipografia, cores, estados (vazio, erro, carregando), responsividade e acessibilidade (contraste, foco, labels). Segue o design system do projeto e implementa as mudanças de interface com cuidado de pixel.',
    keywords: [],
    power: 5,
    bugRate: 0.15,
  },
  {
    id: 'qa',
    name: 'Detetive QA',
    role: 'qa',
    title: 'QA (odeia devs)',
    sprite: 'qa',
    palette: { h: '#3a2a1a', c: '#7a5c3a', p: '#3b3026', A: '#8b6b43', B: '#3a2a1a', C: '#cfd8dc', D: '#5a4632' },
    providerId: 'claude',
    instructions:
      'QA desconfiado. Revisa toda entrega, testa casos de borda, tenta quebrar tudo e devolve com um comentário ácido quando acha bug. Só aprova o que funciona de verdade.',
    keywords: [],
    power: 6,
    bugRate: 0,
  },
];

/** v2: entrou a Lia Pixel (UI/UX) · v3: o Maestro agora se chama Dotor */
export const ROSTER_VERSION = 3;

export function defaultAgents(): Agent[] {
  return seeds.map((s) => ({ ...s, xp: 0, stats: emptyStats(), queue: [], builtin: true }));
}

export const ROLE_LABEL: Record<Role, string> = {
  maestro: 'Maestro',
  'dev-junior': 'Dev Júnior',
  'dev-pleno': 'Dev Pleno',
  'dev-senior': 'Dev Sênior',
  devops: 'DevOps',
  dba: 'Banco',
  qa: 'QA',
  designer: 'UI/UX',
  custom: 'Personalizado',
};

/** Nível a partir do XP (curva quadrática) */
export function levelOf(xp: number) {
  return Math.floor(Math.sqrt(xp / 60)) + 1;
}

export function xpForLevel(level: number) {
  return (level - 1) ** 2 * 60;
}

const RANKS = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Mestre', 'Lenda'];
export function rankOf(level: number) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
}
