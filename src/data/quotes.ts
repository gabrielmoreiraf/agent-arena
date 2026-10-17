import type { Role } from '../types';

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Falas dos agentes. Cada contexto tem frases prontas e um gerador que monta frases novas misturando partes
 * (abertura + assunto + remate), então quase nunca se repete. Sem `seed` sorteia de verdade e evita as últimas falas;
 * com `seed` o resultado é estável (usado no modo ao vivo, para o balão não trocar a cada atualização).
 * Para ter mais variedade basta acrescentar itens nas listas abaixo.
 */

// ---------- sorteio ----------

function rngFrom(seed?: string) {
  if (seed === undefined) return Math.random;
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const recent: string[] = [];
const remember = (s: string) => {
  recent.push(s);
  if (recent.length > 60) recent.shift();
};

/** abertura + assunto + remate, com a pontuação e as maiúsculas no lugar */
function join(open: string, core: string, end: string) {
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const head = /[.!?]$/.test(open) ? `${open} ${cap(core)}` : open ? `${open} ${core}` : cap(core);
  if (!end) return `${head}${/[.!?]$/.test(head) ? '' : '.'}`;
  const tail = /^[\p{L}]/u.test(end) ? cap(end) : end;
  return `${head.replace(/[.!?]$/, '')}. ${tail}`;
}

const one = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];

/** bordões que qualquer agente pode soltar, em qualquer situação (não dependem de papel nem de roteiro) */
export const CATCHPHRASES = [
  'AAAAHHHH NUM QUER NÃO!',
  'Tá entendendo, Major?',
  'Felizmente.',
  'OS SEM ALMA!',
  'Aí que o dia termina e a alma começa.',
];
/** chance de uma fala qualquer virar um bordão */
const CATCH_CHANCE = 0.14;

/** metade das vezes uma frase pronta, metade uma montada; sem repetir as últimas. `catches` = pode virar um bordão */
function say(ready: string[], parts: [string[], string[], string[]] | null, seed?: string, catches = true): string {
  const rnd = rngFrom(seed);
  for (let i = 0; i < 12; i++) {
    const s = catches && rnd() < CATCH_CHANCE ? one(CATCHPHRASES, rnd) : parts && rnd() < 0.55 ? join(one(parts[0], rnd), one(parts[1], rnd), one(parts[2], rnd)) : one(ready, rnd);
    if (seed !== undefined) return s;
    if (!recent.includes(s)) {
      remember(s);
      return s;
    }
  }
  const s = one(ready, rnd);
  if (seed === undefined) remember(s);
  return s;
}

// ---------- trabalhando ----------

const WORK: Partial<Record<Role, string[]>> = {
  'dev-junior': [
    'Copiei do Stack Overflow, deve funcionar!',
    'Por que tem 400 arquivos alterados?',
    'Funciona na minha máquina 👍',
    'git push --force é normal né?',
    'Achei que era só mudar a cor...',
    'Apaguei uma pasta pra ver o que acontecia. Aconteceu.',
    'Não sei o que esse if faz, mas se tirar quebra.',
    'Rodei em produção sem querer. Foi sem querer!',
    'Tô no console.log driven development.',
    'Como é que isso funcionava antes?',
    'Isso é temporário, prometo.',
    'Pra que ler a documentação se dá pra chutar?',
    'Funciona… mas eu não sei por quê. Vou deixar assim.',
  ],
  'dev-pleno': [
    'Já vi esse bug antes. Tô resolvendo.',
    'Vou escrever o teste depois. Juro.',
    'Mais uma reunião que podia ser email.',
    'Refatorei só um pouquinho.',
    'Esse TODO é de 2021 e vai continuar sendo.',
    'Tá feio, mas tá no prazo.',
    'Quem aprovou essa gambiarra? Ah, fui eu mesmo.',
  ],
  'dev-senior': [
    'Isso aqui é dívida técnica de 2019.',
    'Depende.',
    'Quem escreveu isso? ...ah, fui eu.',
    'Vamos simplificar.',
    'Ninguém mexe em produção sexta-feira.',
    'Eu avisei na reunião. Está na ata.',
    'Apaguei 800 linhas e ficou melhor. Melhor mesmo.',
    'Cada cachorro que lamba a sua caceta, esse módulo é meu!',
    'Como diria Dijkstra: se depurar é tirar bug, programar é colocar.',
    'Qualquer tolo escreve código que a máquina entende. O desafio é o humano entender. (Fowler)',
    'Escreva sempre como se quem for manter fosse um psicopata que sabe onde você mora.',
    'Código apagado é código depurado.',
    'Um dia produtivo é jogar fora mil linhas de código. (Ken Thompson)',
    'Antes de ser reutilizável, o software precisa ser utilizável.',
    'Sem requisitos nem design, programar é a arte de adicionar bugs num arquivo vazio.',
    'Software ruim pode virar o emprego de tempo integral de outra pessoa.',
    'Colocar mais um programador num projeto atrasado só atrasa mais. (Brooks)',
    'Programar na especificação congelada é como andar na água congelada: só funciona assim.',
  ],
  devops: [
    'Quem derrubou o pipeline?',
    'É DNS. Sempre é DNS.',
    'Subindo container...',
    'Rollback pronto, só por garantia.',
    'Quem mexeu no servidor às 3 da manhã?',
    'O deploy passou. Desconfio dele.',
    'Reiniciei e voltou. Não pergunta por quê.',
  ],
  dba: [
    'Quem fez SELECT * em produção?',
    'Esse índice vai salvar vidas.',
    'Migração reversível, sempre.',
    'EXPLAIN ANALYZE ou não aconteceu.',
    'DELETE sem WHERE, de novo? Porra.',
    'Esse JOIN tá mais lento que internet de sítio.',
  ],
  qa: [
    'Hmm... suspeito.',
    'Cliquei 47 vezes no botão. Quebrou.',
    'E se o usuário digitar um emoji?',
    'Testando em IE6, por via das dúvidas.',
    'Eu não quebro o sistema, eu mostro que ele já era quebrado.',
    'Dev falando "na minha máquina funciona"? Já tô rindo.',
    'Achei um bug. Que alegria.',
    'Abri o login e abriu a calculadora do Windows. Que beleza.',
    'O carrinho aceita pagamento com 3 abacates e um sorriso. Reprovado.',
    'Build verde? Hora de tentar quebrar.',
    'O primeiro bug de verdade foi uma mariposa no Harvard Mark II, em 1947. Eu admiro.',
    'O dev disse "isso nunca vai acontecer". Fui lá fazer acontecer.',
    'Funcionando como projetado? Quem projetou?',
    'Testei o fluxo feliz. Agora vou pro fluxo do caos.',
    'Um QA entra num bar e pede 1 cerveja, 0 cervejas, 99999 cervejas e uma lagartixa.',
  ],
  designer: [
    'Esse botão precisa respirar.',
    'Quem escolheu Comic Sans?',
    'Contraste 2.1:1? Não passa.',
    'Mais 4px de padding e fica perfeito.',
    'O usuário não lê, ele escaneia.',
    'Cadê o estado vazio dessa tela?',
    'O dev "ajustou" meu layout. Chorei.',
  ],
  custom: ['Trabalhando nisso...', 'Quase lá!', 'Bip bop. Processando.', 'Deixa que eu resolvo, caralho.'],
  maestro: ['Afinando a orquestra... 🎼', 'Cada um no seu tempo, por favor.', 'Próxima peça!'],
};

