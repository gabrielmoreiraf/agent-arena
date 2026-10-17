import { useEffect, useRef } from 'react';
import { MONSTERS, MONSTER_BY_TYPE, MONSTER_INFO } from '../sprites/monsters';
import { PixelSprite } from '../sprites/PixelSprite';
import type { ChatMsg, GameState } from '../types';
import { Avatar } from './ui';

/** Papo dos agentes: cada fala (a mesma que aparece no balão) vira uma mensagem, com quem falou e com quem. Os monstros também falam. */
export function Chat({ state }: { state: GameState }) {
  const now = Date.now();
  const agents = new Map(state.agents.map((a) => [a.id, a]));
  const tasks = new Map(state.tasks.map((t) => [t.id, t]));

  /** quem fala: agente ou monstro (id "m:<tarefa>") */
  const who = (id: string, monsterType?: string) => {
    if (id.startsWith('m:')) {
      // o tipo vem da própria mensagem: a fala do monstro fica no papo mesmo depois que a tarefa termina
      const type = monsterType ?? tasks.get(id.slice(2))?.type;
      if (!type) return null;
      const m = MONSTERS[MONSTER_BY_TYPE[type] ?? 'slime'];
      return {
        name: MONSTER_INFO[type]?.name ?? 'Monstro',
        side: 'monster',
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
  const msgs = (state.chat ?? []).filter((m) => m.at <= now && who(m.agentId, m.monster)).slice(-60);
  const end = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1]?.id;
  useEffect(() => {
    end.current?.parentElement?.scrollTo({ top: end.current.offsetTop, behavior: 'smooth' });
  }, [last]);

  return (
    <aside className="col px chat-col">
      <div className="col-head">
        <span className="px-title">Papo dos agentes</span>
      </div>
      <div className="scroll chat-scroll">
        {!msgs.length && <div className="hint">Quando os agentes trabalharem, eles vão conversando aqui. Os monstros também respondem.</div>}
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
        <div ref={end} />
      </div>
    </aside>
  );
}
