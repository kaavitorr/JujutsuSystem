import Ruleset from "../../../systems/ruleset.mjs";
import { contextoEnergiaReversa, energiaReversaDisponivel, escolherRecuperacaoReversa,
  usarEnergiaReversa } from "./energia-reversa.mjs";

const scope = "jujutsu-system";
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const pending = new WeakSet();
const bound = new WeakSet();
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Narrative exceptions remain editable; only unambiguous origin/path bases are inferred. */
export function contextoReversa1(actor) {
  if (Ruleset.isV2()) return null;
  const items = Array.from(actor.items ?? []);
  if (items.some(item => item.type === "class" && ((item.identifier ?? item.system?.identifier) === "restringido"
    || normalize(item.name).includes("restringido")))) return null;
  const names = items.map(item => normalize(item.name));
  const base = names.some(name => name.includes("feto amaldicoado")) ? 25
    : names.some(name => name === "maldicao" || name === "espirito amaldicoado") ? 20
      : names.some(name => name.includes("mestre de barreiras")) ? 30
        : names.some(name => name === "sentinela") ? 35 : 40;
  const configured = actor.getFlag(scope, "reversaCDBase");
  const cdBase = configured === undefined ? base : integer(configured);
  return { ...contextoEnergiaReversa(actor), despertada: energiaReversaDisponivel(actor),
    cdBase, cd: Math.max(0, cdBase - integer(actor.getFlag(scope, "reversaCDReducao"))),
    reducao: integer(actor.getFlag(scope, "reversaCDReducao")),
    dadosMax: integer(actor.system.attributes.prof) * 2 };
}

export async function testarDespertarReversa1(actor) {
  if (Ruleset.isV2() || !actor?.isOwner || pending.has(actor) || energiaReversaDisponivel(actor)) return false;
  const context = contextoReversa1(actor);
  if (!context) return false;
  pending.add(actor);
  try {
    const rolls = await actor.rollSkill({ skill: "Cont", ability: "con", target: context.cd });
    const roll = rolls?.[0];
    if (!roll || roll.total < context.cd) return false;
    await actor.update({ "system.manipulation.abilities.energiaReversa.unlocked": true });
    ui.notifications.info("Energia Reversa despertada.");
    return true;
  } finally { pending.delete(actor); }
}

export async function registrarFulgorReversa1(actor) {
  if (Ruleset.isV2() || !actor?.isOwner || !contextoReversa1(actor)) return;
  const updates = {};
  if (actor.getFlag(scope, "fulgorZona") && !actor.getFlag(scope, "reversaZonaDescanso")) {
    updates[`flags.${scope}.reversaCDReducao`] = integer(actor.getFlag(scope, "reversaCDReducao")) + 1;
    updates[`flags.${scope}.reversaZonaDescanso`] = true;
  }
  if (energiaReversaDisponivel(actor)) updates[`flags.${scope}.reversaRecuperacao`] = {
    tipo: "fulgor", combatId: game.combat?.started ? game.combat.id : null, restante: 10
  };
  if (Object.keys(updates).length) await actor.update(updates);
  if (contextoEnergiaReversa(actor).podeRecuperar) await escolherRecuperacaoReversa(actor);
}

export async function registrarDescansoReversa1(actor, result) {
  if (Ruleset.isV2() || !actor?.isOwner || !(result?.longRest ?? result?.type === "long")) return;
  const context = contextoReversa1(actor);
  if (!context) return;
  await actor.update({ [`flags.${scope}.reversaZonaDescanso`]: false,
    [`flags.${scope}.reversaRecuperacao`]: { tipo: "descanso", restante: Math.max(0, context.max - context.value) } });
  if (context.despertada && contextoEnergiaReversa(actor).podeRecuperar) await escolherRecuperacaoReversa(actor);
}

