import type { FeedKind, GameState } from '../types';
import { Avatar } from './ui';

const ICON: Record<FeedKind, string> = {
  maestro: '🎼',
  work: '⚔️',
  qa: '🐞',
  banter: '💬',
  done: '✅',
  system: '📜',
  level: '⭐',
};

export function Feed({ state }: { state: GameState }) {
  const agents = new Map(state.agents.map((a) => [a.id, a]));
  return (
    <aside className="col px feed-col">
      <div className="col-head">
        <span className="px-title">Registro de batalha</span>
      </div>
      <div className="scroll">
        {state.feed.map((f) => {
          const agent = f.agentId ? agents.get(f.agentId) : undefined;
          return (
            <div key={f.id} className={`feed-item k-${f.kind}`}>
              <span className="feed-icon">{agent ? <Avatar agent={agent} size={24} /> : ICON[f.kind]}</span>
              <div>
                <time>{new Date(f.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                {f.text}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