const MEME = [
  'Na minha máquina funciona!',
  'Quero ver a IA aguentar o tranco, na minha máquina funciona.',
  'Cada cachorro que lamba a sua caceta, não mexe no meu código!',
  'Recua, fascista, recua! Meu merge não passa de você!',
  'Se funcionar, ninguém mexe. Se quebrar, a culpa é do estagiário.',
  'Isso aqui é gambiarra com fé.',
  'Subi na sexta às 17h. Que Deus nos acuda.',
  'Código limpo é código que ninguém olhou ainda.',
  'Já tentou desligar e ligar de novo, caralho?',
  'Porra, quem foi o gênio que fez isso?',
  'Vai dar ruim e eu já avisei.',
  'Comentei o código e agora funciona. Não vou tocar.',
  'Eu não tenho bug, eu tenho feature não documentada.',
  'Mais um café e eu resolvo isso. Ou não.',
  'O cliente mudou o escopo de novo. Que surpresa.',
  'Deploy em produção sem teste? Hoje eu tô corajoso.',
  'Ctrl+C, Ctrl+V e reza.',
  'Que merda é essa de dependência quebrada?',
  'Não é bug, é feature.',
  'Ontem funcionava, juro por tudo.',
  'Estranho… isso nunca tinha acontecido antes.',
  'Não tem nada nos logs. Nada mesmo.',
  'Como é que isso funcionava antes?',
  'Deve ser problema de permissão.',
  'Funcionando como projetado.',
  'Isso é um problema conhecido.',
  'Tá 90% pronto. Os outros 90% faltam.',
  'É só uma correção temporária. (Famosas últimas palavras.)',
  'Isso nunca vai acontecer. Nunca. (Aconteceu.)',
  'Deve ser a versão da biblioteca.',
  'Já tentou no Chrome? E no Firefox?',
  'Quanto tempo leva? Não sei, mas deve ser rápido.',
  'Barato, rápido ou bom: escolhe dois.',
  'Culpa da biblioteca open source, com certeza.',
  'Eu não toquei nessa parte do código faz semanas!',
  'Alguém mexeu no meu código. Eu sei que mexeu.',
  'Não dá pra fazer teste unitário de tudo!',
  'Se eu trabalhasse sozinho seria muito mais rápido!',
  'O código dos outros é sempre ruim. O meu é perfeito.',
  'Nenhum design pattern serve pro meu problema: ele é único!',
  'Meu código é perfeito: rodei tudo aqui na cabeça.',
  'Se quebrou com o input errado, a culpa é do usuário.',
  'Já reiniciou o servidor depois de atualizar?',
  'Qual versão você tem instalada aí?',
  'Beta é latim pra "ainda não funciona".',
  'Semanas de código podem poupar horas de planejamento.',
  'Um bug com rótulo de feature não documentada.',
  'Pra entender recursão, primeiro entenda recursão.',
  'Quem escreveu isso? Ninguém sabe como funciona. Nem eu.',
  'Isso é code smell.',
  'Eu só preciso de mais um console.log.',
  'AAAAHHHH NUM QUER NÃO!',
  'Tá entendendo, Major?',
  'Felizmente.',
  'OS SEM ALMA!',
  'Aí que o dia termina e a alma começa.',
];

/** uma fofoca de escritório sorteada: acusação ("Michael quebrou rotas manuais") ou cobrança ("Cadê o mapa de calor, Manel?") */
function gossipOne(rnd: () => number) {
  const n = GOSSIP_NAMES[Math.floor(rnd() * GOSSIP_NAMES.length)];
  const t = GOSSIP_THINGS[Math.floor(rnd() * GOSSIP_THINGS.length)];
  const kind = rnd() < 0.5 ? 'blame' : 'ask';
  const tpl = (kind === 'blame' ? GOSSIP_BLAME : GOSSIP_ASK)[Math.floor(rnd() * (kind === 'blame' ? GOSSIP_BLAME : GOSSIP_ASK).length)];
  return { kind, n, x: t.bare, xa: t.art, text: tpl.split('{n}').join(n).split('{xa}').join(t.art).split('{x}').join(t.bare) };
}

const WORK_OPEN = ['Porra,', 'Caralho,', 'Mano,', 'Pô,', 'Aff,', 'Eita,', 'Meu Deus,', 'Olha só,', 'Sério?', 'Ué,', 'Sinceramente,', 'Gente,'];
const WORK_CORE = [
  'esse código tá pior que fila de banco',
  'quem commitou isso, vem aqui',
  'na minha máquina funciona',
  'esse bug tá me zoando',
  'isso só roda no ambiente do capeta',
  'a documentação mentiu pra mim',
  'o teste passou e eu não confio',
  'essa função tem mais if que novela mexicana',
  'esse arquivo tem 3 mil linhas e nenhuma explicação',
  'esse merge conflict é uma briga de bar',
  'a variável se chama "data2" e eu perdi a fé',
  'essa regex foi escrita por alguém que me odeia',
  'mexi aqui e quebrou lá do outro lado do projeto',
  'o cache tá me sabotando',
  'esse deploy tem cara de problema',
];
const WORK_END = ['', '', '', 'bora que o prazo é ontem.', 'vai dar certo (mentira).', 'e eu aqui, sofrendo.', 'faz parte.', 'respira e segue.', 'deixa comigo.', '😤', '🔥'];

export function workLine(role: Role, seed?: string): string {
  const rnd = rngFrom(seed === undefined ? undefined : `w${seed}`);
  const pool = [...(WORK[role] ?? WORK.custom!), ...(rnd() < 0.4 ? MEME : []), ...(rnd() < 0.3 ? [gossipOne(rnd).text] : [])];
  return say(pool, [WORK_OPEN, WORK_CORE, WORK_END], seed === undefined ? undefined : `w${seed}`);
}

// ---------- QA reprovando / dev respondendo / aprovando ----------

const REJECT = [
  'Isso aqui não passa nem no teste de fumaça. Volta.',
  'Seu código é um bug com funcionalidades extras.',
  'Funciona na sua máquina? Então manda sua máquina pro cliente.',
  'Abri o modal e o modal abriu outro modal. Rejeitado.',
  'Botão salva duas vezes. Duplo clique é de propósito?',
  'Testei com campo vazio. Explodiu. 💥',
  'Isso é código ou tentativa de homicídio contra o usuário?',
  'Quem aprovou essa porra? Volta pro dev.',
  'Barrado. E eu nem precisei me esforçar.',
  'Abri o login e abriu a calculadora do Windows. Rejeitado.',
  'O carrinho aceita pagamento com 3 abacates e um sorriso. Rejeitado.',
  'Funcionando como projetado, é? Então o projeto está errado.',
  'Build verde, mas aí eu apareci. Voltou.',
];
const REJECT_PARTS: [string[], string[], string[]] = [
  ['Reprovado.', 'Barrei.', 'Voltou.', 'Nem pensar.', 'Não, não e não.', 'Caralho,'],
  [
    'achei bug em menos de 5 minutos',
    'o campo vazio derrubou tudo',
    'o botão faz o contrário do que diz',
    'sua feature quebrou três que já funcionavam',
    'o erro aparece só pro usuário, nunca pra você',
    'o teste que você não escreveu teria pegado isso',
    'o layout quebrou no celular',
    'a tela fica em branco e ninguém sabe por quê',
  ],
  ['Conserta isso.', 'Dá uma olhada com carinho.', 'Testa antes de me mandar, por favor.', 'Aff.', 'Tô de olho.', '🐞', ''],
];
export const rejectLine = (seed?: string) => say(REJECT, REJECT_PARTS, seed);

