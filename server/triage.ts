/**
 * Maestro de verdade: no modo "Execução real" quem lê o pergaminho (a tarefa)
 * e decide complexidade + agente é um LLM barato (Haiku), não as palavras-chave.
 *
 * Roda `claude -p` sem ferramentas e com um system prompt próprio e curto,
 * então cada triagem custa ~1-2k tokens e leva poucos segundos.
 * O modelo de cada peso continua vindo da tabela de roteamento do jogo.
 */
import { execFile } from 'node:child_process';

export interface TriageAgent {
  id: string;
  name: string;
  role: string;
  title: string;
  instructions: string;
  keywords: string[];
  load: number;
}

export interface TriageRequest {
  task: { title: string; description: string };
  agents: TriageAgent[];
  model?: string;
}

export interface TriageResult {
  agentId: string;
  complexity: 1 | 2 | 3;
  type: 'feature' | 'bug' | 'infra' | 'database' | 'test' | 'refactor';
  lane: 'top' | 'mid' | 'bot' | 'jungle';
  motivo: string;
  tokens: number;
  costUsd: number;
}

const SYSTEM = `Você é o Maestro do Agent Arena. Você NÃO escreve código: lê a tarefa e decide quem faz.

Decida:
1. complexidade: 1 = leve (pequena, bem definida, poucos arquivos: typo, texto, cor, campo, bug simples, uma tela simples e isolada), 2 = média (feature de ponta a ponta, várias partes, precisa de testes), 3 = pesada (arquitetura, segurança, performance, pagamentos, autenticação real com backend, refatoração grande, muitos módulos ou requisito vago).
   Não infle a complexidade: na dúvida entre duas, escolha a menor. Custo importa.
2. tipo: feature, bug, infra, database, test ou refactor.
3. lane: top (front/telas/UI), mid (back/API), bot (infra e banco), jungle (testes).
4. agentId: quem faz. Regras:
   - Especialistas primeiro: banco → DBA, infra/deploy → DevOps, escrever testes → QA, decisão de design/UX (redesenho, usabilidade, acessibilidade, identidade visual, consistência visual) → UI/UX.
   - Implementar telas ou funcionalidades é trabalho de dev, mesmo sendo front.
   - Devs por senioridade mínima: complexidade 1 → Dev Júnior, 2 → Dev Pleno, 3 → Dev Sênior. Nunca dê tarefa leve para sênior.
   - Agente personalizado cujas palavras-chave aparecem na tarefa tem prioridade.
   - Empatou? Prefira o menos ocupado (campo "carga").
5. motivo: 1 frase curta em português, no tom de quem rege uma orquestra, explicando a escolha.`;

const TYPES = ['feature', 'bug', 'infra', 'database', 'test', 'refactor'];
const LANES = ['top', 'mid', 'bot', 'jungle'];

export function triageWithClaude(bin: string, req: TriageRequest): Promise<TriageResult> {
  const agents = req.agents.filter((a) => a.role !== 'maestro');
  const schema = {
    type: 'object',
    properties: {
      complexidade: { type: 'integer', enum: [1, 2, 3] },
      tipo: { type: 'string', enum: TYPES },
      lane: { type: 'string', enum: LANES },
      agentId: { type: 'string', enum: agents.map((a) => a.id) },
      motivo: { type: 'string' },
    },
    required: ['complexidade', 'tipo', 'lane', 'agentId', 'motivo'],
  };
  const roster = agents
    .map(
      (a) =>
        `- id "${a.id}": ${a.name}, ${a.title} (papel ${a.role}, carga ${a.load})` +
        `${a.keywords.length ? `, palavras-chave: ${a.keywords.join(', ')}` : ''}. ${a.instructions.slice(0, 220)}`,
    )
    .join('\n');
  const prompt = `Elenco disponível:\n${roster}\n\nPergaminho (tarefa):\nTítulo: ${req.task.title}\n${req.task.description ? `Descrição: ${req.task.description}` : 'Sem descrição.'}`;

  const args = [
    '-p',
    prompt,
    '--system-prompt',
    SYSTEM,
    '--tools',
    '',
    '--model',
    req.model || 'claude-haiku-5-5',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(schema),
    '--setting-sources',
    'project,local',
    '--strict-mcp-config',
    '--no-session-persistence',
  ];

  return new Promise((resolve, reject) => {
    const child = execFile(bin, args, { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(stderr?.trim() || err.message));
      let out: any;
      try {
        out = JSON.parse(stdout);
      } catch {
        return reject(new Error('Resposta do Maestro ilegível.'));
      }
      const so = out.structured_output;
      if (!so || !agents.some((a) => a.id === so.agentId)) return reject(new Error(out.result || 'Maestro não escolheu ninguém.'));
      const u = out.usage ?? {};
      resolve({
        agentId: so.agentId,
        complexity: [1, 2, 3].includes(so.complexidade) ? so.complexidade : 2,
        type: TYPES.includes(so.tipo) ? so.tipo : 'feature',
        lane: LANES.includes(so.lane) ? so.lane : 'mid',
        motivo: String(so.motivo ?? ''),
        tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        costUsd: Number(out.total_cost_usd ?? 0),
      });
    });
    child.stdin?.end();
  });
}
