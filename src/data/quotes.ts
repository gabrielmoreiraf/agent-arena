import type { Role } from '../types';

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export const WORK_QUOTES: Partial<Record<Role, string[]>> = {
  'dev-junior': [
    'Copiei do Stack Overflow, deve funcionar!',
    'Por que tem 400 arquivos alterados?',
    'Funciona na minha máquina 👍',
    'git push --force é normal né?',
    'Achei que era só mudar a cor...',
  ],
  'dev-pleno': [
    'Já vi esse bug antes. Tô resolvendo.',
    'Vou escrever o teste depois. Juro.',
    'Mais uma reunião que podia ser email.',
    'Refatorei só um pouquinho.',
  ],
  'dev-senior': [
    'Isso aqui é dívida técnica de 2019.',
    'Depende.',
    'Quem escreveu isso? ...ah, fui eu.',
    'Vamos simplificar.',
    'Ninguém mexe em produção sexta-feira.',
  ],
  devops: [
    'Quem derrubou o pipeline?',
    'É DNS. Sempre é DNS.',
    'Subindo container...',
    'Rollback pronto, só por garantia.',
  ],
  dba: [
    'Quem fez SELECT * em produção?',
    'Esse índice vai salvar vidas.',
    'Migração reversível, sempre.',
    'EXPLAIN ANALYZE ou não aconteceu.',
  ],
  qa: [
    'Hmm... suspeito.',
    'Cliquei 47 vezes no botão. Quebrou.',
    'E se o usuário digitar um emoji?',
    'Testando em IE6, por via das dúvidas.',
  ],
  designer: [
    'Esse botão precisa respirar.',
    'Quem escolheu Comic Sans?',
    'Contraste 2.1:1? Não passa.',
    'Mais 4px de padding e fica perfeito.',
    'O usuário não lê, ele escaneia.',
    'Cadê o estado vazio dessa tela?',
  ],
  custom: ['Trabalhando nisso...', 'Quase lá!', 'Bip bop. Processando.'],
};

export const QA_REJECT = [
  'Isso aqui não passa nem no teste de fumaça. Volta.',
  'Seu código é um bug com funcionalidades extras.',
  'Funciona na sua máquina? Então manda sua máquina pro cliente.',
  'Abri o modal e o modal abriu outro modal. Rejeitado.',
  'Botão salva duas vezes. Duplo clique é de propósito?',
  'Testei com campo vazio. Explodiu. 💥',
];

export const DEV_REPLY = [
  'Não é bug, é feature!',
  'Na minha máquina funciona!!',
  'Isso nem tava no escopo...',
  'Você testou do jeito errado.',
  'Ok... vou olhar. 😤',
  'Quem pediu pra testar isso?',
];

export const QA_APPROVE = [
  'Aprovado. Por enquanto. 🧐',
  'Hmm. Não achei nada. Isso me preocupa.',
  'Passou. Mas tô de olho em você.',
  'Ok, tá bom. Não se acostuma.',
];

export const MAESTRO_QUOTES = [
  'Afinando a orquestra... 🎼',
  'Cada um no seu tempo, por favor.',
  'Próxima peça!',
];
