// Gera os feats de Modificadores Lendários + Penalidades Variantes e atualiza
// a macro de importação da personalização 2.0.
const fs = require('fs');
const p = (s) => `<p>${s}</p>`;
const strong = (s) => `<p><strong>${s}</strong></p>`;
const intro = (custo) => p(`Custo: <strong>${custo} Ponto${custo > 1 ? "s" : ""} Lendário${custo > 1 ? "s" : ""}</strong>.`);

const modificadores = [
  { name: "Reencarnação em Objeto Amaldiçoado", pontos: 1,
    texto: p("Você foi um feiticeiro do passado, transformado em um objeto amaldiçoado, e agora sua reencarnação depende de sorte e destino. Seu corpo foi dividido em 20 partes, que podem assumir qualquer forma, desde que sejam do tamanho “Miúdo”.")
    + p("Você começa a aventura no 1º nível, habitando o corpo de um ser que ingeriu uma dessas partes. A cada fragmento recuperado e consumido, você sobe de nível. Caso outra criatura já tenha assimilado uma dessas partes, você pode matá-la para recuperá-la. Ao atingir o 20º nível, você passa a evoluir normalmente, caso a campanha avance para níveis épicos.")
    + strong("Benefício Inerente: você sente partes do seu corpo dentro de 500 metros, desde que não esteja sendo protegida por nenhuma barreira.")
    + intro(1) },
  { name: "Energia Amaldiçoada Variante", pontos: 2,
    texto: p("Sua energia amaldiçoada adotou as propriedades do seu feitiço, fazendo com que ela mudasse suas propriedades mesmo em momentos quando seu feitiço não está sendo utilizado. Você recebe uma das seguintes características dependendo do elemento que seu FEITIÇO INATO utiliza como base:")
    + strong("Energia Venenosa")
    + p("Sua energia amaldiçoada é muito venenosa, fazendo com que o mero toque dela seja o suficiente para incapacitar pessoas comuns. Você recebe as seguintes características:")
    + p("Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Veneno”;")
    + p("Ao atingir uma criatura, você causa +1 de dano de veneno contra ela. Esse dano se acumula em +1 para cada ataque que você atingir sem errá-la, até um máximo igual seu nível de personagem. Ao errar uma rolagem de acerto, esse bônus volta para 0.")
    + strong("Toque Chocante")
    + p("Sua energia amaldiçoada se comporta exatamente igual eletricidade, não existindo bem uma diferenciação entre uma e outra. Você recebe as seguintes características:")
    + p("Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Elétrico”;")
    + p("Ao atingir uma jogada de ataque (Comum) contra a criatura inimiga, você causa o resultado do seu dado de dano principal na vida dela mesmo que ela tenha reduzido seu dano a 0.")
    + strong("Liberação de Calor")
    + p("Sua energia amaldiçoada é extremamente quente, incendiando tudo que toca. Você recebe as seguintes características:")
    + p("Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Fogo”;")
    + p("Sempre que você causar um crítico por excedente, você impõe a condição “Em Chamas” na criatura inimiga se ela falhar em uma Salvaguarda de Constituição.")
    + strong("Frio Absoluto")
    + p("Sua energia amaldiçoada é extremamente fria, congelando tudo que ela entrar em contato. Você recebe as seguintes características:")
    + p("Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Frio”;")
    + p("Ao atingir uma criatura com uma rolagem de ataque, ela recebe 1 Acúmulo de Geada, reduzindo seu deslocamento em 1,5 metros. Ela remove 1 acúmulo no fim de cada um dos turnos dela ou se usar um Ponto de Ação para realizar um Teste de Atributo de Medicina CD 17 em si mesma para remover todos eles.")
    + strong("Eco Trovejante")
    + p("Sua energia amaldiçoada vibra constantemente, fazendo com que seus ataques enviem ondas de choque ao seu redor. Você recebe as seguintes características:")
    + p("Você pode substituir cada um de seus ataques por um ataque a distância de 12 metros ao enviar uma onda de choque contra a criatura. Se você utiliza ondas sonoras ou já tem um ataque a distância de efeito similar, o alcance aumenta em 9 metros adicionais. Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Trovejante”.")
    + strong("Contato Corrosivo")
    + p("Sua energia corrói tudo que toca, derretendo com uma incrível velocidade tudo que não for protegido por energia amaldiçoada. Você recebe as seguintes características:")
    + p("Você pode mudar seu dano de seus ataques (Comuns e de Técnica) para o tipo “Ácido”;")
    + p("Você reduz todo dano sofrido por armas em 2 Pontos de Dano e causa 2 de dano ácido adicional em criaturas de carne e osso. Além disso, você causa o dobro de dano em objetos e estruturas sem energia amaldiçoada.")
    + intro(2) },
  { name: "Redução de Penalidade – Seis Olhos", pontos: 3,
    texto: p("Reduz a penalidade dos Seis Olhos para 2d8 na liberação completa e depois apenas a cada 5 minutos de uso ao invés de a cada rodada. Ele também deixa de causar exaustão no usuário caso ele possua Energia Reversa.")
    + intro(3) },
  { name: "Conhecimento da Alma", pontos: 3,
    texto: p("Você tem um conhecimento instintivo da alma, permitindo que você possa protegê-la de efeitos extremamente prejudiciais de habilidades específicas, assim como te dá certos benefícios:")
    + p("Você tem resistência 20 a dano da alma;")
    + p("Você é capaz de acertar a alma de seres que só podem ser destruídos dessa forma;")
    + p("Você consegue criar objetos amaldiçoados.")
    + intro(3) },
  { name: "Receptáculo Destinado", pontos: 5,
    texto: p("Você não nasceu de uma linhagem poderosa ou com habilidades sobrenaturais, mas possui um corpo físico assustador, capaz de rivalizar com as mais fracas das Restrições Celestiais, além de ter a capacidade de conter maldições em seu corpo com facilidade. Você recebe os seguintes benefícios:")
    + p("Você recebe o benefício de “Conhecimento da Alma”;")
    + p("Sua margem para acertar um Fulgor Negro muda para 19-20;")
    + p("Você aprende automaticamente a habilidade “Abençoado pelas Faíscas Negras”, ignorando seus requisitos.")
    + strong("Requisito: Origem — Receptáculo.")
    + intro(5) },
  { name: "Estrutura Corporal Anômala", pontos: 6,
    texto: p("Seu corpo possui uma forma incomum e extremamente poderosa. Você possui quatro braços, quatro olhos e duas bocas, cada um contribuindo para sua superioridade em combate. Você recebe as seguintes características:")
    + p("Você recebe imunidade a condição Surpreso;")
    + p("Se tiver todos os membros, você pode usar “Ativação Máxima” sem sacrificar nenhum Ponto de Ação;")
    + p("Você recebe 6 Selos adicionais, se tiver a habilidade de selos, e pode utilizá-los com suas mãos adicionais;")
    + p("Você pode ativar outras habilidades do seu feitiço enquanto está recitando um encantamento.")
    + strong("Dificuldade Inerente: você recebe preconceito “Severo”.")
    + intro(6) },
  { name: "Seis Olhos", pontos: 6,
    texto: p("Você é descendente de Sugawara Michizane ou do primeiro portador dos Seis Olhos dentro da lore atual, o que permitiu que herdasse esse traço. Você recebe acesso aos “Seis Olhos” do Clã Gojo sem precisar de rolagem, desde que não pertença a outro clã, podendo, até mesmo, ser um Feiticeiro Inato.")
    + p("Assim como no original, a capacidade de possuir esse benefício depende de não existir outro usuário dos Seis Olhos vivo no momento, então deve ser discutido com o Narrador.")
    + strong("Benefício Inerente: ao pegar esse traço, você ainda está apto a pegar o “Poder da Linhagem” e o talento de origem do “Clã Gojo” caso tenha a origem de poder do clã.")
    + intro(6) },
  { name: "Energia Colossal", pontos: 6,
    texto: p("Você possui uma quantidade imensa de energia amaldiçoada desde o seu nascimento, tornando a utilização de feitiços algo natural para você.")
    + p("Sua quantidade de Energia Amaldiçoada passa a ser 30 vezes o seu nível de personagem, em vez dos 20 atuais, e você recebe 10 PA máximos pelo benefício “Evolução na Prática”, em vez dos 5 que recebe normalmente.")
    + intro(6) }
].map(m => ({ name: m.name, type: "feat", img: "icons/magic/symbols/circled-gem-pink.webp", system: { description: { value: m.texto } },
  flags: { "jujutsu-system": { featureSection: "jj-legendary-modifiers", pontosLendarios: m.pontos } },
  _pasta: "Modificadores Lendários" }));

