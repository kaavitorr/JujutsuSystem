// ════════════════════════════════════════════════════════════════════════════
// Personalização de HUMANOIDES (feiticeiros) portada VERBATIM do NpcTab.jsx
// (Commission Manager / app Electron). NÃO reescrever os dados. Sync MANUAL.
//   ESTILOS/ESTILO_BONUS = classes (Lutador/Especialista/Estrategista/Sentinela).
//   NIVEL_CE = graus de Energia Amaldiçoada (Iniciante → Especial).
//   TECNICAS_OFENSIVAS/SENTINELA_TECNICAS/SENTINELA_AUX/TECNICAS_AUX = técnicas.
//   MANIPULACAO = manipulações (cada uma concede aspectos/reações + técnicas).
// ════════════════════════════════════════════════════════════════════════════

// ── ESTILOS / classes ──
const ESTILOS = {
  Restringido:  { foco: 'forca', desc: 'Foco em Força',             order: ['forca', 'con', 'agi', 'pres', 'sab', 'int'] },
  Lutador:      { foco: 'escolha', desc: 'Foco em Força OU Agilidade' }, // order definido dinamicamente
  Especialista: { foco: 'int',   desc: 'Foco em Intelecto',          order: ['int', 'con', 'sab', 'pres', 'agi', 'forca'] },
  Estrategista: { foco: 'sab',   desc: 'Foco em Sabedoria',          order: ['sab', 'con', 'int', 'pres', 'agi', 'forca'] },
  Sentinela:    { foco: 'agi',   desc: 'Foco em Agilidade',          order: ['agi', 'con', 'forca', 'pres', 'sab', 'int'] },
};

// ── Bônus por estilo ──
const ESTILO_BONUS = {
  Restringido: { crBonus: 0, hpBonus: 0, danoExtra: null, deslocamento: null, regenND: false, ataquesExtra: 0, caminhos: [], extras: [] },
  Lutador: {
    crBonus: 2, hpBonus: 20, danoExtra: '1d4', deslocamento: null, regenND: false, ataquesExtra: 0,
    caminhos: ['Punho Divergente', 'Demolidor', 'Mestre das Armas', 'Mestre do Fulgor'],
    extras: ['+2 de Classe de Resistência', '+20 Pontos de Vida', 'Ataques causam 1d4 de dano adicional'],
  },
  Especialista: {
    crBonus: 0, hpBonus: 0, danoExtra: null, deslocamento: 15, regenND: false, ataquesExtra: 0,
    caminhos: ['Combatente', 'Dueto Amaldiçoado', 'Executor', 'Marionetista'],
    extras: ['Vantagem em ataques se outra criatura estiver a até 3m do alvo', 'Deslocamento se torna 15'],
  },
  Estrategista: {
    crBonus: 1, hpBonus: 30, danoExtra: null, deslocamento: null, regenND: true, ataquesExtra: 0,
    caminhos: ['Feiticeiro Reverso', 'Mestre de Barreiras', 'Médico de Campo'],
    extras: ['+1 de Classe de Resistência', '+30 Pontos de Vida', 'No início de cada turno, recupera PV igual ao próprio ND'],
  },
  Sentinela: {
    crBonus: 2, hpBonus: 0, danoExtra: '1d4', deslocamento: null, regenND: false, ataquesExtra: 1,
    caminhos: [],
    extras: ['+1 rolagem de ataque (Comum) adicional', '+2 de Classe de Resistência', 'Ataques recebem 1d4 de dano adicional'],
  },
};

// ── Técnicas ofensivas (por grau) ──
const TECNICAS_OFENSIVAS = [
  { grau: '1º', nivelMin: 1,  classe: 'Comum', nome: 'Explosão de Energia', pa: 2,  dano: '2d10',  ataque: 'corpo-a-corpo', alcance: '1,5 metros', tipoDano: 'Contundente, Cortante ou Perfurante', efeito: 'Margem de crítico 19-20. Pode ser à distância (alcance da arma).' },
  { grau: '2º', nivelMin: 3,  classe: 'Comum', nome: 'Impacto Devastador',  pa: 4,  dano: '4d10',  ataque: 'corpo-a-corpo', alcance: '1,5 metros', tipoDano: 'Contundente, Cortante ou Perfurante', efeito: 'Alvo: Salvaguarda de Constituição ou perde a ação bônus até o início do próximo turno.' },
  { grau: '3º', nivelMin: 6,  classe: 'Comum', nome: 'Golpe Impetuoso',     pa: 6,  dano: '4d10',  ataque: 'corpo-a-corpo', alcance: '1,5 metros', tipoDano: 'Contundente, Cortante ou Perfurante', efeito: 'Em acerto crítico, realiza um ataque (Comum) adicional contra o alvo.' },
  { grau: '4º', nivelMin: 9,  classe: 'Comum', nome: 'Foco Destruidor',     pa: 8,  dano: '8d10',  ataque: 'corpo-a-corpo', alcance: '1,5 metros', tipoDano: 'Contundente, Cortante ou Perfurante', efeito: 'Salvaguarda de Força ou empurrado 6m; +2d8 Contundente se bater em estrutura de raio ≥1,5m.' },
  { grau: '5º', nivelMin: 12, classe: 'Comum', nome: 'Ofensiva Absoluta',   pa: 10, dano: '10d10', ataque: 'corpo-a-corpo', alcance: '1,5 metros', tipoDano: 'Contundente, Cortante ou Perfurante', efeito: 'Feita com vantagem, margem de crítico 18-20. Perde 2 de CR até o início do próximo turno.' },
];

