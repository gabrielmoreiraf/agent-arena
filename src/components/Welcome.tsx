import { useEffect, useState } from 'react';
import { PixelSprite } from '../sprites/PixelSprite';
import type { Agent } from '../types';

const STEPS = [
  { icon: '📜', title: 'Você cria a tarefa', text: 'Escreva o que precisa ser feito. Ela chega como um pergaminho. (Importar do ClickUp, Jira, Linear e GitHub: em breve.)' },
  { icon: '🎼', title: 'O Maestro lê e decide', text: 'Ele mede a complexidade (P, M ou G), escolhe o agente certo e o modelo certo: Haiku, Sonnet ou Opus.' },
  { icon: '⚔️', title: 'O agente enfrenta o monstro', text: 'Cada tarefa é um monstro na arena. O agente trabalha de verdade no seu projeto e a barra de vida mostra o progresso.' },
  { icon: '🔍', title: 'O QA revisa (e implica)', text: 'O QA, que odeia devs, lê o diff, roda os testes e aprova ou devolve com um comentário ácido.' },
  { icon: '🚀', title: 'Você aplica a entrega', text: 'Cada tarefa fica numa branch isolada. Você revisa na aba Entregas e aplica no projeto com um clique.' },
];

export function Welcome({ agents, onClose }: { agents: Agent[]; onClose: (dontShowAgain: boolean) => void }) {
  const [hide, setHide] = useState(() => {
    try {
      return !!localStorage.getItem('agent-arena:welcome-hidden');
    } catch {
      return false;
    }
  });
  const close = () => onClose(hide);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(hide);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hide]);

  return (
    <div className="welcome-overlay" role="dialog" aria-modal aria-label="Bem-vindo ao Agent Arena">
      <div className="welcome px">
        <div className="welcome-body">
        <header className="welcome-head">
          <div className="welcome-crew">
            {agents.slice(0, 8).map((a) => (
              <PixelSprite key={a.id} sprite={a.sprite} palette={a.palette} size={40} />
            ))}
          </div>
          <h1 className="px-title">Bem-vindo ao AGENT ARENA</h1>
          <p className="lead">
            Um painel em pixel art, estilo MOBA, para <b>orquestrar uma equipe de agentes de IA</b>. Um Maestro distribui suas tarefas entre
            devs júnior, pleno e sênior, DevOps, banco de dados, UI/UX e um QA rival, escolhendo o modelo certo para cada uma. Tudo isso
            acontecendo numa arena que você acompanha ao vivo.
          </p>
        </header>

        <section>
          <h2 className="px-title">Como funciona</h2>
          <ol className="welcome-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="n">{i + 1}</span>
                <span className="ic">{s.icon}</span>
                <span>
                  <b>{s.title}</b>
                  <span className="muted"> — {s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="px-title">Antes de começar</h2>
          <ul className="welcome-tips">
            <li><b>Tudo roda na sua máquina</b>: os agentes são CLIs de verdade (Claude Code, Codex, Gemini…) trabalhando numa pasta de projeto sua. Gasta tokens do seu plano.</li>
            <li><b>Conecte só o que quiser</b>: em <b>Contas & Tokens</b> você conecta ou desconecta cada provedor e vê qual conta está logada. Quem não estiver conectado não recebe tarefas.</li>
            <li><b>Escolha o projeto</b> (📁 na fila): crie uma pasta nova ou anexe uma existente. Cada tarefa roda numa branch isolada; nada muda no projeto até você aplicar.</li>
          </ul>
        </section>

        <section>
          <h2 className="px-title">Onde olhar</h2>
          <ul className="welcome-tips">
            <li><b>Arena</b>: o campo de batalha. Clique num monstro (tarefa) ou num agente para ver detalhes e o terminal ao vivo.</li>
            <li><b>Quadro</b> e <b>Ecossistema</b>: a fila em colunas e o mapa de quem conversa com quem.</li>
            <li><b>Entregas</b>: o que foi feito, com arquivos, diff, pré-visualização e o botão Aplicar.</li>
            <li><b>Placar</b> (tecla Tab): níveis, bugs achados e a rivalidade entre QA e devs.</li>
          </ul>
        </section>

        <section className="welcome-support card">
          <img className="pix" src="/pix-qr.png" alt="QR Code Pix para apoiar o desenvolvedor" width={150} height={150} />
          <div>
            <h2 className="px-title">Ajude quem fez</h2>
            <p>
              O Agent Arena é gratuito e feito com carinho. Se ele te ajudou ou divertiu, dá para apoiar o desenvolvedor com qualquer valor por
              <b> Pix</b>: abra o app do seu banco, escolha pagar com Pix e leia o QR Code ao lado.
            </p>
            <p className="muted small">Obrigado! Isso ajuda a manter o projeto vivo. 💜</p>
          </div>
        </section>

        </div>

        <div className="welcome-actions">
        <div className="welcome-cta">
          <button className="btn gold" onClick={close}>Começar</button>
        </div>

        <footer className="welcome-foot muted small">
          <label className="welcome-hide">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Não mostrar esta tela ao abrir
          </label>
          <div>Você pode reabri-la a qualquer momento pelo botão <b>?</b> no topo.</div>
        </footer>
        </div>
      </div>
    </div>
  );
}
