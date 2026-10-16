import { useState } from 'react';
import type { PermissionMode } from '../../server/runner';
import { saveRealConfig, type RealStatus } from '../engine/realRunner';
import { projectName } from './Projects';
import { Modal } from './ui';

const PERMISSION: Record<PermissionMode, string> = {
  acceptEdits: 'Editar arquivos (recomendado)',
  auto: 'Automático (o Claude decide o que é seguro)',
  bypassPermissions: 'Sem travas (só em sandbox!)',
};

interface Props {
  status: RealStatus | null;
  connected: boolean;
  onClose: () => void;
  onSaved: (s: RealStatus) => void;
  onEnable: () => void;
  enabled: boolean;
  onProjects: () => void;
}

export function RealConfig({ status, connected, onClose, onSaved, onEnable, enabled, onProjects }: Props) {
  const cfg = status?.config;
  const [perm, setPerm] = useState<PermissionMode>(cfg?.permissionMode ?? 'acceptEdits');
  const [parallel, setParallel] = useState(cfg?.maxParallel ?? 1);
  const [autoCommit, setAutoCommit] = useState(cfg?.autoCommit ?? false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async (andEnable = false) => {
    setBusy(true);
    setMsg('');
    try {
      const s = await saveRealConfig({ permissionMode: perm, maxParallel: parallel, autoCommit });
      onSaved(s);
      if (!s.exists) setMsg('Erro: escolha um projeto (crie uma pasta nova ou anexe uma existente).');
      else if (andEnable) {
        onEnable();
        onClose();
      } else setMsg('Salvo.');
    } catch (e) {
      setMsg(`Erro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const loggedIn = !!status?.account?.loggedIn;
  const ready = !!status?.claude && loggedIn && !!status.exists;

  return (
    <Modal
      title="Execução real"
      onClose={onClose}
      narrow
      footer={
        <>
          <button className="btn ghost" disabled={busy} onClick={() => save(false)}>Salvar</button>
          {!enabled && (
            <button className="btn gold" disabled={busy || !cfg?.targetDir || !loggedIn} onClick={() => save(true)} title={loggedIn ? undefined : 'Faça login no Claude Code primeiro'}>
              Salvar e ligar
            </button>
          )}
          <button className="btn" onClick={onClose}>Fechar</button>
        </>
      }
    >
      <div className="hint">
        Na execução real, cada tarefa que o Maestro distribui roda o <b>Claude Code</b> de verdade (<code>claude -p</code>) com o
        subagente e o modelo escolhidos, dentro do projeto abaixo. A barra de vida segue o progresso real, o registro mostra o que
        o agente está fazendo e o QA revisa o <code>git diff</code> antes de aprovar. Os tokens contam no seu plano.
      </div>

      {status === null && (
        <div className="hint card flow">
          <b>Servidor local não encontrado.</b> Esta é a versão hospedada (só o painel): a <b>Simulação</b> funciona normalmente, mas a
          Execução real precisa rodar na sua máquina, onde ficam o Claude Code e as pastas dos projetos. Rode <code>npm run dev</code> no
          repositório e abra <code>http://127.0.0.1:5178</code>.
        </div>
      )}

      <div className="mode-toggle">
        <span className={`status ${status?.claude ? 'ok' : 'off'}`}>{status?.claude ? `claude ${status.claude.split(' ')[0]}` : 'claude não encontrado'}</span>
        {status?.claude && (
          <span className={`status ${status.account?.loggedIn ? 'ok' : 'off'}`} title={status.account?.email}>
            {status.account?.loggedIn ? `logado${status.account.plan ? ` · ${status.account.plan}` : ''}` : 'Claude não logado'}
          </span>
        )}
        <span className={`status ${connected ? 'ok' : 'off'}`}>{connected ? 'servidor conectado' : 'servidor desconectado'}</span>
        {status?.config.targetDir && (
          <span className={`status ${!status.exists ? 'off' : status.isGit ? 'ok' : 'warn'}`}>
            {!status.exists ? 'pasta não existe' : status.isGit ? 'repositório git' : 'sem git (QA não vê o diff)'}
          </span>
        )}
        {!!status?.running && <span className="status warn">{status.running} rodando</span>}
      </div>

      <label className="field">
        <span>Projeto das próximas tarefas</span>
        <button className={`project-pick ${cfg?.targetDir ? '' : 'missing'}`} onClick={onProjects}>
          <span>📁</span>
          <span className="grow">{projectName(status) ?? 'Escolher, criar ou anexar uma pasta…'}</span>
          <span className="muted">▾</span>
        </button>
      </label>

      <label className="field">
        <span>Permissões dos devs</span>
        <select className="select" value={perm} onChange={(e) => setPerm(e.target.value as PermissionMode)}>
          {Object.entries(PERMISSION).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>

      <div className="grid2">
        <label className="field">
          <span>Agentes ao mesmo tempo</span>
          <select className="select" value={parallel} onChange={(e) => setParallel(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aplicar no projeto ao aprovar</span>
          <select className="select" value={autoCommit ? 'sim' : 'nao'} onChange={(e) => setAutoCommit(e.target.value === 'sim')}>
            <option value="nao">Não, eu aplico pela aba Entregas</option>
            <option value="sim">Sim, merge automático quando o QA aprovar</option>
          </select>
        </label>
      </div>

      <div className="hint">
        Em projetos com git, cada tarefa roda no seu próprio <b>worktree</b> (uma branch <code>arena/…</code>): agentes em paralelo não se
        atropelam e o projeto só muda quando você clica em <b>Aplicar</b> na aba Entregas. Os devs podem ler, editar e rodar comandos de
        teste/build; <code>git commit</code>, <code>push</code>, <code>merge</code>, <code>reset</code> e <code>rm -rf</code> ficam bloqueados. O QA não edita nada. Agentes de outros provedores (Codex, Gemini) rodam no Claude com o
        modelo do mesmo peso. Use um repositório de teste primeiro.
      </div>
      {!ready && status && <div className="small bad">{!status.claude
            ? 'Instale o Claude Code (https://claude.com/claude-code).'
            : !loggedIn
              ? 'O Claude Code não está logado: rode `claude` no terminal e faça o login. Depois abra esta tela de novo.'
              : 'Escolha um projeto: crie uma pasta nova ou anexe uma existente.'}</div>}
      {msg && <div className={`small ${msg.startsWith('Erro') ? 'bad' : 'good'}`}>{msg}</div>}
    </Modal>
  );
}
