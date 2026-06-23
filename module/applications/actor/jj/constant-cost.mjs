/**
 * jj/constant-cost.mjs
 * Custo Constante / Concentração: manutenção de PA por turno enquanto a técnica
 * estiver ativa. Liga ao USAR a atividade; drena no início de cada turno do dono;
 * desativa por falta de PA, pelo HUD de combate, ou ao fim do combate.
 * O custo efetivo é resolvido pela própria atividade (getConstantUpkeep):
 * Custo Constante (value) sobrepõe a Concentração (2 PA).
 */

const SCOPE = "jujutsu-system";
const FLAG = "upkeep";   // flag no ATOR: { [activityId]: { itemId, label } }

/** Só um cliente age: GM ativo (se houver) ou o dono do ator. */
function _canAct(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

/** Resolve a atividade viva a partir de uma entrada de upkeep. */
function _activity(actor, info, activityId) {
  return actor.items.get(info?.itemId)?.system?.activities?.get(activityId) ?? null;
}

/**
 * Resolve se a atividade é "ativa/sustentada" e qual o custo. Prioridade:
 *   Custo Constante > Concentração > Duração não-instantânea (sem custo).
 * Cobre o caso de técnicas que "ficam ativas" só pela duração (ex.: 1 minuto),
 * já que o dnd5e não marca isso como ativo por si só.
 * @param {Activity} activity
 * @returns {{active:boolean, value:number, pool:string, type:("constant"|"concentration"|"duration"|null)}}
 */
export function resolveSustained(activity) {
  const up = activity?.getConstantUpkeep?.();
  if ( up?.active ) return up; // type: "constant" | "concentration"
  // Cura automática por turno também mantém a técnica ativa.
  if ( activity?.healLimit?.autoHeal ) return { active: true, value: 0, pool: "generated", type: "duration" };
  // Duração não-instantânea (na ATIVIDADE OU no item/feitiço) → técnica ativa, sem custo.
  // A duração da atividade tem default "inst", então checamos as duas e basta UMA
  // ser não-instantânea (ex.: feitiço de 1 minuto com atividade "inst").
  const units = [activity?.duration?.units, activity?.item?.system?.duration?.units];
  if ( units.some(u => u && u !== "inst") ) return { active: true, value: 0, pool: "generated", type: "duration" };
  return { active: false, value: 0, pool: "generated", type: null };
}

/**
 * Upkeeps ATIVOS e resolvidos do ator (para o HUD).
 * @returns {Array<{activityId:string, itemId:string, label:string, value:number, pool:string, type:string}>}
 */
export function getActorUpkeeps(actor) {
  const flag = actor?.getFlag(SCOPE, FLAG);
  if ( !flag ) return [];
  const out = [];
  for ( const [activityId, info] of Object.entries(flag) ) {
    const act = _activity(actor, info, activityId);
    const up = resolveSustained(act);
    if ( !up?.active ) continue;
    out.push({ activityId, itemId: info.itemId, label: info.label ?? act.item.name,
               value: up.value, pool: up.pool, type: up.type });
  }
  return out;
}

/** Desativa um upkeep específico (remove a entrada da flag). */
export async function deactivateUpkeep(actor, activityId) {
  const flag = actor?.getFlag(SCOPE, FLAG);
  if ( !flag || !(activityId in flag) ) return;
  const label = flag[activityId]?.label;
  await actor.update({ [`flags.${SCOPE}.${FLAG}.-=${activityId}`]: null });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀 <b>${actor.name}</b> desativou a manutenção de <b>${label ?? "técnica"}</b>.`
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/**
 * Ativa o upkeep (Custo Constante / Concentração) de uma atividade. Chamado no
 * `dnd5e.preUseActivity` para cobrir TODOS os caminhos de uso — inclusive os
 * cards customizados (ataque, redução, extras) que vetam o fluxo padrão e
 * impediriam o `postUseActivity` de disparar.
 * @param {Activity} activity
 */
export async function activateUpkeep(activity) {
  const actor = activity?.item?.actor;
  if ( !actor || !actor.isOwner ) return;
  const up = resolveSustained(activity);
  if ( !up?.active ) return;
  if ( actor.getFlag(SCOPE, FLAG)?.[activity.id] ) return; // já ativo → não re-anuncia

  const label = `${activity.item.name}${activity.name ? " — " + activity.name : ""}`;
  await actor.update({ [`flags.${SCOPE}.${FLAG}.${activity.id}`]: { itemId: activity.item.id, label } });

  const detalhe = up.type === "concentration" ? "<b>Concentração</b> 🧠"
    : up.type === "duration" ? "<b>Técnica Ativa</b> (duração)"
    : `<b>Custo Constante</b> — <b>${up.value} PA/turno</b> (${up.pool === "total" ? "Total" : "Gerada"})`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀 <b>${actor.name}</b> ativou ${detalhe} em ${label}. Desative no HUD de combate.`
  });
}

// preUseActivity dispara para TODO uso (todos os listeners rodam mesmo se um veta).
Hooks.on("dnd5e.preUseActivity", (activity) => { activateUpkeep(activity); });

// Drena o custo no início do turno do dono; desativa quem não puder pagar.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const actor = combat.combatants.get(current?.combatantId)?.actor;
  if ( !actor || !_canAct(actor) ) return;
  const flag = actor.getFlag(SCOPE, FLAG);
  if ( !flag || foundry.utils.isEmpty(flag) ) return;

  let genLeft = actor.system.energy?.generated ?? 0;
  let totLeft = actor.system.energy?.total ?? 0;
  const gen0 = genLeft, tot0 = totLeft;
  const updates = {};
  const drained = [], deactivated = [];

  for ( const [activityId, info] of Object.entries(flag) ) {
    const act = _activity(actor, info, activityId);
    const up = act?.getConstantUpkeep?.();
    const label = info.label ?? act?.item?.name ?? "técnica";
    if ( !up?.active ) { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; continue; } // config removida
    if ( up.pool === "total" ) {
      if ( totLeft >= up.value ) { totLeft -= up.value; drained.push(`${label}: −${up.value} (Total)`); }
      else { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; deactivated.push(label); }
    } else {
      if ( genLeft >= up.value ) { genLeft -= up.value; drained.push(`${label}: −${up.value} (Gerada)`); }
      else { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; deactivated.push(label); }
    }
  }

  if ( genLeft !== gen0 ) updates["system.energy.generated"] = genLeft;
  if ( totLeft !== tot0 ) updates["system.energy.total"] = totLeft;
  if ( foundry.utils.isEmpty(updates) ) return;
  await actor.update(updates, { isEnergySystem: true });

  if ( drained.length || deactivated.length ) {
    let content = `🌀 <b>${actor.name}</b> — manutenção de técnicas:`;
    if ( drained.length ) content += `<br>${drained.join("<br>")}`;
    if ( deactivated.length ) content += `<br><span style="color:#b22222;">Desativada(s) por falta de PA: ${deactivated.join(", ")}</span>`;
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  }
});

// Limpa upkeeps ao encerrar o combate.
Hooks.on("deleteCombat", async (combat) => {
  for ( const c of (combat?.combatants ?? []) ) {
    const actor = c.actor;
    if ( !actor || !_canAct(actor) ) continue;
    const flag = actor.getFlag(SCOPE, FLAG);
    if ( flag && !foundry.utils.isEmpty(flag) ) await actor.unsetFlag(SCOPE, FLAG);
  }
});