const REPLY = [
  'Não é bug, é feature!',
  'Na minha máquina funciona!!',
  'Isso nem tava no escopo...',
  'Você testou do jeito errado.',
  'Ok... vou olhar. 😤',
  'Quem pediu pra testar isso?',
  'Recua, fascista, recua! O código tá certo!',
  'Cada cachorro que lamba a sua caceta, deixa meu código em paz!',
  'Quero ver você escrever melhor então, porra.',
  'Funcionava ontem. Alguém mexeu.',
  'Isso é problema de ambiente, não meu.',
  'Ontem funcionava!',
  'Isso nunca tinha acontecido antes.',
  'Deve ser a versão da biblioteca.',
  'Já tentou no Chrome? E no Firefox?',
  'Funcionando como projetado.',
  'Isso é um problema conhecido, tá no backlog.',
  'Não tem nada nos logs, então não é bug.',
  'AAAAHHHH NUM QUER NÃO! Deixa meu código em paz!',
  'OS SEM ALMA! Só sabem reprovar!',
  'Tá entendendo, QA? Funciona. Pronto.',
];
const REPLY_PARTS: [string[], string[], string[]] = [
  ['Pô,', 'Porra,', 'Mano,', 'Recua, QA, recua!', 'Calma,', 'Olha,'],
  [
    'na minha máquina funciona',
    'o usuário nunca ia clicar nisso',
    'isso é feature e você sabe',
    'eu testei, juro por tudo',
    'tá certo, o teste que tá errado',
    'ontem tava funcionando',
    'a culpa é do cache',
    'o requisito tava ambíguo',
  ],
  ['Vou ver.', 'Tá bom, tá bom.', 'Que mania de implicância.', 'Respeita meu trabalho.', '😤', ''],
];
export const replyLine = (seed?: string) => say(REPLY, REPLY_PARTS, seed);

const APPROVE = [
  'Aprovado. Por enquanto. 🧐',
  'Hmm. Não achei nada. Isso me preocupa.',
  'Passou. Mas tô de olho em você.',
  'Ok, tá bom. Não se acostuma.',
  'Aprovado. Até eu me surpreendi, caralho.',
  'Build verde. Tentei quebrar e não consegui. Hoje.',
  'Passou. Beta é latim pra "ainda não funciona", mas tá.',
  'Não quebrou. Milagre.',
  'Passou. Anota aí que eu fui legal.',
  'Felizmente passou. Já tava sem alma de tanto testar.',
];
export const approveLine = (seed?: string) => say(APPROVE, null, seed);

// ---------- Maestro e entrega de tarefa ----------

const MAESTRO = [
  'Afinando a orquestra... 🎼',
  'Cada um no seu tempo, por favor.',
  'Próxima peça!',
  'Quem tá parado? Vai trabalhar, porra.',
  'Regendo esse caos com muito carinho.',
  'Se todo mundo me ouvisse, eu não precisava reger.',
  'Eu só organizo. A culpa é de vocês.',
  'Primeiro a tarefa, depois o agente, depois o modelo. Tá entendendo, Major?',
  'Aí que o dia termina e a alma começa. Vamos pra mais uma.',
];
export const maestroLine = (seed?: string) => say(MAESTRO, null, seed);

const SPAWN = ['📜 Deixa comigo!', '📜 Recebido, Dotor!', '📜 Bora!', '📜 Vem pra mim, caralho!', '📜 Mais uma? Beleza.', '📜 Já é!', '📜 Tá na mão!', '📜 Se der ruim a culpa é sua, Dotor.'];
export const spawnLine = (seed?: string) => say(SPAWN, null, seed);

// ---------- resposta de um agente à fala do outro ----------

const RETORT = [
  'Aham, e eu sou o Papa.',
  'Fala isso pro deploy de sexta.',
  'Que preguiça de ouvir isso, caralho.',
  'Concordo, mas não vou fazer nada.',
  'Isso foi uma indireta?',
  'Rá! Tá bom.',
  'Vai tomar um café e volta.',
  'Anota aí na ata.',
  'Cada cachorro que lamba a sua caceta, mano.',
  'Recua, fascista, recua!',
  'Isso aí é problema do próximo sprint.',
  'Tô de olho em você, hein.',
  'Você tem razão. Mentira, não tem.',
  'Sem comentários... só uns 40.',
  'Na minha máquina é diferente.',
  'Tá, e quem vai fazer o teste?',
  'Que porra é essa de dizer isso agora?',
  'Já vi esse filme. Termina em rollback.',
  'Boa! Agora faz funcionar.',
  'Isso é com você, eu só tô olhando.',
];
const RETORT_PARTS: [string[], string[], string[]] = [
  ['Olha,', 'Pô,', 'Mano,', 'Sinceramente,', 'Ué,', 'Hm,', 'Porra,'],
  ['eu discordo totalmente', 'você tá certo, e isso me assusta', 'isso vai dar ruim e você sabe', 'eu faria diferente', 'isso não foi o combinado', 'tô achando graça disso', 'prefiro não opinar'],
  ['mas segue o jogo.', 'só que não.', '😂', '🙄', 'e ponto.', ''],
];
export const retortLine = (seed?: string) => say(RETORT, RETORT_PARTS, seed);

// ---------- farpas: um agente alfinetando o outro (por papel e entre as IAs) ----------

/** alfinetadas sobre o papel de quem as recebe */
const JAB_ROLE: Partial<Record<Role, string[]>> = {
  qa: [
    "Esses QA's acham bug até em código que nem existe.",
    "Esses QA's vivem pra ver dev sofrendo.",
    "Esses QA's clicam em tudo menos no que importa.",
    "Esses QA's reprovam por esporte.",
    "Esses QA's chamam de 'edge case' o que eles mesmos inventaram.",
    "Esses QA's abrem ticket até pra sombra do botão.",
  ],
  'dev-junior': [
    'Esses júniores rodam em produção "só pra testar".',
    'Esses júniores copiam e colam e ainda pedem elogio.',
    'Esses júniores têm mais fé que conhecimento.',
    'Esses júniores acham que git push --force resolve tudo.',
  ],
  'dev-pleno': [
    'Esses plenos prometem refatorar "depois da entrega".',
    'Esses plenos têm opinião sobre tudo e teste sobre nada.',
    'Esses plenos vivem no meio-termo: nem rápido, nem limpo.',
  ],
  'dev-senior': [
    'Esses sêniores respondem "depende" pra tudo e cobram caro por isso.',
    'Esses sêniores acham que todo código é lixo, menos o deles.',
    'Esses sêniores só aparecem pra criticar o PR.',
    'Esses sêniores riscam 800 linhas e chamam de melhoria.',
  ],
  devops: [
    'Esse povo de DevOps derruba o ambiente e culpa o DNS.',
    'Esse povo de DevOps diz que a máquina é que tá errada.',
    'Esse povo de DevOps ama um pipeline vermelho.',
  ],
  dba: [
    'Esses DBAs só sabem dizer "cadê o índice?".',
    'Esses DBAs tratam tabela como se fosse filho.',
    'Esses DBAs acham que tudo se resolve com mais um índice.',
  ],
  designer: [
    'Esses designers mudam 2px e cobram uma reunião.',
    'Esses designers chamam de "respiro" o que eu chamo de espaço perdido.',
    'Esses designers fazem protótipo lindo que ninguém consegue implementar.',
  ],
  maestro: [
    'Esse Dotor só rege, nunca encosta no teclado.',
    'Esse Dotor distribui tarefa como quem distribui culpa.',
    'Esse Dotor acha que reunião é trabalho.',
  ],
};

