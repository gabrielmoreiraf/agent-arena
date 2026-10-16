export type Role =
  | 'maestro'
  | 'dev-junior'
  | 'dev-pleno'
  | 'dev-senior'
  | 'devops'
  | 'dba'
  | 'qa'
  | 'designer'
  | 'custom';

export type ProviderId = 'claude' | 'codex' | 'gemini' | 'openrouter';

export type Tier = 'leve' | 'medio' | 'pesado';

export type TaskType = 'feature' | 'bug' | 'infra' | 'database' | 'test' | 'refactor';

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export type Lane = 'top' | 'mid' | 'bot' | 'jungle';

export type Source = 'manual' | 'clickup' | 'jira' | 'linear' | 'github';

export interface AgentStats {
  done: number;
  bugsCaused: number;
  bugsFound: number;
  reviews: number;
  tokens: number;
  streak: number;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  title: string;
  sprite: string; // sprite id em sprites.ts
  palette: Record<string, string>;
  providerId: ProviderId;
  /** Instruções próprias (vira o corpo do subagente exportado) */
  instructions: string;
  /** Palavras que puxam tarefas para esse agente (agentes custom) */
  keywords: string[];
  /** Quanto de "dano" por tick (velocidade) */
  power: number;
  /** Chance de deixar passar bug (0..1) — só faz sentido p/ devs */
  bugRate: number;
  xp: number;
  stats: AgentStats;
  currentTaskId?: string;
  queue: string[];
  builtin: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  source: Source;
  externalKey?: string;
  url?: string;
  type: TaskType;
  complexity: 1 | 2 | 3;
  tier: Tier;
  model?: string;
  effort: number;
  hp: number;
  status: TaskStatus;
  assigneeId?: string;
  reviewerId?: string;
  lane: Lane;
  laneT: number;
  bounces: number;
  reason?: string;
  createdAt: number;
  doneAt?: number;
  /** Execução real: job do Claude Code rodando agora para esta tarefa */
  jobId?: string;
  /** Execução real: último comentário do QA (vai no prompt da correção) */
  lastReview?: string;
  /** Execução real: resumo do que o agente disse que fez */
  output?: string;
  /** Execução real: deu erro e espera o usuário mandar tentar de novo */
  blocked?: string;
  realTokens?: number;
  costUsd?: number;
  /** Execução real: worktree/branch isolados da tarefa */
  worktree?: { dir: string; branch: string; base: string };
  /** merge da branch no projeto (sha curto) */
  landedSha?: string;
  /** branch descartada sem aplicar */
  discarded?: boolean;
  /** Execução real: processo do agente congelado */
  paused?: boolean;
  /** Provedor que executa o dev desta tarefa */
  providerId?: string;
  /** Pasta do projeto onde a tarefa roda (execução real) */
  projectDir?: string;
  /** Execução real: comentário do QA ao aprovar */
  qaNote?: string;
  /** Execução real: arquivos que o agente mexeu no projeto alvo */
  files?: { path: string; status: 'M' | 'A' | 'D' | 'R' }[];
  /** Maestro está lendo o pergaminho desde... (triagem por IA em andamento) */
  readingSince?: number;
  /** quando o Maestro despachou o pergaminho para o agente (animação) */
  assignedAt?: number;
}

export type FeedKind = 'maestro' | 'work' | 'qa' | 'banter' | 'done' | 'system' | 'level';

export interface FeedItem {
  id: string;
  at: number;
  kind: FeedKind;
  agentId?: string;
  text: string;
}

export type WindowMode = '5h' | 'daily' | 'weekly' | 'monthly';

export interface UsageEvent {
  at: number;
  tokens: number;
}

export interface ProviderModel {
  id: string;
  label: string;
  tier: Tier;
  /** Multiplicador de consumo de tokens em relação ao modelo médio */
  weight: number;
}

export interface Provider {
  id: ProviderId;
  name: string;
  color: string;
  connected: boolean;
  plan: string;
  models: ProviderModel[];
  limits: Partial<Record<WindowMode, number>>;
  shownModes: WindowMode[];
  events: UsageEvent[];
}

export interface Bubble {
  agentId: string;
  text: string;
  from: number;
  until: number;
}

/** Progresso de um agente dentro de uma partida (projeto) */
export interface AgentProgress {
  xp: number;
  stats: AgentStats;
  queue: string[];
  currentTaskId?: string;
}

/** Partida guardada de um projeto que não está aberto agora */
export interface ProjectMatch {
  tasks: Task[];
  feed: FeedItem[];
  startedAt: number;
  progress: Record<string, AgentProgress>;
}

export interface GameState {
  agents: Agent[];
  tasks: Task[];
  feed: FeedItem[];
  providers: Provider[];
  bubbles: Bubble[];
  speed: 0 | 1 | 3;
  startedAt: number;
  routing: Record<Tier, Partial<Record<ProviderId, string>>>;
  /** versão do elenco padrão salvo (para trazer agentes novos em partidas antigas) */
  rosterVersion?: number;
  /** versão da lista de modelos por provedor (para migrar partidas salvas) */
  modelsVersion?: number;
  /** projeto (pasta) da partida aberta; cada projeto tem tarefas, registro e placar próprios */
  projectDir?: string;
  /** partidas dos outros projetos, guardadas até você voltar para eles */
  matches?: Record<string, ProjectMatch>;
}

/** Tarefa vinda de fora (digitada, colada ou importada de uma integração) */
export interface RawTask {
  title: string;
  description?: string;
  source: Source;
  externalKey?: string;
  url?: string;
}
