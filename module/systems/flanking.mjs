/**
 * ── FLANQUEAMENTO (2.0) ──────────────────────────────────────────────────────
 * Porta simplificada do cálculo do Crucible (canvas/token.mjs#computeFlanking):
 * o grau de flanqueamento de um alvo é
 *
 *   grau = máx(0, flanqueadores − distração dos aliados − capacidade)
 *
 *   • flanqueadores: inimigos adjacentes ao alvo (grid), conscientes
 *   • distração: aliados adjacentes AO ALVO engajados nos mesmos inimigos
 *   • capacidade:   tamanho do alvo "cabe" mais inimigos sem ser flanqueado
 *                   (Engajamento do ator, incluindo Active Effects)
 *
 * Sem estado persistente: calculado no momento do ataque. Cada grau conta
 * como 1 vantagem (+1, respeitando o teto de 6).
 */

import { engagementValue } from "./engagement.mjs";

const _adjacent = (a, b) => {
  // v14: os tokens não têm gridX/gridY — a adjacência é medida em pixels
  // contra o tamanho do grid (1 quadrado = 1 metro nesta configuração).
  const gs = a.scene?.grid?.size ?? globalThis.canvas?.scene?.grid?.size ?? 100;
  const ax = a.document?.x ?? a.x, ay = a.document?.y ?? a.y;
  const bx = b.document?.x ?? b.x, by = b.document?.y ?? b.y;
  const da = Math.abs(ax - bx);
  const db = Math.abs(ay - by);
  return (da <= gs) && (db <= gs) && ((da + db) > 0);
};

const _hostil = (token, alvo) => {
  // Monstros NÃO engajam monstros: só conta quem é hostil ao alvo pela
  // disposição (PCs e invocações de jogador — que vêm como "Aliado",
  // disposição amigável — diferem do monstro e contam naturalmente).
  return token.disposition !== alvo.disposition;
};

const _ativo = (token) => {
  const actor = token.actor;
  if ( !actor ) return false;
  if ( actor.system?.attributes?.hp?.value <= 0 ) return false;
  const statuses = actor.statuses ?? new Set();
  return ![ "unconscious", "dead", "paralyzed", "unaware", "incapacitated" ].some(s => statuses.has(s));
};

/**
 * Grau de vantagem do alvo por sobrecarga de engajamento (estilo Crucible):
 * cada inimigo consciente adjacente a ele (a 1 metro, quadrado adjacente)
 * acima do Valor de Engajamento dele dá +1 vantagem para TODO ataque contra
 * o alvo — independente de quem ataca.
 * @param {Token} atacante  Token que ataca (só para validar a cena).
 * @param {Token} alvo      Token atacado.
 * @returns {number} Graus (0-6, para casar com o teto de vantagens).
 */
export function grauFlanqueamento(atacante, alvo) {
  if ( !atacante || !alvo || (atacante === alvo) ) return 0;
  const scene = atacante.scene ?? alvo.scene ?? canvas.scene;
  if ( !scene || (atacante.scene !== alvo.scene) ) return 0;

  const engajados = scene.tokens.filter(t =>
    t.actor && (t !== alvo) && _adjacent(t, alvo) && _hostil(t, alvo) && _ativo(t)
  ).length;

  const teto = alvo.actor ? engagementValue(alvo.actor) : 1;
  return Math.max(0, Math.min(6, engajados - teto));
}

/**
 * Calcula o flanqueamento para o próximo ataque do ator a partir do token
 * controlado/alvo marcado. Retorna { graus, nomeAlvo } ou graus 0.
 */
export function flanqueamentoDoAtaque(actor) {
  const atacante = actor?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0];
  const alvo = [...(game.user.targets ?? [])][0] ?? null;
  if ( !atacante || !alvo ) return { graus: 0, nomeAlvo: null };
  return { graus: grauFlanqueamento(atacante, alvo), nomeAlvo: alvo.name };
}
