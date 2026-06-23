// Gerador aleatório de NPC (Maldição/Humanoide) dentro dos limites do ND.
//   • Maldições nascem de um MEDO (modelo de npcCurses.js). As tags do modelo
//     enviesam, com chance 0–99% (dropChance, npcThemes.js), QUAIS características
//     caem ao gerar.
//   • Dois andares SEPARADOS de poder:
//       – ASPECTOS ANIMAIS (fracos, passivos) → patch.aspectos.
//       – HABILIDADES DE MALDIÇÃO (fortes) → hab_poder / hab_bonus / hab_reacao.
//   • Atributos dentro do orçamento do ND, perfil pelo arquétipo.
//   • Pelo menos 1 ataque escalado, +1 ação de poder, 1 ação bônus e 1 reação.
import { NPC_CATALOG } from './npcCatalog.mjs';
import { CURSE_MODELS, getCurse } from './npcCurses.mjs';
import { resolverHabCalibrada, mediaDanoHabilidades, resolverFormulasND } from './npcMaldicaoCalibrado.mjs';
import { gerarAtributosNpc } from './npcAtributosCalibrado.mjs';
import { maldCrBonus, maldAcertoBonus, deslocPorND, naturezaMaldicao, salvaguardasFortes,
         ataquesNormaisMaldicao, ataquesPorND, dadoMaldicao } from './npcDerivadoCalibrado.mjs';
import { gerarHumanoide } from './npcHumanoideCalibrado.mjs';
import { escolherAnimalTematico, escolherAspectoTematico, tracoComum, aspectoTematicoResolvido } from './npcTagsCalibrado.mjs';
import {
  FEAR_CATEGORIES, resolveCurseTags, dropChance, charGroup,
} from './npcThemes.mjs';

const ATTR_KEYS = ['forca_val', 'agi_val', 'con_val', 'int_val', 'sab_val', 'pres_val'];
const SAVE_KEYS = ['forca', 'agi', 'con', 'int', 'sab', 'pres'];

// 1º Grau/Especial já concede estes na seção "Classe" → não duplicar como aspecto.
const _GRADE_GRANT_ASPECTOS = new Set(['Defesa de Energia', 'Explosão Ofensiva', 'Explosão Defensiva', 'Energia Reversa']);
// Itens do grau que são NÚMEROS já aplicados na ficha (não mostrar na Classe).
const _CLASSE_BAKED_RE = /^(ND efetivo|\+\d+\s*PV|CD\s*\+|CR\s*\+|Resistência a TODOS|Recebe\s*\+\d+\s*de acerto|\+\d+d4\s*de dano)/i;

// Média de uma fórmula "XdY +Z …" (soma a média dos dados + modificadores flat).
function _avgFormula(expr) {
  let t = 0;
  for (const m of String(expr || '').matchAll(/([+-]?)(\d*)d(\d+)/g)) {
    const sign = m[1] === '-' ? -1 : 1, q = +(m[2] || 1), f = +m[3];
    t += sign * q * (f + 1) / 2;
  }
  for (const m of String(expr || '').matchAll(/(^|\s)([+-]?\d+)(?!\d*d)/g)) t += +m[2];
  return Math.max(0, Math.round(t));
}

// Perfis de atributo por arquétipo (ordem FOR, AGI, CON, INT, SAB, PRE).
// hi = alto, med = médio, lo = baixo (pode ficar bem baixo em ND fraco).
export const ARQ_KLASS = {
  aleatorio: null, // sorteia entre os perfis abaixo
  dominio:   ['lo', 'lo', 'hi', 'med', 'med', 'med'],
  robusto:   ['hi', 'med', 'hi', 'lo', 'lo', 'med'],
  desastre:  ['lo', 'med', 'lo', 'hi', 'hi', 'med'],
  assassino: ['lo', 'hi', 'med', 'med', 'hi', 'lo'],
  suporte:   ['lo', 'lo', 'med', 'hi', 'hi', 'hi'],
};
export const ARQ_LABELS = {
  aleatorio: 'Aleatório', dominio: 'Domínio', robusto: 'Robusto',
  desastre: 'Desastre', assassino: 'Assassino', suporte: 'Suporte',
};
const KLASS_EQUILIBRADO = ['med', 'med', 'med', 'med', 'med', 'med'];
const ARQ_REAIS = ['dominio', 'robusto', 'desastre', 'assassino', 'suporte'];

// Nomes temáticos.
const NOME_PREFIXO = ['Vulto', 'Carcaça', 'Aberração', 'Espectro', 'Presságio', 'Larva', 'Quimera',
  'Casulo', 'Ruína', 'Aparição', 'Verme', 'Colosso', 'Sombra', 'Mandíbula', 'Espinho', 'Lamento'];
const NOME_SUFIXO = ['Faminto', 'Errante', 'Putrefato', 'Silente', 'Vil', 'Dilacerante', 'Insaciável',
  'Profano', 'Voraz', 'Carniceiro', 'Espreitante', 'Maldito', 'Sombrio', 'Atroz'];
const NOME_HUMANO = ['Feiticeiro Renegado', 'Usuário Amaldiçoado', 'Mercenário', 'Caçador', 'Cultista', 'Algoz'];

