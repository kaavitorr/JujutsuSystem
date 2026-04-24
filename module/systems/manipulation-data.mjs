/**
 * Dados estáticos das Habilidades de Manipulação de Energia (Cap. 6)
 * e dos Treinamentos (Cap. 6.5)
 */

// ============================================================
// HABILIDADES DE MANIPULAÇÃO
// ============================================================

export const MANIPULATION_ABILITIES = {

  // ── BÁSICAS ─────────────────────────────────────────────
  defesaEnergia: {
    category: "basic",
    label: "Defesa de Energia",
    stage: "beginner",
    cost: 3,
    description: "Você reduz todo dano sem energia amaldiçoada pela metade (armas mundanas, disparos de fogo, etc.).",
    techniques: ["Defesa Sólida"],
    requires: { stage: "beginner", abilities: [] }
  },
  fulgorNegro: {
    category: "basic",
    label: "Fulgor Negro",
    stage: "beginner",
    cost: 3,
    description: "Você tem controle suficiente para ativar um Fulgor Negro durante o combate.",
    techniques: [],
    requires: { stage: "beginner", abilities: [] }
  },
  explosaoOfensiva: {
    category: "basic",
    label: "Explosão Ofensiva",
    stage: "beginner",
    cost: 3,
    description: "Adicione até seu bônus de proficiência em dados d4 ao próximo ataque ou técnica. Custo: 1 PA por dado.",
    techniques: ["Explosão de Energia", "Impacto Devastador"],
    requires: { stage: "beginner", abilities: [] }
  },
  explosaoDefensiva: {
    category: "basic",
    label: "Explosão Defensiva",
    stage: "beginner",
    cost: 3,
    description: "Gaste 1 PA para reduzir 1d4 de dano sofrido, ou 2 dados em técnicas de redução. Máximo = PA gerada disponível.",
    techniques: ["Salto Concentrado", "Investida Focada"],
    requires: { stage: "beginner", abilities: [] }
  },
  despertarHabilidade: {
    category: "basic",
    label: "Despertar Habilidade",
    stage: "beginner",
    cost: 3,
    description: "Você pode utilizar sua técnica Inata ou Hereditária em combate.",
    techniques: [],
    requires: { stage: "beginner", abilities: [] }
  },
  ultimoRecurso: {
    category: "basic",
    label: "Último Recurso",
    stage: "expert",
    cost: 6,
    description: "Até 3×/descanso longo: ao sofrer crítico comum, sofra dano normal. Ilimitado contra críticos de técnica (custo: 6 PA).",
    techniques: [],
    requires: { stage: "expert", abilities: ["explosaoDefensiva"] }
  },

  // ── AVANÇADAS ────────────────────────────────────────────
  sentirMaldicao: {
    category: "advanced",
    label: "Sentir Maldição",
    stage: "beginner",
    cost: 3,
    description: "Sente espíritos e energia amaldiçoada em 6m ao redor. Pode adquirir múltiplas vezes (+3m cada).",
    techniques: ["Detecção de Energia"],
    requires: { stage: "beginner", abilities: [] }
  },
  envolver: {
    category: "advanced",
    label: "Envolver",
    stage: "expert",
    cost: 3,
    description: "Envolva objetos com energia para 2 efeitos: equiparar CR, dobrar dano em estruturas, dar 50 Pontos de Armadura, mudar dano base para 1d10 com arremesso.",
    techniques: [],
    requires: { stage: "expert", abilities: [] }
  },
  focoAgressivo: {
    category: "advanced",
    label: "Foco Agressivo",
    stage: "expert",
    cost: 6,
    description: "Seus ataques comuns recebem +1d4 de dano adicional.",
    techniques: ["Ataque Explosivo", "Foco Destruidor"],
    requires: { stage: "expert", abilities: ["explosaoOfensiva"] }
  },
  focoDefensivo: {
    category: "advanced",
    label: "Foco Defensivo",
    stage: "expert",
    cost: 6,
    description: "Cria 20 Pontos de Armadura (como PV temporários, mas coexistem com eles e são consumidos primeiro). Duram até o fim do encontro. Restauram após 10 min sem usar energia.",
    techniques: [],
    requires: { stage: "expert", abilities: ["explosaoDefensiva"] }
  },
  analiceSuperior: {
    category: "advanced",
    label: "Análise Superior",
    stage: "expert",
    cost: 10,
    description: "Quando uma criatura usa uma característica com seu Detectar Energia ativo, faça INT (Feitiço) ou SAB (Sobrenatural) CD=ND para saber exatamente o que ela faz.",
    techniques: [],
    requires: { stage: "expert", abilities: [] }
  },
  fluxoPerfeito: {
    category: "advanced",
    label: "Fluxo Perfeito",
    stage: "expert",
    cost: 10,
    description: "Sua margem de acerto crítico em ataques (comuns e de técnica) torna-se 19–20.",
    techniques: [],
    requires: { stage: "expert", abilities: [] }
  },
  fluxoConstante: {
    category: "advanced",
    label: "Fluxo Constante",
    stage: "expert",
    cost: 10,
    description: "O dano do Foco Agressivo aumenta em um passo de dado e o Foco Defensivo recebe +20 Pontos de Armadura adicionais.",
    techniques: [],
    requires: { stage: "expert", abilities: [] }
  },
  energiaReversa: {
    category: "advanced",
    label: "Energia Reversa",
    stage: "master",
    cost: 10,
    description: "Gaste 1 PA para recuperar 1d4 PV. Máximo por rodada = dobro do bônus de proficiência em dados.",
    techniques: ["Regeneração Constante", "Energia Reversa Avançada"],
    requires: { stage: "master", abilities: ["fluxoPerfeito", "fluxoConstante"] }
  },
  reversaoFeitico: {
    category: "advanced",
    label: "Reversão de Feitiço",
    stage: "master",
    cost: 10,
    description: "Crie uma versão alternativa de uma técnica usando energia positiva (inverte efeitos). Pode ser escolhida até 3 vezes com feitiços diferentes.",
    techniques: [],
    requires: { stage: "master", abilities: ["fluxoPerfeito", "fluxoConstante"] }
  },
  energiaFlexivel: {
    category: "advanced",
    label: "Energia Flexível",
    stage: "master",
    cost: 30,
    description: "Pode usar Energia Reversa em outras criaturas (metade do valor de cura), assim como Regeneração Constante.",
    techniques: [],
    requires: { stage: "master", abilities: ["energiaReversa"] }
  },

  // ── EXTREMAS ─────────────────────────────────────────────
  focoExtremo: {
    category: "extreme",
    label: "Foco Extremo",
    stage: "master",
    cost: 10,
    description: "Gaste 4 PA para tornar seu próximo dano do tipo Verdadeiro.",
    techniques: ["Ofensiva Absoluta"],
    requires: { stage: "master", abilities: [] }
  },
  negacaoEnergia: {
    category: "extreme",
    label: "Negação de Energia",
    stage: "master",
    cost: 15,
    description: "Ao ser alvo de efeito/condição de técnica inimiga, gaste 8 PA para fazer um teste de CON (Controle) contra o teste da criatura. Sucesso: anula.",
    techniques: [],
    requires: { stage: "master", abilities: [] }
  },
  muralhaEnergia: {
    category: "extreme",
    label: "Muralha de Energia",
    stage: "master",
    cost: 15,
    description: "1×/descanso longo: ao ser alvo de ataque ou salvaguarda, use reação para reduzir o dano sobre você e criaturas em cone de 12m atrás a 0.",
    techniques: ["Defesa Absoluta"],
    requires: { stage: "master", abilities: [] }
  },
  ofensivaExtrema: {
    category: "extreme",
    label: "Ofensiva Extrema",
    stage: "master",
    cost: 15,
    description: "Explosão Ofensiva sem limite de dados (até sua PA gerada disponível). Se adicionar mais dados que seu nível, CR = 0 até o fim do próximo turno.",
    techniques: [],
    requires: { stage: "master", abilities: [] }
  },
  reversaoSubita: {
    category: "extreme",
    label: "Reversão Súbita",
    stage: "master",
    cost: 30,
    description: "Consuma 30 PA Total para receber 1 falha automática de Salvaguarda de Morte e recuperar do Esgotamento de domínio/técnica amaldiçoada. Falhas perdem-se 1 a cada 3 dias.",
    techniques: [],
    requires: { stage: "master", abilities: ["energiaReversa"] }
  },

  // ── BARREIRAS ────────────────────────────────────────────
  cortina: {
    category: "barrier",
    label: "Cortina (Véu)",
    stage: "beginner",
    cost: 3,
    description: "Você pode criar uma cortina ou véu, ocultando o que ocorre no interior de criaturas de fora.",
    techniques: [],
    requires: { stage: "beginner", abilities: [] }
  },
  barreiraVazia: {
    category: "barrier",
    label: "Barreira Vazia",
    stage: "expert",
    cost: 6,
    description: "Cria uma Barreira Vazia, tipo de barreira versátil que permite manipular quase livremente o interior.",
    techniques: [],
    requires: { stage: "expert", abilities: ["cortina"] }
  },
  barreiraPura: {
    category: "barrier",
    label: "Barreira Pura",
    stage: "master",
    cost: 15,
    description: "Cria uma Barreira Pura, muito mais poderosa, com diferentes regras e poderes adicionáveis.",
    techniques: [],
    requires: { stage: "master", abilities: ["barreiraVazia"] }
  },
  barreiraBon: {
    category: "barrier",
    label: "Barreira Bon",
    stage: "master",
    cost: 30,
    description: "Cria o tipo mais poderoso de barreira: Barreira Bon.",
    techniques: [],
    requires: { stage: "master", abilities: ["barreiraPura"] }
  }
};

