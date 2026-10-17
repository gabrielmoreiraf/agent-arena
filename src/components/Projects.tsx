import { useState } from 'react';
import { saveRealConfig, type RealStatus } from '../engine/realRunner';
import { Modal } from './ui';

const OFFLINE = 'Não encontrei o servidor local. Abra o painel por http://127.0.0.1:5178 (rode npm run dev na pasta do agent-arena). A versão da Vercel não acessa pastas do seu computador.';

async function projects(body: Record<string, string>) {
  let r: Response;
  try {
    r = await fetch('/api/real/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await r.json().catch(() => ({ error: OFFLINE }));
  if (!r.ok) throw new Error(data.error || OFFLINE);
  return data;
}

const pickFolder = async (): Promise<string | null> => (await projects({ action: 'pick' })).dir;

const short = (dir: string) => dir.replace(/^\/Users\/[^/]+/, '~');

interface Props {
  status: RealStatus | null;
  onClose: () => void;
  onSaved: (s: RealStatus) => void;
}

/** Escolher o projeto (pasta) onde as próximas tarefas vão rodar: criar uma pasta nova ou anexar uma existente */
export function Projects({ status, onClose, onSaved }: Props) {
  const list = status?.config.projects ?? [];
  const current = status?.config.targetDir;
  const [name, setName] = useState('');
  const [parent, setParent] = useState('~/Documents');
  const [attach, setAttach] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (fn: () => Promise<RealStatus | void>, ok?: string) => {
    setBusy(true);
    setMsg('');
    try {
      const s = await fn();
      if (s) onSaved(s);
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg(`Erro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const choose = (dir: string) => run(() => saveRealConfig({ targetDir: dir }), `Projeto atual: ${short(dir)}`);

  return (
    <Modal
      title="📁 Projetos"
      onClose={onClose}
      narrow
      footer={
        <button className="btn" onClick={onClose}>
          Pronto
        </button>
      }
    >
      {status === null && <div className="hint card flow"><b>Sem servidor local.</b> {OFFLINE}</div>}
      <div className="hint">
        Cada tarefa roda dentro da pasta de um projeto, nunca dentro do Agent Arena. O projeto marcado vale para as próximas tarefas que você criar.
      </div>

      <div className="section-label">Seus projetos</div>
      {!list.length && <div className="hint">Nenhum ainda. Crie uma pasta nova ou anexe uma que já existe.</div>}
      <div className="project-list">
        {list.map((p) => (
          <div key={p.dir} className={`project-row ${p.dir === current ? 'on' : ''}`}>
            <button className="grow" disabled={busy} onClick={() => choose(p.dir)} title="Usar nas próximas tarefas">
              <span>{p.dir === current ? '◉' : '○'}</span>
              <span className="grow">
                <b>{p.name}</b>
                <span className="muted small">{short(p.dir)}</span>
              </span>
            </button>
            <button
              className="btn sm ghost"
              title="Abrir no Finder"
              onClick={() => fetch('/api/real/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir: p.dir }) })}
            >
              📂
            </button>
            <button
              className="btn sm ghost"
              title="Tirar da lista (não apaga a pasta)"
              disabled={busy}
              onClick={() => run(() => projects({ action: 'remove', dir: p.dir }))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="px-title">✨ Novo projeto</div>
          <div className="hint">Cria a pasta, um README e um repositório git (para o QA ver o que mudou).</div>
          <label className="field">
            <span>Nome</span>
            <input className="input" placeholder="meu-app" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Dentro de</span>
            <div className="row-input">
              <input className="input" value={parent} onChange={(e) => setParent(e.target.value)} />
              <button className="btn sm" disabled={busy} onClick={() => run(async () => void (await pickFolder().then((d) => d && setParent(short(d)))))}>
                Escolher…
              </button>
            </div>
          </label>
          <button
            className="btn gold"
            disabled={busy || !name.trim()}
            onClick={() =>
              run(async () => {
                const s = await projects({ action: 'create', name, parent });
                setName('');
                return s;
              }, 'Projeto criado e selecionado.')
            }
          >
            Criar pasta do projeto
          </button>
        </div>

        <div className="card">
          <div className="px-title">📎 Anexar pasta</div>
          <div className="hint">Use um projeto que já existe no seu computador.</div>
          <button
            className="btn gold"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const dir = await pickFolder();
                if (dir) return projects({ action: 'attach', dir });
              }, undefined)
            }
          >
            {busy ? 'Aguardando você escolher…' : 'Escolher pasta…'}
          </button>
          <label className="field">
            <span>ou cole o caminho</span>
            <div className="row-input">
              <input className="input" placeholder="~/Documents/meu-repo" value={attach} onChange={(e) => setAttach(e.target.value)} />
              <button
                className="btn sm"
                disabled={busy || !attach.trim()}
                onClick={() =>
                  run(async () => {
                    const s = await projects({ action: 'attach', dir: attach });
                    setAttach('');
                    return s;
                  }, 'Pasta anexada e selecionada.')
                }
              >
                Anexar
              </button>
            </div>
          </label>
        </div>
      </div>

      {msg && <div className={`small ${msg.startsWith('Erro') ? 'bad' : 'good'}`}>{msg}</div>}
    </Modal>
  );
}

export const projectKey = (dir: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(dir)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const projectName = (status: RealStatus | null, dir?: string) => {
  const d = dir ?? status?.config.targetDir;
  if (!d) return undefined;
  return status?.config.projects.find((p) => p.dir === d)?.name ?? d.split(/[\\/]/).pop();
};