const penalidades = [
  { name: "Perde 3 dos seus Selos",
    texto: p("Você perde 3 dos seus selos (precisa da habilidade).") + p("Bônus: <strong>1 Ponto Lendário</strong>.") },
  { name: "Perde 2 Habilidades de Especialização",
    texto: p("Você perde 2 Habilidades de Especialização.") + p("Bônus: <strong>2 Pontos Lendários</strong>.") },
  { name: "Sacrifica os benefícios da origem",
    texto: p("Sacrifica todos os benefícios da origem.") + p("Bônus: <strong>2 Pontos Lendários</strong>.") },
  { name: "Perde 2 Pontos de Vida ou 4 de Energia Base",
    texto: p("Você perde 2 Pontos de Vida ou 4 de Energia Base.") + p("Bônus: <strong>2 Pontos Lendários</strong>.") },
  { name: "Perde 1 Ponto de Ação permanente",
    texto: p("Perder um Ponto de Ação [⬢] permanentemente.") + p("Bônus: <strong>2 Pontos Lendários</strong>.") },
  { name: "Vulnerabilidade 10 a danos físicos",
    texto: p("Receber Vulnerabilidade 10 a danos físicos.") + p("Bônus: <strong>3 Pontos Lendários</strong>.") }
].map(m => ({ name: m.name, type: "feat", img: "icons/magic/death/skull-energy-light-white.webp", system: { description: { value: m.texto } },
  flags: { "jujutsu-system": { featureSection: "jj-variant-penalties" } }, _pasta: "Penalidades Variantes" }));

