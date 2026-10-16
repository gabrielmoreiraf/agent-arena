import type { GameState, Provider, ProviderId, Tier } from '../types';

/**
 * Limites são ESTIMATIVAS editáveis na tela de Contas.
 * Os provedores não publicam um número exato de tokens por plano.
 */
export function defaultProviders(): Provider[] {
  return [
    {
      id: 'claude',
      name: 'Claude',
      color: '#d97757',
      connected: false,
      plan: 'Max 5x',
      models: [
        { id: 'claude-haiku-5-5', label: 'Haiku', tier: 'leve', weight: 0.4 },
        { id: 'claude-sonnet-5-5', label: 'Sonnet', tier: 'medio', weight: 1 },
        { id: 'claude-opus-5-5', label: 'Opus', tier: 'pesado', weight: 2.2 },
      ],
      limits: { '5h': 4_000_000, weekly: 60_000_000 },
      shownModes: ['5h', 'weekly'],
      events: [],
    },
    {
      id: 'codex',
      name: 'Codex',
      color: '#10a37f',
      connected: false,
      plan: 'Plus',
      models: [
        { id: 'gpt-5-codex-mini', label: 'Codex Mini', tier: 'leve', weight: 0.4 },
        { id: 'gpt-5-codex', label: 'Codex', tier: 'medio', weight: 1 },
        { id: 'gpt-5.1-codex-max', label: 'Codex Max', tier: 'pesado', weight: 2 },
      ],
      limits: { '5h': 3_000_000, weekly: 40_000_000 },
      shownModes: ['5h', 'weekly'],
      events: [],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      color: '#4f8df5',
      connected: false,
      plan: 'Pro',
      models: [
        { id: 'gemini-2.5-flash-lite', label: 'Flash-Lite', tier: 'leve', weight: 0.3 },
        { id: 'gemini-2.5-flash', label: 'Flash', tier: 'medio', weight: 0.8 },
        { id: 'gemini-2.5-pro', label: 'Pro', tier: 'pesado', weight: 1.8 },
      ],
      limits: { daily: 6_000_000, weekly: 35_000_000 },
      shownModes: ['daily', 'weekly'],
      events: [],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      color: '#8b7cf6',
      connected: false,
      plan: 'Pay-as-you-go',
      models: [
        { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku', tier: 'leve', weight: 0.4 },
        { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet', tier: 'medio', weight: 1 },
        { id: 'anthropic/claude-opus-4.1', label: 'Claude Opus', tier: 'pesado', weight: 2 },
      ],
      limits: { monthly: 100_000_000 },
      shownModes: ['monthly'],
      events: [],
    },
  ];
}

/** Tabela de roteamento padrão: complexidade → modelo, por provedor */
export function defaultRouting(): GameState['routing'] {
  const r: GameState['routing'] = { leve: {}, medio: {}, pesado: {} };
  for (const p of defaultProviders()) {
    for (const m of p.models) r[m.tier][p.id] = m.id;
  }
  return r;
}

export function modelFor(state: Pick<GameState, 'providers' | 'routing'>, providerId: ProviderId, tier: Tier) {
  const provider = state.providers.find((p) => p.id === providerId);
  const id = state.routing[tier][providerId];
  const preset = provider?.models.find((m) => m.id === id);
  if (preset) return preset;
  // modelo digitado pelo usuário (id que não está na lista): usa do jeito que veio
  if (id && provider) return { id, label: id, tier, weight: 1 };
  return provider?.models.find((m) => m.tier === tier);
}

export const WINDOW_MS = {
  '5h': 5 * 3600_000,
  daily: 24 * 3600_000,
  weekly: 7 * 24 * 3600_000,
  monthly: 30 * 24 * 3600_000,
} as const;

export const WINDOW_LABEL = {
  '5h': 'Janela 5h',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
} as const;

export const TIER_LABEL: Record<Tier, string> = { leve: 'Leve', medio: 'Médio', pesado: 'Pesado' };

/** Quem executa o agente: o provedor configurado nele, se estiver conectado; senão o Claude; senão qualquer conectado */
export function providerFor(state: Pick<GameState, 'providers'>, agent: { providerId: string }) {
  const on = state.providers.filter((p) => p.connected);
  return on.find((p) => p.id === agent.providerId) ?? on.find((p) => p.id === 'claude') ?? on[0];
}