// Sabor de ataque por tag dominante (nome + tipo de dano).
const TAG_FLAVOR = {
  fogo:      { tipos: ['Fogo'],       ataques: ['Labareda', 'Brasa Viva', 'Toque Ardente', 'Língua de Fogo', 'Explosão Ígnea'] },
  queimar:   { tipos: ['Fogo'],       ataques: ['Chama Faminta', 'Brasa', 'Toque Ardente'] },
  gelo:      { tipos: ['Frio'],       ataques: ['Estilhaço Gélido', 'Toque Congelante', 'Lâmina de Gelo'] },
  frio:      { tipos: ['Frio'],       ataques: ['Sopro Glacial', 'Toque Congelante'] },
  agua:      { tipos: ['Contundente'],ataques: ["Jato d'Água", 'Tromba', 'Onda Esmagadora'] },
  eletrico:  { tipos: ['Elétrico'],   ataques: ['Descarga', 'Choque Violento'] },
  acido:     { tipos: ['Ácido'],      ataques: ['Esguicho Corrosivo', 'Cuspe Ácido'] },
  veneno:    { tipos: ['Veneno'],     ataques: ['Presa Peçonhenta', 'Ferroada Tóxica', 'Cuspe Venenoso', 'Bote Peçonhento', 'Picada Letal'] },
  escuridao: { tipos: ['Psíquico'],   ataques: ['Garra Sombria', 'Toque das Trevas'] },
  luz:       { tipos: ['Energia'],    ataques: ['Lança de Luz', 'Clarão Ardente'] },
  psiquico:  { tipos: ['Psíquico'],   ataques: ['Lança Psíquica', 'Toque do Pavor'] },
  mente:     { tipos: ['Psíquico'],   ataques: ['Investida Mental', 'Toque do Pavor'] },
  medo:      { tipos: ['Psíquico'],   ataques: ['Toque do Pavor', 'Garra do Terror', 'Sussurro Aterrador', 'Olhar Sombrio'] },
  sangue:    { tipos: ['Cortante'],   ataques: ['Dilaceração', 'Talho Sangrento', 'Mordida'] },
  carne:     { tipos: ['Cortante'],   ataques: ['Dilaceração', 'Mordida Voraz'] },
  ossos:     { tipos: ['Perfurante'], ataques: ['Lâmina de Osso', 'Espinho Ósseo'] },
  inseto:    { tipos: ['Perfurante'], ataques: ['Ferrão', 'Mandíbula', 'Presa'] },
  aracnideo: { tipos: ['Perfurante'], ataques: ['Presa Venenosa', 'Ferrão'] },
  pedra:     { tipos: ['Contundente'],ataques: ['Esmagamento', 'Pisão', 'Marreta de Pedra'] },
  terra:     { tipos: ['Contundente'],ataques: ['Pisão', 'Soterramento'] },
  gravidade: { tipos: ['Contundente'],ataques: ['Esmagamento', 'Prensa'] },
  espacial:  { tipos: ['Energia'],    ataques: ['Corte Dimensional', 'Estilhaço do Vazio'] },
  som:       { tipos: ['Trovejante'], ataques: ['Estrondo', 'Grito Dilacerante'] },
  maquina:   { tipos: ['Cortante'],   ataques: ['Lâmina Serrilhada', 'Soco Hidráulico'] },
  metal:     { tipos: ['Cortante'],   ataques: ['Lâmina Serrilhada', 'Garra de Aço'] },
  profano:   { tipos: ['Energia'],  ataques: ['Toque Mórbido', 'Garra Profana'] },
  morte:     { tipos: ['Energia'],  ataques: ['Toque da Morte', 'Garra Sepulcral'] },
  fera:      { tipos: ['Cortante'],   ataques: ['Garras', 'Mordida', 'Investida', 'Dentada', 'Patada Brutal'] },
  predador:  { tipos: ['Cortante'],   ataques: ['Garras', 'Bote', 'Mordida', 'Salto Mortal', 'Dilacerar'] },
  // ── Temas adicionais (pra todo medo render um tipo de dano condizente) ─────
  tempo:     { tipos: ['Energia'],    ataques: ['Toque do Envelhecimento', 'Eco Temporal', 'Marca do Fim'] },
  vazio:     { tipos: ['Energia'],    ataques: ['Sopro do Vazio', 'Toque Nulo'] },
  dimensao:  { tipos: ['Energia'],    ataques: ['Corte Dimensional', 'Fenda Cortante'] },
  doenca:    { tipos: ['Veneno'],     ataques: ['Toque Pestilento', 'Bafo Doente', 'Sopro Infeccioso'] },
  podridao:  { tipos: ['Energia'],  ataques: ['Toque Putrefato', 'Garra Apodrecida'] },
  natureza:  { tipos: ['Cortante', 'Veneno'], ataques: ['Chicote de Espinhos', 'Cipó Cortante', 'Lança de Esporos'] },
  planta:    { tipos: ['Cortante'],   ataques: ['Cipó Cortante', 'Açoite de Vinhas'] },
  afogamento:{ tipos: ['Contundente'],ataques: ['Onda Sufocante', "Jato d'Água"] },
  queda:     { tipos: ['Contundente'],ataques: ['Impacto', 'Tromba', 'Esmagamento'] },
  altura:    { tipos: ['Contundente'],ataques: ['Mergulho', 'Investida Aérea'] },
  peso:      { tipos: ['Contundente'],ataques: ['Esmagamento', 'Prensa', 'Pisão'] },
  confinamento: { tipos: ['Contundente'], ataques: ['Aperto Esmagador', 'Compressão'] },
  prisao:    { tipos: ['Contundente'],ataques: ['Aperto Esmagador', 'Garra Aprisionante'] },
  odio:      { tipos: ['Contundente', 'Cortante'], ataques: ['Golpe Rancoroso', 'Talho Vingativo', 'Soco Furioso'] },
  raiva:     { tipos: ['Contundente'],ataques: ['Soco Furioso', 'Pancada Brutal'] },
  rancor:    { tipos: ['Cortante'],   ataques: ['Talho Vingativo', 'Corte Amargo'] },
  vinganca:  { tipos: ['Cortante'],   ataques: ['Lâmina da Vingança', 'Golpe de Represália'] },
  multidao:  { tipos: ['Contundente'],ataques: ['Esmagamento da Turba', 'Avalanche de Corpos'] },
  solidao:   { tipos: ['Psíquico'],   ataques: ['Toque da Solidão', 'Vazio Interior'] },
  velocidade:{ tipos: ['Contundente', 'Cortante'], ataques: ['Investida Veloz', 'Corte Relâmpago', 'Atropelo'] },
  perseguicao: { tipos: ['Contundente'], ataques: ['Atropelo', 'Bote Súbito'] },
  deformidade: { tipos: ['Cortante', 'Perfurante'], ataques: ['Membro Disforme', 'Garra Mutante', 'Lâmina de Carne'] },
  mutacao:   { tipos: ['Perfurante'], ataques: ['Aguilhão Mutante', 'Espinho Disforme'] },
  olho:      { tipos: ['Psíquico'],   ataques: ['Olhar Perfurante', 'Feixe Ocular'] },
  observacao:{ tipos: ['Psíquico'],   ataques: ['Olhar Perfurante', 'Feixe Vigilante'] },
  cadaver:   { tipos: ['Energia'],  ataques: ['Toque Cadavérico', 'Garra Sepulcral'] },
};
const FLAVOR_PADRAO = { tipos: ['Cortante', 'Perfurante', 'Contundente'], ataques: ['Garras', 'Mordida', 'Golpe'] };

// Grupo do catálogo → slot da ficha onde a característica entra.
function slotForGroup(group) {
  switch (group) {
    case 'aspecto':                            return 'aspecto';
    case 'acaoBonus': case 'espiritoBonus':    return 'bonus';
    case 'reacao':    case 'espiritoReacao':   return 'reacao';
    case 'acaoPoder': case 'espiritoPoder':
    case 'barreira':                           return 'poder';
    default:                                   return 'aspecto';
  }
}

