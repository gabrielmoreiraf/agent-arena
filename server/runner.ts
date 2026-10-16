/**
 * Execução REAL dos agentes: dispara o Claude Code em modo headless
 * (`claude -p --output-format stream-json`) com o subagente e o modelo que o
 * Maestro escolheu, dentro do diretório do projeto alvo, e transmite o
 * progresso para o navegador via SSE (GET /api/real/events).
 *
 * - O subagente é definido inline com `--agents` + `--agent`, então funciona em
 *   qualquer repositório sem precisar exportar .claude/agents antes.
 * - O QA roda como revisor de verdade: sem Edit/Write, lê o `git diff` e devolve
 *   um veredito estruturado (`--json-schema`).
 * - Tokens vêm do `usage` real de cada mensagem (mesma conta do server/usage.ts:
 *   input + output + cache criado).
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';

export type PermissionMode = 'acceptEdits' | 'auto' | 'bypassPermissions';

export interface Project {
  name: string;
  dir: string;
}

export interface RealConfig {
  /** projeto padrão das tarefas novas */
  targetDir: string;
  /** pastas que o Arena conhece (criadas ou anexadas); só nelas os agentes rodam */
  projects: Project[];
  permissionMode: PermissionMode;
  maxParallel: number;
  autoCommit: boolean;
}

export interface RunRequest {
  taskId: string;
  /** pasta do projeto da tarefa (precisa estar em config.projects); vazio = projeto padrão */
  cwd?: string;
  phase: 'work' | 'review';
  model: string;
  agent: { id: string; name: string; role: string; title: string; instructions: string };
  task: { title: string; description: string; complexity: number; bounces: number; lastReview?: string; devName?: string };
}

interface Tokens {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  total: number;
}

/** cada tarefa trabalha isolada num git worktree, numa branch própria */
export interface Worktree {
  dir: string;
  branch: string;
  /** commit do projeto de onde a branch saiu: o QA revisa base..HEAD */
  base: string;
}

/** onde ficam os worktrees das tarefas (fora do projeto e fora do Arena) */
const WT_ROOT = join(homedir(), '.agent-arena', 'worktrees');

export interface Verdict {
  aprovado: boolean;
  comentario: string;
}

export type RealEvent =
  | { type: 'snapshot'; jobs: JobSummary[] }
  | { type: 'start'; job: JobSummary }
  | { type: 'step'; jobId: string; taskId: string; agentId: string; phase: RunRequest['phase']; progress: number; kind: 'tool' | 'text'; text: string }
  | { type: 'tokens'; jobId: string; taskId: string; agentId: string; delta: number; total: number }
  | { type: 'pause'; jobId: string; taskId: string; agentId: string; paused: boolean }
  | {
      type: 'end';
      jobId: string;
      taskId: string;
      agentId: string;
      phase: RunRequest['phase'];
      ok: boolean;
      result?: string;
      verdict?: Verdict;
      error?: string;
      tokens: Tokens;
      costUsd: number;
      commit?: string;
      /** arquivos alterados no projeto alvo ao fim do trabalho (git status) */
      files?: ChangedFile[];
      /** worktree/branch isolados da tarefa */
      worktree?: Worktree;
      /** merge no projeto (aplicado automaticamente ao aprovar) */
      landed?: string;
    };

export interface ChangedFile {
  path: string;
  /** M modificado, A novo, D apagado, R renomeado */
  status: 'M' | 'A' | 'D' | 'R';
}

export interface JobSummary {
  id: string;
  taskId: string;
  agentId: string;
  phase: RunRequest['phase'];
  model: string;
  status: 'running' | 'done' | 'error' | 'canceled';
  progress: number;
  startedAt: number;
  /** processo congelado (SIGSTOP) até retomar */
  paused?: boolean;
  end?: Extract<RealEvent, { type: 'end' }>;
}

/** uma linha do "terminal" do agente */
export interface LogLine {
  t: number;
  kind: 'start' | 'tool' | 'text' | 'out' | 'end' | 'error';
  text: string;
  jobId: string;
  phase: RunRequest['phase'];
}

interface Job extends JobSummary {
  child?: ChildProcess;
  log: LogLine[];
  dir: string;
  projectDir: string;
  wt: Worktree | null;
  /** mudanças que já existiam antes do job (caminho → mtime), para a entrega listar só o que ele mexeu */
  before: Promise<Map<string, number>>;
  steps: number;
  complexity: number;
  tokens: Tokens;
  seenMessages: Set<string>;
  stderr: string;
  title: string;
  agentName: string;
}

const DEV_TOOLS_ALLOWED = [
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(ls:*)',
  'Bash(node:*)',
  'Bash(npm test:*)',
  'Bash(npm run:*)',
  'Bash(npx:*)',
  'Bash(pnpm:*)',
  'Bash(yarn:*)',
  'Bash(python3:*)',
  'Bash(pytest:*)',
];
// commit/push ficam com o Arena (autoCommit), nunca com o agente
const DEV_TOOLS_DENIED = [
  'Bash(git commit:*)',
  'Bash(git push:*)',
  'Bash(git reset:*)',
  'Bash(git checkout:*)',
  'Bash(git switch:*)',
  'Bash(git merge:*)',
  'Bash(git rebase:*)',
  'Bash(git worktree:*)',
  'Bash(rm -rf:*)',
];

