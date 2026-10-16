# Segurança

O Agent Arena executa CLIs de IA (Claude Code, etc.) que **leem, editam e rodam comandos** na pasta de projeto que você escolher. Trate-o como uma ferramenta de desenvolvimento local.

## O que é protegido

- O servidor escuta só em `127.0.0.1` e recusa requisições cujo `Host` ou `Origin` não sejam locais (protege contra páginas de terceiros tentando falar com a API).
- Cada tarefa roda numa **branch/worktree isolada**; o projeto só muda quando você aplica.
- Os agentes de desenvolvimento não podem rodar `git commit/push/merge/reset/checkout`, nem `rm -rf`; o QA não pode editar arquivos.
- O Agent Arena não aceita como projeto a pasta do próprio Agent Arena nem a pasta pessoal inteira.
- Credenciais ficam na sua máquina (`~/.agent-arena`, com permissão restrita) e nunca vão para o navegador nem para o repositório.

## O que não é protegido

- Um agente pode rodar scripts do projeto (testes, `npm run …`). Use projetos em que você confia ou um ambiente isolado.
- Não exponha o painel na internet nem em redes compartilhadas.

## Reportando uma vulnerabilidade

Use a aba **Security → Report a vulnerability** do repositório no GitHub (relato privado). Descreva o que acontece, como reproduzir e o impacto. Não publique detalhes antes da correção.
