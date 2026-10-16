import type { RawTask } from '../types';
import { BrandLogo } from './BrandLogo';
import { Modal } from './ui';

const LOGO = [
  { id: 'clickup', name: 'ClickUp', text: 'Importar as tarefas de uma lista.' },
  { id: 'jira', name: 'Jira', text: 'Importar issues por JQL.' },
  { id: 'linear', name: 'Linear', text: 'Importar issues do seu time.' },
  { id: 'github', name: 'GitHub Issues', text: 'Importar issues de um repositório.' },
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
              <BrandLogo id={l.id} />
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
