import Ruleset from "./ruleset.mjs";
import { ALTERNATIVE_SAVES, alternativeSavesEnabled, alternativeSaveDefinition } from "./legacy2-alternative-saves.mjs";

const SCOPE = "jujutsu-system";
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const localize = value => game.i18n?.localize?.(value) ?? value;
export const conditionName = id => localize(CONFIG.statusEffects?.[id]?.name ?? id);

/** Store a canonical attribute so switching the optional save rule remains reversible. */
export function conditionSaveAbility(key) {
  return ALTERNATIVE_SAVES.find(save => save.key === key)?.abilities[0] ?? key;
}
export function conditionSaveLabel(key) {
  return (alternativeSavesEnabled() ? alternativeSaveDefinition(key)?.label : null)
    ?? localize(CONFIG.DND5E.abilities[conditionSaveAbility(key)]?.label ?? key);
}
export function conditionSaveOptions() {
  return alternativeSavesEnabled() ? ALTERNATIVE_SAVES.map(save => ({ value: save.abilities[0], label: save.label }))
    : Object.entries(CONFIG.DND5E.abilities).map(([value, config]) => ({ value, label: localize(config.label) }));
}
export function activityConditionsContext(activity) {
  const conditionOptions = Object.values(CONFIG.statusEffects ?? {}).filter(condition => condition.id
    && (!Ruleset.isV2() || condition.id.startsWith("jj-"))).map(condition => ({ value: condition.id, label: conditionName(condition.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return { conditionOptions, saveOptions: conditionSaveOptions(), isAttack: activity.type === "attack",
    hasDamage: !!activity.damage?.parts?.length && !!Array.from(activity.save?.ability ?? []).length,
    rows: Array.from(activity.conditions ?? []).map((row, index) => ({ ...row, index,
      saveValue: alternativeSavesEnabled() ? alternativeSaveDefinition(row.save)?.abilities[0] ?? row.save : conditionSaveAbility(row.save)
    })) };
}

/** Snapshot the rule and DC on the usage card, rather than rereading a subsequently edited technique. */
export function activityConditionsSnapshot(activity) {
  if (!["attack", "save"].includes(activity?.type)) return null;
  const conditions = Array.from(activity.conditions ?? []).filter(row => row.condition && row.save).map((row, index) => ({
    _id: row._id ?? String(index), condition: row.condition, save: conditionSaveAbility(row.save)
  }));
  if (!conditions.length) return null;
  const actor = activity.item?.actor ?? activity.actor;
  const principal = actor?.type === "npc" ? Ruleset.npcPrincipal(actor) : Ruleset.atributoPrincipal(actor);
  const dc = Number(activity.save?.dc?.value ?? activity.getRollData?.({ deterministic: true })?.dc
    ?? actor?.system?.attributes?.spell?.dc ?? actor?.system?.abilities?.[principal]?.dc);
  return { type: activity.type, dc: Number.isFinite(dc) ? dc : null,
    damageSave: activity.type === "save" && !!activity.damage?.parts?.length && !!Array.from(activity.save?.ability ?? []).length, conditions };
}

const sameTarget = (left, right) => left.token || right.token ? left.token === right.token
  : !!left.actor && left.actor === right.actor;
const rollFailed = (roll, dc, forceSuccess = false) => {
  if (!roll || forceSuccess) return false;
  if (roll.isSuccess === true) return false;
  if (roll.isFailure === true) return true;
  return Number.isFinite(roll.total) && Number.isFinite(dc) && roll.total < dc;
};

/** A condition save never doubles as the technique's initial damage save. */
export function conditionTargetGate(snapshot, descriptor, { attacks = [], saves = [] } = {}) {
  if (snapshot.type === "attack") {
    for (const message of [...attacks].reverse()) {
      const target = message.system?.evaluatedTargets?.find(target => sameTarget(target, descriptor));
      if (target) return { eligible: target.isMiss === false, reason: target.isMiss ? "miss" : "hit" };
    }
    return { eligible: false, reason: "pendingAttack" };
  }
  if (!snapshot.damageSave) return { eligible: true, reason: "direct" };
  for (const message of [...saves].reverse()) {
    if (message.flags?.[SCOPE]?.conditionResistance) continue;
    const target = { token: message.getAssociatedToken?.()?.uuid, actor: message.getAssociatedActor?.()?.uuid };
    if (!sameTarget(target, descriptor) || !message.rolls?.length) continue;
    const failed = rollFailed(message.rolls[0], snapshot.dc, message.system?.forceSuccess);
    return { eligible: failed, reason: failed ? "failedDamageSave" : "passedDamageSave" };
  }
  return { eligible: false, reason: "pendingDamageSave" };
}

export function conditionChatButtons(snapshot) {
  if (!snapshot) return [];
  return snapshot.conditions.map(row => ({ action: "rollConditionSave", visibility: "all",
    dataset: { conditionId: row._id }, icon: "systems/jujutsu-system/icons/svg/activity/save.svg",
    label: { hidden: `Resistir a ${conditionName(row.condition)} · ${conditionSaveLabel(row.save)}`,
      value: `Resistir a ${conditionName(row.condition)} · ${conditionSaveLabel(row.save)}${snapshot.dc !== null ? ` (CD ${snapshot.dc})` : ""}` }
  }));
}
export function conditionButtonAvailable(message) {
  const snapshot = message.flags?.[SCOPE]?.activityConditions;
  if (!snapshot || !Number.isFinite(snapshot.dc)) return false;
  if (snapshot.type === "save" && !snapshot.damageSave) return true;
  const context = { attacks: message.getAssociatedRolls?.("attack") ?? [], saves: message.getAssociatedRolls?.("save") ?? [] };
  const descriptors = snapshot.type === "attack" ? context.attacks.flatMap(message => message.system?.evaluatedTargets ?? [])
    : context.saves.map(message => ({ token: message.getAssociatedToken?.()?.uuid, actor: message.getAssociatedActor?.()?.uuid }));
  return descriptors.some(descriptor => conditionTargetGate(snapshot, descriptor, context).eligible);
}

const queued = new WeakMap();
function withActorLock(actor, task) {
  const prior = queued.get(actor) ?? Promise.resolve();
  const run = prior.catch(() => {}).then(task);
  const settled = run.finally(() => { if (queued.get(actor) === settled) queued.delete(actor); });
  queued.set(actor, settled);return settled;
}
const describe = target => {
  const document = target.document ?? target;
  const actor = document.actor ?? (document.documentName === "Actor" ? document : null);
  return { actor, document, descriptor: { actor: actor?.uuid, token: document === actor ? undefined : document.uuid } };
};

/** Roll only for owned, eligible targets; receipts survive reloads and prevent accidental repeated saves. */
export async function resistActivityConditions(message, targets, { rowId, event, apply } = {}) {
  const snapshot = message.flags?.[SCOPE]?.activityConditions;
  if (!snapshot || !Number.isFinite(snapshot.dc)) { ui.notifications.warn("A técnica não tem uma CD válida para resistir à condição."); return; }
  const rows = snapshot.conditions.filter(row => rowId === undefined || row._id === rowId);
  if (!rows.length) return;
  const context = { attacks: message.getAssociatedRolls?.("attack") ?? [], saves: message.getAssociatedRolls?.("save") ?? [] };
  const source = message.uuid ?? message.id;
  const seen = new Set(), results = [];
  for (const target of targets) {
    const { actor, document, descriptor } = describe(target);
    if (!actor?.isOwner || !descriptor.actor) continue;
    const key = descriptor.token ?? descriptor.actor;
    if (seen.has(key)) continue;seen.add(key);
    const gate = conditionTargetGate(snapshot, descriptor, context);
    if (!gate.eligible) {
      const reasons = { pendingAttack: "Role o acerto da técnica contra este alvo primeiro.", miss: "A técnica errou este alvo; a condição não pode ser aplicada.",
        pendingDamageSave: "Role a salvaguarda de dano deste alvo primeiro.", passedDamageSave: "O alvo passou na salvaguarda de dano e não precisa resistir à condição." };
      ui.notifications.warn(reasons[gate.reason]);continue;
    }
    await withActorLock(actor, async () => {
      for (const row of rows) {
        const receipts = actor.getFlag?.(SCOPE, "activityConditionResults") ?? [];
        if (receipts.some(receipt => receipt.source === source && receipt.target === key && receipt.conditionId === row._id)) {
          ui.notifications.info(`${actor.name} já resolveu esta condição neste uso da técnica.`);continue;
        }
        const status = CONFIG.statusEffects?.[row.condition];
        if (!status) { ui.notifications.warn("Esta condição não está mais disponível no jogo.");continue; }
        const name = conditionName(row.condition), ability = conditionSaveAbility(row.save);
        const rollResult = await actor.rollSavingThrow({ ability, target: snapshot.dc, event }, {}, { data: {
          speaker: ChatMessage.getSpeaker({ actor, token: document === actor ? undefined : document, scene: document.parent ?? globalThis.canvas?.scene }),
          flavor: `${escape(name)} — ${escape(conditionSaveLabel(ability))}${message.shouldDisplayChallenge === false ? "" : ` CD ${snapshot.dc}`}`,
          flags: { [SCOPE]: { conditionResistance: { source, conditionId: row._id, condition: row.condition, target: key } } }
        } });
        const roll = Array.isArray(rollResult) ? rollResult[0] : rollResult?.rolls?.[0] ?? rollResult;
        if (!roll || !Number.isFinite(roll.total)) continue;
        const failed = rollFailed(roll, snapshot.dc);
        let applied = false;
        if (failed) {
          const applyCondition = apply ?? (await import("../applications/actor/jj/conditions.mjs")).applyGameCondition;
          applied = await applyCondition(actor, row.condition, { origin: message.uuid });
        }
        const receipt = { source, target: key, conditionId: row._id, condition: row.condition, total: roll.total,
          outcome: failed ? (applied ? "applied" : "unaffected") : "resisted" };
        await actor.setFlag(SCOPE, "activityConditionResults", [...receipts.slice(-199), receipt]);
        results.push(receipt);
        ui.notifications.info(failed ? `${actor.name}: ${applied ? `${name} aplicada` : `não sofreu ${name}`}.` : `${actor.name} resistiu a ${name}.`);
      }
    });
  }
  if (!seen.size) ui.notifications.warn("Selecione um alvo cuja ficha você possa controlar para resistir à condição.");
  return results;
}

/** Native activity chat action, shared by attack and save activities. */
export async function rollConditionSave(event, target, message) {
  let targets = message.system?.evaluatedTargets;
  targets ??= globalThis.canvas?.tokens?.controlled?.length ? canvas.tokens.controlled : Array.from(game.user.targets ?? []);
  if (!targets.length && game.user.character) targets = [game.user.character];
  const rowId = message.system?.getButton?.(target)?.dataset?.conditionId ?? target.dataset?.conditionId;
  return resistActivityConditions(message, targets, { rowId, event });
}
