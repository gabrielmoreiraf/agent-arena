/** Aviso de mapa vazio: mostra só o que ainda falta (conta, projeto, tarefa). Compartilhado pelos mapas. */
export function EmptyArena({ connected, hasProject, onAccounts, onProjects, title = 'Arena vazia' }: { connected: boolean; hasProject: boolean; onAccounts: () => void; onProjects: () => void; title?: string }) {
  return (
    <div className="arena-empty">
      <div className="px">
        <div className="px-title">{title}</div>
        {connected && hasProject ? (
          <div className="hint">Tudo pronto. <b>Escreva uma tarefa</b> na fila, ao lado, e envie ao Maestro: ela vira um pergaminho e os agentes entram em ação.</div>
        ) : (
          <>
            <ol className="empty-steps">
              {!connected && <li><b>Conecte uma conta</b> de IA (Claude, Codex, Gemini ou OpenRouter): só as que você quiser.</li>}
              {!hasProject && <li><b>Escolha o projeto</b>: crie uma pasta nova ou anexe uma que já existe.</li>}
              <li><b>Escreva uma tarefa</b> na fila, ao lado.</li>
            </ol>
            <div className="btn-group">
              {!connected && <button className="btn gold" onClick={onAccounts}>Conectar conta</button>}
              {!hasProject && <button className="btn gold" onClick={onProjects}>Escolher projeto</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
