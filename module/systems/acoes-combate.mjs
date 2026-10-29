import Ruleset from "./ruleset.mjs";
import { reducaoCustoSeisOlhos } from "./seis-olhos.mjs";
import { MODIFICADORES_CONDICOES, MODIFICADORES_DEFESA } from "../applications/actor/jj/conditions.mjs";
import { EnergySystem } from "./energy.mjs";

/**
 * ── AÇÕES 2.0 (Pontos de Ação) ──────────────────────────────────────────────
 * • Uso de técnica/atividade consome o Número de Ações configurado na
 *   ATIVAÇÃO (activation.value; tipo fixo "action") de legacy2.actions.value.
 *   Sem PA suficientes, o uso é bloqueado.
 * • No início do turno do combatente no combate, o personagem recupera TODOS
 *   os Pontos de Ação (regra 2.1/2.9).
 * Auto-registrado via Hooks (importado por efeito colateral).
 */

const nomeCampo = "Pontos de Ação";

/**
 * Custo em ações da ativação da activity (0 quando ausente). O nível da
 * activity vence; sem valor na activity, cai para a ativação do ITEM
 * (fichas de técnica sem activity configuram o custo no item).
 */
function custoBaseEmAcoes(activity) {
  const valor = activity?.activation?.value ?? activity?.item?.system?.activation?.value;
  return Math.max(0, Math.floor(Number(valor) || 0));
}

/**
 * Custo efetivo com as escolhas do modal (2.0): Selos de Mão reduzem o custo
 * da ativação (mínimo 1 ação) e o gesto escolhido soma +1 ação. Os selos
 * usados são limitados ao pool disponível do ator.
 */
export function custoEfetivoEmAcoes(activity, usageConfig, actor) {
  let base = custoBaseEmAcoes(activity);
  // Recarga (lod): atacar com a arma descarregada custa +1 Ponto de Ação
  // (marcando "Recarregar agora" no dialog, o ataque sai carregado).
  const item = activity?.item;
  if ( (item?.type === "weapon") && Ruleset.temPropriedade(item, "lod")
    && (item.getFlag?.("jujutsu-system", "carregada") === false) && !usageConfig?.legacy2?.recarregar ) base += 1;
  // Desorientado: qualquer ação que use PA custa 1 ⬢ adicional.
  if ( actor?.statuses?.has?.("jj-desorientado") && (base > 0) ) base += 1;
  // Seis Olhos: técnicas e feitiços custam 2 PA a menos (1 vendado) — pode zerar.
  const seis = reducaoCustoSeisOlhos(actor);
  if ( seis && base > 0 ) base = Math.max(0, base - seis);
  const l2 = usageConfig?.legacy2 ?? {};
  const pool = actor ? Math.max(0, Math.floor(Number(actor.getFlag?.("jujutsu-system", "selos") ?? 0))) : 0;
  const selos = Math.min(Math.max(0, Math.floor(Number(l2?.selos) || 0)), 2, l2?.manipulacao ? 2 : pool);
  const gestoAcao = l2?.gesto ? 1 : 0;
  if ( base <= 0 ) return gestoAcao;
  return Math.max(1, base + gestoAcao - selos);
}

/**
 * Consome PA do ator pelo custo de ativação de um ITEM (técnicas sem
 * activity — o caminho item.use → displayCard não passa pelos hooks de
 * activity). Retorna `false` (sem consumir) quando não há PA suficientes.
 */
