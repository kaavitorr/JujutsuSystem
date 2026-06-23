// ════════════════════════════════════════════════════════════════════════════
// Derivações CALIBRADAS de Maldição portadas VERBATIM do NpcTab.jsx (Electron).
// NÃO reescrever a matemática. Sync MANUAL.
//   maldCrBonus/maldAcertoBonus/maldNumSaves: escalam por ND.
//   deslocPorND: deslocamento base (9–15m).
//   naturezaMaldicao: imune ao próprio dano, resiste ao oposto; aparição resiste físico.
// ════════════════════════════════════════════════════════════════════════════

export const maldCrBonus     = (nd) => [4, 8, 12, 16, 20].filter(t => nd >= t).length;        // +1 de CR nos níveis 4/8/12/16/20
export const maldAcertoBonus = (nd) => [6, 12, 18].filter(t => nd >= t).length * 2;             // +2 de acerto nos níveis 6/12/18
export const maldNumSaves    = (nd) => Math.max(1, [1, 6, 11, 15, 20, 21].filter(t => nd >= t).length); // nº de Salvaguardas proficientes (6 = todas)

export function deslocPorND(nd) {
  const tier = Math.max(0, Math.min(4, Math.floor((nd || 0) / 6))); // 0..4
  return 9 + tier * 1.5; // 9 / 10,5 / 12 / 13,5 / 15
}

const _OPOSTO_DANO = { Fogo: 'Frio', Frio: 'Fogo', Ácido: 'Veneno', Veneno: 'Ácido', Elétrico: 'Trovejante', Trovejante: 'Elétrico' };
const _COND_POR_DANO = {
  Fogo: ['Queimado'], Frio: ['Hipotérmico', 'Congelado'], Veneno: ['Envenenado'],
  Ácido: [], Elétrico: ['Atordoado'], Trovejante: ['Surdo'],
  Psíquico: ['Amedrontado', 'Alucinado', 'Enfeitiçado'], Energia: [],
};
export function naturezaMaldicao(tipoDano, baseCriatura) {
  const FIS = ['Contundente', 'Cortante', 'Perfurante'];
  const t = tipoDano || '';
  const incorporeo = /Aparição|Vulto|Espectro|Horror|Fantasma|Etére/i.test(baseCriatura || '');
  let imuneDano = [], resistDano = [], imuneCond = [];
  if (['Fogo', 'Frio', 'Ácido', 'Veneno', 'Elétrico', 'Trovejante', 'Psíquico', 'Energia'].includes(t)) {
    imuneDano = [t];
    imuneCond = [...(_COND_POR_DANO[t] || [])];
    if (_OPOSTO_DANO[t]) resistDano = [_OPOSTO_DANO[t]];
  }
  if (t === 'Psíquico') resistDano = [...resistDano, ...FIS]; // dano mental → corpo sutil resiste a físico
  if (incorporeo) {
    resistDano = [...new Set([...resistDano, ...FIS])];
    imuneCond = [...new Set([...imuneCond, 'Agarrado', 'Caído', 'Impedido'])];
  }
  return { imuneDano, resistDano, imuneCond };
}

// Salvaguardas proficientes da maldição = os N atributos MAIS FORTES (maldNumSaves
// pelo ND; 6 = todas em ND 21+). Substitui o "2 aleatórias" do webview.
const _SAVE_COLS = [['forca', 'forca_val'], ['agi', 'agi_val'], ['con', 'con_val'], ['int', 'int_val'], ['sab', 'sab_val'], ['pres', 'pres_val']];
export function salvaguardasFortes(npc, nd) {
  const n = maldNumSaves(nd);
  const ordenado = _SAVE_COLS.slice().sort((a, b) => (npc[b[1]] || 0) - (npc[a[1]] || 0));
  const fortes = new Set(ordenado.slice(0, n).map(([k]) => k));
  const saves = {};
  for (const [k] of _SAVE_COLS) saves[k] = { prof: fortes.has(k) ? 1 : 0, bonus: 0 };
  return saves;
}

// ── Nº de ataques NORMAIS por ND (Electron). Maldição sempre + 1 ação de poder. ──
export function ataquesNormaisMaldicao(nd) {
  if (nd >= 21) return 5;
  if (nd >= 14) return 4;
  if (nd >= 9)  return 3;
  if (nd >= 5)  return 2;
  return 1;
}
export function ataquesPorND(nd) {
  if (nd >= 19) return 5;
  if (nd >= 15) return 4;
  if (nd >= 10) return 3;
  if (nd >= 6)  return 2;
  return 1;
}

// Dado de dano VARIADO p/ a média-alvo de UM ataque (≈ danoPorAtaque) — Electron.
// Escolhe faces (d6-d12) e quantidade que batem o alvo; prefere ≤5 dados.
export function dadoMaldicao(target) {
  const alvo = Math.max(2, Math.round(Number(target) || 0));
  const q = (f) => Math.max(1, Math.round(alvo / ((f + 1) / 2)));
  const bons = [6, 8, 10, 12].filter(f => q(f) <= 5);
  const faces = bons.length ? bons[Math.floor(Math.random() * bons.length)] : 12;
  const qtd = q(faces);
  return { expr: `${qtd}d${faces}`, avg: Math.round(qtd * (faces + 1) / 2) };
}