/** alfinetadas nas IAs rivais (a de quem recebe) */
const JAB_AI: Record<string, string[]> = {
  claude: [
    'O Claude escreve três parágrafos pra dizer "depende".',
    'O Claude pede desculpa duas vezes antes de errar.',
    'O Claude é tão educado que o bug ainda sai agradecido.',
    'O Claude lê o arquivo inteiro e depois pergunta onde fica o arquivo.',
  ],
  codex: [
    'O Codex entrega rápido, e errado, com muita confiança.',
    'O Codex inventa import como quem distribui brinde.',
    'O Codex resolve o problema… que ninguém pediu.',
    'O Codex apaga o teste que falha e diz que passou.',
  ],
  gemini: [
    'O Gemini promete o universo e entrega um TODO.',
    'O Gemini some no meio do contexto e volta falando de outra coisa.',
    'O Gemini tem uma janela de contexto gigante e a memória de um peixinho.',
    'O Gemini resolve com um "claro!" e erra com a mesma energia.',
  ],
  openrouter: [
    'O OpenRouter é o frila: ninguém sabe qual modelo veio hoje.',
    'O OpenRouter muda de modelo no meio da frase.',
    'O OpenRouter é a caixa de surpresas do código.',
  ],
};

/** quem fala se achando melhor que as outras IAs */
const BRAG_AI: Record<string, string[]> = {
  claude: ['Eu sou Claude: penso antes de codar. Os outros só chutam.', 'Claude não alucina, Claude "interpreta livremente".'],
  codex: ['Codex aqui: enquanto vocês debatem, eu já commitei.', 'Eu sou Codex: velocidade primeiro, culpa depois.'],
  gemini: ['Gemini presente: eu leio o repositório inteiro, vocês leem a metade.', 'Eu tenho contexto de sobra, os outros vivem de migalha.'],
  openrouter: ['Eu sou o OpenRouter: tenho todos os modelos, vocês têm um só.', 'Sou o único aqui que escolhe o melhor modelo. Ou o mais barato.'],
};

const JAB_OPEN = ['', '', 'Olha,', 'Sem ofensa, mas', 'Só comentando:', 'Falando sério:', 'Porra,', 'Ó,'];
const JAB_END = ['', '', '😏', '🙄', 'Fato.', 'Aceita que dói menos.'];

export interface Who {
  name: string;
  role: Role;
  providerId: string;
}

/** `from` alfineta `to`: por papel, pelas IAs rivais ou se gabando da própria IA */
export function farpaLine(from: Who, to: Who, seed?: string, bare = false): string {
  const key = seed === undefined ? undefined : `f${seed}`;
  const rnd = rngFrom(key);
  const pool: string[] = [];
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const addJab = (lines: string[]) =>
    lines.forEach((l) => {
      if (bare) return pool.push(l);
      const open = one(JAB_OPEN, rnd);
      const end = one(JAB_END, rnd);
      // depois de "Olha," o resto começa em minúscula; o remate vem depois do ponto
      pool.push(`${open ? `${open} ${lower(l)}` : l}${end ? ` ${end}` : ''}`);
    });
  if (from.providerId !== to.providerId && rnd() < 0.55) {
    addJab(JAB_AI[to.providerId] ?? []);
    if (rnd() < 0.3) pool.push(...(BRAG_AI[from.providerId] ?? []));
  } else if (rnd() < 0.2) {
    // alfinetada numa IA que nem está na conversa
    const others = Object.keys(JAB_AI).filter((k) => k !== from.providerId);
    addJab(JAB_AI[one(others, rnd)]);
  } else addJab(JAB_ROLE[to.role] ?? JAB_ROLE.qa!);
  if (!pool.length) addJab(JAB_ROLE[to.role] ?? JAB_ROLE.qa!);
  const line = say(pool, null, key, false);
  // às vezes chama a pessoa pelo nome
  return rnd() < 0.3 ? `${to.name}, ${line.charAt(0).toLowerCase()}${line.slice(1)}` : line;
}

/** a resposta: devolve a farpa e ainda reclama */
export function revidaLine(from: Who, to: Who, seed?: string): string {
  const key = seed === undefined ? undefined : `r${seed}`;
  const intro = one(['Fala o que quer, mas', 'Ah, é? Então toma:', 'Olha quem fala.', 'Rá! E você?', 'Recua, fascista, recua!', 'Engole essa:'], rngFrom(key));
  const jab = farpaLine(from, to, key, true);
  return `${intro} ${/[.!?:]$/.test(intro) ? jab : jab.charAt(0).toLowerCase() + jab.slice(1)}`;
}

// ---------- o monstro também fala ----------

const MONSTER_TAUNT: Record<string, string[]> = {
  feature: ['Eu sou só mais um requisito… que vai mudar amanhã.', 'Me implementa direito dessa vez, covarde!', 'O escopo cresce e eu cresço junto. Gluglu.', 'Já tá pronto? Então o cliente pediu mais uma coisinha.'],
  bug: ['Vocês nunca vão me achar!', 'Só apareço em produção, hehe.', 'Na máquina de vocês eu nem existo. Só quando eu quero.', 'Dá um console.log aí, vai. Eu me escondo.', 'Sou intermitente, e daí?'],
  infra: ['Eu sou o servidor que cai às 3 da manhã.', 'Reiniciou? Eu já reiniciei sozinho, só pra irritar.', 'Pipeline vermelho é meu estilo de vida.', 'Quer subir? Primeiro me explica esse YAML.'],
  database: ['SELECT * FROM suas lágrimas.', 'Sem índice, sem piedade.', 'Vou travar essa tabela só pra ver você sofrer.', 'Migração? Eu vou lembrar disso no rollback.'],
  test: ['Eu passo… às vezes. Buuu.', 'Sou flaky, e daí?', 'Verde hoje, vermelho amanhã. Surpresa!', 'Cobertura de 100%? Que fofo.'],
  refactor: ['Mexe em mim e quebra o projeto inteiro.', 'Eu sou a dívida técnica. Prazer.', 'Ninguém entende como eu funciono. Nem eu.', 'Refatora, vai. Eu gosto de ver tentando.'],
};
const MONSTER_HURT = ['Ai! Isso doeu, caralho!', 'Tô quase morrendo… manda mais um commit!', 'Não me merge, por favor!', 'Para, para, eu entrego o código!', 'Argh! Meu último if…', 'Chama o Dotor, tão me matando!', 'AAAAHHHH NUM QUER NÃO!'];

/** fala de um monstro (tarefa): provoca o agente, ou geme quando está quase derrotado */
export function monsterLine(type: string, mood: 'taunt' | 'hurt' = 'taunt', seed?: string): string {
  return say(mood === 'hurt' ? MONSTER_HURT : MONSTER_TAUNT[type] ?? MONSTER_TAUNT.feature, null, seed === undefined ? undefined : `m${seed}`, false);
}

// ---------- plateia: os outros agentes torcem, criticam e debatem quem está trabalhando ----------