export async function consumirPAItem(item) {
  if ( !Ruleset.isV2() ) return true;
  const actor = item?.actor;
  const custo = Math.max(0, Math.floor(Number(item?.system?.activation?.value ?? 0) || 0));
  if ( !actor || (custo <= 0) ) return true;
  const atual = Number(actor.system.legacy2?.actions?.value ?? 0);
  if ( atual < custo ) {
    ui.notifications.warn(`${item.name} custa ${custo} ${nomeCampo} — ${actor.name} tem apenas ${atual}.`);
    return false;
  }
  await actor.update({ "system.legacy2.actions.value": Math.max(0, atual - custo) });
  return true;
}

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  if ( !Ruleset.isV2() ) return;
  const actor = activity?.actor ?? activity?.item?.actor;
  const custo = custoEfetivoEmAcoes(activity, usageConfig, actor);
  if ( !actor || (custo <= 0) ) return;
  // Enfurecido (2.0): só pode gastar PA com ataques — o uso de técnica e de
  // outras atividades com custo em PA fica bloqueado.
  if ( (activity.type !== "attack") && actor.statuses?.has?.("jj-enfurecido") ) {
    ui.notifications.warn(`⚡ ${actor.name} está Enfurecido — só pode gastar PA com ataques.`);
    return false;
  }
  const atual = Number(actor.system.legacy2?.actions?.value ?? 0);
  if ( atual >= custo ) return;
  ui.notifications.warn(`${activity.item?.name ?? "Técnica"} custa ${custo} ${nomeCampo} — `
    + `${actor.name} tem apenas ${atual}.`);
  return false;
});

Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig) => {
  if ( !Ruleset.isV2() ) return;
  const actor = activity?.actor ?? activity?.item?.actor;
  const l2 = usageConfig?.legacy2 ?? {};
  // Use the state validated before consumption: seals and loaded weapons change below.
  const custo = custoEfetivoEmAcoes(activity, usageConfig, actor);
  // Selos de Mão: consome os usos do pool (Manipulação de Selos paga com deslocamento
  // e NÃO é limitada pelo pool). Os selos usados são calculados uma vez só — o gasto
  // acontece ANTES do early-return de custo zero (selo escolhido em técnica gratuita
  // é gasto mesmo assim).
  const pool = Math.max(0, Math.floor(Number(actor?.getFlag?.("jujutsu-system", "selos") ?? 0)));
  const selosPedidos = Math.min(Math.max(0, Math.floor(Number(l2?.selos) || 0)), 2);
  const selos = l2?.manipulacao ? selosPedidos : Math.min(selosPedidos, pool);
  if ( (selos > 0) && !l2?.manipulacao && (pool > 0) ) {
    await actor.update({ "flags.jujutsu-system.selos": pool - selos });
  }
  if ( (selos > 0) && l2?.manipulacao ) {
    const metade = selos < 2;
    ui.notifications.info(`${actor.name}: selo pago com deslocamento (${metade ? "metade" : "zero"} até o fim do turno).`);
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `Selos: Manipulação (${metade ? "deslocamento pela metade" : "deslocamento 0"})`,
      icon: "systems/jujutsu-system/icons/svg/items/feature.svg",
      origin: actor.uuid,
      duration: { rounds: 1, turns: 1, startRound: game.combat?.round ?? 0, startTurn: game.combat?.turn ?? 0 },
      changes: [{ key: "system.attributes.movement.speeds.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
        value: metade ? "0.5" : "0" }]
    }]);
  }
  // Recarga (lod): o ataque descarrega a arma; "Recarregar agora" a deixa carregada.
  const itemAtaque = activity?.item;
  if ( (itemAtaque?.type === "weapon") && Ruleset.temPropriedade(itemAtaque, "lod") ) {
    await itemAtaque.setFlag?.("jujutsu-system", "carregada", !!usageConfig?.legacy2?.recarregar);
  }
  if ( !actor || (custo <= 0) ) return;
  const atual = Number(actor.system.legacy2?.actions?.value ?? 0);
  if ( atual > 0 ) await actor.update({ "system.legacy2.actions.value": Math.max(0, atual - custo) });
});

/* ── Ciclo de turno no combate (2.1: Reservas de Ação) ──────────────────────
 * Fim do próprio turno: as ações restantes viram Reservas de Ação.
 * Chegada do próprio turno (a partir da 2ª rodada): as Reservas definem o
 * limite de refinamento normal; com 5 ou mais guardadas, até o DOBRO
 * do limite normal, transferido da Energia Total só ao confirmar o modal — e os
 * Pontos de Ação são todos recuperados. As Reservas também dão +1 de
 * iniciativa por ação na rolagem da rodada (iniciativa-dinamica.mjs). */
const turnoEmCurso = new Map(); // combatId → last processed round/combatant key

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if ( !Ruleset.isV2() || !game.user.isGM || !combat.started || options?.turnEvents === false ) return;
  if ( (changed.turn === undefined) && (changed.round === undefined) ) return;
  const atualId = combat.current?.combatantId ?? null;
  if (!atualId) return;
  const anteriorId = combat.previous?.combatantId ?? null;
  const virouRodada = combat.current?.round !== combat.previous?.round;
  if (anteriorId === atualId && !virouRodada) return;
  const autor = game.users?.get?.(userId ?? combat._stats?.lastModifiedBy);
  const autoridade = (autor?.active && autor.isGM ? autor : null) ?? game.users?.activeGM;
  if (autoridade ? autoridade.id !== game.user.id : userId && userId !== game.user.id) return;
  const key = `${combat.round}:${atualId}`;
  if (turnoEmCurso.get(combat.id) === key) return;
  turnoEmCurso.set(combat.id, key);
  try {

    // Fim do próprio turno — inclusive quando um combatente solitário inicia a próxima rodada.
    if ( anteriorId && ((anteriorId !== atualId) || virouRodada) ) {
      const anterior = combat.combatants.get(anteriorId);
      const actorAnt = anterior?.actor;
      const maxAnt = Number(actorAnt?.system?.legacy2?.actions?.max ?? 0);
      if ( actorAnt && (maxAnt > 0) ) {
        const restantes = Math.max(0, Math.floor(Number(actorAnt.system.legacy2.actions.value ?? 0)));
        await actorAnt.update({ "system.legacy2.reservas.value": restantes });
      }
    }

    // Chegada do próprio turno: recupera ações; o refinamento depende da confirmação do dono.
    const combatente = combat.combatants.get(atualId);
    const actor = combatente?.actor;
    if ( actor ) {
      // Desatento (2.0): remove-se no início do próprio turno.
      if ( actor.statuses?.has("jj-desatento") ) {
        const efeito = actor.effects.find(e => e.statuses?.has("jj-desatento"));
        if ( efeito ) {
          await efeito.delete();
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
            content: `👁️ <strong>Desatento</strong> se removeu — ${actor.name} age normalmente neste turno.` });
        }
      }
      const maximo = Number(actor.system.legacy2?.actions?.max ?? 0);
      const reservas = Math.max(0, Math.floor(Number(actor.system.legacy2?.reservas?.value ?? 0)));
      if ( maximo > 0 ) {
        const updates = {};
        if ( reservas > 0 ) updates["system.legacy2.reservas.value"] = 0;
        const atual = Number(actor.system.legacy2.actions.value ?? 0);
        if ( atual < maximo ) updates["system.legacy2.actions.value"] = maximo;
        if ( !foundry.utils.isEmpty(updates) ) await actor.update(updates, { isEnergySystem: true });
      }
      await EnergySystem.promptTurnStart(actor, {
        reserves: (combat.round ?? changed.round ?? 1) >= 2 ? reservas : 0
      });
    }
  } catch (error) {
    if (turnoEmCurso.get(combat.id) === key) turnoEmCurso.delete(combat.id);
    throw error;
  }
});

