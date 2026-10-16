import { useState } from 'react';
import { levelOf, rankOf, ROLE_LABEL, xpForLevel } from '../data/agents';
import { TIER_LABEL, modelFor } from '../data/providers';
import { uid } from '../engine/game';
import { PixelSprite } from '../sprites/PixelSprite';
import { SPRITE_CHOICES } from '../sprites/sprites';
import type { Agent, GameState, ProviderId, Role, Tier } from '../types';
import { Bar, fmtTokens, Modal } from './ui';

const COLOR_KEYS: { key: string; label: string }[] = [
  { key: 'c', label: 'roupa' },
  { key: 'h', label: 'cabelo' },
  { key: 'p', label: 'calça' },
  { key: 's', label: 'pele' },
  { key: 'A', label: 'acessório' },
  { key: 'B', label: 'detalhe' },
];

const ROLES: Role[] = ['custom', 'dev-junior', 'dev-pleno', 'dev-senior', 'devops', 'dba', 'designer', 'qa'];

export function newAgent(): Agent {
  return {
    id: uid('ag'),
    name: 'Novo Agente',
    role: 'custom',
    title: 'Especialista',
    sprite: 'bot',
    palette: { c: '#4f8df5', h: '#2b2b2b', p: '#22283d', s: '#f2c79a', A: '#ff6b6b', B: '#9aa0a6', C: '#ffd166' },
    providerId: 'claude',
    instructions: 'Descreva aqui como esse agente trabalha: no que é especialista, regras que ele sempre segue e o formato da entrega.',
    keywords: [],
    power: 5,
    bugRate: 0.15,
    xp: 0,
    stats: { done: 0, bugsCaused: 0, bugsFound: 0, reviews: 0, tokens: 0, streak: 0 },
    queue: [],
    builtin: false,
  };
}

interface Props {
  state: GameState;
  agent: Agent;
  isNew: boolean;
  onClose: () => void;
  onSave: (a: Agent) => void;
  onDelete: (id: string) => void;
}

export function AgentEditor({ state, agent, isNew, onClose, onSave, onDelete }: Props) {
  const [a, setA] = useState<Agent>(agent);
  const [kw, setKw] = useState(agent.keywords.join(', '));
  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setA((x) => ({ ...x, [k]: v }));
  const lvl = levelOf(a.xp);
  const isMaestro = a.role === 'maestro';
  const provider = state.providers.find((p) => p.id === a.providerId);
  const current = state.tasks.find((t) => t.id === agent.currentTaskId);

  const save = () => {
    onSave({ ...a, keywords: kw.split(',').map((k) => k.trim()).filter(Boolean) });
    onClose();
  };

  return (
    <Modal
      title={isNew ? 'Recrutar agente' : `${a.name} · ${a.title}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && !isMaestro && (
            <button
              className="btn danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                if (confirm(`Remover ${a.name}? As tarefas dele voltam para o Maestro.`)) {
                  onDelete(a.id);
                  onClose();
                }
              }}
            >
              Remover
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" onClick={save}>{isNew ? 'Recrutar' : 'Salvar'}</button>
        </>
      }
    >
      <div className="agent-editor">
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div className="preview-stage">
            <PixelSprite className="sprite" sprite={a.sprite} palette={a.palette} size={128} />
            <div className="px-title">{a.name || '???'}</div>
            <span className="chip">Nv {lvl} · {rankOf(lvl)}</span>
            <div style={{ width: '100%' }}>
              <Bar value={(a.xp - xpForLevel(lvl)) / Math.max(1, xpForLevel(lvl + 1) - xpForLevel(lvl))} className="xp" />
              <div className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>
                {a.xp} / {xpForLevel(lvl + 1)} XP
              </div>
            </div>
          </div>
          {!isNew && (
            <div className="stat-grid">
              <div><b className="good">{a.stats.done}</b><span>feitas</span></div>
              <div><b className="bad">{a.stats.bugsCaused}</b><span>bugs causados</span></div>
              <div><b>{a.stats.bugsFound}</b><span>bugs achados</span></div>
              <div><b>{a.stats.reviews}</b><span>revisões</span></div>
              <div><b>{a.stats.streak}</b><span>sequência</span></div>
              <div><b>{fmtTokens(a.stats.tokens)}</b><span>tokens</span></div>
            </div>
          )}
          {current && <div className="hint">Agora: <b style={{ color: 'var(--text)' }}>{current.title}</b></div>}

          {!isMaestro && (
            <>
              <div className="section-label" style={{ margin: 0 }}>Visual</div>
              <div className="sprite-picker">
                {SPRITE_CHOICES.map((s) => (
                  <button key={s} className={a.sprite === s ? 'on' : ''} onClick={() => set('sprite', s)} title={s}>
                    <PixelSprite sprite={s} palette={a.palette} size={36} />
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="colors">
            {COLOR_KEYS.map(({ key, label }) => (
              <label key={key}>
                <input type="color" value={a.palette[key] ?? '#888888'} onChange={(e) => set('palette', { ...a.palette, [key]: e.target.value })} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div className="grid2">
            <label className="field">
              <span>Nome</span>
              <input className="input" value={a.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field">
              <span>Título</span>
              <input className="input" value={a.title} onChange={(e) => set('title', e.target.value)} />
            </label>
          </div>

          {!isMaestro && (
            <div className="grid2">
              <label className="field">
                <span>Papel</span>
                <select className="select" value={a.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Provedor / conta</span>
                <select className="select" value={a.providerId} onChange={(e) => set('providerId', e.target.value as ProviderId)}>
                  {state.providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.connected ? '' : ' (desconectado)'}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {!isMaestro && (
            <div className="card" style={{ background: '#0d1424' }}>
              <div className="small">
                <b>Modelo escolhido pelo Maestro</b> <span className="muted">conforme o peso da tarefa:</span>
              </div>
              <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                {(['leve', 'medio', 'pesado'] as Tier[]).map((t) => (
                  <span key={t} className={`chip cx-${t === 'leve' ? 1 : t === 'medio' ? 2 : 3}`}>
                    {TIER_LABEL[t]} → <b style={{ color: provider?.color }}>{modelFor(state, a.providerId, t)?.label ?? '—'}</b>
                  </span>
                ))}
              </div>
              <div className="hint">Edite a tabela em Contas & Tokens.</div>
            </div>
          )}

          {(a.role === 'custom' || !a.builtin) && !isMaestro && (
            <label className="field">
              <span>Palavras-chave (o Maestro manda pra cá tarefas que contêm)</span>
              <input className="input" placeholder="ex.: stripe, pagamento, checkout" value={kw} onChange={(e) => setKw(e.target.value)} />
            </label>
          )}

          <label className="field">
            <span>Instruções do agente</span>
            <textarea className="textarea" style={{ minHeight: 170 }} value={a.instructions} onChange={(e) => set('instructions', e.target.value)} />
          </label>
          <div className="hint">
            As instruções viram o corpo do subagente em <code>.claude/agents/</code> quando você clica em “Exportar p/ Claude Code”.
          </div>

          {!isMaestro && (
            <div className="grid2">
              <label className="field">
                <span>Velocidade ({a.power})</span>
                <input type="range" min={1} max={10} value={a.power} onChange={(e) => set('power', Number(e.target.value))} />
              </label>
              {a.role !== 'qa' && (
                <label className="field">
                  <span>Chance de bug ({Math.round(a.bugRate * 100)}%)</span>
                  <input type="range" min={0} max={60} value={Math.round(a.bugRate * 100)} onChange={(e) => set('bugRate', Number(e.target.value) / 100)} />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
