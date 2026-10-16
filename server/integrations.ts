/**
 * Importa tarefas reais das ferramentas de gestão.
 * As credenciais ficam no .env.local (nunca no navegador).
 */

export interface ImportedTask {
  title: string;
  description: string;
  source: 'clickup' | 'jira' | 'linear' | 'github';
  externalKey: string;
  url?: string;
}

type Env = Record<string, string>;

export const INTEGRATIONS = {
  clickup: { name: 'ClickUp', env: ['CLICKUP_TOKEN', 'CLICKUP_LIST_ID'] },
  jira: { name: 'Jira', env: ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] },
  linear: { name: 'Linear', env: ['LINEAR_API_KEY'] },
  github: { name: 'GitHub Issues', env: ['GITHUB_TOKEN', 'GITHUB_REPO'] },
} as const;

export type IntegrationId = keyof typeof INTEGRATIONS;

export function integrationStatus(env: Env) {
  return Object.fromEntries(
    Object.entries(INTEGRATIONS).map(([id, def]) => [
      id,
      { name: def.name, env: def.env, configured: def.env.every((k) => Boolean(env[k])) },
    ]),
  );
}

async function json(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Jira devolve a descrição em ADF (árvore); pega só o texto */
function adfText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: string; content?: unknown[] };
  return (n.text ?? '') + (n.content ?? []).map(adfText).join(' ');
}

export async function importFrom(id: IntegrationId, env: Env): Promise<ImportedTask[]> {
  switch (id) {
    case 'clickup': {
      const data = await json(
        await fetch(`https://api.clickup.com/api/v2/list/${env.CLICKUP_LIST_ID}/task?include_closed=false`, {
          headers: { Authorization: env.CLICKUP_TOKEN },
        }),
      );
      return (data.tasks ?? []).slice(0, 30).map((t: { id: string; name: string; description?: string; url?: string; custom_id?: string }) => ({
        title: t.name,
        description: t.description ?? '',
        source: 'clickup',
        externalKey: `clickup:${t.id}`,
        url: t.url,
      }));
    }
    case 'jira': {
      const jql = env.JIRA_JQL || 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
      const base = env.JIRA_BASE_URL.replace(/\/$/, '');
      const auth = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64');
      const data = await json(
        await fetch(`${base}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,description&maxResults=30`, {
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        }),
      );
      return (data.issues ?? []).map((i: { key: string; fields: { summary: string; description?: unknown } }) => ({
        title: `[${i.key}] ${i.fields.summary}`,
        description: adfText(i.fields.description).trim(),
        source: 'jira',
        externalKey: `jira:${i.key}`,
        url: `${base}/browse/${i.key}`,
      }));
    }
    case 'linear': {
      const query = `{ issues(first: 30, filter: { state: { type: { nin: ["completed", "canceled"] } } }) { nodes { identifier title description url } } }`;
      const data = await json(
        await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { Authorization: env.LINEAR_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        }),
      );
      return (data.data?.issues?.nodes ?? []).map((i: { identifier: string; title: string; description?: string; url: string }) => ({
        title: `[${i.identifier}] ${i.title}`,
        description: i.description ?? '',
        source: 'linear',
        externalKey: `linear:${i.identifier}`,
        url: i.url,
      }));
    }
    case 'github': {
      const data = await json(
        await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues?state=open&per_page=30`, {
          headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        }),
      );
      return (data as { number: number; title: string; body?: string; html_url: string; pull_request?: unknown }[])
        .filter((i) => !i.pull_request)
        .map((i) => ({
          title: `#${i.number} ${i.title}`,
          description: i.body ?? '',
          source: 'github',
          externalKey: `github:${env.GITHUB_REPO}#${i.number}`,
          url: i.html_url,
        }));
    }
  }
}