const QA_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    aprovado: { type: 'boolean', description: 'true só se a entrega resolve a tarefa sem quebrar nada' },
    comentario: { type: 'string', description: 'Veredito curto e ácido, em português, citando o problema concreto se reprovar' },
  },
  required: ['aprovado', 'comentario'],
});

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const zero = (): Tokens => ({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 });

function tokensOf(u: Record<string, number> | undefined): Tokens {
  const t = zero();
  if (!u) return t;
  t.input = u.input_tokens ?? 0;
  t.output = u.output_tokens ?? 0;
  t.cacheCreate = u.cache_creation_input_tokens ?? 0;
  t.cacheRead = u.cache_read_input_tokens ?? 0;
  t.total = t.input + t.output + t.cacheCreate;
  return t;
}

const short = (s: string, n = 160) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

function describeTool(name: string, input: Record<string, unknown>, cwd: string) {
  const rel = (p: unknown) => (typeof p === 'string' ? p.replace(`${cwd}/`, '') : '');
  switch (name) {
    case 'Bash':
      return `$ ${short(String(input.command ?? ''), 120)}`;
    case 'Read':
      return `📖 lendo ${rel(input.file_path)}`;
    case 'Edit':
    case 'MultiEdit':
      return `✏️ editando ${rel(input.file_path)}`;
    case 'Write':
      return `📝 criando ${rel(input.file_path)}`;
    case 'Grep':
      return `🔎 procurando "${short(String(input.pattern ?? ''), 60)}"`;
    case 'Glob':
      return `🗂 listando ${short(String(input.pattern ?? ''), 60)}`;
    case 'StructuredOutput':
      return '⚖️ dando o veredito';
    case 'TodoWrite':
      return '🗒 organizando a lista de passos';
    default:
      return `🔧 ${name}`;
  }
}

export class Runner {
  private jobs = new Map<string, Job>();
  private clients = new Set<ServerResponse>();
  private seq = 0;
  config: RealConfig;
  private configFile: string;
  readonly bin: string;
  private root: string;

  constructor(root: string, env: Record<string, string>) {
    this.root = resolve(root);
    this.bin = env.CLAUDE_BIN || process.env.CLAUDE_BIN || 'claude';
    this.configFile = join(root, '.arena-real.json');
    const saved = existsSync(this.configFile) ? safeJson(readFileSync(this.configFile, 'utf8')) : {};
    this.config = {
      targetDir: env.ARENA_TARGET_DIR || '',
      projects: [],
      permissionMode: 'acceptEdits',
      maxParallel: 1,
      autoCommit: false,
      ...saved,
    };
    if (this.config.targetDir && !this.config.projects.some((p) => p.dir === this.config.targetDir))
      this.config.projects.push({ name: basename(this.config.targetDir), dir: this.config.targetDir });
    const killAll = () => this.jobs.forEach((j) => j.child?.kill('SIGTERM'));
    process.once('exit', killAll);
  }

  // ---------- configuração ----------

  async status() {
    const dir = this.config.targetDir;
    const exists = !!dir && existsSync(dir) && statSync(dir).isDirectory();
    const isGit = exists && existsSync(join(dir, '.git'));
    const version = await new Promise<string | null>((res) =>
      execFile(this.bin, ['--version'], { timeout: 10_000 }, (err, out) => res(err ? null : out.trim())),
    );
    return { config: this.config, exists, isGit, claude: version, running: this.running() };
  }

  async setConfig(patch: Partial<RealConfig>) {
    const next = { ...this.config, projects: [...this.config.projects] };
    if (typeof patch.targetDir === 'string') {
      const dir = expand(patch.targetDir);
      if (dir) {
        this.assertAllowed(dir);
        if (!next.projects.some((p) => p.dir === dir)) next.projects.push({ name: basename(dir), dir });
      }
      next.targetDir = dir;
    }
    if (patch.permissionMode && ['acceptEdits', 'auto', 'bypassPermissions'].includes(patch.permissionMode))
      next.permissionMode = patch.permissionMode;
    if (typeof patch.maxParallel === 'number') next.maxParallel = Math.max(1, Math.min(4, Math.round(patch.maxParallel)));
    if (typeof patch.autoCommit === 'boolean') next.autoCommit = patch.autoCommit;
    this.config = next;
    await this.save();
    return this.status();
  }

  private save() {
    return writeFile(this.configFile, JSON.stringify(this.config, null, 2));
  }

  // ---------- projetos ----------

  /** nunca deixa um projeto morar dentro do próprio Agent Arena */
  private assertAllowed(dir: string) {
    if (dir === this.root || dir.startsWith(this.root + sep))
      throw new Error('Escolha uma pasta fora do Agent Arena: os agentes não podem criar projetos dentro dele.');
    if (dir === homedir() || dir === '/') throw new Error('Escolha uma pasta de projeto, não a pasta do usuário inteira.');
  }

