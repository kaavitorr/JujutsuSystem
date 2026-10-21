import Ruleset from "../../../systems/ruleset.mjs";
import { MODIFICADORES_MOVIMENTO } from "../../../systems/condicoes-dano.mjs";
import { temSeisOlhos, modoSeisOlhos } from "../../../systems/seis-olhos.mjs";

/**
 * ── SEIS OLHOS (2.0) — camada interativa ────────────────────────────────────
 * Toggle (1 Ponto de Ação por transição), Sobrecarga Mental (3d4 psíquico ao
 * desvendar e no início de cada turno em combate), Análise de Fluxo (1 ⬢ +
 * Intelecto/Feitiço CD 15 + ND) e exaustão ao fim do combate após mais de 2
 * rodadas seguidas. Os bônus numéricos vivem em systems/seis-olhos.mjs.
 */

async function gastePA(actor) {
  const pa = Number(actor?.system?.legacy2?.actions?.value ?? 0);
  if (pa < 1) {
    ui.notifications.warn("Isto custa 1 Ponto de Ação [⬢] — sem PA disponível!");
    return false;
  }
  await actor.update({ "system.legacy2.actions.value": pa - 1 });
  return true;
}

/**
 * Sobrecarga Mental: 3d4 de dano Psíquico DIRETO na vida — ignora escudo,
 * Pontos de Armadura e pontos de vida temporários (regra do Efeito Colateral).
 */
async function sobrecargaMental(actor, contexto) {
  const rolagem = await new Roll("3d4").evaluate();
  await rolagem.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `⚡ Sobrecarga Mental (${contexto}) — 3d4 de dano Psíquico direto na vida`
  });
  const hp = actor.system.attributes.hp;
  await actor.update({ "system.attributes.hp.value": Math.max(0, (hp.value ?? 0) - rolagem.total) });
}

/**
 * Transição de estado dos Seis Olhos. Custa 1 Ponto de Ação; desvendar
 * aplica a Sobrecarga Mental imediata.
 */
export async function alternarSeisOlhos(actor, novoModo) {
  if (!Ruleset.isV2() || !temSeisOlhos(actor)) return false;
  if (!["sealed", "full"].includes(novoModo)) return false;
  const atual = modoSeisOlhos(actor);
  if (atual === novoModo) return false;
  if (!(await gastePA(actor))) return false;
  await actor.update({ "flags.jujutsu-system.seisOlhosMode": novoModo });
  const rodada = game.combat?.round ?? null;
  await actor.setFlag("jujutsu-system", "seisOlhosRodadaInicial",
    novoModo === "full" && rodada ? rodada : null);
  if (novoModo === "full") await sobrecargaMental(actor, "ao desvendar");
  return true;
}

/**
 * Análise de Fluxo: 1 ⬢ + Teste de Intelecto (Feitiço) contra CD 15 + ND da
 * criatura. Sucesso: os feitiços dela não podem ter vantagem contra você.
 */
export async function analiseDeFluxo(actor, alvo) {
  if (!Ruleset.isV2()) return false;
  if (modoSeisOlhos(actor) !== "full") {
    ui.notifications.warn("Análise de Fluxo exige os Seis Olhos desvendados.");
    return false;
  }
  if (!alvo) {
    ui.notifications.warn("Mire na criatura que usou a técnica antes de analisar.");
    return false;
  }
  const cd = 15 + Ruleset.nivel(alvo);
  const resultado = await actor.rollSkill?.({ skill: "arc", ability: "int" });
  const total = Array.isArray(resultado) ? resultado[0]?.total : resultado?.total;
  if (!Number.isFinite(total)) return false; // modal cancelado — nada gasto
  if (!(await gastePA(actor))) return false; // a tentativa consome o ⬢ (sucesso ou falha)
  if (total < cd) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `👁️ <strong>${actor.name}</strong> falha na Análise de Fluxo (${total} vs CD ${cd}).` });
    return false;
  }
  await actor.setFlag("jujutsu-system", "analiseFluxo", { alvoUuid: alvo.uuid, nome: alvo.name });
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `👁️ <strong>${actor.name}</strong> analisa o fluxo de <strong>${alvo.name}</strong> `
      + `(${total} vs CD ${cd})! Os feitiços dela não podem ter vantagem contra ele.` });
  return true;
}

// ── Combate: Sobrecarga no início do turno · exaustão e limpeza no fim ─────
Hooks.on("updateCombat", async (combat, changed) => {
  if (!Ruleset.isV2() || !game.user.isGM) return;
  if (!("turn" in changed) && !("round" in changed)) return;
  const ator = combat.combatant?.actor;
  if (!ator || modoSeisOlhos(ator) !== "full") return;
  // A contagem de rodadas começa no primeiro turno do combate com o poder ativo.
  if (!ator.getFlag?.("jujutsu-system", "seisOlhosRodadaInicial")) {
    await ator.setFlag?.("jujutsu-system", "seisOlhosRodadaInicial", combat.round ?? 1);
  }
  const incapacitado = ["jj-paralisado", "jj-incapacitado", "jj-sonolento"]
    .some(s => ator.statuses?.has?.(s)) || ator.system.attributes.hp.value <= 0;
  if (incapacitado) return;
  await sobrecargaMental(ator, "início do turno");
});

Hooks.on("deleteCombat", async (combat) => {
  if (!Ruleset.isV2() || !game.user.isGM) return;
  for (const combatente of combat.combatants) {
    const ator = combatente.actor;
    if (!ator) continue;
    await ator.unsetFlag?.("jujutsu-system", "analiseFluxo");
    if (modoSeisOlhos(ator) !== "full") continue;
    const inicial = Number(ator.getFlag?.("jujutsu-system", "seisOlhosRodadaInicial") ?? 0);
    const rodadas = inicial ? (combat.round ?? 1) - inicial + 1 : 1;
    if (rodadas > 2) {
      // Exausto é ACUMULÁVEL: soma +1 nível (máx. 6) no que já existir.
      const existente = ator.effects.find(e => e.statuses?.has("jj-exausto"));
      const nivelAtual = Number(existente?.getFlag?.("jujutsu-system", "exaustoNivel") ?? (existente ? 1 : 0));
      const novoNivel = Math.min(6, nivelAtual + 1);
      const changes = [{ key: "system.attributes.movement.walk",
        mode: 2, value: -(1.5 * novoNivel) }];
      if ( existente ) await existente.update({ changes, "flags.jujutsu-system.exaustoNivel": novoNivel });
      else await ator.createEmbeddedDocuments("ActiveEffect", [{
        name: "Exausto (Seis Olhos)", icon: "icons/svg/degen.svg",
        statuses: ["jj-exausto"], disabled: false, changes,
        flags: { "jujutsu-system": { isJujutsuCondition: true, exaustoNivel: novoNivel } }
      }]);
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
        content: `😵 <strong>${ator.name}</strong> usou os Seis Olhos por ${rodadas} rodadas seguidas e sofre <strong>${novoNivel} nível(is) de Exaustão</strong>.` });
    }
    await ator.unsetFlag?.("jujutsu-system", "seisOlhosRodadaInicial");
  }
});

/**
 * Compatibilidade com a interface 1.0 (radios Selado/Poder Completo): grava o
 * modo. Na 2.0 nenhum ActiveEffect é criado — os bônus são computados no
 * prepare, no acerto e no custo das técnicas a partir da flag.
 */
export async function applySeiOlhosEffects(actor, mode) {
  await actor?.setFlag?.("jujutsu-system", "seisOlhosMode", mode || null);
}
