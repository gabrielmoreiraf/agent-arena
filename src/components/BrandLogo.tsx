/** Logos oficiais das marcas (SVG da coleção Simple Icons, em public/logos), em branco sobre a cor da marca */
const BRANDS: Record<string, { file: string; bg: string; name: string }> = {
  claude: { file: 'claude', bg: '#D97757', name: 'Claude' },
  codex: { file: 'openai', bg: '#10A37F', name: 'OpenAI Codex' },
  gemini: { file: 'googlegemini', bg: '#4285F4', name: 'Google Gemini' },
  openrouter: { file: 'openrouter', bg: '#6566F1', name: 'OpenRouter' },
  clickup: { file: 'clickup', bg: '#7B68EE', name: 'ClickUp' },
  jira: { file: 'jira', bg: '#0052CC', name: 'Jira' },
  linear: { file: 'linear', bg: '#5E6AD2', name: 'Linear' },
  github: { file: 'github', bg: '#24292F', name: 'GitHub' },
};

export function BrandLogo({ id, size = 40 }: { id: string; size?: number }) {
  const b = BRANDS[id];
  if (!b) return <span className="provider-logo" style={{ width: size, height: size }}>{id[0]?.toUpperCase()}</span>;
  const url = `/logos/${b.file}.svg`;
  return (
    <span className="provider-logo brand" style={{ width: size, height: size, background: b.bg }} role="img" aria-label={b.name} title={b.name}>
      <span className="mark" style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` }} />
    </span>
  );
}
