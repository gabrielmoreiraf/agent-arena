import { useEffect, useRef } from 'react';
import { BattleMusic } from './battleMusic';

/** Liga/desliga a trilha, ajusta o volume e a intensidade (batalha quando há agentes trabalhando) */
export function useBattleMusic(on: boolean, volume: number, battle: boolean) {
  const engine = useRef<BattleMusic | null>(null);

  useEffect(() => {
    engine.current ??= new BattleMusic();
    const m = engine.current;
    if (!on) {
      m.stop();
      return;
    }
    void m.start();
    // se o navegador bloqueou o áudio (sem gesto ainda), toca assim que a pessoa interagir com a página
    const resume = () => void m.start();
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [on]);

  useEffect(() => engine.current?.setVolume(volume), [volume, on]);
  useEffect(() => engine.current?.setIntensity(battle ? 1 : 0), [battle, on]);
  useEffect(() => () => engine.current?.destroy(), []);
}