const _rint = (n) => Math.floor(Math.random() * n);
const pick  = (arr) => arr[_rint(arr.length)];
function shuffle(a) { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = _rint(i + 1); [c[i], c[j]] = [c[j], c[i]]; } return c; }
function pickWeighted(weights) {
  const tot = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

/**
 * Planeja o ataque de uma criatura. A criatura tem UM golpe pequeno `Xd8 + mod`
 * e ATACA VÁRIAS VEZES por turno (nGolpes) pra somar o Dano/Rodada do ND — em
 * vez de um ataque gigante (15d8+15) ou de várias definições diferentes. O nº de
 * golpes vai num aspecto "Ataques Múltiplos". O flat é o MODIFICADOR DO ATRIBUTO
 * PRINCIPAL. Ex.: dano alto → 1 golpe de `5d8+5`, atacando 3× por turno.
 *  @returns {{nGolpes:number, dano:string, media:number}}
 */
function planejarAtaques(danoTotal, mod) {
  const flat = Math.max(0, Math.round(mod));
  const total = Math.max(1, Math.round(danoTotal));
  // ND ínfimo (<1): dado menor, 1 golpe, pra não estourar a média.
  if (total <= 4) return { nGolpes: 1, dano: flat > 0 ? `1d4+${flat}` : '1d4', media: total };
  if (total <= 7) return { nGolpes: 1, dano: flat > 0 ? `1d6+${flat}` : '1d6', media: total };
  // Cada golpe deve ser pequeno (≤5d8). Aumenta o nº de golpes/turno até caber.
  const diceFor = (n) => Math.max(1, Math.round((total / n - flat) / 4.5));
  let n = 1, guard = 0;
  while (diceFor(n) > 5 && n < 12 && guard++ < 50) n++;
  const dice = diceFor(n);
  const media = Math.round(n * (dice * 4.5 + flat));
  return { nGolpes: n, dano: flat > 0 ? `${dice}d8+${flat}` : `${dice}d8`, media };
}

/** Modificador do atributo principal (o maior atributo) — bônus flat de dano. */
function modPrincipal(patch) {
  const max = Math.max(...ATTR_KEYS.map(k => Number(patch[k]) || 10));
  return Math.floor((max - 10) / 2);
}

/** Energia Gerada/rodada recomendada a partir do pool de Energia do ND. */
export function energiaGeradaFromEnergia(energia) {
  const e = Number(energia) || 0;
  return e <= 0 ? 0 : Math.max(2, Math.round(e / 8));
}

/** Distribui o orçamento de atributos pela classificação hi/med/lo, cap 50. */
function gerarAtributos(budget, klass, ndNum = 5) {
  const ks = Array.isArray(klass) && klass.length === 6 ? klass : KLASS_EQUILIBRADO;
  const vals = {}; let used = 0;
  const loMax = Math.max(6, Math.min(12, 6 + Math.floor((Number(ndNum) || 0) / 4)));
  ATTR_KEYS.forEach((k, i) => {
    if (ks[i] === 'lo') vals[k] = 4 + _rint(Math.max(1, loMax - 4 + 1)); // 4..loMax
    else vals[k] = 10;
    used += vals[k];
  });
  let remaining = Math.max(0, Math.round(budget) - used);
  const idxs = ATTR_KEYS.map((_, i) => i).filter(i => ks[i] !== 'lo');
  const weights = idxs.map(i => (ks[i] === 'hi' ? 4 : 1.5));
  let guard = 0;
  while (remaining > 0 && idxs.length && guard++ < 100000) {
    const k = ATTR_KEYS[idxs[pickWeighted(weights)]];
    if (vals[k] < 50) { vals[k]++; remaining--; }
    else if (idxs.every(i => vals[ATTR_KEYS[i]] >= 50)) break;
  }
  return vals;
}

// Mapa de Salvaguarda (texto da descrição → chave do save).
const _SAVE_MAP = {
  'força': 'forca', 'forca': 'forca', 'agilidade': 'agi', 'constituição': 'con',
  'constituicao': 'con', 'intelecto': 'int', 'espírito': 'int', 'espirito': 'int',
  'sabedoria': 'sab', 'presença': 'pres', 'presenca': 'pres',
};
const _CONDICOES = ['Sangramento', 'Envenenado', 'Atordoado', 'Paralisado', 'Caído',
  'Cego', 'Amedrontado', 'Surdo', 'Inconsciente', 'Incapacitado', 'Letárgico', 'Pesado', 'Enfeitiçado'];

/** Conta de dados a partir de uma fração do ND. Dano arredonda SEMPRE para cima
 *  ("½ ND" → ⌈ND/2⌉, "¼ ND" → ⌈ND/4⌉, "= ND" → ND). */
function _ndCount(fracText, nd) {
  const t = String(fracText).toLowerCase();
  if (/¼|1\/4|um quarto|quarto/.test(t)) return Math.max(1, Math.ceil(nd / 4));
  if (/metade|½|1\/2|meio/.test(t))      return Math.max(1, Math.ceil(nd / 2));
  return Math.max(1, Math.ceil(nd)); // "= ND" / "próprio ND"
}

/**
 * Lê a descrição (do catálogo) de uma habilidade e CALCULA os campos mecânicos
 * em função do ND: alcance (raio = N× ND ou fixo em m), dano e cura (dD = fração
 * do ND), tipo de dano, salvaguarda e condição. É isso que faltava — o gerador
 * mandava só o texto.
 */
function deriveHabFields(desc, nd) {
  const d = String(desc || '');
  const out = { alcanceM: 1.5, dano: '', cura: '', tipo: 'Energia', save: null, condicao: '' };

  // ── Alcance/raio ──────────────────────────────────────────────────────────
  const rMult = d.match(/(?:raio|alcance|dist[âa]ncia|a\s*at[ée]|at[ée])[^.;:]{0,20}?(\d+)\s*[×x]\s*ND/i);
  if (rMult) out.alcanceM = Math.min(300, Number(rMult[1]) * nd);
  else {
    const rFix = d.match(/(?:raio|alcance|a\s*at[ée]|at[ée])[^.;:]{0,16}?(\d+(?:[.,]\d+)?)\s*m\b/i);
    if (rFix) out.alcanceM = Number(rFix[1].replace(',', '.'));
  }

  // ── Fórmulas "dD = fração do ND" — classificadas em dano / cura / redução ──
  const re = /(\d*)d(\d+)\s*([^.;]*?)=\s*([^.;]*?ND[^.;]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const die = m[2], mid = m[3] || '', frac = m[4];
    const ctx = (d.slice(Math.max(0, m.index - 24), m.index) + mid).toLowerCase();
    const formula = `${_ndCount(frac, nd)}d${die}`;
    if (/recupera|cura|restaura/.test(ctx)) { if (!out.cura) out.cura = formula; }
    else if (/reduz|reduç|reduzid/.test(ctx)) { /* redução de dano: não é ataque */ }
    else if (!out.dano) out.dano = formula;
  }

  // ── Tipo de dano ──────────────────────────────────────────────────────────
  if (/ps[íi]quic/i.test(d)) out.tipo = 'Psíquico';
  else if (/[áa]cid/i.test(d)) out.tipo = 'Ácido';
  else if (/verdadeir/i.test(d)) out.tipo = 'Verdadeiro';
  else if (/fogo|[íi]gneo/i.test(d)) out.tipo = 'Fogo';
  else if (/el[ée]tric/i.test(d)) out.tipo = 'Elétrico';
  else if (/contundente/i.test(d)) out.tipo = 'Contundente';
  else if (/cortante/i.test(d)) out.tipo = 'Cortante';
  else if (/perfurante/i.test(d)) out.tipo = 'Perfurante';

  // ── Salvaguarda + condição ────────────────────────────────────────────────
  const sm = d.match(/Salvaguarda de ([A-Za-zÀ-ú]+)/i);
  if (sm && _SAVE_MAP[sm[1].toLowerCase()]) out.save = _SAVE_MAP[sm[1].toLowerCase()];
  for (const c of _CONDICOES) { if (new RegExp(c, 'i').test(d)) { out.condicao = c; break; } }
  return out;
}

function habFromEntry(e, nd = 5) {
  const ndR = Math.max(1, Math.round(Number(nd) || 5));
  // Texto CALIBRADO do Electron (resolverHabCalibrada) é a fonte da verdade: desc
  // integral com fórmulas já resolvidas pelo ND + dado de dano via dmg(nd). Se a
  // habilidade não existir nas listas calibradas, cai no derivador antigo.
  const calib = resolverHabCalibrada(e?.nome, ndR);
  if (calib) {
    const der = deriveHabFields(calib.desc, ndR); // só p/ pills (save/condição/alcance) no modelo Webview
    return {
      nome: calib.nome, custoPA: 0, acerto: 0, recarga: calib.recarga,
      dano: calib.dano || der.dano, tipo: calib.tipo || der.tipo,
      save: der.save, condicao: der.condicao, alcanceM: der.alcanceM,
      critRange: 20, cura: calib.cura || der.cura, desc: calib.desc,
    };
  }
  const descR = resolverFormulasND(e?.desc || '', ndR);
  const der = deriveHabFields(descR, ndR);
  return {
    nome: e?.nome || 'Habilidade', custoPA: 0, acerto: 0,
    dano: der.dano, tipo: der.tipo, save: der.save, condicao: der.condicao,
    alcanceM: der.alcanceM, critRange: 20, cura: der.cura, desc: descR,
  };
}

/**
 * Escolhe características de um pool por chance (dropChance) com nomes forçados.
 *  @returns {Array} entradas do catálogo escolhidas.
 */
function rollPool(pool, pesos, { cap, min, forced }) {
  const chosen = [];
  const names = new Set();
  for (const f of (forced || [])) {
    const e = pool.find(p => p.nome === f);
    if (e && !names.has(f)) { chosen.push(e); names.add(f); }
  }
  const candidates = shuffle(pool.filter(p => !names.has(p.nome)))
    .map(p => ({ p, ch: dropChance(p.nome, pesos) }));
  for (const { p, ch } of candidates) {
    if (chosen.length >= cap) break;
    if (_rint(100) < ch) { chosen.push(p); names.add(p.nome); }
  }
  if (chosen.length < min) {
    const rest = candidates.filter(c => !names.has(c.p.nome)).sort((a, b) => b.ch - a.ch);
    for (const c of rest) { if (chosen.length >= min) break; chosen.push(c.p); names.add(c.p.nome); }
  }
  return chosen;
}

/** Resolve a linha da tabela de ND mais próxima do valor pedido. */
function resolveNd(ndTable, ndValue) {
  if (!Array.isArray(ndTable) || !ndTable.length) return null;
  const n = Number(ndValue);
  let best = ndTable[0], dist = Infinity;
  for (const r of ndTable) {
    const d = Math.abs((Number(r.ndNum) || 0) - (Number.isFinite(n) ? n : 0));
    if (d < dist) { dist = d; best = r; }
  }
  return best;
}

/**
 * Sorteia um sabor de ataque PONDERADO pelos pesos do medo: cada tag temática
 * (com TAG_FLAVOR) entra na roleta com peso = peso da tag na maldição. Assim o
 * TIPO de dano sai na proporção das tags do medo (Medo de Fogo → quase sempre
 * Fogo; medo misto distribui entre seus tipos). Vazio → sabor padrão.
 */
function flavorWeightedPick(pesos) {
  const cand = [];
  for (const [tag, w] of Object.entries(pesos || {})) {
    if (TAG_FLAVOR[tag] && w > 0) cand.push([TAG_FLAVOR[tag], w]);
  }
  if (!cand.length) return FLAVOR_PADRAO;
  const tot = cand.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * tot;
  for (const [fl, w] of cand) { r -= w; if (r <= 0) return fl; }
  return cand[cand.length - 1][0];
}

// Re-exporta para a UI do editor.
export { CURSE_MODELS, getCurse, FEAR_CATEGORIES };
export function listCurses() { return CURSE_MODELS; }

/**
 * Gera um patch de NPC aleatório dentro dos limites do ND.
 * @param {{nd:number, tipo:'maldicao'|'humano', ndTable:Array, curseId?:string,
 *          arquetipo?:string, boss?:boolean}} cfg
 * @returns {object|null} patch pronto pra mesclar no estado do editor.
 */
export function gerarNpc({ nd, tipo, ndTable, curseId, arquetipo, boss,
                           estilo, grauCE, lutFoco, manipulacoes, origem }) {
  const row = resolveNd(ndTable, nd);
  if (!row) return null;
  const isMald = tipo !== 'humano';
  const isBoss = !!boss;

  // Maldição: resolve o modelo (escolhido ou aleatório) e seus pesos de tag.
  let curse = null, pesos = {}, cat = null;
  if (isMald) {
    curse = (curseId && getCurse(curseId)) || pick(CURSE_MODELS);
    pesos = resolveCurseTags(curse);
    cat = FEAR_CATEGORIES[curse.categoria] || null;
  }
  // Forma animal temática (Electron): 30% da maldição lembrar um animal coerente com
  // as tags do medo → vira "(forma de X)" no nome, dá os traços dele em "Ações Comuns"
  // e o aspecto típico. Senão, sem forma (só o aspecto temático).
  const animalForma = isMald && _rint(100) < 30 ? escolherAnimalTematico(pesos) : null;

  // Arquétipo de atributos: explícito > do modelo > da categoria > aleatório.
  let arqKey = arquetipo || (curse && curse.arquetipo) || (cat && cat.arquetipo) || 'aleatorio';
  if (!ARQ_KLASS[arqKey] && arqKey !== 'aleatorio') arqKey = 'aleatorio';
  if (arqKey === 'aleatorio') arqKey = isMald ? pick(ARQ_REAIS) : 'aleatorio';
  const klass = isMald ? (ARQ_KLASS[arqKey] || KLASS_EQUILIBRADO) : KLASS_EQUILIBRADO;

  // Tema do ataque (ordem de atributos da maldição) + humanoide (estilo/grau/técnicas),
  // calculados cedo pra o título mostrar a classe.
  const ataqueTema = isMald ? sortearAtaqueTema(pesos) : null;
  const ndNum = Number(nd) || row.ndNum;
  const hum = isMald ? null : gerarHumanoide({ nd: ndNum, estilo, grauCE, lutFoco, manipulacoes });

  const emoji = ''; // NPCs gerados saem SEM emoji no nome/cabeçalho (decisão do usuário)
  const nomeBase = isMald
    ? `${pick(NOME_PREFIXO)} ${pick(NOME_SUFIXO)}`
    : pick(NOME_HUMANO);
  // Título: maldição mostra o medo; humanoide mostra a classe/estilo.
  const nome = isMald
    ? `${nomeBase} — ${curse.nome}${animalForma ? ` (forma de ${animalForma.nome})` : ''}${isBoss ? ' (Boss)' : ''}`
    : `${nomeBase} — ${hum.estilo}${isBoss ? ' (Boss)' : ''}`;
  const descricao = isMald
    ? `<p><strong>${curse.nome}</strong> — maldição nascida do medo, tipo <strong>${cat?.label || curse.categoria}</strong>.</p>`
    : `<p>Feiticeiro humanoide — <strong>${hum.estilo}</strong>${hum.ce.ndEfetivo ? `, ${hum.ce.label}` : ''}.</p>`;
  // Deltas calibrados — maldição: aspecto de maldição; humanoide: estilo + grau (NIVEL_CE).
  const crDelta = isMald ? maldCrBonus(ndNum) : ((hum.bonus.crBonus || 0) + (hum.ce.crBonus || 0));
  const hpDelta = isMald ? 0 : ((hum.bonus.hpBonus || 0) + (hum.ce.hpFixo || 0));
  const cdDelta = isMald ? 0 : (hum.ce.cdBonus || 0);
  const deslocV = isMald ? deslocPorND(ndNum) : (hum.bonus.deslocamento ?? deslocPorND(ndNum));

  const patch = {
    nd: ndNum,
    tipo: isMald ? 'maldicao' : 'humano',
    boss: isBoss ? 1 : 0,
    nome,
    descricao,
    emoji,
    proficiencia: row.prof,
    pa_max: row.energia == null ? 0 : row.energia,
    pa_gerada: Math.round(2 * ndNum), // Energia Gerada/rodada = 2×ND (Electron)
    cr: (isBoss ? row.crBoss : row.cr) + crDelta,
    cd: row.cd + cdDelta,
    hp_min: row.hpMin + hpDelta,
    hp_max: row.hpMax + hpDelta,
    sentidos: '',
    deslocamento: deslocV,
    // Atributos: distribuirAtributos (Electron). Humanoide usa a ordem do estilo;
    // maldição, a ordem pelo tema/arquétipo.
    ...gerarAtributosNpc({
      budget: isBoss ? (row.atribBoss || row.atrib) : row.atrib,
      isMaldicao: isMald, ataqueTema, arquetipo, order: hum?.order,
    }),
  };

  // Base de ataque/dano calculada cedo (reusada nas técnicas do humanoide e no
  // bloco de ataque). Acerto = prof + mod do principal + bônus (maldição: aspecto;
  // humanoide: grau de Energia Amaldiçoada).
  const modAtq = modPrincipal(patch);
  const acertoBase = row.prof + modAtq + (isMald ? maldAcertoBonus(ndNum) : (hum.ce.acertoBonus || 0));
  // "Ataque Preciso": se o acerto gerado não bate o alvo da tabela de Bônus de Ataque por
  // ND (atk normal / atkBoss para boss), compensa a diferença com um aspecto e soma esse
  // bônus no acerto de todos os ataques/técnicas. Vale pra maldição e humanoide.
  const alvoAcerto = isBoss ? (row.atkBoss ?? row.atk ?? 0) : (row.atk ?? 0);
  const precisaoAcerto = Math.max(0, alvoAcerto - acertoBase);
  const acertoAtq = acertoBase + precisaoAcerto;
  const critRangeNpc = isMald ? 20 : (hum.ce.critMin || 20);
  // Dano extra dos ataques do humanoide: +1d4 do estilo + Nd4 do grau.
  const danoExtraParts = isMald ? [] : [hum.bonus.danoExtra, (hum.ce.danoDados > 0 ? `${hum.ce.danoDados}d4` : null)].filter(Boolean);
  const danoSuffix = danoExtraParts.length ? ' +' + danoExtraParts.join(' +') : '';
  // Média do dano-extra (suffix): entra no ORÇAMENTO — o dado base encolhe pra que o
  // TOTAL (base + mod + suffix) bata o alvo da tabela, em vez de estourar por cima.
  const sufAvg = danoExtraParts.reduce((s, p) => {
    const m = /(\d+)d(\d+)/.exec(p); return m ? s + (+m[1]) * (+m[2] + 1) / 2 : s;
  }, 0);

  // Salvaguardas: maldição é proficiente nos N atributos MAIS FORTES (maldNumSaves
  // pelo ND; todas em ND 21+) — Electron. Humanoide: 2 aleatórias.
  if (isMald) {
    patch.saves = salvaguardasFortes(patch, ndNum);
    // Resistências/imunidades pela NATUREZA do dano da maldição (imune ao próprio
    // conceito, resiste ao oposto; aparição resiste físico) — naturezaMaldicao.
    const nat = naturezaMaldicao(ataqueTema?.tipoDano, nome);
    if (nat.resistDano.length) patch.resistencias = nat.resistDano;
    if (nat.imuneDano.length)  patch.imunidade_dano = nat.imuneDano;
    if (nat.imuneCond.length)  patch.imunidade_cond = nat.imuneCond;
  } else {
    // Salvaguardas proficientes pelo ESTILO (Electron), não mais 2 aleatórias.
    const profSaves = new Set(hum.saves || []);
    patch.saves = {};
    SAVE_KEYS.forEach(k => { patch.saves[k] = { prof: profSaves.has(k) ? 1 : 0, bonus: 0 }; });
    // Resistências pelo grau de Energia Amaldiçoada. SÓ 1º Grau/Especial têm resistência
    // FIXA (a todos os tipos). Iniciante/4º/3º/2º NÃO têm resistência a físico (BCP) — a
    // única resistência deles vem dos Pontos de Armadura (a todo dano exceto Verdadeiro,
    // enquanto durar), já descrita no aspecto "Pontos de Armadura". Nada de linha fixa.
    if (hum.ce.resistAll) patch.resistencias = ['Todos os tipos'];
    // Origem de Poder (Linhagem Herdada): grava no patch — o deriveNpcLocal já aplica
    // os benefícios (+FOR/+PV/+desloc/crít Fulgor/retaliação/etc.) automaticamente.
    if (origem) patch.origem_poder = origem;
  }

  // Assinaturas do modelo, separadas por slot.
  const sigBySlot = { aspecto: [], poder: [], bonus: [], reacao: [] };
  for (const nome of (curse?.assinatura || [])) {
    const slot = slotForGroup(charGroup(nome));
    sigBySlot[slot].push(nome);
  }

  if (isMald) {
    // ── ASPECTOS TEMÁTICOS (curados pela tag do medo) + AÇÕES COMUNS da forma ──
    // Electron: aspecto da forma animal (se houver) + 1 aspecto coerente com o tema
    // (nunca pool aleatório). Os traços do animal viram a seção "Ações Comuns".
    const aspNomes = new Set();
    if (animalForma?.aspecto) aspNomes.add(animalForma.aspecto);
    aspNomes.add(escolherAspectoTematico(pesos));
    for (const f of sigBySlot.aspecto) aspNomes.add(f);
    patch.aspectos = [...aspNomes].filter(Boolean).map(n => {
      const r = aspectoTematicoResolvido(n);
      return { nome: r.nome, descricao: r.desc };
    });
    patch.acoes_comuns = animalForma ? animalForma.tracos.map(n => tracoComum(n, ndNum)) : [];

    // ── HABILIDADES DE MALDIÇÃO (fortes) ─────────────────────────────────────
    const poderPool  = [...NPC_CATALOG.espiritoPoder,  ...NPC_CATALOG.acaoPoder];
    const bonusPool  = [...NPC_CATALOG.espiritoBonus,  ...NPC_CATALOG.acaoBonus];
    const reacaoPool = [...NPC_CATALOG.espiritoReacao, ...NPC_CATALOG.reacao];
    patch.hab_poder  = rollPool(poderPool,  pesos, { cap: isBoss ? 3 : 2, min: 1, forced: sigBySlot.poder  }).map(e => habFromEntry(e, ndNum));
    patch.hab_bonus  = rollPool(bonusPool,  pesos, { cap: isBoss ? 2 : 1, min: 1, forced: sigBySlot.bonus  }).map(e => habFromEntry(e, ndNum));
    patch.hab_reacao = rollPool(reacaoPool, pesos, { cap: isBoss ? 2 : 1, min: 1, forced: sigBySlot.reacao }).map(e => habFromEntry(e, ndNum));
  } else {
    // ── HUMANOIDE: classe/estilo + grau + manipulações + técnicas (Electron) ──
    const _alcM = (a) => { const m = String(a || '').match(/([\d,]+)\s*metros/); return m ? Number(m[1].replace(',', '.')) : null; };
    const _custo = (c) => { const m = String(c || '').match(/(\d+)/); return m ? Number(m[1]) : 0; };
    const _auxDesc = (t) => `${t.efeito || ''}${t.requisito ? ` (Requer: ${t.requisito})` : ''}`.trim();

    // Técnicas ofensivas (3 grau mais alto) → Ações de Poder, no formato do Electron:
    // título "(Técnica Comum – Xº Grau | Custo N PA)" + Acerto (média) + Efeito.
    // DANO = base da técnica + modPrincipal APENAS. Os +1d4/+Nd4 de estilo/grau
    // entram só no ataque BÁSICO (Soco), NUNCA nas técnicas (igual ao Electron).
    const _modTxt = modAtq > 0 ? ` +${modAtq}` : (modAtq < 0 ? ` ${modAtq}` : '');
    patch.hab_poder = hum.tecnicas.map(t => ({
      nome: t.nome, custoPA: t.pa || 0, tecnica: 'grau',
      grau: t.grau, classeTec: t.classe || 'Comum',
      ataque: t.ataque || 'corpo-a-corpo', alcanceTxt: t.alcance || '1,5 metros',
      acerto: acertoAtq, dano: `${t.dano}${_modTxt}`, tipo: t.tipoDano || '',
      alcanceM: _alcM(t.alcance), critRange: critRangeNpc, desc: t.efeito || '', recarga: '',
    }));
    // Auxiliares de "Ação de Poder" (Sentinela + manipulações) → Técnica Auxiliar (sem dano).
    for (const t of hum.aux.poder) patch.hab_poder.push({ nome: t.nome, custoPA: _custo(t.custo), tecnica: 'aux', classeTec: t.classe || 'Auxiliar', custoTxt: t.custo || `${_custo(t.custo)} PA`, acerto: 0, dano: '', tipo: '', alcanceM: _alcM(t.alcance), critRange: 20, desc: t.efeito || _auxDesc(t), recarga: '' });
    patch.hab_bonus = [];
    // Reações: concedidas por manipulação + auxiliares de Reação (Técnica Auxiliar).
    patch.hab_reacao = [
      ...hum.manipReacoes.map(c => ({ nome: c.nome, custoPA: 0, acerto: 0, dano: '', tipo: '', desc: c.desc || '', recarga: '' })),
      ...hum.aux.reacao.map(t => ({ nome: t.nome, custoPA: _custo(t.custo), tecnica: 'aux', classeTec: t.classe || 'Auxiliar', custoTxt: t.custo || `${_custo(t.custo)} PA`, acerto: 0, dano: '', tipo: '', desc: t.efeito || _auxDesc(t), recarga: '' })),
    ];
    // Aspectos: SÓ mecânicas reais (manipulações + auxiliares + recursos que não dão
    // pra "embutir num número"). Os bônus de estilo/grau (+CR, +PV, +Nd4, ND efetivo…)
    // JÁ estão aplicados em cr/hp/cd/dano/resistências — NÃO viram aspecto (igual ao
    // Electron, onde `extras` é só painel de transparência, não vai pra ficha).
    const aspNotas = [];
    if (hum.ce.hpTemp)     aspNotas.push({ nome: 'Pontos de Armadura', descricao: `${hum.ce.hpTemp} Pontos de Armadura + resistência a todo dano (exceto Verdadeiro) enquanto durarem.` });
    if (hum.bonus.regenND) aspNotas.push({ nome: 'Regeneração', descricao: `No início de cada turno, recupera ${ndNum} Pontos de Vida (igual ao ND).` });
    // No 1º Grau/Especial o grau JÁ concede acesso a Explosão Ofensiva/Defensiva +
    // Energia Reversa (declarado na seção Classe) — não repetir como aspecto.
    for (const c of hum.manipAspectos) {
      if (hum.ce.resistAll && _GRADE_GRANT_ASPECTOS.has(c.nome)) continue;
      aspNotas.push({ nome: c.nome, descricao: c.desc || '' });
    }
    for (const t of hum.aux.outras)    aspNotas.push({ nome: t.nome, descricao: _auxDesc(t) });
    patch.aspectos = aspNotas;

    // 1º Grau / Especial: o grau concede grants que NÃO são números (acesso a EO/ED
    // + Energia Reversa, percepção de EA, grants padrão). Os bônus numéricos (PV/CD/
    // CR/resist/acerto/dano) JÁ estão aplicados na ficha → filtrados aqui. Sobra só o
    // qualitativo, numa ÚNICA "Classe" (seção própria).
    if (hum.ce.resistAll && hum.ce.extras && hum.ce.extras.length) {
      const itens = hum.ce.extras.filter(t => !_CLASSE_BAKED_RE.test(t));
      // Tira o "(ND efetivo +N)" do nome — é redundante/desnecessário na ficha.
      const nomeClasse = hum.ce.label.replace(/\s*\(ND efetivo[^)]*\)/i, '').trim();
      if (itens.length) patch.classe = { nome: nomeClasse, itens };
    }
  }

  // ── ATAQUE — a criatura tem 1 (às vezes 2) golpe pequeno `Xd8 + modPrincipal`
  // e ATACA VÁRIAS VEZES por turno pra somar o Dano/Rodada do ND. O nº de golpes
  // vai no aspecto "Ataques Múltiplos". O TIPO de dano sai dos pesos do medo.
  const _ndDano = Number(nd) || row.ndNum;
  let danoTotal = Math.round((row.danoMin + row.danoMax) / 2);
  // Buff de dificuldade: +50% de dano POR TURNO a partir do ND ≥ 5 (Electron usa 5,
  // não 6). Aplica no dano total antes de planejar os golpes, então o nº de golpes /
  // tamanho dos dados e a "média por rodada" exibida já refletem.
  if (_ndDano >= 5) danoTotal = Math.ceil(danoTotal * 1.5);
  // BOSS: dobro de dano por rodada que um normal do mesmo ND (ataques doem mais).
  // Aplica DEPOIS do buff, então o boss = 2× o dano já buffado do normal.
  if (isBoss) danoTotal *= 2;
  // ── Orçamento de dano por rodada (Electron) ──────────────────────────────────
  // As habilidades de dano (maldição) RESERVAM parte do dano/rodada (≈ 1 ação de
  // poder); o RESTANTE é dividido entre N ataques normais. Cada ataque é um dado
  // VARIADO (dadoMaldicao) dimensionado pra (danoPorAtaque − mod do principal).
  // modAtq/acertoAtq/critRangeNpc/danoSuffix já foram calculados acima.
  const habNomes = [...(patch.hab_poder || []), ...(patch.hab_bonus || []), ...(patch.hab_reacao || [])].map(h => h.nome);
  // A "ação de poder" reservada por rodada: maldição = média das habilidades de dano;
  // humanoide = a TÉCNICA DE DANO MAIS ALTA (a criatura usa 1 técnica + os ataques
  // normais; a técnica entra na média/rodada e encolhe os ataques, igual à maldição).
  const tecAvgs = isMald ? [] : (patch.hab_poder || []).filter(h => h.tecnica === 'grau' && h.dano).map(h => _avgFormula(h.dano));
  const maxTec = tecAvgs.length ? Math.max(...tecAvgs) : 0;
  // Nº de ataques normais/turno. Humanoide soma ataquesExtra do estilo (ex.: Sentinela +1).
  const ataquesSugeridos = isMald
    ? Math.min(5, ataquesNormaisMaldicao(ndNum))
    : (ataquesPorND(ndNum) + (hum.bonus.ataquesExtra || 0));
  // Reserva a técnica de dano mais alta APENAS se, depois dela, ainda sobrar DADO real
  // pros ataques normais (cada um precisa de mais que só mod+suffix). Em ND baixo a
  // técnica de dado fixo (4d10) já vale o orçamento inteiro → ela É a rodada (alternativa
  // ao multiataque), não soma por cima. Senão entra na média e encolhe os ataques.
  // A técnica de ação de poder SEMPRE faz parte do dano/rodada (a criatura ataca E usa
  // a técnica no mesmo turno, igual à maldição que reserva 1 ação de poder). Então
  // reserva-a sempre que houver técnica de dano: ela entra na média e os ataques
  // normais encolhem pra o TOTAL (ataques + técnica) bater o orçamento. Em ND baixo a
  // técnica de dado fixo já vale quase o orçamento → os ataques ficam mínimos.
  const podeReservar = !isMald && maxTec > 0;
  const somaHabilidades = isMald ? mediaDanoHabilidades(habNomes, ndNum) : (podeReservar ? maxTec : 0);
  const restanteDano = Math.max(0, danoTotal - somaHabilidades);
  const danoPorAtaque = ataquesSugeridos > 0 ? restanteDano / ataquesSugeridos : restanteDano;
  const dieTarget = danoPorAtaque - modAtq - sufAvg;
  // Se a técnica reservada já consumiu o orçamento (não sobra dado pros ataques), o
  // ataque básico vira FRACO de propósito: dado mínimo + mod, SEM os +1d4 de estilo/grau
  // (o dano da rodada já está na técnica). Senão, dado dimensionado + suffix normal.
  const fillerAtaque = podeReservar && dieTarget <= 0;
  let dadoAtq = fillerAtaque ? { expr: '1d6', avg: 3.5 } : dadoMaldicao(dieTarget);
  // LIMITE em ND≤4: um único ataque comum não passa de 4d10 (+mod) — evita "nuke" de
  // golpe único que pode matar de uma vez. (O golpe forte intencional fica no "Golpe
  // Concentrado", que só existe quando há multiataque.)
  const CAP_DADO_AVG = 22; // média de 4d10
  if (_ndDano <= 4 && dadoAtq.avg > CAP_DADO_AVG) {
    dadoAtq = { expr: '4d10', avg: CAP_DADO_AVG };
  }
  const danoBaseStr = modAtq > 0 ? `${dadoAtq.expr} +${modAtq}` : (modAtq < 0 ? `${dadoAtq.expr} ${modAtq}` : dadoAtq.expr);
  const danoAtqStr = fillerAtaque ? danoBaseStr : `${danoBaseStr}${danoSuffix}`; // +1d4 estilo / +Nd4 grau (só não-filler)
  // 1–2 definições de ataque (mesmo dano por golpe; a criatura faz ataquesSugeridos
  // ataques/turno escolhendo entre elas).
  const nDefs = (isBoss || _rint(100) < 35) ? 2 : 1;
  patch.ataques = [];
  const nomesUsados = new Set();
  for (let i = 0; i < nDefs; i++) {
    const fl = isMald ? flavorWeightedPick(pesos) : FLAVOR_PADRAO;
    let nome = pick(fl.ataques), guard = 0;
    while (nomesUsados.has(nome) && guard++ < 8) nome = pick(fl.ataques);
    nomesUsados.add(nome);
    patch.ataques.push({
      nome,
      acerto: acertoAtq, alcanceM: 1.5, dano: danoAtqStr,
      tipo: pick(fl.tipos), critRange: critRangeNpc,
      desc: isMald ? `Ataque característico de ${curse?.nome || 'maldição'}.` : 'Ataque característico.',
    });
  }

  // "Golpe Concentrado": SÓ aparece quando a criatura tem multiataque (>1 ataque). No
  // lugar de realizar seus vários ataques, ela desfere um único golpe poderoso, causando
  // o dano COMBINADO dos ataques sacrificados (quanto mais ataques, mais dano).
  if (ataquesSugeridos > 1) {
    const tipoGc = patch.ataques[0]?.tipo || '';
    const perAtaqueAvg = _avgFormula(danoAtqStr);
    const alvoConc = Math.round(ataquesSugeridos * perAtaqueAvg);
    const dm = dadoMaldicao(Math.max(2, alvoConc - modAtq)); // soma o mod uma única vez
    const danoConcStr = modAtq > 0 ? `${dm.expr} +${modAtq}` : (modAtq < 0 ? `${dm.expr} ${modAtq}` : dm.expr);
    const avgGc = _avgFormula(danoConcStr);
    patch.hab_poder = patch.hab_poder || [];
    patch.hab_poder.push({
      nome: 'Golpe Concentrado',
      custoPA: Math.max(2, 2 * (Number(nd) || row.ndNum)),
      acerto: acertoAtq, dano: danoConcStr, tipo: tipoGc,
      alcanceM: 1.5, critRange: critRangeNpc,
      desc: `Em vez de realizar seus ${ataquesSugeridos} ataques na rodada, a criatura concentra todos eles num único golpe devastador, causando o dano combinado dos ataques sacrificados. Ataque corpo-a-corpo contra um alvo: ${acertoAtq >= 0 ? '+' : ''}${acertoAtq} para atingir, causando ${avgGc} (${danoConcStr})${tipoGc ? ` de dano ${tipoGc}` : ''}.`,
      recarga: '',
    });
  }

  // ── Aspecto "Ataques Múltiplos": SÓ descreve as ações da rodada (ataque comum +
  // ação de poder). Sem cálculo de dano médio no texto — os números já estão no
  // bloco de Ataques e nas Ações de Poder.
  patch.aspectos = (patch.aspectos || []).filter(a => a.nome !== 'Ataques Múltiplos' && a.nome !== 'Dano por Rodada');
  if (ataquesSugeridos > 1 || somaHabilidades > 0) {
    const ataquesTxt = ataquesSugeridos > 1
      ? `<strong>${ataquesSugeridos} jogadas de ataque</strong> por turno (com seus ataques, em qualquer combinação)`
      : `<strong>1 jogada de ataque</strong> por turno`;
    const acaoPoderTxt = somaHabilidades > 0 ? `, além de <strong>1 ação de poder</strong>${isMald ? '' : ' (técnica)'} por rodada` : '';
    patch.aspectos.unshift({
      nome: 'Ataques Múltiplos',
      descricao: `A criatura realiza ${ataquesTxt}${acaoPoderTxt}.`,
    });
  }

  // "Ataque Preciso": aspecto que compensa o acerto faltante pro alvo da tabela por ND.
  if (precisaoAcerto > 0) {
    patch.aspectos = patch.aspectos || [];
    patch.aspectos.push({
      nome: 'Ataque Preciso',
      descricao: `Você recebe +${precisaoAcerto} em acerto.`,
    });
  }

  // Metadados pra "Recriar como Boss": guarda a config que gerou esta criatura
  // (incl. o modelo de maldição aleatório resolvido) pra recriar o MESMO ser como boss.
  patch._boss = isBoss;
  patch._gen = { tipo, nd, curseId: curse?.id || null, arquetipo: arqKey, estilo, grauCE, lutFoco, manipulacoes, origem };

  return patch;
}

