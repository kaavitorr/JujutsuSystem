/**
 * feto-amaldicoado.mjs
 *
 * Regras especiais para a origem/raça "feto-amaldicoado":
 *  - Pode comprar "Energia Reversa" ignorando seus requisitos (estágio e habilidades)
 *  - O custo é reduzido à metade (arredondado para cima)
 *
 * Integra-se ao sistema de manipulação via dois pontos de extensão:
 *  1. hasFetoCurse(actor)          — verifica se o ator tem a origem
 *  2. applyFetoRules(abilityId, actor, result) — modifica o resultado de canUnlockAbility
 */

const ORIGIN_ID   = "feto-amaldicoado";
const ABILITY_ID  = "energiaReversa";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna true se o ator possuir a raça/origem "feto-amaldicoado".
 * @param {Actor} actor
 * @returns {boolean}
 */
export function hasFetoCurse(actor) {
  return actor.items.some(
    i => i.type === "race" && (i.system?.identifier ?? i.name?.slugify()) === ORIGIN_ID
  );
}

/**
 * Dado um resultado bruto de canUnlockAbility, aplica as modificações do Feto
 * Amaldiçoado caso o abilityId seja "energiaReversa" e o ator tenha a origem.
 *
 * @param {string} abilityId
 * @param {Actor}  actor
 * @param {{ can: boolean, reason?: string, cost?: number }} result  resultado original
 * @param {object} abilityDef  definição da habilidade em MANIPULATION_ABILITIES
 * @returns {{ can: boolean, reason?: string, cost: number, fetoDiscount: boolean }}
 */
export function applyFetoRules(abilityId, actor, result, abilityDef) {
  if ( abilityId !== ABILITY_ID ) return { ...result, fetoDiscount: false };
  if ( !hasFetoCurse(actor) )    return { ...result, fetoDiscount: false };

  const baseCost      = abilityDef?.cost ?? 10;
  const discountedCost = Math.ceil(baseCost / 2);
  const cursePoints   = actor.system.curseResources?.cursePoints ?? 0;

  // Ignora requisitos de estágio e habilidades; só verifica PM
  if ( cursePoints < discountedCost ) {
    return {
      can: false,
      reason: `Faltam ${discountedCost - cursePoints} PM (custo Feto: ${discountedCost})`,
      cost: discountedCost,
      fetoDiscount: true
    };
  }

  return { can: true, cost: discountedCost, fetoDiscount: true };
}
