import { useEffect, useRef, useState } from 'react';
import { soulName } from '../data/quotes';
import { MONSTERS, MONSTER_BY_TYPE, MONSTER_INFO } from '../sprites/monsters';
import { GHOST, GHOST_PAL } from '../sprites/props';
import { PixelSprite } from '../sprites/PixelSprite';
import type { ChatMsg, GameState } from '../types';
import { Avatar } from './ui';

/** Papo dos agentes: cada fala (a mesma que aparece no balão) vira uma mensagem, com quem falou e com quem. Os monstros também falam. */
export function Chat({ state, onMuted }: { state: GameState; onMuted: (muted: boolean) => void }) {
  const muted = !!state.muted;
  const now = Date.now();
  const agents = new Map(state.agents.map((a) => [a.id, a]));
  const tasks = new Map(state.tasks.map((t) => [t.id, t]));

  /** quem fala: agente ou monstro (id "m:<tarefa>") */
  const who = (id: string, monsterType?: string) => {
    if (id.startsWith('s:')) {
      // alma de um monstro derrotado: o tipo vem da própria mensagem
      const type = monsterType ?? 'feature';
      return {
        name: soulName(type),
        side: 'is-monster is-soul',
        avatar: (
          <span className="chat-ava soul-ava">
            <PixelSprite rows={GHOST} palette={GHOST_PAL} size={22} />
          </span>
        ),
      };
    }
    if (id.startsWith('m:')) {
      // o tipo vem da própria mensagem: a fala do monstro fica no papo mesmo depois que a tarefa termina
      const type = monsterType ?? tasks.get(id.slice(2))?.type;
      if (!type) return null;
      const m = MONSTERS[MONSTER_BY_TYPE[type] ?? 'slime'];
      return {
        name: MONSTER_INFO[type]?.name ?? 'Monstro',
        side: 'is-monster',
        avatar: (
          <span className="chat-ava">
            <PixelSprite rows={m.rows} palette={m.palette} size={24} />
          </span>
        ),
      };
    }
    const a = agents.get(id);
    return a ? { name: a.name, side: a.role === 'qa' ? 'qa' : a.role === 'maestro' ? 'maestro' : '', avatar: <Avatar agent={a} size={28} /> } : null;
  };

  // falas agendadas para daqui a pouco (respostas) só aparecem na hora
  // trechos em que o papo esteve silenciado: o que foi dito nesse intervalo não aparece depois de reativar
  const quiet = useRef<{ from: number; to: number }[]>([]);
  const prevMuted = useRef(muted);
  if (muted !== prevMuted.current) {
    if (muted) quiet.current.push({ from: state.mutedAt ?? now, to: Infinity });
    else {
      const r = quiet.current[quiet.current.length - 1];
      if (r) r.to = now;
    }
    prevMuted.current = muted;
  }
  if (muted && !quiet.current.length) quiet.current.push({ from: state.mutedAt ?? now, to: Infinity });
  const hidden = (at: number) => quiet.current.some((r) => at >= r.from && at <= r.to);
  const msgs = (state.chat ?? []).filter((m) => m.at <= now && !hidden(m.at) && who(m.agentId, m.monster)).slice(-60);

  // só acompanha as mensagens novas se você está no fim; se subiu para ler o antigo, o scroll fica onde está
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const last = msgs[msgs.length - 1]?.id;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (stick.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else setAway(true);
  }, [last]);
  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    stick.current = atEnd;
    if (atEnd) setAway(false);
  };
  const toEnd = () => {
    stick.current = true;
    setAway(false);
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  };

  return (
    <aside className="col px chat-col">
      <div className="col-head">
        <span className="px-title">Papo dos agentes</span>
        <button
          className={`btn sm ${muted ? 'on' : 'ghost'}`}
          onClick={() => onMuted(!muted)}
          title={muted ? 'Reativar o papo agora (também volta sozinho quando entra uma tarefa nova)' : 'Encerrar o papo: os agentes ficam quietos até você reativar ou entrar uma tarefa nova'}
        >
          {muted ? '💬 Reativar' : '🤐 Encerrar'}
        </button>
      </div>
      {muted && <div className="hint chat-muted">Papo encerrado. Os agentes estão quietos.</div>}
      <div className="scroll chat-scroll" ref={box} onScroll={onScroll}>
        {!msgs.length && !muted && <div className="hint">Quando os agentes trabalharem, eles vão conversando aqui. Os monstros também respondem.</div>}
        {msgs.map((m: ChatMsg, i) => {
          const w = who(m.agentId, m.monster)!;
          const to = m.toId ? who(m.toId, m.monster) : null;
          return (
            <div key={m.id} className={`chat-msg ${w.side} ${i === msgs.length - 1 ? 'new' : ''}`}>
              {w.avatar}
              <div className="chat-body">
                <div className="chat-who">
                  <b>{w.name}</b>
                  {to && <span className="small"> → {to.name}</span>}
                  <time>{new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                </div>
                <div className="chat-bubble">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      {away && (
        <button className="btn sm gold chat-jump" onClick={toEnd}>
          ↓ novas mensagens
        </button>
      )}
    </aside>
  );
}