// ── Técnicas auxiliares (mapa por nome) ──
const TECNICAS_AUX = {
  'Defesa Sólida': { nome: 'Defesa Sólida', classe: 'Auxiliar', custo: '3 PA', duracao: 'Instantâneo', alcance: 'Pessoal', requisito: 'Reação',
    efeito: 'Quando for alvo de uma jogada de ataque ou técnica (ou de uma Salvaguarda de alvo único contra você), usa a reação para reduzir 10d8 de dano (um ataque apenas). Pode gastar 1 PA para adicionar 2d8 de redução, até no máximo 30d8.' },
  'Investida Focada': { nome: 'Investida Focada', classe: 'Auxiliar', custo: 'Especial', duracao: 'Até o fim do turno atual', alcance: 'Pessoal', requisito: 'Especial',
    efeito: 'Acumula energia nas pernas: +3 metros de deslocamento por 1 PA gasto, até no máximo 30 metros (não dobra em disparada). Não consome ação.' },
  'Salto Concentrado': { nome: 'Salto Concentrado', classe: 'Auxiliar', custo: 'Especial', duracao: 'Instantâneo', alcance: 'Pessoal', requisito: 'Especial',
    efeito: 'Concentra energia nas pernas para um grande salto: 1 PA por 3 metros de pulo. Não consome ação; só no seu turno ou se puder usar deslocamento fora dele.' },
  'Regeneração Constante': { nome: 'Regeneração Constante', classe: 'Auxiliar', custo: '6 PA', duracao: 'Especial', alcance: 'Pessoal', requisito: 'Ação Bônus',
    efeito: 'No início de cada turno recupera 3× o nível em PV; após curar 9× o nível, para (reseta ao acertar um Fulgor Negro). Consome 6 PA no início de cada turno para manter.' },
  'Defesa Absoluta': { nome: 'Defesa Absoluta', classe: 'Auxiliar', custo: '10 PA', duracao: 'Especial', alcance: 'Pessoal', requisito: 'Especial',
    efeito: 'Imunidade a todo dano sem Energia Amaldiçoada e reduz pela metade o dano com Energia Amaldiçoada. Não pode aumentar dados via Explosão Ofensiva nem causar mais que metade da média enquanto ativa. Ativa sem custo de ação; consome 10 PA na ativação e no início de cada turno.' },
};

