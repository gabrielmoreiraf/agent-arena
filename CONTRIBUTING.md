# Contribuindo com o Agent Arena

Obrigado por ajudar! O Agent Arena roda **na máquina de cada pessoa**: quem usa clona o repositório e roda `npm run dev`. Estas regras existem para que ninguém quebre o que já funciona e para que atualizar (`git pull`) nunca apague o que é seu.

## Regras do projeto

1. **Nada de segredos.** Nunca commite tokens, chaves de API, `.env.local`, `.arena-real.json` ou qualquer coisa de `~/.agent-arena`. O `.gitignore` já cobre isso: não o enfraqueça.
2. **Dados do usuário ficam fora do repositório.** Configuração, projetos, worktrees e credenciais moram em `.arena-real.json` (ignorado), `~/.agent-arena/` e no navegador (`localStorage`). O código do repo nunca deve escrever dentro da pasta do próprio Agent Arena (nem `.claude/`): quem atualiza com `git pull` não pode ter conflito por causa de arquivos gerados.
3. **Os agentes nunca trabalham dentro do Agent Arena.** Sempre numa pasta de projeto escolhida pelo usuário (e numa branch/worktree isolada). Essa proteção está no servidor (`assertAllowed`); não a remova.
4. **O servidor só aceita o próprio computador.** A API executa comandos, então ela só responde em `127.0.0.1`/`localhost`. Não abra para a rede (`host: '0.0.0.0'`) e não desligue a checagem de `Host`/`Origin`.
5. **Uma preocupação por PR**, pequeno e fácil de revisar. Refatoração e funcionalidade nova não vão juntas.
6. **Interface em português.** Nomes de código e commits podem ser em português ou inglês, mas siga o que já existe no arquivo.
7. **Não quebre o fluxo principal:** conectar conta → escolher projeto → criar tarefa → Maestro → agente → QA → Entregas → Aplicar. Se mexer em algo desse caminho, teste ele inteiro.

## Como contribuir

```bash
git clone https://github.com/<seu-usuario>/agent-arena.git
cd agent-arena
npm install
git checkout -b minha-mudanca
npm run dev        # painel em http://127.0.0.1:5178
```

Antes de abrir o PR:

```bash
npm run typecheck
npm run build
```

O CI roda os dois em todo PR. A branch `main` só recebe mudanças por Pull Request aprovado por quem mantém o projeto (veja `.github/CODEOWNERS`).

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

## Segurança

Veja [SECURITY.md](SECURITY.md). Encontrou uma falha? Não abra uma issue pública: siga as instruções de lá.
