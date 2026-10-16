import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { exportAgents } from './exportAgents';
import { INTEGRATIONS, importFrom, integrationStatus, type IntegrationId } from './integrations';
import { claudeAccount } from './claudeAccount';
import { Runner } from './runner';
import { triageWithClaude } from './triage';
import { readUsage } from './usage';

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

/** Host e Origin (quando existir) precisam ser locais */
function isLocalRequest(req: IncomingMessage) {
  if (!LOCAL_HOST.test(String(req.headers.host ?? ''))) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return LOCAL_HOST.test(new URL(String(origin)).host);
  } catch {
    return false;
  }
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

/** API local servida pelo próprio Vite em /api/* */
export function arenaApi(env: Record<string, string>, root: string): Plugin {
  const runner = new Runner(root, env);
  return {
    name: 'agent-arena-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        // a API executa comandos: só responde ao próprio computador (protege de páginas de terceiros / DNS rebinding)
        if (!isLocalRequest(req)) return send(res, 403, { error: 'Acesso negado: o Agent Arena só aceita requisições locais (127.0.0.1).' });
        const url = new URL(req.url, 'http://localhost');
        try {
          if (url.pathname === '/api/usage') {
            const [usage, account] = await Promise.all([readUsage(env), claudeAccount(runner.bin, url.searchParams.has('fresh'))]);
            return send(res, 200, { ...(usage as object), account });
          }

          if (url.pathname === '/api/integrations') return send(res, 200, integrationStatus(env));

          const m = url.pathname.match(/^\/api\/integrations\/(\w+)\/import$/);
          if (m && req.method === 'POST') {
            const id = m[1] as IntegrationId;
            if (!(id in INTEGRATIONS)) return send(res, 404, { error: 'Integração desconhecida' });
            if (!integrationStatus(env)[id].configured)
              return send(res, 400, { error: `Configure ${INTEGRATIONS[id].env.join(', ')} no .env.local` });
            return send(res, 200, { tasks: await importFrom(id, env) });
          }

          if (url.pathname === '/api/agents/export' && req.method === 'POST') {
            const { agents } = await body(req);
            // grava no PROJETO escolhido (onde o Claude Code vai usar os subagentes), nunca dentro do Agent Arena
            return send(res, 200, { written: await exportAgents(runner.projectDir(), agents ?? [], root) });
          }

          // ---- execução real (Claude Code headless) ----
          if (url.pathname === '/api/real/events') return runner.subscribe(res);
          if (url.pathname === '/api/real/config') {
            if (req.method === 'POST') return send(res, 200, await runner.setConfig(await body(req)));
            return send(res, 200, await runner.status());
          }
          if (url.pathname === '/api/real/run' && req.method === 'POST') {
            try {
              return send(res, 200, { job: await runner.start(await body(req)) });
            } catch (err) {
              return send(res, 409, { error: err instanceof Error ? err.message : String(err) });
            }
          }
          if (url.pathname === '/api/real/triage' && req.method === 'POST') {
            return send(res, 200, await triageWithClaude(runner.bin, await body(req)));
          }
          if (url.pathname === '/api/real/changes') {
            const only = url.searchParams.get('files');
            const dir = url.searchParams.get('dir') ?? undefined;
            const task = url.searchParams.get('task') ?? undefined;
            const merge = url.searchParams.get('merge') ?? undefined;
            return send(res, 200, await runner.changes(dir, only ? only.split(',').filter(Boolean) : undefined, task, merge));
          }
          // /api/real/preview/<projeto em base64url>/<caminho>: o caminho relativo mantém os imports da página funcionando
          const pv = url.pathname.match(/^\/api\/real\/preview\/([\w-]+)\/?(.*)$/);
          if (pv) return runner.preview(pv[1], pv[2], res);
          if (url.pathname === '/api/real/open' && req.method === 'POST') {
            const { dir, path } = await body(req);
            return send(res, 200, { opened: runner.open(dir, path ?? '') });
          }
          // worktree da tarefa: aplicar no projeto (merge) ou descartar
          if ((url.pathname === '/api/real/land' || url.pathname === '/api/real/discard') && req.method === 'POST') {
            const b = await body(req);
            try {
              if (url.pathname === '/api/real/land') return send(res, 200, await runner.land(b.dir ?? '', b.taskId ?? '', b.title ?? 'tarefa'));
              return send(res, 200, await runner.discard(b.dir ?? '', b.taskId ?? ''));
            } catch (err) {
              return send(res, 409, { error: err instanceof Error ? err.message : String(err) });
            }
          }
          if (url.pathname === '/api/real/projects' && req.method === 'POST') {
            const b = await body(req);
            try {
              if (b.action === 'create') return send(res, 200, await runner.createProject(b.name ?? '', b.parent ?? ''));
              if (b.action === 'attach') return send(res, 200, await runner.attachProject(b.dir ?? ''));
              if (b.action === 'remove') return send(res, 200, await runner.removeProject(b.dir ?? ''));
              if (b.action === 'pick') return send(res, 200, { dir: await runner.pickFolder() });
              return send(res, 400, { error: 'Ação desconhecida' });
            } catch (err) {
              return send(res, 400, { error: err instanceof Error ? err.message : String(err) });
            }
          }
          if (url.pathname === '/api/real/log') return send(res, 200, runner.logs(url.searchParams.get('agentId') ?? '', url.searchParams.get('taskId') ?? undefined));
          if (url.pathname === '/api/real/control' && req.method === 'POST') {
            const { action, agentId } = await body(req);
            if (!['pause', 'resume', 'stop'].includes(action)) return send(res, 400, { error: 'Ação inválida' });
            return send(res, 200, { affected: runner.control(action, agentId || undefined) });
          }
          if (url.pathname === '/api/real/cancel' && req.method === 'POST') {
            const { jobId } = await body(req);
            return send(res, 200, { canceled: runner.cancel(jobId) });
          }

          send(res, 404, { error: 'Rota não encontrada' });
        } catch (err) {
          send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