  /** pasta do projeto da tarefa: só aceita projetos conhecidos */
  projectDir(dir?: string) {
    const d = dir ? expand(dir) : this.config.targetDir;
    if (!d) throw new Error('Escolha um projeto para a tarefa (crie uma pasta nova ou anexe uma existente).');
    if (d !== this.config.targetDir && !this.config.projects.some((p) => p.dir === d)) throw new Error(`Projeto desconhecido: ${d}`);
    if (!existsSync(d)) throw new Error(`A pasta do projeto não existe mais: ${d}`);
    return d;
  }

  /** projeto conhecido ou worktree de tarefa (para pré-visualizar/abrir o que está na branch) */
  knownDir(dir: string) {
    const d = expand(dir);
    if (d.startsWith(WT_ROOT + sep) && existsSync(d)) return d;
    return this.projectDir(d);
  }

  private async useProject(dir: string, name = basename(dir)) {
    if (!this.config.projects.some((p) => p.dir === dir)) this.config.projects.push({ name, dir });
    this.config.targetDir = dir;
    await this.save();
    return this.status();
  }

  /** cria a pasta do projeto (fora do Arena) e já inicia um repositório git, para o QA enxergar o diff */
  async createProject(name: string, parent: string) {
    const clean = name.trim().replace(/[\/:*?"<>|]+/g, '-').replace(/^\.+/, '');
    if (!clean) throw new Error('Dê um nome para o projeto.');
    const base = expand(parent || '~/Documents');
    const dir = join(base, clean);
    this.assertAllowed(dir);
    if (existsSync(dir)) throw new Error(`Já existe uma pasta "${clean}" em ${base}. Use "Anexar pasta" para usar ela.`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'README.md'), `# ${name.trim()}\n\nProjeto criado pelo Agent Arena.\n`);
    const git = (...a: string[]) => this.git(dir, ...a);
    await git('init', '-q');
    await git('add', '-A');
    await git('-c', 'user.name=Agent Arena', '-c', 'user.email=arena@localhost', 'commit', '-qm', 'Início do projeto (Agent Arena)');
    return this.useProject(dir, name.trim());
  }

  async attachProject(raw: string) {
    const dir = expand(raw);
    if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) throw new Error('Essa pasta não existe.');
    this.assertAllowed(dir);
    return this.useProject(dir);
  }

  async removeProject(raw: string) {
    const dir = expand(raw);
    this.config.projects = this.config.projects.filter((p) => p.dir !== dir);
    if (this.config.targetDir === dir) this.config.targetDir = this.config.projects[0]?.dir ?? '';
    await this.save();
    return this.status();
  }

  /** abre o seletor de pastas nativo (macOS) e devolve o caminho escolhido */
  pickFolder(): Promise<string | null> {
    if (process.platform !== 'darwin') return Promise.resolve(null);
    return new Promise((res) =>
      execFile(
        'osascript',
        ['-e', 'POSIX path of (choose folder with prompt "Escolha a pasta do projeto para o Agent Arena")'],
        { timeout: 5 * 60_000 },
        (err, out) => res(err ? null : out.trim().replace(/\/$/, '') || null),
      ),
    );
  }

  // ---------- SSE ----------