// ── Técnicas do Sentinela ──
const SENTINELA_TECNICAS = [
  { grau: '1º', nivelMin: 1,  classe: 'Comum', nome: 'Destabilize', pa: 2, dano: '2d10', ataque: 'corpo-a-corpo', alcance: 'Toque', tipoDano: 'Cortante',
    efeito: 'Saca a arma num golpe fluido e gira o corpo acertando as pernas do alvo com a bainha. O alvo faz Salvaguarda de Agilidade para não receber a condição "Caído". · Requisito: Katana, Ação de Poder · Ataque Combinado: Impossível.' },
  { grau: '2º', nivelMin: 3,  classe: 'Comum', nome: 'White Flash', pa: 4, dano: '4d10', ataque: 'corpo-a-corpo', alcance: 'Até 4,5 metros, Linha', tipoDano: 'Cortante',
    efeito: 'Some de vista, aparecendo a 1,5 metro da criatura enquanto embainha a espada e causa o dano da técnica. O alvo faz Salvaguarda de Constituição para não perder metade do deslocamento até o fim do próximo turno dele. · Requisito: Katana, Ação de Poder · Ataque Combinado: Possível.' },
  { grau: '3º', nivelMin: 6,  classe: 'Comum', nome: 'Battō', pa: 6, dano: '6d8', ataque: 'em linha', alcance: 'Movimento, Linha de 4,5m de largura', tipoDano: 'Cortante',
    efeito: 'Circula energia amaldiçoada na bainha e se impulsiona para frente. Todas as criaturas na linha fazem Salvaguarda de Agilidade — sofrem todo o dano se falharem, metade se passarem. · Requisito: Katana, Domínio Simples, Ação de Poder · Ataque Combinado: Possível.' },
  { grau: '4º', nivelMin: 9,  classe: 'Comum', nome: 'Ascendant Blade', pa: 8, dano: '6d10', ataque: 'corpo-a-corpo', alcance: 'Toque', tipoDano: 'Cortante',
    efeito: 'Enquanto a criatura está no seu domínio simples, desaparece e reaparece agachado à frente dela, desferindo um corte de baixo para cima que a arremessa a 30 metros de altura. Se acertá-la de novo com qualquer ataque antes de ela cair, causa 1 dado de dano adicional nesse ataque. · Requisito: Katana, Domínio Simples, Ação de Poder · Ataque Combinado: Impossível.' },
  { grau: '5º', nivelMin: 12, classe: 'Comum', nome: 'Blood Moon', pa: 10, dano: '10d10', ataque: 'corpo-a-corpo', alcance: 'Até 4,5 metros, Linha', tipoDano: 'Cortante',
    efeito: 'Dentro do domínio simples, cria uma lâmina de energia amaldiçoada na katana; quando uma criatura entra na área, desfere 3 cortes quase simultâneos. Após atingir, faz mais duas rolagens de acerto que não causam dano e, ao acertar as 3, impõe "Sangramento" sem Salvaguarda. · Requisito: Katana, Domínio Simples, Ação de Poder · Ataque Combinado: Impossível.' },
  { grau: '6º', nivelMin: 16, classe: 'Comum', nome: 'God Step', pa: 12, dano: '12d6', ataque: 'em emanação', alcance: 'Até 12 metros de raio, Emanação', tipoDano: 'Cortante',
    efeito: 'Expande o domínio simples para 12 metros e desaparece, cortando tudo no interior antes de voltar à posição inicial. Todas as criaturas na área fazem Salvaguarda de Agilidade — todo o dano se falharem, metade se passarem; quem falha na primeira recebe automaticamente "Sangramento". · Requisito: Katana, Domínio Simples, Ação de Poder · Ataque Combinado: Impossível.' },
  { grau: '7º', nivelMin: 20, classe: 'Comum', nome: 'Heavenly Moon Strike', pa: 14, dano: '14d10', ataque: 'em linha', alcance: 'Até 18 metros, Linha', tipoDano: 'Cortante',
    efeito: 'Expande o domínio simples para 18 metros e se impulsiona na direção de uma criatura com um corte vertical que tenta parti-la ao meio. Em acerto crítico, ela faz Salvaguarda de Constituição ou perde um membro à escolha do Narrador. Se ativar um Fulgor Negro de 20 natural, a cabeça é arrancada. · Requisito: Katana, Domínio Simples, Ação de Poder · Ataque Combinado: Possível.' },
];

// ── Auxiliares do Sentinela (katana) ──
const SENTINELA_AUX = [
  { nivelMin: 1,  nome: 'Hazy Moon', classe: 'Auxiliar', custo: '5 PA', duracao: 'Até 1 minuto', alcance: 'Pessoal', requisito: 'Katana, Ação Bônus',
    efeito: 'Cria uma lâmina de energia amaldiçoada envolvendo a arma (ou substituindo uma lâmina quebrada). Enquanto ativa: seu dano aumenta em um passo (ex.: d8 → d10) e você recebe vantagem em uma rolagem de acerto por rodada.' },
  { nivelMin: 3,  nome: 'Yuzuki', classe: 'Auxiliar', custo: '6 PA', duracao: 'Até o início do seu próximo turno', alcance: 'Pessoal', requisito: 'Katana, Reação',
    efeito: 'Cria uma forma inicial de domínio simples; ao ativar, role 1d20 + seu modificador de Agilidade. Toda rolagem de ataque cujo dado seja menor que esse resultado é bloqueada/erra. Não afeta rolagens de 20 natural.' },
  { nivelMin: 6,  nome: 'Six Blades', classe: 'Auxiliar', custo: '4 PA', duracao: 'Instantâneo', alcance: 'Toque', requisito: 'Katana, Domínio Simples, Ação Bônus',
    efeito: 'Desfere 6 ataques quase simultâneos contra a criatura, perfurando pontos críticos. Ela faz Salvaguarda de Constituição para não receber a condição "Paralisado" até o fim do próximo turno dela.' },
  { nivelMin: 9,  nome: 'Madara', classe: 'Auxiliar', custo: '15 PA', duracao: 'Especial', alcance: 'Pessoal', requisito: 'Katana, Domínio Simples, Ação de Poder',
    efeito: 'Com o domínio simples ativo, faz surgir diversos domínios ao seu redor num raio de 9 metros. Todo ataque feito contra você dentro da área é bloqueado (dano 0) e você responde com um ataque (Comum ou de Técnica) sem consumir ação, ainda pagando o custo do ataque. Consome 6 PA no início de cada turno para manter.' },
  { nivelMin: 12, nome: 'Steel Heart', classe: 'Auxiliar', custo: '15 PA', duracao: 'Até 1 minuto', alcance: 'Toque', requisito: 'Katana, Ação de Poder',
    efeito: 'Fortalece o corpo com energia amaldiçoada: enquanto ativa, imunidade a danos críticos (não engloba Fulgor), Feridas Brutais e Ferimentos Persistentes. Além disso, não pode receber mais de 50 Pontos de Dano por vez.' },
];

