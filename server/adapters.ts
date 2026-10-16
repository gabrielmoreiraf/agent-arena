/**
 * Adaptadores de execução para CLIs que não são o Claude Code (Gemini CLI e Codex CLI).
 * Cada um monta o comando headless e converte a saída em JSON (uma linha por evento) em passos do "terminal".
 *
 * ATENÇÃO: os formatos de evento abaixo seguem a documentação de cada CLI, mas ainda NÃO foram validados contra uma
 * execução real nesta máquina (o Gemini estava sem login e o Codex não estava instalado). A leitura é defensiva:
 * eventos desconhecidos são ignorados e qualquer falha da CLI aparece no terminal do agente.
 */
export type OtherProvider = 'gemini' | 'codex';

export interface OtherInput {
  provider: OtherProvider;
  model: string;
  prompt: string;
  persona: string;
  review: boolean;
  dir: string;
  geminiKey?: string;
}

/** Como o QA devolve o veredito nas CLIs sem saída estruturada */
export const VERDICT_INSTRUCTION =
  'Ao final, responda com UM objeto JSON numa única linha, sem texto depois dele: {"aprovado": true|false, "comentario": "veredito curto em português, citando o problema concreto se reprovar"}.';

export function otherCommand(i: OtherInput): { bin: string; args: string[]; env: Record<string, string> } {
  const full = [i.persona, '', i.prompt, i.review ? `\n${VERDICT_INSTRUCTION}` : ''].join('\n');
  if (i.provider === 'gemini') {
    return {
      bin: 'gemini',
      // dev: edita arquivos sem pedir; QA: modo somente leitura (plan). Comandos de shell não são aprovados automaticamente.
      args: ['-p', full, ...(i.model && i.model !== 'default' ? ['-m', i.model] : []), '--approval-mode', i.review ? 'plan' : 'auto_edit', '-o', 'stream-json', '--skip-trust'],
      env: i.geminiKey ? { GEMINI_API_KEY: i.geminiKey } : {},
    };
  }
  return {
    bin: 'codex',
    // sandbox do próprio Codex: dev só escreve dentro do worktree; QA só lê
    args: ['exec', '--json', '--skip-git-repo-check', '--sandbox', i.review ? 'read-only' : 'workspace-write', '-C', i.dir, ...(i.model && i.model !== 'default' ? ['-m', i.model] : []), full],
    env: {},
  };
}

export interface ParsedStep {
  tool?: string;
  text?: string;
  out?: string;
  tokens?: { input: number; output: number };
  error?: string;
}

const short = (s: unknown, n = 140) => {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseOtherLine(provider: OtherProvider, m: Record<string, any>): ParsedStep[] {
  const out: ParsedStep[] = [];
  const type = String(m.type ?? '');

  if (provider === 'gemini') {
    if (type === 'message' && m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) out.push({ text: m.content });
    else if (type === 'tool_use') {
      const name = m.tool_name ?? m.name ?? 'ferramenta';
      const p = m.parameters ?? m.args ?? {};
      const detail = p.command ?? p.file_path ?? p.path ?? p.pattern ?? p.dir_path ?? '';
      out.push({ tool: `🔧 ${name}${detail ? `: ${short(detail, 100)}` : ''}` });
    } else if (type === 'tool_result') {
      const o = m.output ?? m.content ?? m.error?.message;
      if (o) out.push({ out: short(typeof o === 'string' ? o : JSON.stringify(o), 400) });
    } else if (type === 'error') out.push({ error: short(m.message ?? m.error?.message ?? JSON.stringify(m), 300) });
    else if (type === 'result') {
      const st = m.stats ?? {};
      const input = num(st.input_tokens ?? st.input ?? st.prompt_tokens);
      const output = num(st.output_tokens ?? st.output ?? st.candidates_tokens);
      const total = num(st.total_tokens);
      if (input || output) out.push({ tokens: { input, output } });
      else if (total) out.push({ tokens: { input: total, output: 0 } });
      if (m.status && m.status !== 'success') out.push({ error: short(m.error?.message ?? `status ${m.status}`) });
    }
    return out;
  }

  // codex exec --json
  const item = m.item ?? {};
  if (type === 'item.started' && item.type === 'command_execution') out.push({ tool: `$ ${short(item.command, 120)}` });
  else if (type === 'item.completed') {
    if (item.type === 'agent_message' && item.text) out.push({ text: String(item.text) });
    else if (item.type === 'command_execution') {
      if (item.aggregated_output) out.push({ out: short(item.aggregated_output, 400) });
    } else if (item.type === 'file_change') {
      for (const c of item.changes ?? []) out.push({ tool: `✏️ ${c.kind ?? 'alterado'} ${c.path ?? ''}`.trim() });
    } else if (item.type === 'mcp_tool_call') out.push({ tool: `🔧 ${item.tool ?? 'ferramenta'}` });
    else if (item.type === 'error') out.push({ error: short(item.message) });
  } else if (type === 'turn.completed') {
    const u = m.usage ?? {};
    const input = num(u.input_tokens);
    const output = num(u.output_tokens);
    if (input || output) out.push({ tokens: { input, output } });
  } else if (type === 'turn.failed' || type === 'error') out.push({ error: short(m.message ?? m.error?.message ?? JSON.stringify(m), 300) });
  return out;
}

/** Pega o último objeto JSON com "aprovado" do texto final do QA */
export function extractVerdict(text: string): { aprovado: boolean; comentario: string } | null {
  const found = text.match(/\{[^{}]*"aprovado"[^{}]*\}/g);
  if (!found) return null;
  for (const raw of [...found].reverse()) {
    try {
      const o = JSON.parse(raw);
      if (typeof o.aprovado === 'boolean') return { aprovado: o.aprovado, comentario: String(o.comentario ?? '') };
    } catch {
      /* tenta o anterior */
    }
  }
  return null;
}
