import { Modal } from './ui';

const STEPS = [
  { icon: '📜', title: 'Lê a tarefa', text: 'Título e detalhes. Ele mede o tipo (feature, bug, infra, banco, teste ou refatoração) e o tamanho: P (leve), M (média) ou G (pesada). Quanto mais claro o texto, melhor a escolha.' },
  { icon: '🧑‍💻', title: 'Escolhe o agente', text: 'Banco → Dona Query · Infra e deploy → Ops Rocha · Design e UX → Lia Pixel · Testes → QA. Para o resto, um dev pela senioridade: P → Juninho, M → Plenão, G → Seu Sênior. Agentes seus, com palavras-chave, têm prioridade. Em caso de empate, o menos ocupado.' },
  { icon: '🧠', title: 'Escolhe o modelo', text: 'Pelo tamanho: P → leve, M → médio, G → pesado, conforme a tabela de Contas & Tokens e o provedor do agente (ou outro que esteja conectado).' },
  { icon: '💬', title: 'Explica o motivo', text: 'A justificativa aparece no card da tarefa e no registro de batalha. Se o QA devolver a mesma tarefa 2 vezes, ele sobe um nível de modelo.' },
  { icon: '👤', title: 'Você manda quando quiser', text: 'Em "Quem faz" escolha um agente: o Maestro respeita e só mede tipo e tamanho.' },
];

export function MaestroHelp({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="🎼 Como o Maestro decide" onClose={onClose} narrow footer={<button className="btn gold" onClick={onClose}>Entendi</button>}>
      <ol className="help-steps">
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
    </Modal>
  );
}