// ── Ações de Poder / Reações comuns ──
const ACOES_PODER = [
  { nome: 'Ataque com Asas', animal: true, nota: 'Aumenta o dano efetivo por rodada (acerta 2 alvos)', desc: 'Bate as asas. Cada alvo a até 6m faz Salvaguarda de Agilidade ou sofre dano Contundente e fica Caído. Depois pode voar até metade do deslocamento.' },
  { nome: 'Ataque de Mergulho', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Se estiver voando e mergulhar ≥6m em linha reta e atingir um alvo com ataque corpo-a-corpo, causa dano extra.' },
  { nome: 'Bote Sônico', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Percorre ≥6m em linha reta livre em direção ao alvo e o atinge com ataque corpo-a-corpo, com dano extra. O alvo faz Salvaguarda de Força para não cair. O movimento não provoca ataque de oportunidade.' },
  { nome: 'Bote', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥6m em direção a um alvo e ataca corpo-a-corpo; o alvo faz Salvaguarda de Força ou fica Caído. Se cair, ação bônus para um novo ataque.' },
  { nome: 'Corte Sangrento', nota: null, desc: '1×/turno, após acertar com arma cortante, o alvo faz Salvaguarda de Constituição ou recebe Sangramento. Até 5×/dia, recarrega após descanso longo.' },
  { nome: 'Cuspir Veneno', animal: true, nota: null, desc: 'Ataque à distância (até 6m). Se acertar, o alvo faz Salvaguarda de Constituição ou fica Envenenado por 1 min; depois fica imune ao veneno por 24h.' },
  { nome: 'Descuidado', nota: null, desc: 'No início do turno, ganha vantagem em todos os ataques corpo-a-corpo no turno, mas os ataques contra ela têm vantagem até o início do próximo turno.' },
  { nome: 'Impacto Atordoante', nota: 'Aumenta o bônus de ataque efetivo em 3', desc: '1×/rodada, ao causar dano Contundente, o alvo faz Salvaguarda de Constituição ou fica Atordoado até o fim do próximo turno dele.' },
  { nome: 'Inflar', animal: true, nota: null, desc: 'Aumenta o tamanho para "Enorme" e não recebe dano de queda.' },
  { nome: 'Investida Derrubadora', nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥3m em direção a um alvo e ataca corpo-a-corpo, causando dano Contundente extra. Se for criatura, faz Salvaguarda de Força (CD) ou é empurrada 6m e cai.' },
  { nome: 'Investida', nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥3m em direção a um alvo e ataca corpo-a-corpo, causando dano extra.' },
  { nome: 'Soltar Tinta', animal: true, nota: null, desc: 'Ação: solta tinta num cone de 6m. Todo alvo na área que use os olhos faz Salvaguarda de Agilidade ou fica Cego até limpar a tinta ou ser coberto por água corrente.' },
  { nome: 'Teia', animal: true, nota: 'Aumenta a CR efetiva em 1', desc: 'Ataque à distância (9/18m) contra alvo Grande ou menor. Se acertar, o alvo fica Impedido. Com uma ação, faz Teste de Força para escapar. A teia tem CR 10, 5 PV, resistência a Contundente e imunidade a Psíquico e Veneno.' },
  // ── Novos traços ─────────────────────────────────────────────────────────
  { nome: 'Ferrão Venenoso', animal: true, nota: null, desc: 'Ataque corpo-a-corpo. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" por 1 minuto.' },
  { nome: 'Cauda Constritora', animal: true, nota: 'Aumenta o dano efetivo por rodada', desc: 'Ataque corpo-a-corpo com a cauda contra um alvo Grande ou menor. Se acertar, o alvo recebe a condição "Agarrado" e sofre o dano da cauda novamente no início de cada turno do espírito enquanto permanecer preso.' },
  { nome: 'Investida com Chifres', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move-se ao menos 3 metros em direção a um alvo e o ataca corpo-a-corpo, causando dano extra. Se for uma criatura, ela faz Salvaguarda de Força ou é empurrada 3 metros e recebe a condição "Caído".' },
  { nome: 'Pinça Esmagadora', animal: true, nota: null, desc: 'Ataque corpo-a-corpo. Em caso de acerto contra um alvo Grande ou menor, ele recebe a condição "Agarrado"; enquanto estiver preso, tem desvantagem em ataques que não sejam contra o espírito.' },
  { nome: 'Guincho Ensurdecedor', animal: true, nota: null, desc: 'Solta um guincho agudo. Todas as criaturas a até 6 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Surdo" até o fim de seu próximo turno.' },
  { nome: 'Mordida Dilacerante', animal: true, nota: 'Aumenta o dano efetivo por rodada', desc: 'Ataque corpo-a-corpo. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sangramento".' },
  { nome: 'Salto Predatório', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Salta até 6 metros em direção a um alvo e o ataca corpo-a-corpo com dano extra. Se acertar, o alvo faz Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Descarga Elétrica', animal: true, nota: null, desc: 'Ataque corpo-a-corpo carregado de eletricidade. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Golpe Esmagador', nota: 'Aumenta o dano efetivo por rodada', desc: '1×/rodada, ao causar dano Contundente, o alvo Grande ou menor deve realizar uma Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Finta Brutal', nota: 'Aumenta o bônus de ataque efetivo em 2', desc: 'O espírito engana o alvo com um movimento falso. Sua próxima rolagem de ataque contra essa criatura neste turno é feita com vantagem.' },
];

const REACOES = [
  { nome: 'Apanhar Pedra', nota: null, desc: 'Ao ser alvo de pedras grandes ou objeto similar, com Salvaguarda de Força bem-sucedida apanha o projétil sem sofrer dano Contundente dele.' },
  { nome: 'Aparar', nota: 'Aumenta a CR efetiva em 1', desc: 'Adiciona +5 à CR contra um ataque corpo-a-corpo que poderia atingi-la. Precisa ver o atacante e empunhar arma corpo-a-corpo.' },
  { nome: 'Ataque de Oportunidade Superior', nota: 'Aumenta o bônus de ataque efetivo em 2', desc: 'Se um alvo sair do alcance voluntariamente (mesmo sem provocar), faz ataque corpo-a-corpo. Se acertar, o deslocamento da criatura vira 0 até o fim da rodada.' },
  { nome: 'Ataque de Oportunidade Traiçoeiro', nota: 'Aumenta o bônus de ataque efetivo em 3', desc: 'Faz ataque de oportunidade quando um inimigo visível se move para fora OU para dentro do seu alcance corpo-a-corpo.' },
  { nome: 'Ataque de Oportunidade Orgulhoso', nota: 'Aumenta o bônus de ataque efetivo em 2', desc: 'Se um alvo atacar outra criatura (que não você) a até 1,5m, faz ataque corpo-a-corpo contra o alvo.' },
  { nome: 'Ataque de Oportunidade', nota: 'Aumenta o bônus de ataque efetivo em 1', desc: 'Faz ataque de oportunidade corpo-a-corpo quando um inimigo visível se move para fora do seu alcance.' },
  { nome: 'Defletir Projéteis', nota: 'Aumenta a CR efetiva em 2', desc: 'Ao ser atingido por ataque à distância, empunhando arma corpo-a-corpo e vendo o atacante, defleti todos os projéteis do turno; o dano é reduzido em 4d10. Se reduzir a zero, o ataque é evitado.' },
  { nome: 'Redirecionar Ataque', nota: null, desc: 'Ao receber um ataque visível, escolhe uma criatura aliada de ND menor a até 1,5m. As duas trocam de lugar e a aliada vira o alvo.' },
];

// ── Graus de Energia Amaldiçoada ──
const BCP = ['Contundente', 'Cortante', 'Perfurante'];
const NIVEL_CE = {
  '':          { label: '— sem proficiência —', ndEfetivo: 0, hpTemp: 0, hpFixo: 0, resist: [], resistAll: false, cdBonus: 0, crBonus: 0, danoDados: 0, critMin: 20, extras: [] },
  iniciante:   { label: 'Iniciante (ND efetivo +1)', ndEfetivo: 1, hpTemp: 20, hpFixo: 0, resist: BCP, resistAll: false, cdBonus: 0, crBonus: 0, danoDados: 0, critMin: 20,
                 extras: ['ND efetivo +1', 'Recebe 20 Pontos de Armadura + resistência a todo dano exceto Verdadeiro enquanto durarem'] },
  feiticeiro4: { label: 'Feiticeiro de 4º Grau (ND efetivo +2)', ndEfetivo: 2, hpTemp: 30, hpFixo: 0, resist: BCP, resistAll: false, cdBonus: 1, crBonus: 0, danoDados: 1, critMin: 20,
                 extras: ['ND efetivo +2', 'CD +1', '+1d4 de dano em todos os ataques', 'Recebe 30 Pontos de Armadura + resistência a todo dano exceto Verdadeiro enquanto durarem', 'É capaz de sentir Energia Amaldiçoada em 9 metros de emanação ao seu redor e recebe +3 de percepção contra furtividade nessa área.'] },
  feiticeiro3: { label: 'Feiticeiro de 3º Grau (ND efetivo +3)', ndEfetivo: 3, hpTemp: 40, hpFixo: 0, resist: BCP, resistAll: false, cdBonus: 2, crBonus: 0, danoDados: 2, critMin: 20,
                 extras: ['ND efetivo +3', 'CD +2', '+2d4 de dano em todos os ataques', 'Recebe 40 Pontos de Armadura + resistência a todo dano exceto Verdadeiro enquanto durarem', 'É capaz de sentir Energia Amaldiçoada em 18 metros de emanação ao seu redor e recebe +4 de percepção contra furtividade nessa área.'] },
  feiticeiro2: { label: 'Feiticeiro de 2º Grau (ND efetivo +4)', ndEfetivo: 4, hpTemp: 50, hpFixo: 0, resist: BCP, resistAll: false, cdBonus: 3, crBonus: 0, danoDados: 2, critMin: 20,
                 extras: ['ND efetivo +4', 'CD +3', '+2d4 de dano em todos os ataques', 'Recebe 50 Pontos de Armadura + resistência a todo dano exceto Verdadeiro enquanto durarem', 'É capaz de sentir Energia Amaldiçoada em 24 metros de emanação ao seu redor e recebe +5 de percepção contra furtividade nessa área.'] },
  feiticeiro1: { label: 'Feiticeiro/Maldição de 1º Grau (ND efetivo +5)', ndEfetivo: 5, hpTemp: 0, hpFixo: 60, resist: [], resistAll: true, cdBonus: 4, crBonus: 3, danoDados: 3, critMin: 20, acertoBonus: 3,
                 extras: ['ND efetivo +5', '+60 PV', 'CD +4', 'CR +3', 'Resistência a TODOS os tipos de dano', 'Recebe +3 de acerto', '+3d4 de dano em todos os ataques', 'Recebe acesso a Explosão Ofensiva e Defensiva e; Energia Reversa', 'É capaz de sentir Energia Amaldiçoada em 30 metros de emanação ao seu redor e recebe +6 de percepção contra furtividade nessa área.'] },
  especial:    { label: 'Feiticeiro/Maldição de Grau Especial (ND efetivo +6)', ndEfetivo: 6, hpTemp: 0, hpFixo: 100, resist: [], resistAll: true, cdBonus: 6, crBonus: 3, danoDados: 4, critMin: 20, acertoBonus: 5,
                 extras: ['ND efetivo +6', '+100 PV', 'CD +6', 'CR +3', 'Resistência a TODOS os tipos de dano', 'Recebe +5 de acerto', '+4d4 de dano em todos os ataques', 'Recebe acesso a Explosão Ofensiva e Defensiva e; Energia Reversa', 'Recebe por padrão: Reversão de Feitiço, Foco Extremo, Ofensiva Extrema, Negação de Energia e Muralha de Energia', 'É capaz de sentir Energia Amaldiçoada em 120 metros de emanação ao seu redor e recebe +6 de percepção contra furtividade nessa área.'] },
};

// ── Manipulações ──
const MANIPULACAO = [
  { nome: 'Defesa de Energia', tier: 'Básica',   ndMin: 0,  desc: 'Reduz pela metade todo dano que NÃO seja Energia Amaldiçoada; recebe a técnica "Defesa Sólida".',
    tecnicas: ['Defesa Sólida'],
    concede: [
      { nome: 'Defesa de Energia', tipo: 'aspecto', desc: 'Reduz pela metade todo dano sem energia amaldiçoada (disparos de armas de fogo, armas mundanas sem Energia Amaldiçoada imbuída).' },
    ] },
  { nome: 'Espada e Escudo',   tier: 'Básica',   ndMin: 0,  desc: 'Recebe as manipulações "Explosão Ofensiva" e "Explosão Defensiva".',
    tecnicas: ['Salto Concentrado', 'Investida Focada'],
    concede: [
      { nome: 'Explosão Ofensiva', tipo: 'aspecto', desc: 'Adiciona até (bônus de proficiência) d4 de dano no próximo ataque ou técnica, consumindo 1 PA por dado aumentado.' },
      { nome: 'Explosão Defensiva', tipo: 'aspecto', desc: 'Gasta 1 PA para reduzir 1d4 de dano sofrido — ou 2 dados de redução à próxima técnica de redução — até o máximo da Energia Amaldiçoada disponível na rodada. A versão de 2 dados não funciona em técnicas que reduzem dano por d8 fixo.' },
    ] },
  { nome: 'Envolver',          tier: 'Avançada', ndMin: 0,  desc: 'Recebe a manipulação "Envolver Objeto".',
    concede: [{ nome: 'Envolver Objeto', tipo: 'aspecto', desc: 'Você pode envolver objetos com sua energia amaldiçoada para desencadear efeitos, desde aumentar sua defesa até aprimorar seu dano. Você pode aplicar DOIS dos seguintes efeitos em um objeto envolvido: • a Classe de Resistência do objeto se torna igual à sua; • o objeto passa a dar o dobro de dano em objetos e estruturas; • o objeto recebe 50 Pontos de Armadura (regras do Foco Defensivo); • o dano base do objeto se torna 1d10 e você pode arremessá-lo num alcance de 3 metros × seu nível de Maestria (Cap. 6.5), até no máximo 30 metros.' }] },
  { nome: 'Fluxo',             tier: 'Avançada', ndMin: 0,  desc: 'Foco Agressivo (+1d4 de dano) e Foco Defensivo (Pontos de Armadura) — JÁ embutidos nos números da Classe.',
    concede: [
      { nome: 'Foco Agressivo', tipo: 'aspecto', baked: true, desc: 'Ataques (Comuns) recebem +1d4 de dano. (Já refletido nos números da Classe/ataque.)' },
      { nome: 'Foco Defensivo', tipo: 'aspecto', baked: true, desc: '20 Pontos de Armadura (consumidos antes dos PV temporários, duram até o fim do encontro) + resistência a todos os tipos de dano enquanto durarem; restaurados após 10 min de descanso sem usar Energia Amaldiçoada. (Já refletido nos números da Classe.)' },
    ] },
  { nome: 'Energia Reversa',   tier: 'ND 8+',    ndMin: 8,  desc: 'Recebe a manipulação "Energia Reversa".',
    tecnicas: ['Regeneração Constante'],
    concede: [{ nome: 'Energia Reversa', tipo: 'aspecto', desc: 'Gasta 1 PA para recuperar 1d4 PV, até (2× nível de proficiência) dados por rodada. Usando a Energia Total, cura até 10× o nível de personagem; depois só com energia gerada até descanso longo ou atingir 1 Fulgor Negro.' }] },
  { nome: 'Reversão',          tier: 'ND 8+',    ndMin: 8,  desc: 'Recebe a manipulação "Reversão de Feitiço".',
    concede: [{ nome: 'Reversão de Feitiço', tipo: 'aspecto', desc: 'Cria uma versão alternativa (energia positiva) de uma técnica comum, feitiço inato ou habilidade menor, invertendo seus efeitos (consultar Narrador). Limite de custo = o do feitiço base (feitiço básico: 15 PA, dividido entre as reversões). Não se beneficia do tipo da base. Escolhível até 3×, item diferente a cada vez.' }] },
  { nome: 'Cura Expansiva',    tier: 'ND 8+',    ndMin: 8,  desc: 'Recebe a manipulação "Energia Flexível".',
    concede: [{ nome: 'Energia Flexível', tipo: 'aspecto', desc: 'Permite usar a manipulação "Energia Reversa" (e a técnica "Regeneração Constante") em outras criaturas, com metade do valor da cura.' }] },
  { nome: 'Ímpeto Agressivo',  tier: 'ND 8+',    ndMin: 8,  desc: 'Recebe "Foco Extremo" e "Ofensiva Extrema".',
    concede: [
      { nome: 'Foco Extremo', tipo: 'aspecto', desc: 'Ao realizar uma jogada de acerto, paga 4 PA para que o próximo dano se torne do tipo "Verdadeiro". (Técnica: Ofensiva Absoluta.)' },
      { nome: 'Ofensiva Extrema', tipo: 'aspecto', desc: 'Pode adicionar quantos dados de dano quiser via "Explosão Ofensiva", até o limite da Energia Amaldiçoada gerada disponível; se adicionar mais que seu nível de personagem, sua CR vira 0 até o fim do próximo turno.' },
    ] },
  { nome: 'Ímpeto Defensivo',  tier: 'ND 8+',    ndMin: 8,  desc: 'Recebe "Negação de Energia" e "Muralha de Energia".',
    tecnicas: ['Defesa Absoluta'],
    concede: [
      { nome: 'Negação de Energia', tipo: 'reacao', desc: 'Quando for alvo de um efeito/condição de técnica de Energia Amaldiçoada, paga 8 PA para um Teste Resistido de Constituição (Controle de Energia) contra o teste da criatura inimiga; em sucesso, anula os efeitos.' },
      { nome: 'Muralha de Energia', tipo: 'reacao', desc: '1×/descanso longo: quando for alvo de ataque (Comum/Técnica) ou tiver que fazer Salvaguarda para tomar todo/metade do dano, usa a reação para reduzir a 0 o dano sobre você e toda criatura num cone de 12m atrás de você. (Técnica: Defesa Absoluta.)' },
    ] },
  { nome: 'Reversão Suprema',  tier: 'ND 16+',   ndMin: 16, desc: 'Recebe a manipulação "Reversão Súbita".',
    concede: [{ nome: 'Reversão Súbita', tipo: 'aspecto', desc: 'Ativa e consome 30 PA Total para receber 1 falha automática em uma Salvaguarda de Morte e recuperar-se do "Esgotamento" da expansão de domínio e técnica amaldiçoada. Com 3 falhas na Salvaguarda de Morte, morre ao cair a 0 PV. Essas falhas só somem 1 a cada 3 dias.' }] },
];

// ── Glue p/ o gerador ─────────────────────────────────────────────────────────
const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _ESTILO_REAIS = ['Lutador', 'Especialista', 'Estrategista', 'Sentinela'];

// Salvaguardas proficientes por estilo (Lutador escolhe Força ou Agilidade) — Electron.
const SAVE_PROF = {
  Restringido:  () => ['forca', 'agi', 'con'],
  Lutador:      (foco) => [foco, 'con'],
  Especialista: () => ['int', 'con'],
  Estrategista: () => ['sab', 'con'],
  Sentinela:    () => ['agi', 'con', 'int'],
};
const _saveProf = (est, foco) => (SAVE_PROF[est] || SAVE_PROF.Restringido)(foco || 'forca');

// Dropdowns
export const ESTILOS_HUMANO = [
  ['aleatorio', '🎲 Aleatório'], ['Lutador', '🥊 Lutador (Força/Agi)'], ['Especialista', '🎯 Especialista (Intelecto)'],
  ['Estrategista', '🧠 Estrategista (Sabedoria)'], ['Sentinela', '🗡 Sentinela (Agilidade)'],
];
export const GRAUS_CE = [
  ['', '— sem grau —'], ['iniciante', 'Iniciante (ND +1)'], ['feiticeiro4', '4º Grau (ND +2)'],
  ['feiticeiro3', '3º Grau (ND +3)'], ['feiticeiro2', '2º Grau (ND +4)'], ['feiticeiro1', '1º Grau (ND +5)'], ['especial', 'Especial (ND +6)'],
];
// Lista de manipulações p/ o multi-select (nome/tier/ndMin/desc).
export const MANIPULACOES_LISTA = MANIPULACAO.map(m => ({ nome: m.nome, tier: m.tier, ndMin: m.ndMin, desc: m.desc }));

// Ordem de atributos do estilo (Lutador depende do foco F/A).
export function ordemEstilo(estilo, lutFoco = 'forca') {
  if (estilo === 'Lutador') { const outro = lutFoco === 'forca' ? 'agi' : 'forca'; return [lutFoco, 'con', outro, 'pres', 'sab', 'int']; }
  return (ESTILOS[estilo] && ESTILOS[estilo].order) || ['forca', 'con', 'agi', 'pres', 'sab', 'int'];
}

// Monta tudo do humanoide: bônus de estilo + grau + 3 técnicas mais altas +
// auxiliares (Sentinela + manipulações) + aspectos/reações concedidos.
export function gerarHumanoide({ nd, estilo, lutFoco, grauCE, manipulacoes } = {}) {
  const est = (estilo && estilo !== 'aleatorio' && ESTILO_BONUS[estilo]) ? estilo : _pick(_ESTILO_REAIS);
  const bonus = ESTILO_BONUS[est] || ESTILO_BONUS.Restringido;
  const ce = NIVEL_CE[grauCE || ''] || NIVEL_CE[''];
  const ndN = Math.max(1, Math.round(Number(nd) || 1));
  const lista = est === 'Sentinela' ? SENTINELA_TECNICAS : TECNICAS_OFENSIVAS;
  const tecnicas = lista.filter(t => ndN >= t.nivelMin).slice(-3).map(t => ({ ...t })); // 3 mais altas (Electron)

  const sel = new Set(manipulacoes || []);
  const concedidas = MANIPULACAO.filter(m => sel.has(m.nome)).flatMap(m => m.concede || []);
  const manipAspectos = concedidas.filter(c => c.tipo !== 'reacao' && !c.baked);
  const manipReacoes = concedidas.filter(c => c.tipo === 'reacao');

  const tecAux = MANIPULACAO.filter(m => sel.has(m.nome)).flatMap(m => (m.tecnicas || []).map(n => TECNICAS_AUX[n]).filter(Boolean));
  const tecAuxSent = est === 'Sentinela' ? SENTINELA_AUX.filter(t => ndN >= t.nivelMin) : [];
  const all = [...tecAux, ...tecAuxSent];
  const aux = {
    reacao: all.filter(t => /Reação/.test(t.requisito || '')),
    poder:  all.filter(t => /Ação de Poder/.test(t.requisito || '')),
    outras: all.filter(t => !/Reação|Ação de Poder/.test(t.requisito || '')),
  };
  return { estilo: est, bonus, ce, order: ordemEstilo(est, lutFoco), saves: _saveProf(est, lutFoco), tecnicas, aux, manipAspectos, manipReacoes };
}

export { ESTILOS, ESTILO_BONUS, NIVEL_CE, MANIPULACAO };