// ─── Seleção temática para o NpcTab (Commission Manager) ──────────────────────
// Escolhe uma Maldição (modelo de medo) e sorteia só os NOMES das habilidades
// temáticas — o NpcTab calcula os stats. Replica o viés por tags do gerarNpc,
// sem depender da tabela de ND (não precisa de stats aqui).
// Nome temático aleatório de maldição (o nome de um dos 874 modelos de medo).
export function nomeMaldicaoTematico() {
  return pick(CURSE_MODELS).nome;
}

// Ataque temático (nome + tipo de dano) a partir dos pesos de tag da maldição.
// Sem pesos → flavor padrão. Ex.: tema "medo" → "Toque do Pavor" (Psíquico).
export function sortearAtaqueTema(pesos) {
  const fl = flavorWeightedPick(pesos);
  return { nome: pick(fl.ataques), tipoDano: pick(fl.tipos) };
}

export function sortearMaldicaoSelecao({ curseId, boss } = {}) {
  const curse  = (curseId && getCurse(curseId)) || pick(CURSE_MODELS);
  const pesos  = resolveCurseTags(curse);
  const cat    = FEAR_CATEGORIES[curse.categoria] || null;
  const isBoss = !!boss;
  // Nome = o próprio nome temático da maldição (curto e sempre no tema), sem o
  // prefixo/sufixo aleatório que deixava o nome longo e divergente do tema.
  const nome   = `${curse.nome}${isBoss ? ' (Boss)' : ''}`;

  const sigBySlot = { aspecto: [], poder: [], bonus: [], reacao: [] };
  for (const n of (curse.assinatura || [])) sigBySlot[slotForGroup(charGroup(n))].push(n);

  const nomesDe = (arr) => arr.map(e => e?.nome ?? e);
  // Só os pools de ESPÍRITO (habilidades de maldição) — todos casam com as listas
  // do NpcTab. Os pools "animais" (Bote/Teia/asas) ficam de fora: são Traços
  // Animais (seção própria) e seriam filtrados, anulando o min:1.

  return {
    nome,
    categoria: cat?.label || curse.categoria,
    emoji: curse.emoji || cat?.emoji || '👹',
    tags: pesos, // pesos de tag do medo (p/ escolher forma animal coerente, etc.)
    ataque: sortearAtaqueTema(pesos),
    poder:  nomesDe(rollPool(NPC_CATALOG.espiritoPoder,  pesos, { cap: isBoss ? 3 : 2, min: 1, forced: sigBySlot.poder  })),
    bonus:  nomesDe(rollPool(NPC_CATALOG.espiritoBonus,  pesos, { cap: isBoss ? 2 : 1, min: 1, forced: sigBySlot.bonus  })),
    reacao: nomesDe(rollPool(NPC_CATALOG.espiritoReacao, pesos, { cap: isBoss ? 2 : 1, min: 1, forced: sigBySlot.reacao })),
  };
}
