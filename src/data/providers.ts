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
      connected: true,
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
      connected: true,
      plan: 'Plus',
      models: [
        { id: 'codex-mini', label: 'Codex Mini', tier: 'leve', weight: 0.4 },
        { id: 'codex', label: 'Codex', tier: 'medio', weight: 1 },
        { id: 'codex-high', label: 'Codex (alto raciocínio)', tier: 'pesado', weight: 2 },
      ],
      limits: { '5h': 3_000_000, weekly: 40_000_000 },
      shownModes: ['5h', 'weekly'],
      events: [],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      color: '#4f8df5',
      connected: true,
      plan: 'Pro',
      models: [
        { id: 'gemini-flash-lite', label: 'Flash-Lite', tier: 'leve', weight: 0.3 },
        { id: 'gemini-flash', label: 'Flash', tier: 'medio', weight: 0.8 },
        { id: 'gemini-pro', label: 'Pro', tier: 'pesado', weight: 1.8 },
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
        { id: 'openrouter/auto-small', label: 'Auto (pequeno)', tier: 'leve', weight: 0.4 },
        { id: 'openrouter/auto', label: 'Auto', tier: 'medio', weight: 1 },
        { id: 'openrouter/auto-large', label: 'Auto (grande)', tier: 'pesado', weight: 2 },
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
  return provider?.models.find((m) => m.id === id) ?? provider?.models.find((m) => m.tier === tier);
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
