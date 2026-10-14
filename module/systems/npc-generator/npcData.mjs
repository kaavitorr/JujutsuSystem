// Dados e helpers do editor de NPCs (espelham src/database/abateNpcs.js).
// Mantém os MESMOS mapas perícia→atributo e fórmulas de derivação do backend,
// para o editor mostrar os totais ao vivo enquanto o admin preenche.

// Atributos internos (slot int é exibido como INT/Intelecto nas fichas de NPC).
export const NPC_ATTRS = [
  { key: 'forca', label: 'FOR', full: 'Força',        col: 'forca_val' },
  { key: 'agi',   label: 'AGI', full: 'Agilidade',    col: 'agi_val'   },
  { key: 'con',   label: 'CON', full: 'Constituição', col: 'con_val'   },
  { key: 'int',   label: 'INT', full: 'Intelecto',    col: 'int_val'   },
  { key: 'sab',   label: 'SAB', full: 'Sabedoria',    col: 'sab_val'   },
  { key: 'pres',  label: 'PRE', full: 'Presença',     col: 'pres_val'  },
];

// Perícia → atributo governante + rótulo (mesma fonte de periciasData.js).
export const NPC_SKILLS = [
  { key: 'atletismo',       label: 'Atletismo',           attr: 'forca' },
  { key: 'acrobacia',       label: 'Acrobacia',           attr: 'agi'   },
  { key: 'furtividade',     label: 'Furtividade',         attr: 'agi'   },
  { key: 'prestidigitacao', label: 'Prestidigitação',     attr: 'agi'   },
  { key: 'ctrl_energia',    label: 'Controle de Energia',  attr: 'con'   },
  { key: 'feitico',         label: 'Feitiço',             attr: 'int'   },
  { key: 'historia',        label: 'História',            attr: 'int'   },
  { key: 'investigacao',    label: 'Investigação',        attr: 'int'   },
  { key: 'medicina',        label: 'Medicina',            attr: 'int'   },
  { key: 'natureza',        label: 'Natureza',            attr: 'int'   },
  { key: 'intuicao',        label: 'Intuição',            attr: 'sab'   },
  { key: 'percepcao',       label: 'Percepção',           attr: 'sab'   },
  { key: 'provocacao',      label: 'Provocação',          attr: 'sab'   },
  { key: 'sobrenatural',    label: 'Sobrenatural',        attr: 'sab'   },
  { key: 'sobrevivencia',   label: 'Sobrevivência',       attr: 'sab'   },
  { key: 'atuacao',         label: 'Atuação',             attr: 'pres'  },
  { key: 'enganacao',       label: 'Enganação',           attr: 'pres'  },
  { key: 'intimidacao',     label: 'Intimidação',         attr: 'pres'  },
  { key: 'persuasao',       label: 'Persuasão',           attr: 'pres'  },
  { key: 'sorte',           label: 'Sorte',               attr: 'pres'  },
];

// Salvaguardas: uma por atributo.
export const NPC_SAVES = [
  { key: 'forca', label: 'Força'        },
  { key: 'agi',   label: 'Agilidade'    },
  { key: 'con',   label: 'Constituição' },
  { key: 'int',   label: 'Intelecto'    },
  { key: 'sab',   label: 'Sabedoria'    },
  { key: 'pres',  label: 'Presença'     },
];

export const PROF_LEVELS = [
  { v: 0, label: '—' },
  { v: 1, label: 'Proficiente' },
  { v: 2, label: 'Maestria' },
];

// Benefícios automáticos por Grau (espelha GRAU_BENEFITS de abateNpcs.js).
export const GRAU_ZERO = { ndEff: 0, cd: 0, cr: 0, armadura: 0, pvExtra: 0, danoExtra: '', critRange: 20, deteccaoM: 0, percFurt: 0, resistPermanente: false };
export const GRAU_BENEFITS = {
  'Nível Iniciante': { ndEff: 1, cd: 0, cr: 0, armadura: 20, pvExtra: 0,   danoExtra: '',    critRange: 20, deteccaoM: 0,   percFurt: 0, resistPermanente: false },
  '4º Grau':         { ndEff: 2, cd: 1, cr: 0, armadura: 30, pvExtra: 0,   danoExtra: '1d4', critRange: 20, deteccaoM: 9,   percFurt: 3, resistPermanente: false },
  '3º Grau':         { ndEff: 3, cd: 2, cr: 0, armadura: 40, pvExtra: 0,   danoExtra: '2d4', critRange: 20, deteccaoM: 18,  percFurt: 4, resistPermanente: false },
  '2º Grau':         { ndEff: 4, cd: 3, cr: 0, armadura: 50, pvExtra: 0,   danoExtra: '2d4', critRange: 20, deteccaoM: 24,  percFurt: 5, resistPermanente: false },
  '1º Grau':         { ndEff: 5, cd: 4, cr: 3, armadura: 0,  pvExtra: 60,  danoExtra: '3d4', critRange: 19, deteccaoM: 30,  percFurt: 6, resistPermanente: true  },
  'Grau Especial':   { ndEff: 6, cd: 6, cr: 3, armadura: 0,  pvExtra: 100, danoExtra: '4d4', critRange: 18, deteccaoM: 120, percFurt: 6, resistPermanente: true  },
};
export const grauBenefits = (grau) => GRAU_BENEFITS[grau] || GRAU_ZERO;