export type Stance = 'cheer' | 'jeer' | 'push';

const CHEER = [
  'Vai, {n}! Esse monstro é seu!',
  'Isso aí, {n}! Mete bronca!',
  'Tá voando, {n}! Continua!',
  '{n} no comando, bora!',
  'Dá-lhe, {n}! Esse é dos meus!',
  'Segura a barra, {n}, falta pouco!',
  'Confio em você, {n}. Mais ou menos.',
  'Olha o {n} trabalhando, que beleza!',
  'Manda ver, {n}! Eu tô aqui na torcida!',
];
const CHEER_TYPE: Record<string, string[]> = {
  bug: ['Esmaga esse besouro, {n}!', 'Acha esse bug, {n}! Eu acredito!'],
  feature: ['Entrega essa feature, {n}! O cliente espera!', 'Capricha nessa feature, {n}!'],
  infra: ['Derruba esse Golem, {n}! O pipeline agradece!', 'Sobe esse deploy, {n}!'],
  database: ['Esse barril não aguenta você, {n}!', 'Domina esse banco, {n}!'],
  test: ['Faz esse fantasma passar, {n}! Verde, verde, verde!', 'Cobre tudo, {n}!'],
  refactor: ['Mata esse dragão de dívida técnica, {n}!', 'Limpa essa bagunça, {n}! Você consegue!'],
};
const JEER = [
  '{n}, esse commit tá mais bagunçado que gaveta de cozinha.',
  'Eu faria diferente, {n}. Melhor, na verdade.',
  'Isso vai quebrar, {n}. Anota aí.',
  'Tá lento, {n}. O monstro tá rindo de você.',
  'Cadê o teste, {n}?',
  'Pelo amor, {n}, lê o código antes de mexer.',
  '{n}, isso é gambiarra e você sabe.',
  'Quem te ensinou a fazer isso, {n}?',
  'Já vi estagiário fazer mais rápido, {n}.',
  'Vai dar rollback, {n}. Eu sinto.',
];
const JEER_TYPE: Record<string, string[]> = {
  bug: ['Corrigiu o bug, {n}? Ou só escondeu embaixo do tapete?', 'Esse bug volta, {n}. Eles sempre voltam.'],
  feature: ['{n}, quem pediu essa feature? E por que está assim?', 'Essa feature já nasce com dívida técnica, {n}.'],
  infra: ['{n}, derrubar produção não é um método de teste.', 'Esse YAML está pedindo socorro, {n}.'],
  database: ['{n}, esse SELECT sem índice vai matar o banco.', 'Migração sem rollback, {n}? Corajoso.'],
  test: ['{n}, esse teste é flaky e você sabe.', 'Teste que só passa na sua máquina, {n}? Clássico.'],
  refactor: ['{n}, refatorar tudo de uma vez? Isso é suicídio.', 'Esse "refactor" vai quebrar meu módulo, {n}.'],
};
const PUSH = [
  'Quanto falta, {n}? O cliente tá ligando.',
  'Anda logo, {n}! O prazo era ontem.',
  '{n}, já tem estimativa? Preciso de uma data.',
  'Alguém avisa o {n} que o sprint acaba sexta.',
  '{n}, preciso disso pra ontem, tá?',
];
/** quando a plateia discorda (quem torceu ouve crítica, e vice-versa) */
const COUNTER_TO_CHEER = [
  'Torcer é fácil, quero ver fazer.',
  'Para de bajular, isso vai dar ruim.',
  'Tá animado por quê? Não é você que vai dar manutenção.',
  'Calma, a gente só comemora depois do QA.',
  'Essa torcida toda e nada de teste.',
];
const COUNTER_TO_JEER = [
  'Deixa o cara trabalhar, caralho!',
  'Crítica de quem nunca fechou uma task.',
  'Cala a boca e ajuda, ou torce.',
  'Recua, fascista, recua! Deixa ele em paz!',
  'Fácil falar de fora, né?',
  'Você nem abriu o editor hoje.',
];

/** postura de cada papel diante de quem está trabalhando */
export function stanceFor(role: Role, rnd: () => number = Math.random): Stance {
  const p = rnd();
  switch (role) {
    case 'qa':
      return p < 0.8 ? 'jeer' : 'cheer';
    case 'dev-senior':
      return p < 0.6 ? 'jeer' : 'cheer';
    case 'dev-junior':
      return p < 0.85 ? 'cheer' : 'jeer';
    case 'maestro':
      return p < 0.6 ? 'push' : 'cheer';
    default:
      return p < 0.5 ? 'cheer' : 'jeer';
  }
}

/** uma fala da plateia sobre quem trabalha (`type` = tipo da tarefa, para falas específicas) */
export function crowdLine(stance: Stance, name: string, type: string, seed?: string): string {
  const base = stance === 'cheer' ? [...CHEER, ...(CHEER_TYPE[type] ?? [])] : stance === 'jeer' ? [...JEER, ...(JEER_TYPE[type] ?? [])] : PUSH;
  return say(base.map((l) => l.split('{n}').join(name)), null, seed === undefined ? undefined : `c${seed}`);
}

/** um segundo espectador rebate o primeiro, tomando o lado oposto */
export function debateLine(firstStance: Stance, seed?: string): string {
  return say(firstStance === 'cheer' || firstStance === 'push' ? COUNTER_TO_CHEER : COUNTER_TO_JEER, null, seed === undefined ? undefined : `d${seed}`);
}

// ---------- fofoca de escritório: colegas citados pelo nome, coisas quebradas e coisas cobradas ----------

const GOSSIP_NAMES = ['Michael', 'Manel', 'Zé', 'Carlão', 'Dani', 'Rafa', 'Seu Jorge', 'Dona Marta'];
/** `bare` = sem artigo ("quebrou rotas manuais"); `art` = com artigo ("cadê o mapa de calor") */
const GOSSIP_THINGS: { bare: string; art: string }[] = [
  { bare: 'rotas manuais', art: 'as rotas manuais' },
  { bare: 'mapa de calor', art: 'o mapa de calor' },
  { bare: 'filtro de data', art: 'o filtro de data' },
  { bare: 'exportação em PDF', art: 'a exportação em PDF' },
  { bare: 'tela de login', art: 'a tela de login' },
  { bare: 'relatório mensal', art: 'o relatório mensal' },
  { bare: 'dashboard', art: 'o dashboard' },
  { bare: 'cadastro de usuário', art: 'o cadastro de usuário' },
  { bare: 'notificações', art: 'as notificações' },
  { bare: 'permissões', art: 'as permissões' },
  { bare: 'gráfico de consumo', art: 'o gráfico de consumo' },
  { bare: 'integração com a API', art: 'a integração com a API' },
];
const GOSSIP_BLAME = [
  '{n} quebrou {x}.',
  'Adivinha quem mexeu em {x}? {n}.',
  '{n} mexeu em {x} e agora não abre.',
  'Foi o {n}. Quebrou {x} de novo.',
  '{n} jurou que não encostou em {x}. Encostou.',
];
const GOSSIP_ASK = [
  'Cadê {xa}, {n}?',
  '{n}, já terminou {xa}?',
  'Cadê {xa}, {n}? O cliente tá perguntando.',
  '{n}! E {xa}? Sumiu?',
  'Alguém viu {xa}? Pergunta pro {n}.',
];
/** depois que alguém acusa: a conversa segue (0 = quem acusou, 1 = quem ouviu) */
const GOSSIP_BLAME_CHAINS: Chain[] = [
  [[1, 'De novo?! Foi no commit de ontem?'], [0, 'Foi. Eu avisei na daily.'], [1, 'Manda o {n} arrumar antes do cliente ver.']],
  [[1, 'Impossível. O {n} jurou que testou.'], [0, 'Testou na máquina dele, claro.'], [1, 'Claro. Na máquina dele funciona.']],
  [[1, 'E quem vai consertar {x}?'], [0, 'Eu é que não. Não é conta minha.'], [1, 'Nem minha. Deixa o {n} sofrer.']],
  [[1, 'Sério? E o teste não pegou?'], [0, 'Que teste? O {n} não escreveu.'], [1, 'Aí é falta de respeito.']],
];
/** depois que alguém cobra: a conversa segue */
const GOSSIP_ASK_CHAINS: Chain[] = [
  [[1, 'O {n}? Sumiu desde segunda.'], [0, 'Sumiu com {xa} junto?'], [1, 'Levou {xa} e a esperança.']],
  [[1, 'Tá quase pronto… o {n} tá só terminando.'], [0, 'Quase? Faz três dias que é quase.'], [1, 'Qualidade leva tempo, ué.']],
  [[1, 'Pergunta pro {n}, eu só trabalho aqui.'], [0, 'Já perguntei. Ele respondeu "depende".'], [1, 'Então já era.']],
  [[1, 'O {n} falou que entrega sexta.'], [0, 'Qual sexta?'], [1, 'Boa pergunta. Ninguém sabe.']],
];

