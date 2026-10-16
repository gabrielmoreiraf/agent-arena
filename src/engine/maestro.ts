/**
 * Cérebro do Maestro: classifica a tarefa, escolhe o agente e o modelo.
 *
 * As mesmas regras estão descritas em .claude/skills/maestro-triage/SKILL.md,
 * para que o Maestro "de verdade" (Claude Code) decida igual ao do jogo.
 * Se um dia quiser trocar por um LLM, basta substituir `triage()` mantendo
 * o mesmo retorno.
 */
import { modelFor } from '../data/providers';
import type { Agent, GameState, Lane, Task, TaskType, Tier } from '../types';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const KW = {
  database: ['banco', 'sql', 'query', 'migracao', 'migration', 'indice', 'index', 'postgres', 'mysql', 'mongo', 'tabela', 'schema', 'coluna', 'seed'],
  infra: ['deploy', 'docker', 'pipeline', 'ci', 'cd', 'kubernetes', 'k8s', 'aws', 'gcp', 'servidor', 'nginx', 'terraform', 'monitoramento', 'infra', 'dns', 'ssl', 'build'],
  test: ['teste', 'testes', 'test', 'e2e', 'qa', 'regressao', 'cobertura', 'cypress', 'playwright'],
  bug: ['bug', 'erro', 'fix', 'crash', 'quebrado', 'quebrando', 'corrigir', 'falha', 'nao funciona'],
  refactor: ['refatorar', 'refactor', 'refatoracao', 'limpar', 'divida tecnica', 'arquitetura'],
  front: ['tela', 'ui', 'botao', 'css', 'layout', 'componente', 'react', 'modal', 'pagina', 'cor', 'texto', 'onboarding', 'dashboard', 'rodape', 'formulario', 'icone'],
  back: ['api', 'endpoint', 'auth', 'servico', 'webhook', 'email', 'senha', 'backend', 'fila', 'job', 'integracao'],
  heavy: ['arquitetura', 'refatorar', 'seguranca', 'performance', 'pagamento', 'escalar', 'escalabilidade', 'integracao', 'autenticacao', 'concorrencia', 'cache', 'multi-tenant', 'reescrever'],
  design: ['ux', 'ui', 'design', 'layout', 'visual', 'estilo', 'figma', 'acessibilidade', 'prototipo', 'wireframe', 'tipografia', 'paleta', 'usabilidade', 'responsivo', 'redesenho', 'redesign'],
  light: ['typo', 'texto', 'cor', 'label', 'icone', 'espacamento', 'copy', 'renomear', 'tooltip', 'ajustar', 'alinhar'],
};

const hits = (text: string, words: string[]) =>
  words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(text));

export interface Classification {
  type: TaskType;
  complexity: 1 | 2 | 3;
  lane: Lane;
  signals: string[];
}

export function classify(title: string, description = ''): Classification {
  const text = norm(`${title} ${description}`);
  const signals: string[] = [];
  const take = (words: string[]) => {
    const h = hits(text, words);
    signals.push(...h);
    return h.length;
  };

  let type: TaskType = 'feature';
  if (take(KW.database)) type = 'database';
  else if (take(KW.infra)) type = 'infra';
  else if (take(KW.test)) type = 'test';
  else if (take(KW.bug)) type = 'bug';
  else if (take(KW.refactor)) type = 'refactor';

  let lane: Lane = 'mid';
  if (type === 'infra' || type === 'database') lane = 'bot';
  else if (type === 'test') lane = 'jungle';
  else if (hits(text, KW.front).length > hits(text, KW.back).length) lane = 'top';

  const heavy = hits(text, KW.heavy).length;
  const light = hits(text, KW.light).length;
  let complexity: 1 | 2 | 3 = 2;
  if (heavy > 0 || type === 'refactor') complexity = 3;
  else if (light > 0) complexity = 1;
  if (description.length > 400 && complexity < 3) complexity = (complexity + 1) as 2 | 3;

  return { type, complexity, lane, signals: [...new Set(signals)].slice(0, 4) };
}

