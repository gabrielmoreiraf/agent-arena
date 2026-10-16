# Notas para quem for mexer no código

O Agent Arena é mantido pelo autor e **não recebe issues nem pull requests**: o repositório é para você clonar, usar e, se quiser, fazer um **fork** e adaptar do seu jeito (a licença MIT permite). Estas notas explicam como o código está organizado e quais cuidados valem para quem altera.

```bash
git clone https://github.com/gabrielmoreiraf/agent-arena.git
cd agent-arena
npm install
npm run dev        # painel em http://127.0.0.1:5178
npm run typecheck && npm run build
```

## Cuidados ao alterar

1. **Nada de segredos.** Nunca commite tokens, chaves de API, `.env.local`, `.arena-real.json` ou qualquer coisa de `~/.agent-arena`. O `.gitignore` já cobre isso: não o enfraqueça.
2. **Dados do usuário ficam fora do repositório.** Configuração, projetos, worktrees e credenciais moram em `.arena-real.json` (ignorado), `~/.agent-arena/` e no navegador (`localStorage`). O código do repo nunca deve escrever dentro da pasta do próprio Agent Arena (nem `.claude/`): quem atualiza com `git pull` não pode ter conflito por causa de arquivos gerados.
3. **Os agentes nunca trabalham dentro do Agent Arena.** Sempre numa pasta de projeto escolhida pelo usuário (e numa branch/worktree isolada). Essa proteção está no servidor (`assertAllowed`); não a remova.
4. **O servidor só aceita o próprio computador.** A API executa comandos, então ela só responde em `127.0.0.1`/`localhost`. Não abra para a rede (`host: '0.0.0.0'`) e não desligue a checagem de `Host`/`Origin`.
5. **Interface em português.** Nomes de código e commits podem ser em português ou inglês, mas siga o que já existe no arquivo.
6. **Não quebre o fluxo principal:** conectar conta → escolher projeto → criar tarefa → Maestro → agente → QA → Entregas → Aplicar. Se mexer em algo desse caminho, teste ele inteiro.

Antes de considerar uma mudança pronta: `npm run typecheck` e `npm run build` (o CI roda os dois a cada push).

## Estrutura do código

```
server/            API local servida pelo Vite (/api/*)
  runner.ts        execução dos agentes (CLIs headless), worktrees, SSE
  adapters.ts      Gemini e Codex: comando e leitura de eventos
  connections.ts   conectar/desconectar contas e terminal de login
  models.ts        modelos reais de cada provedor
  triage.ts        Maestro (IA) · claudeAccount.ts · usage.ts
src/
  engine/          game.ts (estado da partida), maestro.ts (regras), realRunner.ts (ponte com o servidor)
  components/      telas (Arena, Quadro, Ecossistema, Entregas, Contas...)
  audio/           música de batalha (Web Audio)
  sprites/ data/   pixel art, agentes e provedores
scripts/gen-art.ts gera as imagens do README (npm run art)
.claude/skills/    skill do Maestro
```

## Mexendo nos agentes e no Maestro

- Os agentes padrão estão em `src/data/agents.ts`. Se mudar o elenco, aumente `ROSTER_VERSION` para as partidas salvas receberem os novos.
- As regras do Maestro estão em `src/engine/maestro.ts` (fallback) e `server/triage.ts` (IA). A skill `.claude/skills/maestro-triage/SKILL.md` descreve as mesmas regras: mantenha as três coerentes.

Segurança: veja [SECURITY.md](SECURITY.md).