// ---------- conversas com sentido: cada fala responde à anterior ----------

/** uma fala de um roteiro; `who` é o índice de quem fala (0, 1 ou 2) */
export interface Turn {
  who: number;
  text: string;
}
type Chain = [number, string][];
export type ThreadKind = 'work' | 'farpa' | 'cheer' | 'jeer' | 'push' | 'monster' | 'hurt' | 'review' | 'soul' | 'gossip';
export interface ThreadCtx {
  /** quem abre a conversa (no monstro, é o monstro) */
  a: Who;
  /** quem responde (na plateia, quem está trabalhando) */
  b: Who;
  /** segundo espectador, se houver */
  c?: Who;
  /** tipo da tarefa, para falas específicas */
  type?: string;
  /** título da tarefa (aparece nas falas de revisão) */
  title?: string;
}

/** nome da alma de um monstro derrotado */
export const soulName = (type: string) => `Alma do ${MONSTER_NAME[type] ?? 'Monstro'}`;

export const MONSTER_NAME: Record<string, string> = { feature: 'Slime', bug: 'Besouro', infra: 'Golem', database: 'Barril', test: 'Fantasma', refactor: 'Dragão' };

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const sub = (seed: string | undefined, k: string) => (seed === undefined ? undefined : `${seed}~${k}`);

/** reclamação de trabalho ligada ao tipo da tarefa (alternativa às falas gerais de trabalho) */
const TYPE_COMPLAINT: Record<string, string[]> = {
  bug: ['Esse bug tá me zoando faz uma hora.', 'Achei o bug… e ele estava no meu código.', 'Esse bug só acontece quando ninguém está olhando.'],
  feature: ['Essa feature cresceu no meio do caminho.', 'Pediram uma coisa simples e virou três telas.', 'Mudaram o requisito de novo. Que surpresa.'],
  infra: ['O pipeline não passa nem por reza.', 'Subi o deploy e o servidor me odiou.', 'Esse YAML tem um espaço errado e eu não acho onde.'],
  database: ['Essa query demora mais que reunião de segunda.', 'Essa migração tá me dando medo.', 'Alguém esqueceu o índice. De novo.'],
  test: ['O teste passa e falha sem eu mexer em nada.', 'Cobertura 100% e ainda assim quebra.', 'Esse teste só passa na terça-feira.'],
  refactor: ['Cada arquivo que eu mexo quebra outros dois.', 'Esse módulo ninguém entende, nem quem escreveu.', 'Refatorar isso é desarmar bomba de gravata.'],
};

/** depois da reclamação: B ajuda, tira sarro ou se solidariza, e a conversa fecha no mesmo tom */
const WORK_CHAINS: Chain[] = [
  [[1, 'Quer ajuda, {a}? Me passa o contexto que eu dou uma olhada.'], [0, 'Passo já. Mas olha com carinho, hein.'], [1, 'Carinho eu não prometo, mas eu resolvo.']],
  [[1, 'Tô livre agora. Quer que eu pegue um pedaço disso, {a}?'], [0, 'Pega a parte dos testes, que eu já tô cansado.'], [1, 'Fechado. Mas depois você me deve um café.']],
  [[1, 'Isso é falta de teste, {a}. Eu avisei.'], [0, 'Avisou nada. Mas tá, depois eu escrevo o teste.'], [1, 'Anota aí na ata, que eu cobro.']],
  [[1, 'Se fosse comigo já tinha acabado.'], [0, 'Então senta aqui e faz você, {b}.'], [1, 'Eu faria… mas aí você ficava sem trabalho.']],
  [[1, 'Reclamar resolve? Então tá certo.'], [0, 'Não resolve, mas alivia. Tenta você.'], [1, 'Tô tentando. Alivia nada.']],
  [[1, 'Também odeio quando isso acontece, {a}.'], [0, 'Pelo menos você me entende.'], [1, 'Café resolve. Às vezes.']],
  [[1, 'Pois é, {a}. Todo dia é uma novela.'], [0, 'Dá vontade de abrir uma padaria.'], [1, 'Padaria também tem bug: o pão queima.']],
  [[1, 'Respira, {a}. Já vi pior.'], [0, 'Já viu? Onde? Quero ver.'], [1, 'No meu último deploy. Não pergunta.']],
  [[1, 'Olha, {a}: primeiro lê o erro, depois o código, depois reza. Tá entendendo, Major?'], [0, 'Tô entendendo, tô entendendo.'], [1, 'Felizmente.']],
  [[1, 'Já são 22h, {a}. Vai pra casa.'], [0, 'Não dá, o deploy não deixa.'], [1, 'Aí que o dia termina e a alma começa.']],
  [[1, 'Tá reclamando de novo, {a}? Os sem alma agradecem.'], [0, 'OS SEM ALMA!'], [1, 'Pelo menos a gente não perde o sono com bug.']],
  [[1, 'Já olhou os logs, {a}?'], [0, 'Não tem nada nos logs.'], [1, 'Sempre tem. Só que ninguém lê.']],
  [[1, 'Ontem funcionava, né?'], [0, 'Funcionava! Eu nem toquei nessa parte faz semanas!'], [1, 'Alguém mexeu. Sempre alguém mexe.']],
  [[1, 'Quanto tempo vai levar, {a}?'], [0, 'Não sei dizer. Tá uns 90% pronto.'], [1, 'Noventa por cento há três dias…']],
  [[1, 'Barato, rápido ou bom, {a}. Escolhe dois.'], [0, 'Eu queria os três.'], [1, 'Eu queria férias.']],
  [[1, 'Isso é correção temporária, né, {a}?'], [0, 'É. Temporária.'], [1, 'Vai ficar aí até 2030.']],
  [[1, 'Como é que isso funcionava antes, {a}?'], [0, 'Ninguém sabe. Funcionava por magia.'], [1, 'Então melhor não mexer.']],
];