const DEV_LEVEL: Record<string, number> = { 'dev-junior': 1, 'dev-pleno': 2, 'dev-senior': 3 };

function load(agent: Agent) {
  return agent.queue.length + (agent.currentTaskId ? 1 : 0);
}

function leastLoaded(list: Agent[]) {
  return [...list].sort((a, b) => load(a) - load(b))[0];
}

export function pickAgent(agents: Agent[], c: Classification, title: string, description = ''): Agent | undefined {
  const text = norm(`${title} ${description}`);

  // 1) agente personalizado cujas palavras-chave batem com a tarefa
  const custom = agents.filter(
    (a) => a.role === 'custom' && a.keywords.some((k) => k.trim() && text.includes(norm(k.trim()))),
  );
  if (custom.length) return leastLoaded(custom);

  // 2) especialistas
  const byRole = (role: Agent['role']) => agents.filter((a) => a.role === role);
  if (c.type === 'database' && byRole('dba').length) return leastLoaded(byRole('dba'));
  if (c.type === 'infra' && byRole('devops').length) return leastLoaded(byRole('devops'));
  if (c.type === 'test' && byRole('qa').length) return leastLoaded(byRole('qa'));
  if (hits(text, KW.design).length && byRole('designer').length) return leastLoaded(byRole('designer'));

  // 3) devs: só quem tem senioridade para a complexidade; entre eles, o menos ocupado,
  //    preferindo o mais júnior possível (sênior não deve gastar tempo com typo)
  const devs = agents.filter((a) => DEV_LEVEL[a.role] >= c.complexity);
  if (!devs.length) return agents.find((a) => a.role !== 'maestro' && a.role !== 'qa');

  return [...devs].sort((a, b) => load(a) - load(b) || DEV_LEVEL[a.role] - DEV_LEVEL[b.role])[0];
}

export const tierOf = (complexity: 1 | 2 | 3, bounces = 0): Tier => {
  const n = Math.min(3, complexity + (bounces >= 2 ? 1 : 0));
  return n === 1 ? 'leve' : n === 2 ? 'medio' : 'pesado';
};

const TYPE_LABEL: Record<TaskType, string> = {
  feature: 'feature',
  bug: 'bug',
  infra: 'infra',
  database: 'banco',
  test: 'teste',
  refactor: 'refatoração',
};
const SIZE = ['', 'P', 'M', 'G'];

export const effortFor = (complexity: 1 | 2 | 3) => {
  const base = complexity === 1 ? 24 : complexity === 2 ? 60 : 120;
  return Math.round(base * (0.8 + Math.random() * 0.4));
};

export function reasonFor(c: Pick<Classification, 'type' | 'complexity'>, agentName: string, modelLabel: string, why: string) {
  return `${TYPE_LABEL[c.type]} · tamanho ${SIZE[c.complexity]}${why} → ${agentName} com ${modelLabel}`;
}

export interface TriageResult {
  classification: Classification;
  agent?: Agent;
  tier: Tier;
  modelId?: string;
  modelLabel?: string;
  effort: number;
  reason: string;
}

export function triage(state: Pick<GameState, 'agents' | 'providers' | 'routing'>, task: Task): TriageResult {
  const c = classify(task.title, task.description);
  const workers = state.agents.filter((a) => a.role !== 'maestro');
  const agent = pickAgent(workers, c, task.title, task.description);
  const tier = tierOf(c.complexity, task.bounces);
  const model = agent ? modelFor(state, agent.providerId, tier) : undefined;
  const effort = effortFor(c.complexity);
  const why = c.signals.length ? ` · sinais: ${c.signals.map((s) => `"${s}"`).join(', ')}` : '';
  const reason = reasonFor(c, agent?.name ?? '???', model?.label ?? '?', why);
  return { classification: c, agent, tier, modelId: model?.id, modelLabel: model?.label, effort, reason };
}