/* Combate deletado: limpa o rastro de turno. */
Hooks.on("deleteCombat", (combat) => turnoEmCurso.delete(combat.id));

/* ── DESIDRATADO (2.0): 1 nível de exaustão por hora com a condição ativa ────
 * O toggle da condição grava desidratadoDesde (tempo de mundo) e
 * desidratadoHoras; quando o tempo avança, as horas vencidas convertem em
 * exaustão. Encerra removendo a condição (500 ml de água) — a exaustão
 * acumulada permanece até ser removida pelos meios normais.
 * Consumido pelo gancho updateWorldTime abaixo (um único cliente aplica).
 */
export async function atualizarDesidratado(actor, worldTime) {
  if ( !actor || !actor.statuses?.has?.("jj-desidratado") ) return 0;
  const desde = Math.floor(Number(actor.getFlag?.("jujutsu-system", "desidratadoDesde")) || 0);
  const ja = Math.floor(Number(actor.getFlag?.("jujutsu-system", "desidratadoHoras")) || 0);
  const horas = Math.floor(Math.max(0, worldTime - desde) / 3600);
  const extras = Math.max(0, horas - ja);
  if ( extras <= 0 ) return 0;
  const exaustao = Number(actor.system.attributes.exhaustion) || 0;
  await actor.update({ "system.attributes.exhaustion": exaustao + extras });
  await actor.setFlag("jujutsu-system", "desidratadoHoras", horas);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `💧 <strong>Desidratado</strong>: ${actor.name} sofre <strong>${extras} nível(is) de exaustão</strong> (${horas}h sem água — encerra com 500 ml).` });
  return extras;
}

Hooks.on("updateWorldTime", async (worldTime, delta) => {
  if ( !Ruleset.isV2() || (delta <= 0) ) return;
  const gm = game.users?.activeGM;
  const autoridade = gm ? (gm.id === game.user.id) : true;
  if ( !autoridade ) return;
  for ( const actor of game.actors ) {
    if ( !actor.statuses?.has?.("jj-desidratado") ) continue;
    const gm = game.users?.activeGM;
    const pode = gm ? (gm === game.user) : (actor.isOwner === true);
    if ( !pode ) continue;
    await atualizarDesidratado(actor, worldTime).catch(() => {});
  }
});


/* ── INCONSCIENTE AUTOMÁTICO (2.0): criatura a 0 PV fica Inconsciente ────────
 * Aplica a condição jj-inconsciente quando o PV chega a 0 (CR 0 e sem ações)
 * e remove quando o PV sobe de 0 (cura). Marcada com inconscienteAuto para
 * não tocar em Inconscientes concedidos manualmente pelo Narrador. */
async function sincronizarInconsciente(actor) {
  const hp = actor.system.attributes.hp;
  if ( !hp ) return;
  const efeito = actor.effects.find(e => e.statuses?.has("jj-inconsciente")
    && e.getFlag?.("jujutsu-system", "inconscienteAuto"));
  if ( (hp.value ?? 0) > 0 ) {
    if ( efeito ) await efeito.delete();
    return;
  }
  if ( efeito ) return;
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Inconsciente (0 PV)", icon: "icons/svg/unconscious.svg",
    statuses: ["jj-inconsciente"],
    changes: [
      ...(MODIFICADORES_CONDICOES["jj-inconsciente"] ?? []),
      ...(MODIFICADORES_DEFESA["jj-inconsciente"] ?? [])
    ],
    flags: { "jujutsu-system": { inconscienteAuto: true, isJujutsuCondition: true } }
  }]);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `💫 <strong>${actor.name}</strong> chegou a 0 PV e fica <strong>Inconsciente</strong>.` });
}

Hooks.on("updateActor", (actor) => {
  if ( !Ruleset.isV2() || !actor?.system?.attributes?.hp ) return;
  const gm = game.users?.activeGM;
  const pode = gm ? (gm === game.user) : (actor.isOwner === true);
  if ( !pode ) return;
  sincronizarInconsciente(actor).catch(() => {});
});