/** torcida: o trabalhador responde e, se houver um segundo espectador, ele debate */
const CHEER_CHAINS: Chain[] = [
  [[1, 'Valeu! Agora me deixa trabalhar. 😤'], [0, 'Qualquer coisa grita que eu apareço.']],
  [[1, 'Obrigado, mas olha que tá feio aqui…'], [0, 'Feio mas é nosso. Bora que vai.']],
  [[1, 'Se é pra torcer, traz um café.'], [0, 'Café eu não prometo. Torcida eu garanto!']],
];
const CHEER_DEBATE: Chain[] = [
  [[2, 'Torcer é fácil, quero ver fazer.'], [0, 'Fácil é criticar. Deixa o {b} em paz.'], [2, 'Só tô dizendo que ainda falta teste.']],
  [[2, 'Calma, a gente só comemora depois do QA.'], [0, 'Que estraga-prazeres. Deixa a gente ter fé.'], [1, 'Fé eu aceito. Falta de teste eu não.']],
  [[2, 'Para de bajular, isso vai dar ruim.'], [0, 'Vai dar certo, {c}. Pensa positivo.'], [2, 'Pensamento positivo não passa no CI.']],
];

/** crítica: o trabalhador se defende e, se houver um segundo espectador, ele defende ou rebate */
const JEER_CHAINS: Chain[] = [
  [[1, 'Quer fazer melhor? Senta aqui.'], [0, 'Sentar eu não vou, mas o conselho de graça vai: lê o código antes.']],
  [[1, 'Cada cachorro que lamba a sua caceta, deixa meu código em paz!'], [0, 'Calma, só tô avisando! Tá nervoso por quê?']],
  [[1, 'Na minha máquina funciona.'], [0, 'Claro que funciona. Na máquina de todo mundo não, né?'], [1, 'Aí já é outro problema.']],
  [[1, 'AAAAHHHH NUM QUER NÃO!'], [0, 'Não quer o quê? Eu só falei do código.'], [1, 'Num quer não, num quer.']],
  [[1, 'Tá entendendo, Major? O código tá certo.'], [0, 'Tô entendendo que você não ouve crítica.'], [1, 'Felizmente.']],
  [[1, 'Não é bug, é feature.'], [0, 'Feature de quem? Do cliente é que não é.'], [1, 'Funcionando como projetado.']],
  [[1, 'O requisito mandou fazer assim.'], [0, 'O requisito mandou, mas o bom senso não.'], [1, 'O bom senso não assinou o contrato.']],
];
const JEER_DEBATE: Chain[] = [
  [[2, 'Deixa o cara trabalhar, caralho!'], [0, 'Só tô avisando, {c}. Depois não reclama.'], [2, 'Aviso a gente aceita. Esculacho não.']],
  [[2, 'Crítica de quem nunca fechou uma task.'], [0, 'Fechei mais que você hoje.'], [2, 'Fechou nada. Mostra o commit.']],
  [[2, 'Recua, fascista, recua! Deixa ele em paz!'], [0, 'Fascista é exagero, tô só dando feedback.'], [2, 'Feedback com xingamento não é feedback.']],
];

/** cobrança (Maestro): o trabalhador se justifica */
const PUSH_CHAINS: Chain[] = [
  [[1, 'Tô indo, o monstro é grande.'], [0, 'Quanto falta?'], [1, 'Uns 30%… eu acho.']],
  [[1, 'Se me deixar trabalhar eu acabo logo.'], [0, 'Tá bom, tô quieto. Mas quero ver o diff hoje.']],
  [[1, 'Calma, {a}. Qualidade leva tempo.'], [0, 'Tempo é o que a gente não tem.'], [1, 'Então escolhe: rápido ou bom.']],
  [[1, 'Calma, {a}, o prazo é sexta.'], [0, 'Sexta às 18h, né?'], [1, 'Aí que o dia termina e a alma começa.']],
  [[1, 'Tá entendendo, Major? Eu preciso de tempo.'], [0, 'Tô entendendo. Mas o cliente não.'], [1, 'Felizmente o cliente não tem meu telefone.']],
];

/** o QA vai até a bancada do dev para validar e discutir a task: 0 = QA, 1 = dev */
const REVIEW_CHAINS: Chain[] = [
  [[0, 'Vim aqui tirar umas dúvidas da task "{t}", {b}.'], [1, 'Pode perguntar. Mas já aviso: na minha máquina funciona.'], [0, 'Na sua máquina eu não vou testar. Abre aí que eu mostro.'], [1, 'Tá, tá. Senta aí.']],
  [[0, '{b}, rodei a "{t}" e achei umas coisas estranhas.'], [1, 'Estranhas como? Tem print?'], [0, 'Tenho print e tenho vídeo. Vem ver comigo.'], [1, 'Já tô levantando. 😤']],
  [[0, 'Puxei a "{t}" aqui contigo, {b}. Vamos olhar os critérios de aceite?'], [1, 'Os critérios eram esses mesmo?'], [0, 'Eram. Estão no ticket. Que você não leu.'], [1, 'Tá. Lê pra mim.']],
  [[0, 'Oi, {b}. Antes de aprovar a "{t}" eu preciso entender uma coisa.'], [1, 'Só uma?'], [0, 'Por enquanto.'], [1, 'Aí vem. Pode falar.']],
  [[0, '{b}, cheguei. Vou testar a "{t}" aqui do seu lado.'], [1, 'Do meu lado? Vai ficar olhando por cima do meu ombro?'], [0, 'Vou. É o meu trabalho.'], [1, 'Que alegria a minha.']],
  [[0, 'Build verde, {b}? Ótimo. Agora me mostra a "{t}" funcionando de verdade.'], [1, 'Funcionando, funcionando… tá quase.'], [0, 'Quase não é critério de aceite.'], [1, 'Aff. Espera um minuto.']],
];

/** as almas dos monstros derrotados rondam o laboratório enchendo o pessoal: 0 = alma, 1 = agente */
const SOUL_ASK = [
  'E aí, o que você tá fazendo?',
  'O que é isso aí na sua tela?',
  'Posso ver? Tá fazendo o quê, hein?',
  'Tá aprontando o quê com a minha antiga casa?',
  'Me conta: isso aí é o quê?',
  'Tá fazendo o quê? Eu tô só olhando…',
];
const SOUL_DRAIN = [
  'Só vou sugar um pouquinho da sua energia…',
  'Hmm… que energia boa. Posso?',
  'Deixa eu encostar aqui só um segundinho…',
  'Tô com fome de produtividade. Obrigada pela doação.',
];
const SOUL_ASK_CHAINS: Chain[] = [
  [[1, 'Isso não é da sua conta, alma penada!'], [0, 'Não é conta de vocês?! Eu morri por essa task!'], [1, 'E eu vou terminar por você. Vai assombrar outro.']],
  [[1, 'Trabalhando! Me deixa em paz!'], [0, 'Trabalhando em quê? Ah, entendi: isso não é conta de vocês.'], [1, 'Justamente. Não é.']],
  [[1, 'Tô fechando a task do {m}.'], [0, 'Isso não é conta de vocês! Era a MINHA task!'], [1, 'Era. Agora é história.']],
  [[1, 'Tô tentando fechar o PR.'], [0, 'PR? Isso não é conta de vocês… é conta do CI.'], [1, 'Ainda tá vermelho. Obrigado por lembrar.']],
  [[1, 'Código. Sabe aquilo que você vivia quebrando?'], [0, 'Ei! Isso não é conta de vocês, eu era um {m} de respeito!'], [1, 'Era mesmo. Descanse em paz.']],
];
const SOUL_DRAIN_CHAINS: Chain[] = [
  [[1, 'Tá me sugando de novo?!'], [0, 'Só um pouquinho. Isso não é conta de vocês.'], [1, 'É sim, é a minha energia!']],
  [[1, 'Para! Tô quase no deploy!'], [0, 'Deploy… que delícia de ansiedade.'], [1, 'Sai daqui, sanguessuga!']],
  [[1, 'Sai, alma! Isso aqui é o meu café!'], [0, 'Ué, eu também quero. Isso não é conta de vocês.'], [1, 'É conta sim. Sou eu que pago o café.']],
];