// Estilo de Combate (espelha ESTILO_BENEFITS de abateNpcs.js).
export const ESTILO_BENEFITS = {
  'Lutador':      { cr: 2, pv: 20, danoExtra: '1d4', deslocamento: null, vantagemAdjacente: false, regenPorNd: false,
                    caminhos: ['Punho Divergente', 'Demolidor', 'Mestre das Armas', 'Mestre do Fulgor'] },
  'Especialista': { cr: 0, pv: 0,  danoExtra: '',    deslocamento: 15,   vantagemAdjacente: true,  regenPorNd: false,
                    caminhos: ['Combatente', 'Dueto Amaldiçoado', 'Executor', 'Marionetista'] },
  'Estrategista': { cr: 1, pv: 30, danoExtra: '',    deslocamento: null, vantagemAdjacente: false, regenPorNd: true,
                    caminhos: ['Feiticeiro Reverso', 'Mestre de Barreiras', 'Médico de Campo'] },
};
export const ESTILOS_LISTA = Object.keys(ESTILO_BENEFITS);
export const estiloBenefits = (e) => ESTILO_BENEFITS[e] || null;
export function estiloBenefitsList(estilo) {
  const eb = estiloBenefits(estilo);
  if (!eb) return [];
  const out = [];
  if (eb.cr) out.push(`Classe de Resistência +${eb.cr}`);
  if (eb.pv) out.push(`+${eb.pv} Pontos de Vida`);
  if (eb.danoExtra) out.push(`+${eb.danoExtra} de dano adicional nos ataques`);
  if (eb.deslocamento != null) out.push(`Deslocamento se torna ${eb.deslocamento}m`);
  if (eb.vantagemAdjacente) out.push('Vantagem em ataques se outra criatura estiver a até 3m do alvo');
  if (eb.regenPorNd) out.push('No início de cada turno, recupera PV igual ao próprio ND');
  return out;
}

// Habilidades de Manipulação (espelha MANIPULACOES de abateNpcs.js).
export const MANIPULACOES = [
  { key: 'defesa_energia',   cat: 'Básica',   label: 'Defesa de Energia',  ndMin: 0,  concede: ['Defesa Sólida'], efeito: 'Reduz pela metade todo dano que não seja de Energia Amaldiçoada' },
  { key: 'espada_escudo',    cat: 'Básica',   label: 'Espada e Escudo',    ndMin: 0,  concede: ['Explosão Ofensiva', 'Explosão Defensiva'] },
  { key: 'deteccao',         cat: 'Avançada', label: 'Detecção',           ndMin: 0,  concede: ['Sentir Maldição'] },
  { key: 'envolver',         cat: 'Avançada', label: 'Envolver',           ndMin: 0,  concede: ['Envolver Objeto'] },
  { key: 'fluxo',            cat: 'Avançada', label: 'Fluxo',              ndMin: 0,  concede: ['Foco Ofensivo', 'Foco Defensivo'] },
  { key: 'energia_reversa',  cat: 'ND 8+',    label: 'Energia Reversa',    ndMin: 8,  concede: ['Energia Reversa'] },
  { key: 'reversao',         cat: 'ND 8+',    label: 'Reversão',           ndMin: 8,  concede: ['Reversão de Feitiço'] },
  { key: 'cura_expansiva',   cat: 'ND 8+',    label: 'Cura Expansiva',     ndMin: 8,  concede: ['Energia Flexível'] },
  { key: 'impeto_agressivo', cat: 'ND 8+',    label: 'Ímpeto Agressivo',   ndMin: 8,  concede: ['Foco Extremo', 'Ofensiva Extrema'] },
  { key: 'impeto_defensivo', cat: 'ND 8+',    label: 'Ímpeto Defensivo',   ndMin: 8,  concede: ['Negação de Energia', 'Muralha de Energia'] },
  { key: 'reversao_suprema', cat: 'ND 16+',   label: 'Reversão Suprema',   ndMin: 16, concede: ['Reversão Súbita'] },
];
function _combinaD4(...fs) {
  let n = 0;
  for (const f of fs) { const m = /^(\d+)d4$/.exec(String(f || '').trim()); if (m) n += parseInt(m[1], 10); }
  return n > 0 ? `${n}d4` : '';
}

