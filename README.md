<p align="center"><b>English</b> · <a href="README.pt-BR.md">Português</a></p>

<p align="center">
  <img src="docs/img/banner.svg" alt="Agent Arena: Maestro, Juninho, Plenão, Seu Sênior, Ops Rocha, Dona Query, Lia Pixel and Detetive QA" width="100%">
</p>

<h1 align="center">Agent Arena</h1>

<p align="center">
  <b>A team of AI agents working on your code, in a pixel-art arena.</b><br>
  A Maestro hands out the tasks, the agents really execute them, and a QA who hates devs reviews everything.
</p>

<p align="center">
  <a href="https://github.com/gabrielmoreiraf/agent-arena/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/gabrielmoreiraf/agent-arena/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-e8b64c"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%E2%89%A5%2020-5fa04e">
  <img alt="Runs locally" src="https://img.shields.io/badge/runs-locally-a970ff">
</p>

<p align="center">
  <img src="docs/img/providers.svg" alt="Claude Code, Codex, Gemini CLI and OpenRouter" width="560">
</p>

---

## What it is

Agent Arena turns the work of an AI team into a game you can watch live. You write a task; it becomes a **scroll** that reaches the **Maestro**. He sizes it up, picks the right agent and model, and the agent takes on the task as a **monster** in the arena, really editing your project. When it's done, the **QA** reads the diff, runs the tests, and either approves or sends it back with a sarcastic comment.

- **It's all real.** The agents are the CLIs you already use (Claude Code, Codex, Gemini) working in one of your folders, with your own accounts.
- **Nothing changes without you.** Every task runs on its own isolated branch; you review it and apply it with one click.
- **You pick the providers.** Connect only what you want, see which account is signed in, and disconnect any time.

## How it works

| | Step | What happens |
|---|---|---|
| 📜 | **Task** | You write what needs doing. It arrives at the Maestro's base as a scroll. |
| 🎼 | **Maestro** | Reads it, measures type and size (S, M or L), picks the agent and the model, and explains why. Or you pick the agent yourself. |
| ⚔️ | **Agent** | Works on the project, on its own branch. You watch every command and edit live in the agent's terminal. |
| 🔍 | **QA** | Reviews the branch diff, runs the tests and delivers a verdict. If it fails, the task goes back to the dev with the comment. |
| 🚀 | **Delivery** | You see files, diff and a preview, then merge it into the project or discard it. |

## The arena

A vertical battlefield in the style of arena games: the **Backlog** towers at the top, the **Review River** with two bridges in the middle, and at the bottom the Maestro, the scrolls and the agents' camp. Each lane has a tower that falls when its tasks are done. **Elixir** is what's left of your plan.

<p align="center">
  <img src="docs/img/monsters.svg" alt="The monsters: feature, bug, infra, database, test and refactor" width="760">
</p>

Besides the **Arena**, there is the **Board** (the queue in columns), the **Ecosystem** (a map of who talks to whom), the **Deliveries** and the **Scoreboard** (levels, bugs found and the QA-versus-devs rivalry). There is even battle music, with an on/off switch.

## AI accounts

Connect only the accounts you want in **Accounts & Tokens**. Each provider shows its real state: not installed (with the install command), disconnected, or connected with the signed-in account. Sign-in opens your browser and runs in a terminal inside the app.

| Provider | How it connects | Shows |
|---|---|---|
| **Claude Code** | `claude auth login` in the browser | email, plan and the real 5-hour and weekly usage % |
| **Codex** | `codex login` in the browser | signed-in account |
| **Gemini CLI** | Google sign-in in Terminal, or an API key | account or key in use |
| **OpenRouter** | OAuth in the browser, or an API key | key label and balance |

The model for each weight (light, medium, heavy) comes from each provider's real model list and can be changed. Agents whose provider isn't connected use one that is.

> OpenRouter is new and hasn't been tested end to end yet. QA verdicts with Codex and Gemini are also still being validated.

## Install

Requirements: **Node 20+**, **git**, and at least one AI CLI installed and signed in (for example [Claude Code](https://claude.com/claude-code)).

```bash
git clone https://github.com/gabrielmoreiraf/agent-arena.git
cd agent-arena
npm install
npm run dev
```

Open **http://127.0.0.1:5178**. To update: `git pull && npm install`.

## Getting started

> The app interface is currently in Portuguese. Names used below, as you will see them on screen: *Contas & Tokens* (Accounts & Tokens), *Entregas* (Deliveries), *Quem faz* (Who does it), *Aplicar no projeto* (Apply to project), *Exportar p/ Claude Code* (Export to Claude Code).

1. **Connect an account** in *Accounts & Tokens*.
2. **Pick the project** (📁 in the queue): create a new folder (with git) or attach an existing one.
3. **Write a task** and send it to the Maestro. Follow it in the arena; click a monster or an agent for details and the terminal.
4. **Review in Deliveries** and click *Apply to project*.

## Your data and your safety

Everything stays on your machine, and nothing is overwritten when you update the repository.

| What | Where |
|---|---|
| Current project and settings | `.arena-real.json` (git-ignored) |
| Task branches | `~/.agent-arena/worktrees/` |
| Keys stored by Arena | `~/.agent-arena/credentials.json` (0600 permissions, never sent to the browser) |
| Tasks, history and scoreboard | the browser, one match per project |

The server only answers your own computer, agents never work inside Agent Arena itself, and dev agents can't `commit`, `push` or `merge`: you apply the work. See [SECURITY.md](SECURITY.md).

<details>
<summary><b>How the Maestro decides who does what</b></summary>

1. Measures the **type** (feature, bug, infra, database, test, refactor) and the **size**: S (light), M (medium) or L (heavy).
2. Picks the **agent**: database → Dona Query, infra → Ops Rocha, design/UX → Lia Pixel, tests → QA. For everything else, a dev by seniority: S → Juninho, M → Plenão, L → Seu Sênior. Custom agents with keywords take priority; on a tie, the least busy one.
3. Picks the **model** by size (light, medium or heavy), following the table in Accounts & Tokens.
4. If the QA sends the same task back twice, the model goes up one level.

You can choose the agent yourself under **Who does it**. The same rules live in `.claude/skills/maestro-triage/SKILL.md`, so Claude Code can decide just like the game does.
</details>

<details>
<summary><b>Use the crew in Claude Code</b></summary>

The **Export to Claude Code** button writes the agents as subagents (`.claude/agents/*.md`) and the Maestro skill into the **selected project**, never inside Agent Arena. Open Claude Code in that project and ask: *"use the maestro-triage skill to distribute these tasks: …"*.
</details>

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR: it covers the project rules, the code layout and how to run the checks.

## License

[MIT](LICENSE).