/** The fallback spends refined energy, never the total reserve or PER. */
export async function curarEmergencia1(actor, dados) {
  if (Ruleset.isV2() || !actor?.isOwner || !energiaReversaDisponivel(actor) || pending.has(actor)) return false;
  const context = contextoReversa1(actor);
  const combat = game.combat?.started ? game.combat : null;
  const ownTurn = !combat || combat.combatant?.actor === actor || (actor.uuid && combat.combatant?.actor?.uuid === actor.uuid);
  const turnKey = combat ? `${combat.round}:${combat.combatant?.id}` : null;
  const previous = actor.getFlag(scope, "energiaReversaRodada");
  const flag = combat && previous?.combatId === combat.id && previous.turnKey === turnKey ? previous : {};
  if (!context || context.value !== 0 || !ownTurn || flag.bonusEmergencia || Number(actor.system.attributes.hp.value) <= 0
    || ["unconscious", "inconsciente", "jj-inconsciente"].some(status => actor.statuses?.has(status)) || !Number.isInteger(dados)
    || dados < 1 || dados + integer(flag.dadosEmergencia) > context.dadosMax
    || integer(actor.system.energy.generated) < dados * 2) {
    ui.notifications.warn("Com a reserva vazia, use sua ação bônus no seu turno: 2 PA Gerados por d4, até o dobro da proficiência.");
    return false;
  }
  pending.add(actor);
  try {
    const roll = await new Roll(`${dados}d4`).evaluate();
    const current = game.combat?.started ? game.combat : null;
    if ((current?.id ?? null) !== (combat?.id ?? null)
      || (current && `${current.round}:${current.combatant?.id}` !== turnKey)) return false;
    if (integer(actor.system.energy.generated) < dados * 2 || integer(actor.system.legacy2.reverseEnergy.value) !== 0) return false;
    const hp = actor.system.attributes.hp;
    const value = Math.min(hp.effectiveMax ?? hp.max, Number(hp.value) + Math.max(0, roll.total));
    const recovered = Math.max(0, value - hp.value);
    const updates = { "system.energy.generated": integer(actor.system.energy.generated) - dados * 2,
      "system.attributes.hp.value": value };
    if (combat) updates[`flags.${scope}.energiaReversaRodada`] = { combatId: combat.id,
      rodada: combat.round, turnKey, pontos: context.pontosNaRodada,
      dadosEmergencia: integer(flag.dadosEmergencia) + dados, bonusEmergencia: true };
    await actor.update(updates, { isEnergySystem: true });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Reservas esgotadas — ação bônus: ${dados * 2} PA Gerados; ${recovered} PV recuperados.` });
    return true;
  } finally { pending.delete(actor); }
}

async function escolherEmergencia1(actor) {
  const context = contextoReversa1(actor);
  if (!context) return;
  const max = Math.min(context.dadosMax, Math.floor(integer(actor.system.energy.generated) / 2));
  const dados = await foundry.applications.api.DialogV2.wait({
    window: { title: "Reservas esgotadas" },
    content: `<p>Ação bônus no seu turno. Cada d4 custa 2 PA de Energia Gerada.</p>
      <label>Dados d4 <input name="dados" type="number" min="1" max="${max}" value="1" step="1"></label>`,
    buttons: [{ action: "heal", label: "Curar", default: true,
      callback: (_event, _button, dialog) => Number(dialog.element.querySelector('[name="dados"]').value) },
    { action: "cancel", label: "Cancelar", callback: () => null }], rejectClose: false, close: () => null
  });
  if (dados !== null && dados !== undefined) return curarEmergencia1(actor, dados);
}

export async function configurarReversa1(actor) {
  const context = contextoReversa1(actor);
  if (!actor.isOwner || !context) return;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Energia Reversa" },
    content: `<div class="jj-er1-config">
      <label>Reserva atual <input name="value" type="number" min="0" value="${context.value}" step="1"></label>
      <label>Reserva máxima <input name="max" type="number" min="0" value="${context.max}" step="1"></label>
      <label>PER por turno <input name="maxPerRound" type="number" min="0" value="${context.maximoRodada}" step="1"></label>
      <label>CD inicial de aprendizado <input name="cdBase" type="number" min="0" value="${context.cdBase}" step="1"></label>
      <label>Redução permanente da CD <input name="reducao" type="number" min="0" value="${context.reducao}" step="1"></label>
      <label><input name="unlocked" type="checkbox" ${context.despertada ? "checked" : ""}> Energia Reversa despertada</label>
      <p>Despertar natural no nível 12. O narrador determina quando permitir o teste; um 20 natural não garante sucesso.</p>
    </div>`,
    buttons: [{ action: "save", label: "Salvar", default: true, callback: (_event, _button, dialog) => {
      const form = dialog.element;
      return { ...Object.fromEntries(["value", "max", "maxPerRound", "cdBase", "reducao"].map(key => [key, Number(form.querySelector(`[name="${key}"]`).value)])),
        unlocked: form.querySelector('[name="unlocked"]').checked };
    } }, { action: "cancel", label: "Cancelar", callback: () => null }], rejectClose: false, close: () => null
  });
  if (!result) return;
  if (["value", "max", "maxPerRound", "cdBase", "reducao"].some(key => !Number.isInteger(result[key]) || result[key] < 0)
    || result.value > result.max) return void ui.notifications.warn("Confira os valores e os limites da reserva.");
  await actor.update({ "system.legacy2.reverseEnergy.value": result.value,
    ...(result.max !== context.max ? { "system.legacy2.reverseEnergy.max": result.max } : {}),
    ...(result.maxPerRound !== context.maximoRodada ? { "system.legacy2.reverseEnergy.maxPerRound": result.maxPerRound } : {}),
    [`flags.${scope}.reversaCDBase`]: result.cdBase, [`flags.${scope}.reversaCDReducao`]: result.reducao,
    "system.manipulation.abilities.energiaReversa.unlocked": result.unlocked });
}

export function setupReversa1(element, actor) {
  const box = element.querySelector(".jj-er1-box");
  if (!box || bound.has(box) || !actor.isOwner || Ruleset.isV2()) return;
  bound.add(box);
  box.addEventListener("click", event => {
    const action = event.target.closest("[data-er1-action]")?.dataset.er1Action;
    if (!action) return;
    event.preventDefault();
    const actions = { heal: () => curarEnergiaReversa1(actor, 1), limb: () => curarEnergiaReversa1(actor, 2),
      recover: () => escolherRecuperacaoReversa(actor), emergency: () => escolherEmergencia1(actor),
      awaken: () => testarDespertarReversa1(actor), config: () => configurarReversa1(actor) };
    Promise.resolve().then(actions[action]).catch(error => {
      console.error(error); ui.notifications.error("Não foi possível concluir o uso de Energia Reversa.");
    });
  });
}

export function curarEnergiaReversa1(actor, pontos = 1) {
  const target = Array.from(game.user.targets ?? [])[0]?.actor;
  const other = target && target !== actor && (!actor.uuid || target.uuid !== actor.uuid);
  if (!other) return usarEnergiaReversa(actor, pontos);
  if (!actor.system?.manipulation?.abilities?.energiaFlexivel?.unlocked) {
    ui.notifications.warn("Energia Flexível é necessária para curar outra criatura."); return false;
  }
  if (target.isOwner === false) {
    ui.notifications.warn("Peça ao narrador permissão para aplicar a cura no alvo."); return false;
  }
  if (pontos === 2) {
    ui.notifications.warn("A regeneração de membros de aliados exige Reversão Suprema; resolva esse uso com o narrador."); return false;
  }
  return usarEnergiaReversa(actor, pontos, { alvo: target, metade: true });
}

Hooks.on("jujutsu.fulgorNegro", registrarFulgorReversa1);
Hooks.on("dnd5e.restCompleted", registrarDescansoReversa1);
