import { useEffect, useState } from 'react';
import type { RawTask } from '../types';
import { Modal } from './ui';

interface Status {
  name: string;
  env: string[];
  configured: boolean;
}

const LOGO: Record<string, { bg: string; letter: string; hint: string }> = {
  clickup: { bg: '#7b68ee', letter: 'C', hint: 'Settings → Apps → API Token. O ID da lista aparece na URL da lista.' },
  jira: { bg: '#2684ff', letter: 'J', hint: 'id.atlassian.com → Security → API tokens. JIRA_JQL é opcional.' },
  linear: { bg: '#5e6ad2', letter: 'L', hint: 'Settings → API → Personal API keys.' },
  github: { bg: '#24292f', letter: 'G', hint: 'Token fine-grained com leitura de Issues. GITHUB_REPO = dono/repo.' },
};

export function Integrations({ onClose, onImport }: { onClose: () => void; onImport: (t: RawTask[]) => void }) {
  const [status, setStatus] = useState<Record<string, Status> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/integrations')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({}));
  }, []);

  const run = async (id: string) => {
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: '' }));
    try {
      const res = await fetch(`/api/integrations/${id}/import`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onImport(data.tasks);
      setMsg((m) => ({ ...m, [id]: `${data.tasks.length} tarefa(s) importada(s) para o Maestro.` }));
    } catch (e) {
      setMsg((m) => ({ ...m, [id]: `Erro: ${e instanceof Error ? e.message : e}` }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Integrações"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="hint">
        As tarefas importadas caem na fila e o Maestro decide quem pega e com qual modelo. As credenciais ficam no arquivo{' '}
        <code>.env.local</code> na pasta do projeto (lidas só pelo servidor local, nunca pelo navegador). Depois de editar, reinicie o{' '}
        <code>npm run dev</code>.
      </div>
      <div className="grid2">
        {Object.entries(LOGO).map(([id, logo]) => {
          const s = status?.[id];
          return (
            <div key={id} className="card">
              <div className="provider-head">
                <span className="provider-logo" style={{ background: logo.bg }}>{logo.letter}</span>
                <span className="px-title" style={{ color: 'var(--text)' }}>{s?.name ?? id}</span>
                <span className="spacer" />
                {status && <span className={`status ${s?.configured ? 'ok' : 'off'}`}>{s?.configured ? 'configurado' : 'não configurado'}</span>}
              </div>
              <div className="hint">{logo.hint}</div>
              <div className="small">
                {s?.env.map((k) => (
                  <div key={k}>
                    <code>{k}=...</code>
                  </div>
                ))}
              </div>
              <button className="btn gold" disabled={!s?.configured || busy === id} onClick={() => run(id)}>
                {busy === id ? 'Importando...' : 'Importar tarefas'}
              </button>
              {msg[id] && <div className={`small ${msg[id].startsWith('Erro') ? 'bad' : 'good'}`}>{msg[id]}</div>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