// ============================================================
// TREINAMENTOS
// ============================================================

export const TRAININGS_DATA = {

  // ── GERAIS ───────────────────────────────────────────────
  protecaoEnergia: {
    category: "general",
    label: "Proteção de Energia",
    ptCost: [2, 2, 2],         // PT por rank (base, evolução, perfeição)
    paCost: [20, 40, 40],      // PA por rank
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "CR aumenta em +1 (máx. 25). Sempre aplicado por último.",
    evolutionEffect: "CR aumenta em +2 (máx. 27).",
    perfectionEffect: "CR aumenta em +3 (máx. 30).",
    requires: {}
  },
  impactoEcoante: {
    category: "general",
    label: "Impacto Ecoante",
    ptCost: [2, 2, 2],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Aumente o limite do Explosão Ofensiva ou Queima Agressiva em 2 dados adicionais.",
    evolutionEffect: "Limite aumenta em 4 dados.",
    perfectionEffect: "Limite aumenta em 6 dados.",
    requires: {}
  },
  robusto: {
    category: "general",
    label: "Robusto",
    ptCost: [3, 3, 3],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Receba PV adicionais iguais ao seu nível de personagem.",
    evolutionEffect: "PV adicionais = 2× nível.",
    perfectionEffect: "PV adicionais = 3× nível.",
    requires: {}
  },
  agilidadeAvancada: {
    category: "general",
    label: "Agilidade Avançada",
    ptCost: [3, 3, 3],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Receba +1,5m de deslocamento (máx. 15m).",
    evolutionEffect: "+3m (máx. 15m), ignora reações de movimento como Ataque de Oportunidade.",
    perfectionEffect: "+6m (máx. 15m), ignora Ataque de Oportunidade Superior.",
    requires: {}
  },
  energiaAdaptavel: {
    category: "general",
    label: "Energia Adaptável",
    ptCost: [3, 3, 3],
    paCost: [30, 60, 60],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Receba 3× seu mod. de CON em PV adicionais.",
    evolutionEffect: "4× mod. de CON em PV adicionais.",
    perfectionEffect: "5× mod. de CON em PV adicionais.",
    requires: {}
  },
  energiaBruta: {
    category: "general",
    label: "Energia Brutal",
    ptCost: [4, 4, 4],
    paCost: [40, 80, 80],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Até 3×/descanso longo: role dois dados de dano de um ataque/técnica e escolha o maior.",
    evolutionEffect: "5 vezes por descanso longo.",
    perfectionEffect: "Use em todos os seus ataques.",
    requires: {}
  },
  golpePenetrante: {
    category: "general",
    label: "Golpe Penetrante",
    ptCost: [4, 4, 4],
    paCost: [40, 80, 80],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "+1 de acerto em jogadas de ataque (comuns e de técnica).",
    evolutionEffect: "+2 de acerto.",
    perfectionEffect: "+3 de acerto.",
    requires: {}
  },
  periciaNodavel: {
    category: "general",
    label: "Perícia Notável",
    ptCost: [5, 5, 5],
    paCost: [50, 100, 100],
    baseDC: 15,
    dcIncrement: 5,
    baseEffect: "Ao errar uma habilidade/técnica, pode escolher não consumir PA. Recupera ao final de descanso curto/longo.",
    evolutionEffect: "3×/descanso longo, ao errar, não consome PA.",
    perfectionEffect: "Sempre que errar técnica com acerto, não consome PA. Ilimitado ao errar habilidade/técnica sem resultado.",
    requires: {}
  },
  resistenciaAprimorada: {
    category: "general",
    label: "Resistência Aprimorada",
    ptCost: [5, 5, 5],
    paCost: [50, 100, 100],
    baseDC: 15,
    dcIncrement: 5,
    baseEffect: "+1 Ponto de Armadura (Foco Defensivo) por Nível de Maestria.",
    evolutionEffect: "+2 por nível de maestria.",
    perfectionEffect: "+3 por nível de maestria.",
    requires: {}
  },
  ritmoCombate: {
    category: "general",
    label: "Ritmo de Combate",
    ptCost: [8],
    paCost: [80],
    baseDC: 20,
    dcIncrement: 0,
    baseEffect: "1×/encontro: ao ativar a Zona do Fulgor Negro, pode resetar o Foco Defensivo (recebe todos os PA novamente).",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  reversaoDominada: {
    category: "general",
    label: "Reversão Dominada",
    ptCost: [5],
    paCost: [50],
    baseDC: 18,
    dcIncrement: 0,
    baseEffect: "Ao usar pelo menos 4 PA na Energia Reversa para se curar, adicione seu modificador principal ao resultado.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  fulgorCerteiro: {
    category: "general",
    label: "Fulgor Certeiro",
    ptCost: [8],
    paCost: [80],
    baseDC: 22,
    dcIncrement: 0,
    baseEffect: "Após tirar 20 natural, pode reduzir a margem de acerto crítico do Fulgor Negro para 11–20.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  reversaoDupla: {
    category: "general",
    label: "Reversão Dupla",
    ptCost: [10],
    paCost: [100],
    baseDC: 22,
    dcIncrement: 0,
    baseEffect: "Ao usar Energia Reversa em uma criatura, outra criatura a até 3m recebe metade do valor em PV.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  reversaoOfensiva: {
    category: "general",
    label: "Reversão Ofensiva",
    ptCost: [10],
    paCost: [100],
    baseDC: 22,
    dcIncrement: 0,
    baseEffect: "Pode usar Energia Reversa no lugar de Explosão Ofensiva em ataques comuns (dobro dos d4 como dano em Espíritos). Também aumenta dano de Reversão de Feitiço em 1 dado por PA.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  falhaCritica: {
    category: "general",
    label: "Falha Crítica",
    ptCost: [8],
    paCost: [80],
    baseDC: 22,
    dcIncrement: 0,
    baseEffect: "Quando uma criatura tira 1 natural em salvaguarda contra sua técnica, ela recebe o dobro dos dados de dano.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },

  // ── DOMÍNIO ──────────────────────────────────────────────
  dominioIncompleto: {
    category: "domain",
    label: "Domínio Incompleto",
    ptCost: [10],
    paCost: [150],
    baseDC: 20,
    dcIncrement: 0,
    baseEffect: "Você recebe acesso ao domínio incompleto.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  dominioSimples: {
    category: "domain",
    label: "Domínio Simples",
    ptCost: [8],
    paCost: [80],
    baseDC: 18,
    dcIncrement: 0,
    baseEffect: "Aprende a técnica anti-domínio do Domínio Simples.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  cestaOcaDeVime: {
    category: "domain",
    label: "Cesta Oca de Vime",
    ptCost: [10],
    paCost: [100],
    baseDC: 20,
    dcIncrement: 0,
    baseEffect: "Aprende a técnica anti-domínio da Cesta Oca de Vime.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  emocaoDaFlorCaida: {
    category: "domain",
    label: "Emoção da Flor Caída",
    ptCost: [15],
    paCost: [150],
    baseDC: 22,
    dcIncrement: 0,
    baseEffect: "Aprende a técnica anti-domínio da Emoção da Flor Caída.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  amplificacaoDominio: {
    category: "domain",
    label: "Amplificação de Domínio",
    ptCost: [20],
    paCost: [200],
    baseDC: 26,
    dcIncrement: 0,
    baseEffect: "Aprende a técnica anti-domínio da Emoção da Flor Caída (amplificada). Requer Expansão de Domínio.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: { special: "expansaoDominio" }
  },
  dominioSimplesEstendido: {
    category: "domain",
    label: "Domínio Simples Estendido",
    ptCost: [4, 4, 4],
    paCost: [40, 80, 80],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Aumenta área do domínio simples em +1,5m e alcance de ataques comuns e técnicas associadas.",
    evolutionEffect: "Área do domínio simples passa a ser de 3m.",
    perfectionEffect: "Área do domínio simples passa a ser de 4,5m.",
    requires: {}
  },
  expansaoModificada: {
    category: "domain",
    label: "Expansão Modificada",
    ptCost: [5],
    paCost: [100],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Suas técnicas dentro da expansão de domínio têm CD +1 para tomar dano/condições (não efeitos negativos extras). Requer Expansão de Domínio.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: { special: "expansaoDominio" }
  },
  expansaoFortalecida: {
    category: "domain",
    label: "Expansão Fortalecida",
    ptCost: [8, 8, 8],
    paCost: [120, 240, 240],
    baseDC: 16,
    dcIncrement: 5,
    baseEffect: "Expansão de domínio com barreira mais poderosa: 100 PV fora e 200 PV dentro. Requer Expansão de Domínio.",
    evolutionEffect: "200 PV fora e 350 PV dentro.",
    perfectionEffect: "300 PV fora e 500 PV dentro.",
    requires: { special: "expansaoDominio" }
  },

  // ── IMACULADO ────────────────────────────────────────────
  estiloVersatil: {
    category: "immaculate",
    label: "Estilo Versátil",
    ptCost: [5],
    paCost: [50],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Pode reduzir dados de dano de técnicas do Novo Estilo das Sombras para reduzir o custo em PA pelo mesmo valor (mín. 1 dado).",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  laminaVeloz: {
    category: "immaculate",
    label: "Lâmina Veloz",
    ptCost: [5],
    paCost: [50],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Pode ativar Hazy Moon dentro ou fora do turno sem consumir ação. Recebe +2 nas rolagens de dano.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  }
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Calcula o estágio a partir dos pontos investidos
 */
export function getManipulationStage(pointsInvested) {
  if ( pointsInvested >= 46 ) return "master";
  if ( pointsInvested >= 15 ) return "expert";
  return "beginner";
}

const STAGE_ORDER = { beginner: 0, expert: 1, master: 2 };
const STAGE_LABELS = { beginner: "Iniciante", expert: "Perito", master: "Mestre" };

/**
 * Verifica se uma habilidade pode ser desbloqueada
 */
export function canUnlockAbility(abilityId, actor) {
  const abilityDef = MANIPULATION_ABILITIES[abilityId];
  if ( !abilityDef ) return { can: false, reason: "Habilidade desconhecida" };

  const investedPts = actor.system.manipulation?.pointsInvested ?? 0;
  const currentStage = getManipulationStage(investedPts);
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  const unlockedAbilities = actor.system.manipulation?.abilities ?? {};

  // Já desbloqueada
  if ( unlockedAbilities[abilityId]?.unlocked ) return { can: false, reason: "Já desbloqueada" };

  // Estágio necessário
  const reqStage = abilityDef.requires.stage ?? "beginner";
  if ( STAGE_ORDER[currentStage] < STAGE_ORDER[reqStage] ) {
    return { can: false, reason: `Requer estágio ${STAGE_LABELS[reqStage]}` };
  }

  // Habilidades pré-requisito
  for ( const req of (abilityDef.requires.abilities ?? []) ) {
    if ( !unlockedAbilities[req]?.unlocked ) {
      return { can: false, reason: `Requer: ${MANIPULATION_ABILITIES[req]?.label ?? req}` };
    }
  }

  // PM suficientes
  if ( cursePoints < abilityDef.cost ) {
    return { can: false, reason: `Faltam ${abilityDef.cost - cursePoints} PM` };
  }

  return { can: true };
}

/**
 * Prepara os dados de habilidades de manipulação para o template
 */
export function prepareManipulationAbilities(actor) {
  const result = { basic: {}, advanced: {}, extreme: {}, barrier: {} };
  const unlockedAbilities = actor.system.manipulation?.abilities ?? {};

  for ( const [id, def] of Object.entries(MANIPULATION_ABILITIES) ) {
    const { can, reason } = canUnlockAbility(id, actor);
    const data = {
      ...def,
      stageLabel: STAGE_LABELS[def.stage] ?? def.stage,
      unlocked: unlockedAbilities[id]?.unlocked ?? false,
      canUnlock: can,
      lockReason: reason ?? ""
    };
    result[def.category][id] = data;
  }

  return result;
}

/**
 * Prepara os dados de treinamentos para o template
 */
export function prepareTrainings(actor) {
  const result = { general: {}, domain: {}, immaculate: {} };
  const savedTrainings = actor.system.trainings ?? {};
  const trainingPoints = actor.system.curseResources?.trainingPoints ?? 0;
  const energyTotal = actor.system.energy?.total ?? 0;

  for ( const [id, def] of Object.entries(TRAININGS_DATA) ) {
    const saved = savedTrainings[id] ?? { rank: 0, currentDC: def.baseDC };
    const rank = saved.rank ?? 0;
    const currentDC = saved.currentDC ?? def.baseDC;

    // Calcular custo do próximo rank
    const nextRankIdx = rank; // custo para ir para rank+1
    const nextPtCost = def.ptCost[nextRankIdx] ?? def.ptCost[def.ptCost.length - 1];
    const nextPaCost = def.paCost[nextRankIdx] ?? def.paCost[def.paCost.length - 1];

    // Calcular rank máximo baseado nos efeitos definidos
    const maxRank = def.perfectionEffect !== null ? 3
      : def.evolutionEffect !== null ? 2
      : 1;

    // Verificar se pode treinar
    const canTrain = rank < maxRank &&
      trainingPoints >= nextPtCost &&
      energyTotal >= nextPaCost;

    result[def.category][id] = {
      ...def,
      rank,
      maxRank,
      currentDC,
      nextPtCost,
      nextPaCost,
      canTrain,
      lockReason: !canTrain
        ? (trainingPoints < nextPtCost
          ? `Faltam ${nextPtCost - trainingPoints} PT`
          : `Faltam ${nextPaCost - energyTotal} PA Total`)
        : ""
    };
  }

  return result;
}