// Tipo de NPC.
export const TIPOS_NPC = [
  { v: 'maldicao', label: 'Maldição', desc: 'Espírito amaldiçoado — pega traços animais, ações de criatura, habilidades de espírito e barreiras.' },
  { v: 'humano',   label: 'Humano',   desc: 'Feiticeiro humanoide — simples como ficha de jogador (estilo + manipulação).' },
];

// Traço de Origem de Poder (espelha ORIGEM_BENEFITS de abateNpcs.js).
export const ORIGENS_NPC = ['Corpo Amaldiçoado', 'Receptáculo', 'Restringido', 'Feto Amaldiçoado'];
export const ORIGEM_BENEFITS = {
  'Corpo Amaldiçoado': { pv: 0,  forca: 0, desloc: 0, critFulgor: false, retaliacao: false, concede: [], meioProfFisico: true,
                         nota: 'Até 3 traços animais comuns + 5 específicos. Proficiente +½ prof em Salvaguardas e Testes de Força/Agilidade.' },
  'Receptáculo':       { pv: 0,  forca: 4, desloc: 3, critFulgor: true,  retaliacao: false, concede: [],
                         nota: '+4 Força, +3m de deslocamento, crítico de Fulgor Negro 19-20.' },
  'Restringido':       { pv: 0,  forca: 0, desloc: 0, critFulgor: false, retaliacao: false, concede: [], usarFichaJogador: true,
                         nota: 'Use a ficha de jogador para criar essa origem.' },
  'Feto Amaldiçoado':  { pv: 30, forca: 0, desloc: 0, critFulgor: false, retaliacao: true,  concede: ['Energia Reversa'],
                         nota: '+30 PV. Ao sofrer dano corpo-a-corpo na vida, causa (prof)d4 no atacante. Recebe "Energia Reversa".' },
};
export const origemBenefits = (o) => ORIGEM_BENEFITS[o] || null;
export function origemBenefitsList(origem) {
  const ob = origemBenefits(origem);
  if (!ob) return [];
  const out = [];
  if (ob.forca) out.push(`+${ob.forca} de Força`);
  if (ob.pv) out.push(`+${ob.pv} Pontos de Vida`);
  if (ob.desloc) out.push(`+${ob.desloc}m de deslocamento`);
  if (ob.critFulgor) out.push('Crítico de Fulgor Negro 19-20');
  if (ob.retaliacao) out.push('Retaliação ao sofrer dano corpo-a-corpo: (prof)d4 no atacante');
  if (ob.meioProfFisico) out.push('Proficiente +½ prof em Salvaguardas/Testes de Força e Agilidade');
  for (const t of (ob.concede || [])) out.push(`Concede: ${t}`);
  if (ob.usarFichaJogador) out.push('⚠️ Use a ficha de jogador para esta origem.');
  return out;
}

// Lista legível dos benefícios de um grau (pra UI).
export function grauBenefitsList(grau) {
  const gb = grauBenefits(grau);
  if (!grau) return [];
  const out = [];
  out.push(`ND efetivo do PdN +${gb.ndEff}`);
  if (gb.cd) out.push(`Classe de Dificuldade +${gb.cd}`);
  if (gb.cr) out.push(`Classe de Resistência +${gb.cr}`);
  if (gb.armadura) out.push(`${gb.armadura} Pontos de Armadura (resistência a todo dano enquanto durarem)`);
  if (gb.pvExtra) out.push(`+${gb.pvExtra} Pontos de Vida`);
  if (gb.resistPermanente) out.push('Resistência a todos os tipos de dano (permanente)');
  if (gb.danoExtra) out.push(`+${gb.danoExtra} de dano extra em toda jogada de ataque`);
  if (gb.critRange < 20) out.push(`Margem de crítico ${gb.critRange}-20`);
  if (gb.deteccaoM) out.push(`Detecta energia amaldiçoada em ${gb.deteccaoM}m (+${gb.percFurt} percepção p/ furtividade)`);
  return out;
}

const _int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const _clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const npcMod = (val) => Math.floor((_int(val, 10) - 10) / 2);
export const fmtSigned = (n) => (n >= 0 ? `+${n}` : `${n}`);

