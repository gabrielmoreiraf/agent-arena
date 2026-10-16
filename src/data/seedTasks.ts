import type { Source } from '../types';

export interface RawTask {
  title: string;
  description?: string;
  source: Source;
  externalKey?: string;
  url?: string;
}

export const DEMO_TASKS: RawTask[] = [
  { title: 'Ajustar cor do botão "Salvar" na tela de perfil', source: 'demo' },
  { title: 'Criar endpoint de reset de senha com envio de email', source: 'demo' },
  { title: 'Pipeline de CI quebrando no build do Docker', source: 'demo' },
  { title: 'Query do relatório mensal demorando 30s — criar índice', source: 'demo' },
  { title: 'Refatorar arquitetura do módulo de pagamentos', source: 'demo' },
  { title: 'Testes e2e do fluxo de checkout', source: 'demo' },
  { title: 'Bug: data aparece em UTC no dashboard', source: 'demo' },
  { title: 'Corrigir typo no texto do rodapé', source: 'demo' },
  { title: 'Migração: adicionar coluna "status" na tabela de pedidos', source: 'demo' },
  { title: 'Tela de onboarding com 3 passos', source: 'demo' },
];
