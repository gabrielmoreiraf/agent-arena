/**
 * Exporta os agentes do jogo como subagentes do Claude Code
 * (.claude/agents/<slug>.md) e atualiza a lista usada pela skill do Maestro.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface ExportAgent {
  id: string;
  name: string;
  role: string;
  title: string;
  providerId: string;
  instructions: string;
  keywords: string[];
}

const DEFAULT_MODEL: Record<string, string> = {
  'dev-junior': 'haiku',
  'dev-pleno': 'sonnet',
  'dev-senior': 'opus',
  devops: 'sonnet',
  dba: 'sonnet',
  qa: 'sonnet',
  designer: 'sonnet',
  custom: 'sonnet',
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const yaml = (s: string) => JSON.stringify(s);

/** `root` = pasta do projeto que recebe os arquivos; `appRoot` = repositório do Agent Arena (de onde vem a skill) */
export async function exportAgents(root: string, agents: ExportAgent[], appRoot?: string) {
  const dir = join(root, '.claude', 'agents');
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  const roster: string[] = [];

  for (const a of agents) {
    if (a.role === 'maestro') continue; // o Maestro é a sessão principal + skill
    const name = slug(`${a.title}-${a.name}`) || slug(a.id);
    const model = a.providerId === 'claude' ? DEFAULT_MODEL[a.role] ?? 'sonnet' : 'inherit';
    const desc = `${a.title} (${a.name}). ${a.keywords.length ? `Assuntos: ${a.keywords.join(', ')}. ` : ''}Use quando o Maestro delegar uma tarefa deste perfil.`;
    const body = [
      '---',
      `name: ${name}`,
      `description: ${yaml(desc)}`,
      `model: ${model}`,
      '---',
      '',
      a.instructions.trim(),
      '',
      a.providerId !== 'claude' ? `> Provedor preferido no Agent Arena: ${a.providerId}.\n` : '',
      'Ao terminar, responda com: o que mudou, arquivos tocados e como testar.',
      '',
    ].join('\n');
    await writeFile(join(dir, `${name}.md`), body);
    written.push(`.claude/agents/${name}.md`);
    roster.push(`| \`${name}\` | ${a.title} | ${a.keywords.join(', ') || '—'} | ${model} |`);
  }

  const skillDir = join(root, '.claude', 'skills', 'maestro-triage');
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, 'roster.md'),
    [
      '# Elenco atual (gerado pelo Agent Arena)',
      '',
      '| subagente | perfil | palavras-chave | modelo padrão |',
      '|---|---|---|---|',
      ...roster,
      '',
    ].join('\n'),
  );
  written.push('.claude/skills/maestro-triage/roster.md');
  // a skill do Maestro acompanha o elenco para o Claude Code do projeto decidir igual ao jogo
  const skill = appRoot ? join(appRoot, '.claude', 'skills', 'maestro-triage', 'SKILL.md') : '';
  if (skill && existsSync(skill)) {
    await copyFile(skill, join(skillDir, 'SKILL.md'));
    written.push('.claude/skills/maestro-triage/SKILL.md');
  }
  return written;
}