// atualiza o JSON de personalização + reescreve a macro com TUDO
const arquivo = 'packs/_source/personalizacao-2-0.json';
const anterior = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const tudo = [
  ...anterior.defeitos.map(d => ({ ...d, _pasta: "Defeitos" })),
  ...anterior.peculiaridades.map(d => ({ ...d, _pasta: "Peculiaridades" })),
  ...modificadores,
  ...penalidades
];
fs.writeFileSync(arquivo, JSON.stringify({
  ...anterior,
  modificadores: modificadores.map(({ _pasta, ...f }) => f),
  penalidadesVariantes: penalidades.map(({ _pasta, ...f }) => f)
}, null, 2), 'utf8');

const macro = `// ⬇⬇ EXECUTAR COMO GM — importa TODA a personalização 2.0 (defeitos, peculiaridades, modificadores lendários e penalidades variantes)
const pack = game.packs.get("jujutsu-compendium.geral-2-0");
if ( !pack ) return ui.notifications.error("Pack geral-2-0 não encontrado.");
const dados = ${JSON.stringify(tudo, null, 1)};
const criarPasta = async (nome) => {
  const existente = pack.folders.find(f => f.name === nome);
  return existente ?? (await Folder.createDocuments([{ name: nome, type: "Item", folder: null }], { pack: pack.collection }))[0];
};
const pastas = {};
for ( const nome of ["Defeitos", "Peculiaridades", "Modificadores Lendários", "Penalidades Variantes"] ) {
  pastas[nome] = await criarPasta(nome);
}
let criados = 0, pulados = 0;
const nomesExistentes = new Set((await pack.getDocuments()).map(d => d.name));
for ( const dado of dados ) {
  if ( nomesExistentes.has(dado.name) ) { pulados++; continue; }
  const pasta = pastas[dado._pasta];
  await Item.createDocuments([{ name: dado.name, type: dado.type, folder: pasta?.id ?? null,
    system: dado.system, flags: dado.flags }], { pack: pack.collection });
  criados++;
}
ui.notifications.info(\`Personalização 2.0: \${criados} criados, \${pulados} já existiam.\`);`;

fs.writeFileSync('packs/_source/importar-personalizacao-macro.txt', macro, 'utf8');
console.log('macro atualizada:', macro.length, 'chars |', tudo.length, 'feats totais',
  `(modificadores ${modificadores.length}, penalidades variantes ${penalidades.length})`);
