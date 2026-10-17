import { useEffect, useMemo, useState } from 'react';
import { TIER_LABEL } from '../data/providers';
import type { GameState, Task } from '../types';
import { projectKey } from './Projects';
import { Avatar, fmtTokens } from './ui';

interface Changes {
  dir: string;
  isGit: boolean;
  isolated: boolean;
  files: { path: string; status: 'M' | 'A' | 'D' | 'R'; exists: boolean }[];
  diff: string;
}

const STATUS_LABEL = { M: 'alterado', A: 'novo', D: 'apagado', R: 'renomeado' } as const;
const PREVIEWABLE = /\.(html?|svg|png|jpe?g|gif|webp|md|txt|css|js|json)$/i;
const isPage = (p: string) => /\.html?$/i.test(p);
const previewUrl = (dir: string, p: string) => `/api/real/preview/${projectKey(dir)}/${p.split('/').map(encodeURIComponent).join('/')}`;

const isReal = (t: Task) => !!(t.output || t.realTokens || t.files?.length);

function openInFinder(dir: string, path = '') {
  fetch('/api/real/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir, path }) }).catch(
    () => undefined,
  );
}

function when(at?: number) {
  if (!at) return '';
  return new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Actions {
  onLanded: (taskId: string, sha: string, branch: string) => void;
  onDiscarded: (taskId: string) => void;
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}

export function Deliveries({ state, targetDir, ...actions }: { state: GameState; targetDir?: string } & Actions) {
  const done = useMemo(
    () => state.tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    [state.tasks],
  );
  const [selId, setSelId] = useState<string | null>(null);
  const sel = done.find((t) => t.id === selId) ?? done[0];

  if (!done.length) {
    return (
      <div className="deliveries empty px">
        <div className="px-title">Nenhuma entrega ainda</div>
        <div className="hint">Quando o QA aprovar uma tarefa, ela aparece aqui com o que foi feito, os arquivos e um botão para abrir.</div>
      </div>
    );
  }

  return (
    <div className="deliveries">
      <aside className="col px">
        <div className="col-head">
          <span className="px-title">✅ Entregas</span>
          <span className="chip">{done.length}</span>
        </div>
        <div className="scroll">
          {done.map((t) => {
            const agent = state.agents.find((a) => a.id === t.assigneeId);
            return (
              <button key={t.id} className={`delivery-item ${t.id === sel?.id ? 'on' : ''}`} onClick={() => setSelId(t.id)}>
                <Avatar agent={agent} size={26} />
                <span className="grow">
                  <span className="title">{t.title}</span>
                  <span className="muted small">
                    {agent?.name ?? '—'} · {when(t.doneAt)} · {`${t.files?.length ? `${t.files.length} arq.` : 'sem arquivos'}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      {sel && <Detail key={sel.id} task={sel} state={state} targetDir={targetDir} {...actions} />}
    </div>
  );
}

function Detail({ task, state, targetDir, onLanded, onDiscarded }: { task: Task; state: GameState; targetDir?: string } & Actions) {
  const agent = state.agents.find((a) => a.id === task.assigneeId);
  const reviewer = state.agents.find((a) => a.role === 'qa');
  const provider = state.providers.find((p) => p.id === agent?.providerId);
  const model = provider?.models.find((m) => m.id === task.model);
  const real = isReal(task);
  // tarefas antigas não guardavam o projeto: usa o projeto atual
  const dir = task.projectDir ?? targetDir ?? '';
  const [changes, setChanges] = useState<Changes | null>(null);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<string | null>(() => task.files?.find((f) => isPage(f.path) && f.status !== 'D')?.path ?? null);
  const [busy, setBusy] = useState<'land' | 'discard' | null>(null);
  const [landMsg, setLandMsg] = useState('');
  const [reload, setReload] = useState(0);
  const wt = task.worktree;
  const onBranch = !!wt && !task.landedSha && !task.discarded;

  useEffect(() => {
    if (!real || (!task.files?.length && !showAll && !wt)) return;
    const q = new URLSearchParams({ dir });
    if (task.landedSha) q.set('merge', task.landedSha);
    else if (onBranch) q.set('task', task.id);
    else if (!showAll && task.files?.length) q.set('files', task.files.map((f) => f.path).join(','));
    fetch(`/api/real/changes?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setChanges(d);
        if (showAll && !preview) setPreview(d.files.find((f: Changes['files'][number]) => isPage(f.path) && f.exists)?.path ?? null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, showAll, reload, task.landedSha, task.discarded]);

  const files = (changes?.isolated || task.landedSha) && changes ? changes.files : task.files?.length ? task.files : showAll ? changes?.files ?? [] : [];
  const pending = new Set(changes?.files.map((f) => f.path));
  // onde os arquivos estão agora: no worktree (antes de aplicar) ou no projeto
  const viewDir = changes?.dir ?? (onBranch ? wt!.dir : dir);

  const land = async () => {
    setBusy('land');
    setLandMsg('');
    try {
      const r = await post('/api/real/land', { dir, taskId: task.id, title: task.title });
      onLanded(task.id, r.sha, r.branch);
      setReload((n) => n + 1);
    } catch (e) {
      setLandMsg(`Erro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };
  const discard = async () => {
    if (!confirm(`Descartar a branch ${wt?.branch}? O trabalho do agente nesta tarefa será apagado; o projeto não muda.`)) return;
    setBusy('discard');
    setLandMsg('');
    try {
      await post('/api/real/discard', { dir, taskId: task.id });
      onDiscarded(task.id);
    } catch (e) {
      setLandMsg(`Erro: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="col px delivery-detail">
      <div className="col-head">
        <span className="px-title">{task.title}</span>
        {real && (
          <button className="btn sm" onClick={() => openInFinder(onBranch ? wt!.dir : dir)} title={onBranch ? wt!.dir : dir}>
            📂 {onBranch ? 'Abrir pasta da branch' : 'Abrir pasta do projeto'}
          </button>
        )}
      </div>
      <div className="scroll">
        <div className="meta-row">
          <Avatar agent={agent} size={30} />
          <span>
            <b>{agent?.name}</b> · {agent?.title}
            {model && <> · {model.label} ({TIER_LABEL[task.tier]})</>}
            {task.bounces > 0 && <span className="bad"> · 🐞 voltou {task.bounces}x</span>}
          </span>
          <span className="spacer" />
          {!!task.realTokens && <span className="chip">{fmtTokens(task.realTokens)} tokens</span>}
          {!!task.costUsd && <span className="chip" title="Custo equivalente de API (no plano Max entra no limite, não na fatura)">US$ {task.costUsd.toFixed(3)}</span>}
        </div>

        {!real && (
          <div className="hint card flow">Esta tarefa foi concluída sem registrar arquivos nem saída (é de uma versão antiga do painel).</div>
        )}

        {task.reason && (
          <div className="block">
            <div className="section-label">🎼 Por que o Maestro escolheu</div>
            <div className="small">{task.reason}</div>
          </div>
        )}

        {task.output && (
          <div className="block">
            <div className="section-label">📦 O que {agent?.name ?? 'o agente'} fez</div>
            <div className="prose">{task.output}</div>
          </div>
        )}

        {task.qaNote && (
          <div className="block">
            <div className="section-label">🔍 Veredito do {reviewer?.name ?? 'QA'}</div>
            <div className="prose qa">{task.qaNote}</div>
          </div>
        )}

        {wt && (
          <div className={`block branch-box ${task.landedSha ? 'landed' : task.discarded ? 'discarded' : ''}`}>
            {task.landedSha ? (
              <div>🚀 Aplicada no projeto · merge <code>{task.landedSha}</code> da branch <code>{wt.branch}</code></div>
            ) : task.discarded ? (
              <div>🗑 Branch <code>{wt.branch}</code> descartada. O projeto não foi alterado.</div>
            ) : (
              <>
                <div>
                  🌿 Feita isolada na branch <code>{wt.branch}</code>. <b>O projeto ainda não mudou</b>: revise abaixo e aplique quando quiser.
                </div>
                <div className="btn-group">
                  <button className="btn gold" disabled={!!busy} onClick={land}>
                    {busy === 'land' ? 'Aplicando…' : '✅ Aplicar no projeto (merge)'}
                  </button>
                  <button className="btn ghost" disabled={!!busy} onClick={discard}>
                    {busy === 'discard' ? 'Descartando…' : '🗑 Descartar'}
                  </button>
                </div>
              </>
            )}
            {landMsg && <div className="small bad">{landMsg}</div>}
          </div>
        )}

        {real && (
          <div className="block">
            <div className="section-label">🗂 Arquivos {dir ? `em 📁 ${dir.split(/[\\/]/).pop()}` : ''}</div>
            {!files.length && !showAll && (
              <div className="hint">
                Esta entrega não registrou os arquivos (é de antes desta versão).{' '}
                <button className="btn sm" onClick={() => setShowAll(true)}>Ver todas as mudanças pendentes do projeto</button>
              </div>
            )}
            {files.map((f) => {
              const stillThere = !changes || pending.has(f.path);
              return (
                <div key={f.path} className="file-row">
                  <span className={`chip st-${f.status}`}>{STATUS_LABEL[f.status]}</span>
                  <code className="grow">{f.path}</code>
                  {!stillThere && !wt && <span className="muted small">já commitado</span>}
                  {f.status !== 'D' && PREVIEWABLE.test(f.path) && (
                    <button className={`btn sm ${preview === f.path ? 'on' : ''}`} onClick={() => setPreview(preview === f.path ? null : f.path)}>
                      👁 Ver
                    </button>
                  )}
                  {f.status !== 'D' && (
                    <a className="btn sm" href={previewUrl(viewDir, f.path)} target="_blank" rel="noreferrer">
                      ↗ Abrir
                    </a>
                  )}
                  <button className="btn sm ghost" onClick={() => openInFinder(viewDir, f.path)} title="Mostrar no Finder">
                    📂
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {preview && (
          <div className="block">
            <div className="section-label">👁 Pré-visualização · {preview}</div>
            <iframe className="preview" src={previewUrl(viewDir, preview)} title={`Pré-visualização de ${preview}`} sandbox="allow-scripts allow-forms allow-same-origin" />
          </div>
        )}

        {err && <div className="small bad">Erro: {err}</div>}
        {changes && (
          <div className="block">
            <div className="section-label">
              {task.landedSha ? '± O que o merge trouxe para o projeto' : changes.isolated ? '± Diff da branch (desde que saiu do projeto)' : '± Diff (mudanças ainda não commitadas)'}
            </div>
            {changes.diff.trim() ? <Diff text={changes.diff} /> : <div className="hint">{changes.isolated ? 'A branch não tem mudanças.' : 'Sem mudanças pendentes: já foi commitado ou desfeito.'}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function Diff({ text }: { text: string }) {
  return (
    <pre className="diff">
      {text.split('\n').map((l, i) => {
        const cls = l.startsWith('+++') || l.startsWith('---') || l.startsWith('diff ') || l.startsWith('index ') || l.startsWith('new file')
          ? 'h'
          : l.startsWith('@@')
            ? 'at'
            : l.startsWith('+')
              ? 'add'
              : l.startsWith('-')
                ? 'del'
                : '';
        return (
          <span key={i} className={cls}>
            {l || ' '}
          </span>
        );
      })}
    </pre>
  );
}
