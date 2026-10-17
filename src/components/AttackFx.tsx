import { ATTACK_SCALE, HITS_PER_CYCLE, attackFor } from '../sprites/attacks';
import { PixelSprite } from '../sprites/PixelSprite';
import type { Agent, Task } from '../types';

type Pt = [number, number];

/**
 * Golpes que o agente lança no monstro enquanto trabalha: cada tipo de tarefa tem o seu; tarefa maior, mais e mais pesados golpes.
 * Compartilhado pelos mapas (Arena e Laboratório). Posições em % do mapa; `unitPos` = pés do agente, `monsterPos` = pés do monstro.
 */
export function AttackFx({ tasks, agents, unitPos, monsterPos }: { tasks: Task[]; agents: Agent[]; unitPos: Map<string, Pt>; monsterPos: Map<string, Pt> }) {
  return (
    <>
      {tasks
        .filter((t) => t.status !== 'backlog' && !t.paused)
        .map((task) => {
          const agent = agents.find((a) => a.currentTaskId === task.id);
          const a = agent && unitPos.get(agent.id);
          const m = monsterPos.get(task.id);
          if (!a || !m) return null;
          const atk = attackFor(task);
          const hits = HITS_PER_CYCLE[task.complexity];
          const px = atk.size * ATTACK_SCALE[task.complexity];
          return Array.from({ length: hits }, (_, i) => {
            const vars = {
              '--x0': `${a[0]}%`,
              '--y0': `${a[1] - 3}%`,
              '--x1': `${m[0]}%`,
              '--y1': `${m[1] - 3.5}%`,
              '--arc': `${atk.arc * ATTACK_SCALE[task.complexity]}px`,
              '--spin': `${atk.spin}deg`,
              '--glow': atk.glow,
              animationDuration: `${atk.ms}ms`,
              animationDelay: `${-(i * atk.ms) / hits}ms`,
            } as React.CSSProperties;
            return (
              <span key={`atk-${task.id}-${i}`}>
                <span className="atk" style={vars} title={atk.name}>
                  <PixelSprite rows={atk.rows} palette={atk.palette} size={px} />
                </span>
                <span className="atk-hit" style={{ ...vars, left: `${m[0]}%`, top: `${m[1] - 3.5}%`, width: px * 1.5, height: px * 1.5 }} />
              </span>
            );
          });
        })}
    </>
  );
}
