<p align="center">
  <img src="docs/img/banner.svg" alt="Agent Arena: Maestro, Juninho, Plenão, Seu Sênior, Ops Rocha, Dona Query, Lia Pixel e Detetive QA" width="100%">
</p>

<h1 align="center">Agent Arena</h1>

<p align="center">
  <b>Uma equipe de agentes de IA trabalhando no seu código, numa arena em pixel art.</b><br>
  Um Maestro distribui as tarefas, os agentes executam de verdade e um QA que odeia devs revisa tudo.
</p>

<p align="center">
  <a href="https://github.com/gabrielmoreiraf/agent-arena/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/gabrielmoreiraf/agent-arena/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-e8b64c"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A5%2020-5fa04e">
  <img alt="Roda na sua máquina" src="https://img.shields.io/badge/roda-local-a970ff">
</p>

<p align="center">
  <img src="docs/img/providers.svg" alt="Claude Code, Codex, Gemini CLI e OpenRouter" width="560">
</p>

---

## O que é

O Agent Arena transforma o trabalho de uma equipe de IA em um jogo que você acompanha ao vivo. Você escreve uma tarefa; ela vira um **pergaminho** que chega ao **Maestro**. Ele mede o tamanho, escolhe o agente e o modelo certos, e o agente enfrenta a tarefa como um **monstro** na arena, editando o seu projeto de verdade. Quando termina, o **QA** lê o diff, roda os testes e aprova ou devolve com um comentário ácido.

- **Tudo é real.** Os agentes são as CLIs que você já usa (Claude Code, Codex, Gemini) trabalhando numa pasta sua, com as suas contas.
- **Nada muda sem você.** Cada tarefa roda numa branch isolada; você revisa e aplica com um clique.
- **Você escolhe os provedores.** Conecte só o que quiser, veja qual conta está logada e desconecte quando quiser.

## Como funciona

| | Etapa | O que acontece |
|---|---|---|
| 📜 | **Tarefa** | Você escreve o que precisa ser feito. Ela chega à base do Maestro como um pergaminho. |
| 🎼 | **Maestro** | Lê, mede o tipo e o tamanho (P, M ou G), escolhe o agente e o modelo e explica o motivo. Ou você escolhe o agente. |
| ⚔️ | **Agente** | Trabalha no projeto, numa branch própria. Você vê cada comando e edição no terminal do agente, ao vivo. |
| 🔍 | **QA** | Revisa o diff da branch, roda os testes e dá o veredito. Se reprovar, a tarefa volta ao dev com o comentário. |
| 🚀 | **Entrega** | Você vê arquivos, diff e pré-visualização, e aplica no projeto (merge) ou descarta. |

## A arena

Um campo vertical no estilo de jogos de arena: no topo, as torres do **Backlog**; no meio, o **Rio da Revisão** com duas pontes; embaixo, o Maestro, os pergaminhos e o acampamento dos agentes. Cada lane tem uma torre que cai quando as tarefas dela terminam. O **elixir** é o que sobra do seu plano.

<p align="center">
  <img src="docs/img/monsters.svg" alt="Os monstros: feature, bug, infra, banco, teste e refatoração" width="760">
</p>

Além da **Arena**, há o **Quadro** (a fila em colunas), o **Ecossistema** (o mapa de quem conversa com quem), as **Entregas** e o **Placar** (níveis, bugs achados e a rivalidade entre QA e devs). Tem até música de batalha, com liga/desliga.

## Contas de IA

Conecte só as contas que quiser em **Contas & Tokens**. Cada provedor mostra o estado real: não instalado (com o comando de instalação), desconectado ou conectado com a conta logada. O login abre o navegador e acontece num terminal dentro do app.

| Provedor | Como conecta | Mostra |
|---|---|---|
| **Claude Code** | `claude auth login` pelo navegador | e-mail, plano e a % real da sessão de 5h e da semana |
| **Codex** | `codex login` pelo navegador | conta logada |
| **Gemini CLI** | login Google no Terminal ou chave de API | conta ou chave em uso |
| **OpenRouter** | OAuth no navegador ou chave de API | rótulo da chave e saldo |

Os modelos de cada peso (leve, médio, pesado) vêm da lista real de cada provedor e podem ser trocados. Agentes cujo provedor não está conectado usam um que esteja.

> OpenRouter é novo e ainda não foi testado de ponta a ponta. O veredito do QA com Codex e Gemini também ainda está em validação.

## Instalação

Requisitos: **Node 20+**, **git** e pelo menos uma CLI de IA instalada e logada (por exemplo o [Claude Code](https://claude.com/claude-code)).

```bash
git clone https://github.com/gabrielmoreiraf/agent-arena.git
cd agent-arena
npm install
npm run dev
```

Abra **http://127.0.0.1:5178**. Para atualizar: `git pull && npm install`.

## Primeiros passos

1. **Conecte uma conta** em *Contas & Tokens*.
2. **Escolha o projeto** (📁 na fila): crie uma pasta nova (com git) ou anexe uma existente.
3. **Escreva uma tarefa** e envie ao Maestro. Acompanhe pela arena; clique num monstro ou num agente para ver os detalhes e o terminal.
4. **Revise em Entregas** e clique em *Aplicar no projeto*.

## Seus dados e sua segurança

Tudo fica na sua máquina e nada é sobrescrito quando você atualiza o repositório.

| O quê | Onde |
|---|---|
| Projeto atual e configurações | `.arena-real.json` (ignorado pelo git) |
| Branches das tarefas | `~/.agent-arena/worktrees/` |
| Chaves guardadas pelo Arena | `~/.agent-arena/credentials.json` (permissão 0600, nunca vai ao navegador) |
| Tarefas, histórico e placar | navegador, uma partida por projeto |

O servidor só responde ao próprio computador, os agentes nunca trabalham dentro do Agent Arena e os devs não podem dar `commit`, `push` ou `merge`: quem aplica é você. Detalhes em [SECURITY.md](SECURITY.md).

<details>
<summary><b>Como o Maestro decide quem faz</b></summary>

1. Mede o **tipo** (feature, bug, infra, banco, teste, refatoração) e o **tamanho**: P (leve), M (média) ou G (pesada).
2. Escolhe o **agente**: banco → Dona Query, infra → Ops Rocha, design/UX → Lia Pixel, testes → QA. Para o resto, um dev pela senioridade: P → Juninho, M → Plenão, G → Seu Sênior. Agentes personalizados com palavras-chave têm prioridade; no empate, o menos ocupado.
3. Escolhe o **modelo** pelo tamanho (leve, médio ou pesado), conforme a tabela de Contas & Tokens.
4. Se o QA devolver a mesma tarefa duas vezes, sobe um nível de modelo.

Você pode escolher o agente direto em **Quem faz**. As mesmas regras estão em `.claude/skills/maestro-triage/SKILL.md`, para o Claude Code decidir igual ao jogo.
</details>

<details>
<summary><b>Usar o elenco no Claude Code</b></summary>

O botão **Exportar p/ Claude Code** grava os agentes como subagentes (`.claude/agents/*.md`) e a skill do Maestro no **projeto selecionado**, nunca dentro do Agent Arena. Abra o Claude Code nesse projeto e peça: *"use a skill maestro-triage para distribuir estas tarefas: …"*.
</details>

## Contribuir

Contribuições são bem-vindas. Leia o [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir um PR: ele explica as regras do projeto, a estrutura do código e como rodar as verificações.

## Licença

[MIT](LICENSE).
