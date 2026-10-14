// ════════════════════════════════════════════════════════════════════════════
// Distribuição de ATRIBUTOS portada VERBATIM do NpcTab.jsx (app Electron). NÃO
// reescrever a matemática — é a calibragem do dono. Sync MANUAL.
//   distribuirAtributos: piso 8, principal = 8 + 33% do "extra" (budget − 48),
//   CON (2º foco) = 8 + 24%, resto 8–18 limitado ao CON, teto 30. (Nada de FOR 23.)
//   ordemMaldicao: ordem (principal→secundário) pelo TIPO do ataque da maldição.
// As chaves de atributo do webview batem com o Electron: forca/agi/con/int/sab/pres
// (int = Espírito no Jujutsu).
// ════════════════════════════════════════════════════════════════════════════

function classificarAtaque(nome, tipoDano, mods) {
  const n = (nome || '').toLowerCase();
  const tem = (...ks) => ks.some(k => n.includes(k));
  // 1) efeito sensorial / área → Salvaguarda (checado ANTES de "toque", p/ pegar "Toque do Pavor")
  if (tem('olhar', 'olho', 'grito', 'lamento', 'aura', 'sussurro', 'eco', 'cântico', 'miragem', 'pavor', 'sopro', 'bafo', 'clarão', 'pulso', 'onda'))
    return { alcance: 'à distância', modelo: 'save' };
  // 2) projétil → à distância, jogada de acerto
  if (tem('cuspe', 'cuspir', 'esguicho', 'jato', 'estilhaço', 'lança', 'descarga', 'choque', 'feixe', 'raio', 'dardo', 'projétil'))
    return { alcance: 'à distância', modelo: 'acerto' };
  // 3) golpe direto → corpo-a-corpo, jogada de acerto
  if (tem('bote', 'mordid', 'presa', 'dentada', 'dente', 'garra', 'patada', 'pata', 'soco', 'pancada', 'golpe', 'talho', 'corte', 'dilacera', 'ferrão', 'ferroada', 'picada', 'mandíbula', 'chifre', 'cauda', 'pisão', 'esmaga', 'marreta', 'investida', 'atropelo', 'salto', 'mergulho', 'tromba', 'aperto', 'constri', 'pseudópode', 'tentáculo', 'impacto', 'prensa', 'aguilhão', 'lâmina', 'toque', 'membro', 'açoite', 'cipó', 'chicote', 'soterramento'))
    return { alcance: 'corpo-a-corpo', modelo: 'acerto' };
  // 4) fallback: físico → acerto (distância se a Constituição é o ponto fraco); resto → Salvaguarda
  const fisico = ['Contundente', 'Cortante', 'Perfurante'].includes(tipoDano);
  if (fisico) {
    const dist = mods.mCon < mods.mFor && mods.mCon < mods.mAgi && Math.max(mods.mFor, mods.mAgi) < 3;
    return { alcance: dist ? 'à distância' : 'corpo-a-corpo', modelo: 'acerto' };
  }
  return { alcance: 'à distância', modelo: 'save' };
}

// Ordem de atributos (principal → secundário) COERENTE com o ataque da maldição.
// O principal define acerto e bônus de dano; então um horror psíquico prioriza
// Presença, um bruto contundente prioriza Força, um predador ágil a Agilidade.
function ordemMaldicao(ataqueTema) {
  const tipo = ataqueTema?.tipoDano || 'Contundente';
  const cls = classificarAtaque(ataqueTema?.nome || '', tipo, { mFor: 0, mAgi: 0, mCon: 0 });
  if (['Psíquico'].includes(tipo))                      return ['pres', 'con', 'sab', 'int', 'agi', 'forca'];
  if (['Energia', 'Verdadeiro'].includes(tipo))         return ['sab', 'con', 'pres', 'int', 'agi', 'forca'];
  if (cls.modelo === 'save')                            return ['pres', 'con', 'agi', 'sab', 'int', 'forca']; // sopro/aura elemental
  if (cls.alcance === 'à distância' || ['Cortante', 'Perfurante'].includes(tipo))
                                                        return ['agi', 'con', 'forca', 'pres', 'sab', 'int'];
  return ['forca', 'con', 'agi', 'pres', 'sab', 'int']; // contundente / golpe pesado corpo-a-corpo
}

// Dado de dano VARIADO para a média-alvo de UM ataque (≈ danoPorAtaque). Bate o
// alvo escolhendo faces (d6-d12) e quantidade; prefere faces que deem até ~5 dados
// (ex.: 3d8, 2d10, 4d6), evitando 8d6. O número de ataques é fixo por ND, então o

