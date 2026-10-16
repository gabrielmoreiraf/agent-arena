import type { RawTask } from '../types';
import { Modal } from './ui';

const LOGO = [
  { id: 'clickup', name: 'ClickUp', bg: '#7b68ee', letter: 'C', text: 'Importar as tarefas de uma lista.' },
  { id: 'jira', name: 'Jira', bg: '#2684ff', letter: 'J', text: 'Importar issues por JQL.' },
  { id: 'linear', name: 'Linear', bg: '#5e6ad2', letter: 'L', text: 'Importar issues do seu time.' },
  { id: 'github', name: 'GitHub Issues', bg: '#24292f', letter: 'G', text: 'Importar issues de um repositório.' },
];

/** Integrações de tarefas: ainda não liberadas (o código de importação existe no servidor, mas a tela fica como "em breve") */
export function Integrations({ onClose }: { onClose: () => void; onImport?: (t: RawTask[]) => void }) {
  return (
    <Modal
      title="Integrações"
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}
    >
      <div className="hint">
        Em breve você poderá trazer tarefas de outras ferramentas direto para a fila do Maestro. Por enquanto, escreva as tarefas no campo
        da fila (cole várias linhas para criar várias de uma vez).
      </div>
      <div className="grid2">
        {LOGO.map((l) => (
          <div key={l.id} className="card soon">
            <div className="provider-head">
              <span className="provider-logo" style={{ background: l.bg }}>{l.letter}</span>
              <span className="px-title" style={{ color: 'var(--text)' }}>{l.name}</span>
              <span className="spacer" />
              <span className="status warn">em breve</span>
            </div>
            <div className="hint">{l.text}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