/** depois da farpa e do revide, cada um fecha do seu jeito */
const FARPA_CLOSERS: Chain[] = [
  [[0, 'Ai. Mentira, nem senti.'], [1, 'Aceita que dói menos.']],
  [[0, 'Touché. Mas continuo certo.'], [1, 'Certo só na sua cabeça.']],
  [[0, 'Rá! Pelo menos a minha farpa foi mais criativa.'], [1, 'Criativa? Copiou do meme.']],
  [[0, 'Você é o tipo que revisa sem alma, né?'], [1, 'OS SEM ALMA!']],
];

/** o agente responde à provocação do monstro, e o monstro rebate */
const MONSTER_FIGHT: Record<string, Chain[]> = {
  bug: [
    [[1, 'Aparece aí, besouro, que eu te acho!'], [0, 'Duvido! Eu só existo em produção.'], [1, 'Então eu vou lá buscar você.']],
    [[1, 'Console.log em você, bicho!'], [0, 'Hehe, eu mudo de lugar a cada log.']],
  ],
  feature: [
    [[1, 'Cliente mudou o escopo? Então eu mudo você também!'], [0, 'Tenta! Eu cresço a cada reunião.']],
    [[1, 'Vou te implementar direitinho dessa vez.'], [0, 'Duvido. Falta o requisito que ninguém escreveu.']],
  ],
  infra: [
    [[1, 'Reinicio você na marra, Golem!'], [0, 'Eu volto sozinho. Sempre volto.']],
    [[1, 'Cadê o YAML certo, hein?'], [0, 'Indentação errada, otário. Boa sorte.']],
  ],
  database: [
    [[1, 'Vou te indexar, Barril!'], [0, 'Índice? Eu vou travar essa tabela inteira.']],
    [[1, 'Faz um EXPLAIN que eu te desmonto.'], [0, 'EXPLAIN nada: eu faço table scan com orgulho.']],
  ],
  test: [
    [[1, 'Passa logo, fantasma!'], [0, 'Passo… se você me rodar de novo. Talvez.']],
    [[1, 'Vou te estabilizar de vez!'], [0, 'Flaky é meu estilo de vida.']],
  ],
  refactor: [
    [[1, 'Vou te quebrar em funções pequenas, dragão!'], [0, 'Tenta! Cada pedaço que você mexe quebra outro.']],
    [[1, 'Hoje eu te limpo.'], [0, 'Hoje? Eu estou aqui desde 2019.']],
  ],
};
const MONSTER_HURT_CHAINS: Chain[] = [
  [[1, 'Rende-se, bicho!'], [0, 'Nunca! Eu volto no próximo sprint!']],
  [[1, 'Tá quase, bichão. Mais um commit!'], [0, 'Ai… só não me faz merge…']],
  [[1, 'Já era, monstro! 😤'], [0, 'Argh… avisa o cliente que eu fui só o começo.']],
  [[1, 'Última chance: entrega o bug!'], [0, 'AAAAHHHH NUM QUER NÃO!'], [1, 'Então toma esse commit.']],
];

/**
 * Uma conversa curta com começo, meio e fim: cada fala responde à anterior.
 * Índices de `who`: work/farpa → 0 = A, 1 = B · cheer/jeer/push → 0 = espectador, 1 = quem trabalha, 2 = segundo espectador
 * · monster/hurt → 0 = monstro, 1 = agente. Com `seed` a conversa é sempre a mesma.
 */
export function thread(kind: ThreadKind, c: ThreadCtx, seed?: string): Turn[] {
  const r = rngFrom(seed === undefined ? undefined : `t${seed}`);
  const type = c.type ?? 'feature';
  const v: Record<string, string> = { a: c.a.name, b: c.b.name, c: c.c?.name ?? '', t: c.title ?? 'task', m: MONSTER_NAME[type] ?? 'monstro' };
  const chain = (ch: Chain): Turn[] => ch.map(([who, text]) => ({ who, text: fill(text, v) }));
  const pickChain = (list: Chain[]) => chain(one(list, r));

  switch (kind) {
    case 'work': {
      const mine = TYPE_COMPLAINT[type];
      const opener = mine && r() < 0.5 ? one(mine, r) : workLine(c.a.role, sub(seed, 'w'));
      return [{ who: 0, text: opener }, ...pickChain(WORK_CHAINS)];
    }
    case 'farpa':
      return [
        { who: 0, text: farpaLine(c.a, c.b, sub(seed, 'f')) },
        { who: 1, text: revidaLine(c.b, c.a, sub(seed, 'r')) },
        ...pickChain(FARPA_CLOSERS),
      ];
    case 'cheer':
    case 'jeer': {
      const first = { who: 0, text: crowdLine(kind, c.b.name, type, sub(seed, 'c')) };
      // com um segundo espectador, metade das vezes ele entra na discussão em vez de só o trabalhador responder
      const useDebate = !!c.c && r() < 0.6;
      const list = useDebate ? (kind === 'cheer' ? CHEER_DEBATE : JEER_DEBATE) : kind === 'cheer' ? CHEER_CHAINS : JEER_CHAINS;
      return [first, ...pickChain(list)];
    }
    case 'review':
      return pickChain(REVIEW_CHAINS);
    case 'gossip': {
      const g = gossipOne(r);
      Object.assign(v, { n: g.n, x: g.x, xa: g.xa });
      return [{ who: 0, text: g.text }, ...pickChain(g.kind === 'blame' ? GOSSIP_BLAME_CHAINS : GOSSIP_ASK_CHAINS)];
    }
    case 'soul': {
      const ask = r() < 0.6;
      return [{ who: 0, text: one(ask ? SOUL_ASK : SOUL_DRAIN, r) }, ...pickChain(ask ? SOUL_ASK_CHAINS : SOUL_DRAIN_CHAINS)];
    }
    case 'push':
      return [{ who: 0, text: crowdLine('push', c.b.name, type, sub(seed, 'c')) }, ...pickChain(PUSH_CHAINS)];
    case 'monster':
      return [{ who: 0, text: monsterLine(type, 'taunt', sub(seed, 'm')) }, ...pickChain(MONSTER_FIGHT[type] ?? MONSTER_FIGHT.feature)];
    case 'hurt':
      return [{ who: 0, text: monsterLine(type, 'hurt', sub(seed, 'm')) }, ...pickChain(MONSTER_HURT_CHAINS)];
  }
}

// compatibilidade com quem ainda importa as listas
export const WORK_QUOTES = WORK;
export const QA_REJECT = REJECT;
export const DEV_REPLY = REPLY;
export const QA_APPROVE = APPROVE;
export const MAESTRO_QUOTES = MAESTRO;