  subscribe(res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': conectado\n\n');
    this.clients.add(res);
    this.sendTo(res, { type: 'snapshot', jobs: [...this.jobs.values()].map(summary) });
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    res.on('close', () => {
      clearInterval(ping);
      this.clients.delete(res);
    });
  }

  private sendTo(res: ServerResponse, ev: RealEvent) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  private emit(ev: RealEvent) {
    for (const c of this.clients) this.sendTo(c, ev);
  }

  // ---------- execução ----------

  running() {
    return [...this.jobs.values()].filter((j) => j.status === 'running').length;
  }

  cancel(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    job.status = 'canceled';
    // processo parado não recebe SIGTERM: acorda antes de encerrar
    if (job.paused) job.child?.kill('SIGCONT');
    job.child?.kill('SIGTERM');
    return true;
  }

  /** pausar/retomar congela o processo do Claude (SIGSTOP/SIGCONT): ele continua do mesmo ponto */
  setPaused(jobId: string, paused: boolean) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running' || !job.child || !!job.paused === paused) return false;
    job.child.kill(paused ? 'SIGSTOP' : 'SIGCONT');
    job.paused = paused;
    this.addLog(job, 'out', paused ? '⏸ pausado' : '▶ retomado');
    this.emit({ type: 'pause', jobId, taskId: job.taskId, agentId: job.agentId, paused });
    return true;
  }

  /** ação em lote: de um agente ou de todos. Devolve quantos jobs foram afetados */
  control(action: 'pause' | 'resume' | 'stop', agentId?: string) {
    let n = 0;
    for (const j of this.jobs.values()) {
      if (j.status !== 'running' || (agentId && j.agentId !== agentId)) continue;
      if (action === 'stop' ? this.cancel(j.id) : this.setPaused(j.id, action === 'pause')) n++;
    }
    return n;
  }

  /** o "terminal" de um agente: linhas dos últimos jobs dele + o job atual */
  logs(agentId: string, taskId?: string) {
    const jobs = [...this.jobs.values()].filter((j) => (taskId ? j.taskId === taskId : j.agentId === agentId)).sort((a, b) => a.startedAt - b.startedAt);
    const current = [...jobs].reverse().find((j) => j.status === 'running');
    return {
      current: current ? { jobId: current.id, taskId: current.taskId, title: current.title, paused: !!current.paused, progress: current.progress, tokens: current.tokens.total } : null,
      lines: jobs.flatMap((j) => j.log).slice(-500),
    };
  }

  async start(req: RunRequest): Promise<JobSummary> {
    const projectDir = this.projectDir(req.cwd);
    if (this.running() >= this.config.maxParallel)
      throw new Error(`Limite de ${this.config.maxParallel} execução(ões) simultânea(s) atingido.`);
    const dup = [...this.jobs.values()].find((j) => j.taskId === req.taskId && j.status === 'running');
    if (dup) return summary(dup);
    const wt = await this.ensureWorktree(projectDir, req.taskId, req.task.title).catch((e: Error) => {
      throw new Error(`Não consegui criar o worktree da tarefa: ${e.message}`);
    });
    const dir = wt?.dir ?? projectDir;

    const id = `job_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    const job: Job = {
      id,
      taskId: req.taskId,
      agentId: req.agent.id,
      phase: req.phase,
      model: req.model,
      status: 'running',
      progress: 0,
      startedAt: Date.now(),
      steps: 0,
      complexity: req.task.complexity,
      tokens: zero(),
      seenMessages: new Set(),
      stderr: '',
      title: req.task.title,
      agentName: req.agent.name,
      dir,
      projectDir,
      wt,
      log: [],
      before: this.snapshot(dir),
    };
    this.jobs.set(id, job);
    this.prune();

    const args = this.buildArgs(req, wt);
    const child = spawn(this.bin, args, { cwd: dir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;
    this.emit({ type: 'start', job: summary(job) });
    this.addLog(job, 'start', `▶ ${req.agent.name} (${req.model}) · ${req.phase === 'review' ? 'revisão' : 'trabalho'} · ${req.task.title}`);
    this.addLog(job, 'out', `cwd: ${dir}${wt ? `  (branch ${wt.branch})` : ''}`);

    let resultMsg: Record<string, any> | null = null;
    const rl = createInterface({ input: child.stdout! });
    rl.on('line', (line) => {
      const msg = safeJson(line);
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'result') resultMsg = msg;
      else this.handleMessage(job, msg, dir);
    });
    child.stderr!.on('data', (d) => (job.stderr = (job.stderr + d.toString()).slice(-4000)));
    child.on('error', (err) => {
      job.stderr += `\n${err.message}`;
    });
    child.on('close', (code) => {
      rl.close();
      void this.finish(job, resultMsg, code);
    });
    return summary(job);
  }

  private buildArgs(req: RunRequest, wt: Worktree | null) {
    const agentSlug = slug(`${req.agent.title}-${req.agent.name}`) || 'arena-agent';
    const review = req.phase === 'review';
    const persona = [
      req.agent.instructions.trim(),
      '',
      `Você é ${req.agent.name} (${req.agent.title}) no Agent Arena. Responda sempre em português.`,
      review
        ? 'Neste turno você é o REVISOR: não edite arquivos. Leia o diff, rode testes se existirem e dê o veredito.'
        : 'Trabalhe só no diretório atual. Faça a menor mudança que resolve a tarefa. Não faça commit nem push: o Agent Arena commita por você.',
    ].join('\n');
    const agents = {
      [agentSlug]: {
        description: `${req.agent.title} (${req.agent.name}) do Agent Arena`,
        prompt: persona,
        model: req.model,
      },
    };

    const t = req.task;
    const prompt = review
      ? [
          `Revise a entrega de ${t.devName ?? 'um dev'} para a tarefa: "${t.title}".`,
          t.description ? `Descrição da tarefa:\n${t.description}` : '',
          wt
            ? `Você está no worktree isolado desta tarefa (branch \`${wt.branch}\`). A entrega está commitada: veja com \`git log --oneline ${wt.base.slice(0, 12)}..HEAD\` e \`git diff ${wt.base.slice(0, 12)}..HEAD\`. Tudo nesse diff é desta tarefa.`
            : 'As mudanças ainda não foram commitadas: use `git status` e `git diff` para vê-las (se o diff tiver mudanças de outras tarefas, foque nesta).',
          'Rode os testes do projeto se houver. Não edite nada.',
          'Aprove só se a tarefa foi resolvida de verdade. Se reprovar, diga exatamente o que está errado.',
        ]
          .filter(Boolean)
          .join('\n\n')
      : [
          `Tarefa: "${t.title}"`,
          t.description ? `Descrição:\n${t.description}` : '',
          t.bounces && t.lastReview
            ? `O QA devolveu sua entrega anterior (${t.bounces}x) com este comentário:\n"${t.lastReview}"\nCorrija o que ele apontou.`
            : '',
          'Ao terminar, responda em poucas linhas: o que mudou, arquivos tocados e como testar.',
        ]
          .filter(Boolean)
          .join('\n\n');

    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      req.model,
      '--agents',
      JSON.stringify(agents),
      '--agent',
      agentSlug,
      '--permission-prompts',
      'none',
      // só configurações do projeto: deixa de fora hooks/plugins/MCP do usuário (mais rápido e mais barato)
      '--setting-sources',
      'project,local',
      '--strict-mcp-config',
      '--name',
      `arena: ${t.title.slice(0, 40)}`,
    ];
    if (review) {
      args.push(
        '--permission-mode',
        'default',
        '--allowedTools',
        'Bash(git status:*)',
        'Bash(git diff:*)',
        'Bash(git log:*)',
        'Bash(git show:*)',
        'Bash(npm test:*)',
        'Bash(npm run:*)',
        'Bash(node:*)',
        'Bash(npx:*)',
        '--disallowedTools',
        'Edit',
        'Write',
        'NotebookEdit',
        '--json-schema',
        QA_SCHEMA,
      );
    } else {
      args.push('--permission-mode', this.config.permissionMode, '--allowedTools', ...DEV_TOOLS_ALLOWED, '--disallowedTools', ...DEV_TOOLS_DENIED);
    }
    return args;
  }

  private addLog(job: Job, kind: LogLine['kind'], text: string) {
    job.log.push({ t: Date.now(), kind, text, jobId: job.id, phase: job.phase });
    if (job.log.length > 600) job.log.splice(0, job.log.length - 600);
  }

  private bump(job: Job, kind: 'tool' | 'text', text: string, full?: string) {
    this.addLog(job, kind, full ?? text);
    job.steps++;
    // progresso real é desconhecido: curva assintótica pelos passos, trava em 92% até o resultado
    const k = job.phase === 'review' ? 3 : 2 + job.complexity * 2.5;
    job.progress = Math.min(0.92, 1 - Math.exp(-job.steps / k));
    this.emit({ type: 'step', jobId: job.id, taskId: job.taskId, agentId: job.agentId, phase: job.phase, progress: job.progress, kind, text });
  }

  private addTokens(job: Job, t: Tokens) {
    if (!t.total) return;
    job.tokens.input += t.input;
    job.tokens.output += t.output;
    job.tokens.cacheCreate += t.cacheCreate;
    job.tokens.cacheRead += t.cacheRead;
    job.tokens.total += t.total;
    this.emit({ type: 'tokens', jobId: job.id, taskId: job.taskId, agentId: job.agentId, delta: t.total, total: job.tokens.total });
  }

  private handleMessage(job: Job, msg: Record<string, any>, cwd: string) {
    // saída das ferramentas (o que o terminal mostraria)
    if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
      for (const c of msg.message.content) {
        if (c.type !== 'tool_result') continue;
        const raw = Array.isArray(c.content) ? c.content.map((x: any) => x.text ?? '').join('\n') : String(c.content ?? '');
        const lines = raw.split('\n').filter((l: string) => l.trim());
        if (lines.length) this.addLog(job, c.is_error ? 'error' : 'out', lines.slice(0, 12).map((l: string) => short(l, 200)).join('\n') + (lines.length > 12 ? `\n… +${lines.length - 12} linhas` : ''));
      }
      return;
    }
    if (msg.type !== 'assistant' || !msg.message) return;
    const m = msg.message;
    // a mesma mensagem chega fatiada em vários eventos com o mesmo id e o mesmo usage
    if (m.id && !job.seenMessages.has(m.id)) {
      job.seenMessages.add(m.id);
      this.addTokens(job, tokensOf(m.usage));
    }
    for (const c of m.content ?? []) {
      if (c.type === 'tool_use') this.bump(job, 'tool', describeTool(c.name, c.input ?? {}, cwd));
      else if (c.type === 'text' && c.text?.trim()) this.bump(job, 'text', short(c.text), c.text.trim().slice(0, 1500));
    }
  }

  private async finish(job: Job, result: Record<string, any> | null, code: number | null) {
    const canceled = job.status === 'canceled';
    // acerto final pelo usage consolidado do resultado
    if (result?.usage) {
      const final = tokensOf(result.usage);
      const delta = final.total - job.tokens.total;
      if (delta) {
        job.tokens = final;
        this.emit({ type: 'tokens', jobId: job.id, taskId: job.taskId, agentId: job.agentId, delta, total: final.total });
      }
    }
    const ok = !canceled && !!result && result.subtype === 'success' && !result.is_error;
    let verdict: Verdict | undefined;
    if (ok && job.phase === 'review') {
      const so = result!.structured_output ?? safeJson(result!.result ?? '');
      verdict =
        so && typeof so.aprovado === 'boolean'
          ? { aprovado: so.aprovado, comentario: String(so.comentario ?? '') }
          : { aprovado: false, comentario: 'Não consegui ler o veredito do QA. Revisão inconclusiva.' };
    }

    let commit: string | undefined;
    let files: ChangedFile[] | undefined;
    let landed: string | undefined;
    if (job.wt) {
      // isolado: o trabalho vira commit na branch da tarefa; o projeto só muda no "Aplicar"
      if (ok && job.phase === 'work') {
        commit = await this.commitWork(job).catch(() => undefined);
        files = await this.branchFiles(job.wt).catch(() => undefined);
      }
      if (ok && verdict?.aprovado && this.config.autoCommit)
        landed = await this.land(job.projectDir, job.taskId, job.title).then((r) => r.sha, () => undefined);
    } else {
      if (ok && verdict?.aprovado && this.config.autoCommit) commit = await this.commit(job).catch(() => undefined);
      files = ok && job.phase === 'work' ? await this.touched(job).catch(() => undefined) : undefined;
    }

    const error = ok
      ? undefined
      : canceled
        ? 'Cancelado.'
        : short(result?.result || result?.errors?.join?.('; ') || job.stderr || `claude saiu com código ${code}`, 300);

    job.status = ok ? 'done' : canceled ? 'canceled' : 'error';
    job.paused = false;
    this.addLog(job, ok ? 'end' : 'error', ok ? `✔ terminou · ${job.tokens.total} tokens` : `✖ ${canceled ? 'cancelado' : short(String(result?.result || job.stderr || `saiu com código ${code}`), 300)}`);
    job.progress = ok ? 1 : job.progress;
    job.child = undefined;
    job.end = {
      type: 'end',
      jobId: job.id,
      taskId: job.taskId,
      agentId: job.agentId,
      phase: job.phase,
      ok,
      result: result?.result ? String(result.result).slice(0, 2000) : undefined,
      verdict,
      error,
      tokens: job.tokens,
      costUsd: Number(result?.total_cost_usd ?? 0),
      commit,
      files,
      worktree: job.wt ?? undefined,
      landed,
    };
    this.emit(job.end);
  }

  private git(dir: string, ...a: string[]) {
    return new Promise<string>((res, rej) =>
      execFile('git', a, { cwd: dir, maxBuffer: 8 * 1024 * 1024 }, (err, out, errOut) =>
        err ? rej(new Error((errOut || out || err.message).trim())) : res(out),
      ),
    );
  }

  /** `git diff --no-index` sai com 1 quando há diferença: não é erro */
  private gitDiff(dir: string, ...a: string[]) {
    return new Promise<string>((res, rej) =>
      execFile('git', a, { cwd: dir, maxBuffer: 8 * 1024 * 1024 }, (err, out) => (err && !out ? rej(err) : res(out))),
    );
  }

  // ---------- worktree por tarefa ----------

  private wtDir(projectDir: string, taskId: string) {
    const h = createHash('sha1').update(projectDir).digest('hex').slice(0, 8);
    return join(WT_ROOT, `${slug(basename(projectDir)) || 'projeto'}-${h}`, taskId.replace(/[^\w-]/g, ''));
  }

  /** cria (ou reaproveita) o worktree da tarefa; null se o projeto não tem git com commits */
  async ensureWorktree(projectDir: string, taskId: string, title: string): Promise<Worktree | null> {
    if (!existsSync(join(projectDir, '.git'))) return null;
    const hasHead = await this.git(projectDir, 'rev-parse', '--verify', 'HEAD').then(() => true, () => false);
    if (!hasHead) return null;
    const dir = this.wtDir(projectDir, taskId);
    if (!existsSync(dir)) {
      await mkdir(dirname(dir), { recursive: true });
      const branch = `arena/${slug(title).slice(0, 40) || 'tarefa'}-${taskId.slice(-5).replace(/[^\w-]/g, '')}`;
      const exists = await this.git(projectDir, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).then(() => true, () => false);
      if (exists) await this.git(projectDir, 'worktree', 'add', dir, branch);
      else await this.git(projectDir, 'worktree', 'add', '-b', branch, dir, 'HEAD');
      // dependências: reaproveita o node_modules do projeto (fica fora dos commits)
      if (existsSync(join(projectDir, 'node_modules')) && !existsSync(join(dir, 'node_modules')))
        await symlink(join(projectDir, 'node_modules'), join(dir, 'node_modules')).catch(() => undefined);
    }
    return this.worktreeInfo(projectDir, dir);
  }

  private async worktreeInfo(projectDir: string, dir: string): Promise<Worktree> {
    const branch = (await this.git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).trim();
    const main = (await this.git(projectDir, 'rev-parse', 'HEAD')).trim();
    const base = (await this.git(dir, 'merge-base', 'HEAD', main)).trim();
    return { dir, branch, base };
  }

  /** identidade git: a do usuário; se não tiver, usa a do Arena */
  private async identity(dir: string, name = 'Agent Arena') {
    const email = await this.git(dir, 'config', 'user.email').then((o) => o.trim(), () => '');
    return email ? [] : ['-c', `user.name=${name}`, '-c', 'user.email=arena@localhost'];
  }

  /** commita o que o agente fez na branch da tarefa, com o agente como autor */
  private async commitWork(job: Job) {
    const dir = job.wt!.dir;
    await this.git(dir, 'add', '-A', '--', '.', ':(exclude)node_modules');
    const staged = (await this.git(dir, 'diff', '--cached', '--name-only')).trim();
    if (!staged) return undefined;
    await this.git(
      dir,
      '-c',
      `user.name=${job.agentName} (Agent Arena)`,
      '-c',
      'user.email=arena@localhost',
      'commit',
      '-q',
      '-m',
      `arena: ${job.title}\n\nFeito por ${job.agentName} no Agent Arena.`,
    );
    return (await this.git(dir, 'rev-parse', '--short', 'HEAD')).trim();
  }

  /** arquivos que a branch da tarefa mudou desde a base */
  private async branchFiles(wt: Worktree, range = `${wt.base}..HEAD`, dir = wt.dir): Promise<ChangedFile[]> {
    const out = await this.git(dir, 'diff', '--name-status', range);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [st, ...paths] = line.split('\t');
        const status = (st[0] === 'A' ? 'A' : st[0] === 'D' ? 'D' : st[0] === 'R' ? 'R' : 'M') as ChangedFile['status'];
        return { path: paths[paths.length - 1], status };
      });
  }

  /** aplica a branch da tarefa no projeto (merge --no-ff) e remove o worktree */
  async land(rawDir: string, taskId: string, title: string) {
    const projectDir = this.projectDir(rawDir);
    const dir = this.wtDir(projectDir, taskId);
    if (!existsSync(dir)) throw new Error('O worktree desta tarefa não existe mais (já foi aplicado ou descartado?).');
    if ([...this.jobs.values()].some((j) => j.taskId === taskId && j.status === 'running'))
      throw new Error('Um agente ainda está trabalhando nesta tarefa.');
    const wt = await this.worktreeInfo(projectDir, dir);
    const pending = (await this.git(dir, 'status', '--porcelain', '--', '.', ':(exclude)node_modules')).trim();
    if (pending) throw new Error('O worktree tem mudanças não commitadas. Rode a tarefa de novo ou descarte.');
    const ahead = (await this.git(dir, 'rev-list', '--count', `${wt.base}..HEAD`)).trim();
    if (ahead === '0') throw new Error('A branch não tem nenhuma mudança para aplicar.');
    const ident = await this.identity(projectDir);
    try {
      await this.git(projectDir, ...ident, 'merge', '--no-ff', '-m', `arena: ${title}\n\nAplicado pelo Agent Arena (branch ${wt.branch}).`, wt.branch);
    } catch (e) {
      await this.git(projectDir, 'merge', '--abort').catch(() => undefined);
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        /conflict|CONFLICT/.test(msg)
          ? `Conflito com o que já está no projeto. Nada foi alterado. Para resolver na mão: git merge ${wt.branch}`
          : /overwritten|local changes/.test(msg)
            ? 'O projeto tem mudanças não commitadas nos mesmos arquivos. Commite ou guarde (stash) e tente de novo.'
            : msg,
      );
    }
    const sha = (await this.git(projectDir, 'rev-parse', '--short', 'HEAD')).trim();
    await this.git(projectDir, 'worktree', 'remove', '--force', dir).catch(() => undefined);
    await this.git(projectDir, 'branch', '-d', wt.branch).catch(() => undefined);
    return { sha, branch: wt.branch };
  }

  /** joga fora o trabalho da tarefa: remove o worktree e a branch */
  async discard(rawDir: string, taskId: string) {
    const projectDir = this.projectDir(rawDir);
    const dir = this.wtDir(projectDir, taskId);
    if ([...this.jobs.values()].some((j) => j.taskId === taskId && j.status === 'running'))
      throw new Error('Um agente ainda está trabalhando nesta tarefa.');
    let branch: string | undefined;
    if (existsSync(dir)) {
      branch = (await this.git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').catch(() => '')).trim() || undefined;
      await this.git(projectDir, 'worktree', 'remove', '--force', dir);
    }
    if (branch) await this.git(projectDir, 'branch', '-D', branch).catch(() => undefined);
    return { discarded: true, branch };
  }

  /** arquivos com mudança não commitada no projeto alvo */
  async changedFiles(dir: string): Promise<ChangedFile[]> {
    if (!existsSync(join(dir, '.git'))) return [];
    const out = await this.git(dir, 'status', '--porcelain', '-uall');
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const xy = line.slice(0, 2);
        const path = line.slice(3).split(' -> ').pop()!.replace(/^"|"$/g, '');
        const status: ChangedFile['status'] = xy.includes('?') || xy.includes('A') ? 'A' : xy.includes('D') ? 'D' : xy.includes('R') ? 'R' : 'M';
        return { path, status };
      })
      .filter((f) => f.path !== 'node_modules');
  }

  private mtime(dir: string, path: string) {
    const abs = join(dir, path);
    return existsSync(abs) ? statSync(abs).mtimeMs : -1;
  }

  private async snapshot(dir: string) {
    const files = await this.changedFiles(dir).catch(() => []);
    return new Map(files.map((f) => [f.path, this.mtime(dir, f.path)]));
  }

  /** só o que mudou durante o job: arquivos novos na lista ou com mtime diferente do início */
  private async touched(job: Job) {
    const before = await job.before;
    const after = await this.changedFiles(job.dir);
    return after.filter((f) => !before.has(f.path) || before.get(f.path) !== this.mtime(job.dir, f.path));
  }

  /** diff das mudanças atuais (só dos arquivos pedidos, se vierem), incluindo arquivos novos */
  async changes(rawDir: string | undefined, only?: string[], taskId?: string, merge?: string) {
    const projectDir = this.projectDir(rawDir);
    // já aplicada: mostra o que o merge trouxe
    if (merge && /^[0-9a-f]{4,40}$/i.test(merge)) {
      const range = `${merge}^1..${merge}`;
      const files = await this.branchFiles({ dir: projectDir, branch: '', base: '' }, range, projectDir);
      const diff = await this.git(projectDir, 'diff', range);
      return { dir: projectDir, isGit: true, isolated: false, files: files.map((f) => ({ ...f, exists: existsSync(join(projectDir, f.path)) })), diff: diff.slice(0, 400_000) };
    }
    // ainda na branch da tarefa: diff isolado base..worktree (commitado + o que sobrou sem commit)
    const wtDir = taskId ? this.wtDir(projectDir, taskId) : '';
    if (wtDir && existsSync(wtDir)) {
      const wt = await this.worktreeInfo(projectDir, wtDir);
      const committed = await this.branchFiles(wt);
      const loose = await this.changedFiles(wtDir);
      const byPath = new Map([...committed, ...loose].map((f) => [f.path, f]));
      const parts = [await this.git(wtDir, 'diff', wt.base, '--', '.', ':(exclude)node_modules')];
      for (const f of loose.filter((f) => f.status === 'A')) parts.push(await this.gitDiff(wtDir, 'diff', '--no-index', '--', '/dev/null', f.path));
      return {
        dir: wtDir,
        isGit: true,
        isolated: true,
        worktree: wt,
        files: [...byPath.values()].map((f) => ({ ...f, exists: existsSync(join(wtDir, f.path)) })),
        diff: parts.join('\n').slice(0, 400_000),
      };
    }
    const dir = projectDir;
    const isGit = existsSync(join(dir, '.git'));
    if (!isGit) return { dir, isGit, isolated: false, files: [] as (ChangedFile & { exists: boolean })[], diff: '' };
    let files = await this.changedFiles(dir);
    if (only?.length) {
      const want = new Set(only);
      files = files.filter((f) => want.has(f.path));
    }
    const tracked = files.filter((f) => f.status !== 'A').map((f) => f.path);
    const parts: string[] = [];
    if (tracked.length) parts.push(await this.gitDiff(dir, 'diff', 'HEAD', '--', ...tracked));
    for (const f of files.filter((f) => f.status === 'A')) parts.push(await this.gitDiff(dir, 'diff', '--no-index', '--', '/dev/null', f.path));
    return {
      dir,
      isGit,
      isolated: false,
      files: files.map((f) => ({ ...f, exists: existsSync(join(dir, f.path)) })),
      diff: parts.join('\n').slice(0, 400_000),
    };
  }

  /** caminho absoluto dentro do projeto alvo (bloqueia ../ para fora dele) */
  safePath(dir: string, rel: string) {
    const root = resolve(dir);
    const abs = resolve(root, decodeURIComponent(rel).replace(/^\/+/, ''));
    if (abs !== root && !abs.startsWith(root + sep)) throw new Error('Caminho fora do projeto.');
    return abs;
  }

  /** serve arquivos do projeto alvo para a pré-visualização (ex.: login.html + login.js) */
  preview(key: string, rel: string, res: ServerResponse) {
    const dir = this.knownDir(Buffer.from(key, 'base64url').toString('utf8'));
    let abs = this.safePath(dir, rel || 'index.html');
    if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, 'index.html');
    if (!existsSync(abs)) {
      res.statusCode = 404;
      return res.end(`Arquivo não encontrado: ${relative(dir, abs)}`);
    }
    res.setHeader('Content-Type', MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(abs).pipe(res);
  }

  /** abre a pasta (Finder) ou o arquivo no app padrão do sistema */
  open(rawDir: string | undefined, rel = '') {
    const dir = rawDir ? this.knownDir(rawDir) : this.projectDir();
    const abs = rel ? this.safePath(dir, rel) : dir;
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    const args = process.platform === 'darwin' && rel ? ['-R', abs] : [abs];
    execFile(cmd, args, () => undefined);
    return abs;
  }

  private commit(job: Job) {
    const git = (...a: string[]) => this.git(job.dir, ...a).then((o) => o.trim());
    return git('add', '-A')
      .then(() => git('commit', '-m', `arena: ${job.title}\n\nEntregue no Agent Arena, aprovado pelo QA (${job.agentName}).`))
      .then(() => git('rev-parse', '--short', 'HEAD'));
  }

  /** guarda só as 50 execuções mais recentes já encerradas */
  private prune() {
    const ended = [...this.jobs.values()].filter((j) => j.status !== 'running');
    for (const j of ended.slice(0, Math.max(0, ended.length - 50))) this.jobs.delete(j.id);
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function summary(j: Job): JobSummary {
  return {
    id: j.id,
    taskId: j.taskId,
    agentId: j.agentId,
    phase: j.phase,
    model: j.model,
    status: j.status,
    progress: j.progress,
    startedAt: j.startedAt,
    paused: j.paused,
    end: j.end,
  };
}

function expand(raw: string) {
  const t = raw.trim().replace(/^~(?=$|\/)/, homedir());
  return t ? resolve(t) : '';
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