// Atributos do NPC humano:
//  • PRINCIPAL e CONSTITUIÇÃO (2º) recebem um bom patamar que escala com o ND
//    (≈33% e ≈24% do "extra" acima do piso 8).
//  • Os 4 atributos restantes são RANDOMIZADOS entre 8 e 18 — limitados ao valor
//    da Constituição para ela seguir sendo o segundo foco. Sem min-max.
function distribuirAtributos(budget, order) {
  const FLOOR = 8, MAX_RESTO = 18, TETO = 30; // nenhum atributo passa de 30
  const extra = Math.max(0, budget - FLOOR * 6);
  const principal = Math.min(TETO, FLOOR + Math.round(extra * 0.33));
  const con       = Math.min(TETO, FLOOR + Math.round(extra * 0.24));
  const tetoResto = Math.max(FLOOR, Math.min(MAX_RESTO, con)); // resto nunca passa do 2º foco
  const result = {};
  order.forEach((attr, i) => {
    if (i === 0)      result[attr] = principal;
    else if (i === 1) result[attr] = con;
    else              result[attr] = FLOOR + Math.floor(Math.random() * (tetoResto - FLOOR + 1));
  });
  return result;
}

const mod = (v) => Math.floor((v - 10) / 2);

// ── Glue p/ o gerador ─────────────────────────────────────────────────────────
// Arquétipo explícito (escolha do usuário) define o atributo principal; CON segue
// sempre como 2º foco (convenção do Electron — criaturas são resistentes).
const ARQ_PRINCIPAL = { dominio: 'pres', robusto: 'forca', desastre: 'forca', assassino: 'agi', suporte: 'sab' };
function orderFromArq(p) {
  const rest = ['forca', 'agi', 'int', 'sab', 'pres'].filter(k => k !== p);
  return [p, 'con', ...rest];
}
function pickOrder(isMaldicao, arquetipo, ataqueTema) {
  const p = ARQ_PRINCIPAL[arquetipo];                 // só p/ arquétipo explícito (não 'aleatorio')
  if (p) return orderFromArq(p);
  if (isMaldicao) return ordemMaldicao(ataqueTema);   // aleatório + maldição → ordem pelo tema (Electron)
  return ['forca', 'con', 'agi', 'pres', 'sab', 'int']; // humanoide neutro
}

// Gera os atributos do NPC já nas colunas *_val do patch. `order` (opcional) força
// a ordem (ex.: do estilo do humanoide); senão usa pickOrder (arquétipo/tema).
export function gerarAtributosNpc({ budget, isMaldicao, ataqueTema, arquetipo, order }) {
  const ord = (Array.isArray(order) && order.length === 6) ? order : pickOrder(isMaldicao, arquetipo, ataqueTema);
  const a = distribuirAtributos(Math.max(48, Number(budget) || 48), ord);
  // Maldição (não tão comum, ~20%): UM atributo dos "resto" (nunca o principal nem a
  // CON) vira uma FRAQUEZA de mínimo 4. Os pontos liberados são REDISTRIBUÍDOS pros
  // outros (que sobem), mantendo o total. Só esse 1 fica baixo; os demais seguem ≥8
  // (evita dois atributos muito baixos). Escolhe o MENOR dos resto pra virar a fraqueza.
  if (isMaldicao && Math.random() < 0.20) {
    const restKeys = ord.slice(2);
    let alvo = restKeys[0];
    for (const k of restKeys) if (a[k] < a[alvo]) alvo = k;
    // Valor da fraqueza: mínimo 4, mas pode ser 5, 6 ou 7 (não fica travado em 4).
    const novoVal = 4 + Math.floor(Math.random() * 4); // 4..7
    if (a[alvo] > novoVal) {
      let liberados = a[alvo] - novoVal;
      a[alvo] = novoVal;
      // redistribui de volta: principal/CON (teto 30) e demais resto (teto 18), 1 ponto por vez.
      const recebe = [ord[0], ord[1], ...restKeys.filter(k => k !== alvo)];
      let i = 0, guard = 0;
      while (liberados > 0 && guard++ < 300) {
        const k = recebe[i % recebe.length];
        const teto = (k === ord[0] || k === ord[1]) ? 30 : 18;
        if (a[k] < teto) { a[k]++; liberados--; }
        i++;
      }
    }
  }
  return {
    forca_val: a.forca, agi_val: a.agi, con_val: a.con,
    int_val: a.int, sab_val: a.sab, pres_val: a.pres,
  };
}

export { distribuirAtributos, ordemMaldicao, classificarAtaque };