// Deriva mods, perícias, saves e percepção passiva (espelha computeNpcDerived).
export function deriveNpcLocal(npc) {
  if (!npc) return { mods: {}, pericias: {}, saves: {}, percepcao_passiva: 10 };
  const prof = _clamp(_int(npc.proficiencia, 2), 0, 20);
  const _ob = origemBenefits(npc.origem_poder);
  const mods = {};
  const attrs_efetivos = {};
  for (const a of NPC_ATTRS) {
    const bonus = (a.key === 'forca' && _ob) ? (_ob.forca || 0) : 0;  // Receptáculo: +4 Força
    const efetivo = _int(npc[a.col], 10) + bonus;
    attrs_efetivos[a.key] = efetivo;
    mods[a.key] = npcMod(efetivo);
  }
  const pericias = {};
  for (const s of NPC_SKILLS) {
    const e = (npc.pericias && npc.pericias[s.key]) || { prof: 0, bonus: 0 };
    pericias[s.key] = (mods[s.attr] || 0) + prof * _clamp(_int(e.prof, 0), 0, 2) + _int(e.bonus, 0);
  }
  const saves = {};
  for (const sv of NPC_SAVES) {
    const e = (npc.saves && npc.saves[sv.key]) || { prof: 0, bonus: 0 };
    saves[sv.key] = (mods[sv.key] || 0) + prof * _clamp(_int(e.prof, 0), 0, 2) + _int(e.bonus, 0);
  }
  // Benefícios automáticos do grau + estilo de combate + origem → efetivos.
  const gb = grauBenefits(npc.grau);
  const eb = estiloBenefits(npc.estilo_combate);
  const ob = origemBenefits(npc.origem_poder);
  const estCr = eb?.cr || 0, estPv = eb?.pv || 0, estDano = eb?.danoExtra || '';
  const origPv = ob?.pv || 0, origDesloc = ob?.desloc || 0;
  const baseCd = _int(npc.cd, 0), baseCr = _int(npc.cr, 0);
  const hpMin = _int(npc.hp_min, 0), hpMax = _int(npc.hp_max, 0);
  const ndEf = (Number(npc.nd) || 0) + gb.ndEff;
  const pvExtra = gb.pvExtra + estPv + origPv;
  return {
    mods, attrs_efetivos, pericias, saves,
    percepcao_passiva: 10 + (pericias.percepcao || 0),
    grau_bonus: gb,
    estilo_bonus: eb,
    nd_efetivo: ndEf,
    cd_efetivo: baseCd + gb.cd,
    cr_efetivo: baseCr + gb.cr + estCr,
    armadura: gb.armadura,
    pv_extra: pvExtra,
    hp_min_efetivo: hpMin + pvExtra,
    hp_max_efetivo: hpMax + pvExtra,
    crit_range: gb.critRange,
    dano_extra: _combinaD4(gb.danoExtra, estDano),
    deslocamento_efetivo: ((eb && eb.deslocamento != null) ? eb.deslocamento : _int(npc.deslocamento, 0)) + origDesloc,
    deteccao_m: gb.deteccaoM,
    percepcao_furtividade: gb.percFurt,
    vantagem_se_aliado_adjacente: !!(eb && eb.vantagemAdjacente),
    regen_por_turno: (eb && eb.regenPorNd) ? Math.round(ndEf) : 0,
    resistencia_permanente: gb.resistPermanente,
    origem_bonus: ob,
    fulgor_negro_crit_19: !!(ob && ob.critFulgor),
    retaliacao_melee: !!(ob && ob.retaliacao),
  };
}

// Campos enviados no PUT (scalars + json). Mantém em sincronia com o backend.
export const NPC_SCALAR_KEYS = [
  'nome', 'emoji', 'descricao', 'grau', 'nd', 'xp', 'proficiencia', 'cr', 'cd',
  'hp_min', 'hp_max', 'pa_max', 'pa_gerada', 'deslocamento', 'nado', 'voo', 'sentidos',
  'forca_val', 'agi_val', 'con_val', 'int_val', 'sab_val', 'pres_val',
  'estilo_combate', 'estilo_caminho', 'tipo', 'origem_poder',
];
export const NPC_JSON_KEYS = [
  'pericias', 'saves', 'resistencias', 'imunidade_dano', 'imunidade_cond',
  'vulnerabilidades', 'aspectos', 'ataques', 'hab_poder', 'hab_bonus', 'hab_reacao',
  'manipulacoes',
];

// Item em branco para as listas de ataque/habilidade. NPCs usam um bônus de
// acerto numérico próprio (não a fórmula do invocador como o shikigami).
export function emptyAtaque() {
  return { nome: '', acerto: 0, alcanceM: 1.5, dano: '', tipo: 'Contundente', critRange: 20, desc: '' };
}
export function emptyHabilidade() {
  return { nome: '', custoPA: 0, acerto: 0, dano: '', tipo: 'Energia', save: null, condicao: '', alcanceM: 1.5, critRange: 20, cura: '', desc: '' };
}
export function emptyAspecto() {
  return { nome: '', descricao: '' };
}
