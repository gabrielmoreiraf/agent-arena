# Agent Arena

Painel em pixel art, estilo Clash Royale, para **orquestrar agentes de IA de verdade**. Um **Maestro** lê suas tarefas, mede a complexidade, escolhe o agente e o modelo certos (Haiku, Sonnet ou Opus, ou os equivalentes do Codex/Gemini/OpenRouter) e acompanha até o **QA**, que odeia devs, aprovar. Tudo roda **na sua máquina**, com as suas contas, numa pasta de projeto sua.

Elenco padrão: Maestro, Juninho (Dev Júnior), Plenão (Dev Pleno), Seu Sênior, Ops Rocha (DevOps), Dona Query (Banco), Lia Pixel (UI/UX) e o Detetive QA.

## Instalar e rodar

Requisitos: **Node 20+**, **git** e pelo menos uma CLI de IA instalada e logada (por exemplo o [Claude Code](https://claude.com/claude-code)).

```bash
git clone https://github.com/gabrielmoreiraf/agent-arena.git
cd agent-arena
npm install
npm run dev
```

Abra **http://127.0.0.1:5178**. Para atualizar depois: `git pull && npm install`. Seus projetos, contas e histórico **não ficam no repositório**, então nada é sobrescrito (veja "Onde ficam seus dados").

Primeiros passos: **Contas & Tokens** (conecte só as contas que quiser) → 📁 **Projeto** (crie uma pasta nova ou anexe uma) → escreva uma tarefa na fila.

## Onde ficam seus dados

| O quê | Onde |
|---|---|
| Projeto atual, permissões, lista de projetos | `.arena-real.json` na pasta do Agent Arena (ignorado pelo git) |
| Worktrees das tarefas | `~/.agent-arena/worktrees/` |
| Credenciais locais (quando necessárias) | `~/.agent-arena/` (permissão restrita) |
| Tarefas, histórico, placar, XP | `localStorage` do navegador, uma partida por projeto |

Contribuir? Leia o [CONTRIBUTING.md](CONTRIBUTING.md). Segurança: [SECURITY.md](SECURITY.md). Licença: [MIT](LICENSE).

## O que tem

| Área | O que faz |
|---|---|
| **Arena** | Campo vertical estilo Clash Royale. No topo, as torres do **Backlog** (uma por lane + o rei) de onde as tarefas marcham como monstros. No meio, o **Rio da Revisão** com duas pontes. Embaixo, a torre do Maestro, os pergaminhos e o acampamento dos agentes. Lane esquerda = Front + Testes, direita = Back + Infra/Dados. Quando as tarefas de uma lane terminam, a torre dela cai (👑 no canto); zerou o backlog, vitória. O **elixir** (💧) é o que sobra da janela de 5h do Claude, e cada carta do deck mostra o custo em elixir do modelo do agente. |
| **Entregas** | O que foi feito em cada tarefa concluída, com arquivos, diff, pré-visualização e botão para abrir. |
| **Ecossistema** | Mapa do Backlog → Maestro → agentes → QA → projeto. As linhas acendem onde há trabalho passando agora; cada nó mostra tarefa atual, modelo, nível e tokens. Clique num nó para abrir o terminal do agente. |
| **Monstros = tarefas** | Cada monstro da arena é uma tarefa vinda do Backlog (slime = feature, besouro = bug, golem = infra, barril = banco, fantasma = teste, dragão = refatoração; a legenda fica no canto da arena). Clique num monstro: explicação do que ele é, tipo, tamanho P/M/G, lane, modelo, quem está nele, por que o Maestro escolheu, entrega, veredito do QA e o terminal ao vivo daquela tarefa. |
| **Terminal do agente** | Clique em qualquer agente (arena, deck ou mapa): vê ao vivo cada comando, leitura, edição e saída do Claude Code, com ⏸ Pausar / ▶ Retomar / ⏹ Parar. Pausar congela o processo (SIGSTOP) e retomar continua do mesmo ponto. ❚❚ no topo pausa todos; ⏹ Parar tudo cancela todos. Editar o agente fica no botão do terminal. |
| **Quadro** | Kanban: Fila do Maestro → Em andamento → Revisão do QA → Concluído. |
| **Projetos** | Cada projeto (pasta) tem a sua partida: tarefas, registro de batalha, placar e XP próprios. Trocar de projeto guarda a partida atual e abre a do outro (ou uma nova, zerada). "Recomeçar projeto" zera só o projeto aberto. |
| **Fila** | Crie tarefas (cole várias linhas de uma vez). |
| **Registro de batalha** | Tudo o que o Maestro decidiu (e por quê), entregas, bugs devolvidos e a briga QA × Dev. |
| **Barra de heróis** | Nível, XP, modelo em uso e o que cada agente está fazendo agora. |
| **Placar (Tab)** | Feitas, bugs causados/achados, sequência, tokens, elo (Ferro → Lenda), MVP e o placar da rivalidade. |
| **Contas & Tokens** | Claude, Codex, Gemini e OpenRouter, com modos **Janela 5h**, **Diário**, **Semanal** e **Mensal**, planos (Pro, Max 5x, Max 20x...) e limites editáveis. Mostra também a tabela de qual modelo o Maestro usa para cada peso. |
| **Integrações** | **Em breve**: ClickUp, Jira, Linear e GitHub Issues (o código de importação já existe em `server/integrations.ts`, mas a tela está desligada). |
| **Agentes** | Clique num agente para editar nome, visual, cores, provedor, palavras-chave e **instruções próprias**. "+ Novo agente" recruta um personalizado. |

## Contas de IA (conectar só o que quiser)

**Contas & Tokens** mostra cada provedor com o estado real, lido das CLIs na sua máquina: *não instalado* (com o comando para instalar), *desconectado* ou *conectado* (com a conta logada). Cada um é opcional; agentes cujo provedor não está conectado usam um que esteja.

| Provedor | Como conecta | Execução |
|---|---|---|
| **Claude Code** | `claude auth login` abre o navegador; o login roda como um terminal dentro do app. Mostra e-mail, plano e a % real da sessão de 5h e da semana (`claude auth status` e `/usage`, sem gastar tokens). | Testado de ponta a ponta |
| **Gemini CLI** | Login Google no Terminal do macOS (`gemini`), chave de API (do Arena ou já configurada no Gemini CLI). | Dev testado de ponta a ponta; veredito do QA ainda não validado |
| **Codex CLI** | `codex login` abre o navegador (precisa da CLI instalada). | Dev testado de ponta a ponta (sandbox `workspace-write`); veredito do QA ainda não validado |
| **OpenRouter** | OAuth no navegador ou chave colada; roda o Claude Code apontado para o OpenRouter. | **Experimental**: ainda não testado |

Credenciais do próprio Arena (chaves) ficam em `~/.agent-arena/credentials.json` com permissão 0600 e nunca vão para o navegador. Os modelos de cada peso (leve/médio/pesado) são editáveis na tabela; para Gemini, Codex e OpenRouter dá para digitar o id exato do modelo.

## Música de batalha

O botão **🔇 Música** no topo liga uma trilha chiptune estilo MOBA gerada no próprio navegador (sem arquivos de áudio): calma quando está tudo parado e épica, com bateria e melodia, quando há agentes trabalhando. Há controle de volume e a escolha fica salva.

## Uso real de tokens

O servidor local lê os logs das CLIs na sua máquina (nada sai dela):

- **Claude Code**: `~/.claude/projects/**/*.jsonl`. Calcula o bloco de 5h (mesma lógica do `ccusage`), as últimas 24h, os últimos 7 dias e o uso por modelo.
- **Codex CLI**: `~/.codex/sessions/**/*.jsonl`. Usa o `rate_limits` (percentual de 5h e semanal) quando existir.
- **Gemini CLI**: por enquanto só detecta a instalação.

Os limites dos planos são **estimativas**: os provedores não publicam um número fixo de tokens. Calibre na tela de Contas.

## Como o Maestro decide

`src/engine/maestro.ts`:

1. **Tipo**: banco, infra, teste, bug, refatoração ou feature (por palavras-chave).
2. **Complexidade**: P / M / G.
3. **Agente**: primeiro um personalizado cujas palavras-chave batem, depois o especialista (DBA, DevOps, QA) e, para devs, a senioridade mínima (P → júnior, M → pleno, G → sênior), escolhendo o menos ocupado.
4. **Modelo**: P → Leve (Haiku), M → Médio (Sonnet), G → Pesado (Opus). Se o QA devolver 2 vezes, ele sobe um nível.

As mesmas regras estão na skill própria `.claude/skills/maestro-triage/SKILL.md`, para o Claude Code decidir igual ao jogo.

## Usar os agentes no Claude Code de verdade

1. Ajuste os agentes no jogo (instruções, palavras-chave).
2. Clique em **Exportar p/ Claude Code**: gera `.claude/agents/*.md` (formato de subagente, com `model:`), `.claude/skills/maestro-triage/roster.md` e a skill do Maestro no projeto.
3. Os arquivos já são gravados no **projeto selecionado** (nunca dentro do Agent Arena). Abra o Claude Code nele e peça: *"use a skill maestro-triage para distribuir estas tarefas: ..."*.

## Execução real (Claude Code de verdade)

O botão **⚙ Execução** no topo abre a configuração (permissões, paralelismo, aplicar ao aprovar).

1. Escolha o **projeto** no topo da fila de tarefas (📁): **crie um projeto novo** (o Arena cria a pasta, um README e um repositório git) ou **anexe uma pasta** que já existe (seletor de pastas do macOS ou caminho colado). Os agentes nunca trabalham dentro do próprio Agent Arena. Cada tarefa guarda o projeto em que foi criada. Depois, em ⚙, clique em **Salvar e ligar**.
2. Crie uma tarefa. Ela chega como um **pergaminho** voando do Nexus até a base do Maestro. Na execução real, quem lê é o **Maestro de verdade**: um Haiku sem ferramentas (`server/triage.ts`, ~US$ 0,0005 por tarefa) decide complexidade, tipo e agente e explica o motivo. Na simulação continuam as regras de palavras-chave. O pergaminho então voa até o agente escolhido e o monstro aparece na lane. O servidor local roda
   `claude -p --output-format stream-json --agents <subagente inline> --agent <nome> --model <modelo>` dentro do projeto alvo.
3. A barra de vida acompanha os passos reais, o registro mostra cada ferramenta que o agente usou (lendo, editando, `$ npm test`...) e o chip **⚡ ao vivo** marca o que está rodando.
4. **Cada tarefa roda isolada num git worktree** (`~/.agent-arena/worktrees/…`, branch `arena/<tarefa>`), criado a partir do HEAD do projeto. Ao fim de cada rodada do dev, o Arena commita na branch com o agente como autor. O projeto só muda quando você clica em **✅ Aplicar no projeto** na aba Entregas (merge `--no-ff`; se der conflito ou houver mudança não commitada nos mesmos arquivos, nada é alterado e o motivo aparece). **🗑 Descartar** apaga o worktree e a branch. Com worktrees, dá para rodar vários agentes em paralelo sem um atropelar o outro. Projetos sem git (ou sem nenhum commit) continuam rodando direto na pasta.
5. Quando o dev termina, o **QA roda como revisor de verdade**: sem `Edit`/`Write`, lê o `git diff`, roda os testes e devolve um veredito estruturado (`--json-schema`). Reprovou → a tarefa volta para o dev com o comentário do QA no prompt (e, na 2ª volta, o Maestro sobe o modelo).
6. A aba **Entregas** lista tudo o que foi concluído: o que o agente disse que fez, o veredito do QA, os arquivos tocados (com diff), a pré-visualização de páginas HTML direto no painel e botões para abrir em nova aba ou no Finder.
7. Tokens e custo vêm do `usage` real de cada mensagem: entram no placar do agente, no card da tarefa e no medidor do Claude (que também relê os logs ao fim de cada job).

Detalhes:

- Execução sempre no Claude: agentes de Codex/Gemini usam o modelo Claude do mesmo peso.
- Devs podem ler, editar e rodar comandos de teste/build; `git commit`, `push`, `reset`, `checkout` e `rm -rf` ficam bloqueados. Qualquer coisa que pediria permissão é negada automaticamente (`--permission-prompts none`).
- Só as configurações do projeto alvo são carregadas (`--setting-sources project,local --strict-mcp-config`): hooks, plugins e MCP do seu usuário ficam de fora, o que deixa cada job mais barato.
- **Aplicar ao aprovar** (opcional) faz o merge da branch automaticamente quando o QA aprova. Por padrão você aplica pela aba Entregas.
- Se um job falha, o card mostra o erro e um botão **Tentar de novo**. Apagar a tarefa cancela o job.
- A configuração fica em `.arena-real.json` (fora do git). `ARENA_TARGET_DIR` e `CLAUDE_BIN` no `.env.local` também funcionam.
- API: `GET /api/real/events` (SSE), `GET|POST /api/real/config`, `POST /api/real/projects` (create/attach/remove/pick), `POST /api/real/triage`, `POST /api/real/run`, `POST /api/real/cancel`, `POST /api/real/land`, `POST /api/real/discard`, `GET /api/real/log`, `POST /api/real/control`, `GET /api/real/changes`, `GET /api/real/preview/<arquivo>`, `POST /api/real/open`.

## Integrações (em breve)

A importação de tarefas do ClickUp, Jira, Linear e GitHub Issues ainda não está liberada na interface.

## Estrutura

```
server/            API local servida pelo Vite (/api/*)
  usage.ts         leitura dos logs de uso
  integrations.ts  ClickUp, Jira, Linear, GitHub
  exportAgents.ts  gera .claude/agents/*.md
  runner.ts        execução real: claude -p headless + SSE
src/
  engine/          maestro.ts (triagem), game.ts (estado da partida + eventos reais), realRunner.ts (SSE/disparo), usage.ts
  data/            agentes, provedores/modelos, falas
  sprites/         pixel art em texto (agentes e monstros)
  components/      telas
.claude/skills/maestro-triage/  skill do Maestro
```

## Próximos passos

- Escrever o status de volta no ClickUp/Jira quando a tarefa for concluída.
- Leitura de uso do Gemini CLI.
