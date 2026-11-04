import Ruleset from "./ruleset.mjs";
import { conditionSourceActorUuid } from "./legacy2-condition-rolls.mjs";

const SIZES = ["tiny", "sm", "med", "lg", "huge", "grg"];
const LABELS = ["Minúsculo", "Pequeno", "Médio", "Grande", "Enorme", "Imenso"];
const ALIASES = { small: "sm", medium: "med", large: "lg", gargantuan: "grg" };
const RULES = {
  lg: { touch: 2, pushAdvantages: 2, pushImmune: false, grappleLimit: null, dex: 0, str: 0,
    summary: "Toque +1 m · Ignora terreno difícil · 2 vantagens contra empurrão." },
  huge: { touch: 3, pushAdvantages: 4, pushImmune: false, grappleLimit: "med", dex: -1, str: 0,
    summary: "Toque 3 m · Ignora terreno difícil · 4 vantagens contra empurrão · Imune a agarrão de criaturas Médias ou menores · −1 Agilidade." },
  grg: { touch: 5, pushAdvantages: 0, pushImmune: true, grappleLimit: "lg", dex: -2, str: 2,
    summary: "Toque 5 m · Ignora terreno difícil · Imune a empurrão e a agarrão de criaturas Grandes ou menores · −2 Agilidade · +2 Força." }
};
const NONE = Object.freeze({ touch: null, pushAdvantages: 0, pushImmune: false, grappleLimit: null, dex: 0, str: 0, summary: "" });
const keyOf = size => ALIASES[size] ?? size;
const prepared = new WeakMap();

export function sizeRules(actor) {
  return ["character", "npc"].includes(actor?.type) && Ruleset.isV2()
    ? RULES[keyOf(actor.system?.traits?.size)] ?? NONE : NONE;
}

export function sizeContext(actor) {
  const key = keyOf(actor.system?.traits?.size) ?? "med";
  const savedKey = keyOf(actor.system?._source?.traits?.size ?? actor._source?.system?.traits?.size ?? key);
  return { ...(RULES[key] ?? NONE), label: LABELS[SIZES.indexOf(key)] ?? key,
    options: SIZES.map((value, index) => ({ value, label: LABELS[index], selected: value === savedKey })) };
}

/** The native initial-effects phase starts a fresh data-preparation cycle. */
export function resetSizePreparation(actor) { prepared.delete(actor); }

/** NPC distribution rebuilds attributes, so remove the last temporary contribution first. */
export function restoreSizeRules(actor) {
  const previous = prepared.get(actor);
  if (!previous) return;
  for (const [key, last] of Object.entries(previous.attributes)) {
    const ability = actor.system?.abilities?.[key];
    if (ability) ability.value += last.base - last.value;
  }
  if (previous.addedAll) previous.terrain?.delete?.("all");
  prepared.delete(actor);
}

/** Temporary derived adjustments, after Active Effects and NPC profile distribution. */
export function prepareSizeRules(actor) {
  const system = actor?.system;
  if (!system || !["character", "npc"].includes(actor.type)) return;
  const previous = prepared.get(actor), rule = sizeRules(actor), attributes = {};
  for (const key of ["str", "dex"]) {
    const ability = system.abilities?.[key];
    if (!ability) continue;
    const last = previous?.attributes[key];
    const base = Number(ability.value) + (last ? last.base - last.value : 0);
    ability.value = Math.max(0, base + rule[key]);
    attributes[key] = { base, value: ability.value };
  }
  const terrain = system.attributes?.movement?.ignoredDifficultTerrain;
  if (previous?.addedAll && previous.terrain === terrain) terrain?.delete?.("all");
  const addedAll = !!rule.touch && !!terrain?.add && !terrain.has("all");
  if (addedAll) terrain.add("all");
  prepared.set(actor, { attributes, terrain, addedAll });
}

/** Conditional immunity: an unknown source never grants blanket grapple immunity. */
export function sizeGrappleImmune(actor, source) {
  const limit = sizeRules(actor).grappleLimit, sourceKey = keyOf(source?.system?.traits?.size);
  const sourceIndex = SIZES.indexOf(sourceKey);
  return !!limit && sourceIndex >= 0 && sourceIndex <= SIZES.indexOf(limit);
}

export function sizeGrappleEffectImmune(actor, effect) {
  const statuses = effect?.statuses;
  if (!(statuses?.has?.("jj-agarrado") || statuses?.has?.("grappled")
    || statuses?.includes?.("jj-agarrado") || statuses?.includes?.("grappled"))) return false;
  const reference = effect.flags?.["jujutsu-system"]?.conditionSourceActor ?? effect.origin
    ?? effect.system?.origin?.actor?.uuid ?? effect.system?.origin?.actor;
  const uuid = conditionSourceActorUuid(reference);
  if (!uuid) return false;
  try { return sizeGrappleImmune(actor, globalThis.fromUuidSync?.(uuid, { strict: false })); }
  catch { return false; }
}

/** Convert only prepared Touch activities, leaving the stored technique unmodified. */
export function sizeTouchRange(actor, range) {
  const touch = sizeRules(actor).touch;
  return touch && range?.units === "touch" ? { ...range, units: "m", value: touch } : null;
}

/** A melee weapon reaches at least as far as the creature's body, without shortening longer weapons. */
export function sizeMeleeReach(actor, reach) {
  return Math.max(Number(reach) || 0, sizeRules(actor).touch ?? 0);
}

export const resistingPush = (process, formData) => {
  const value = formData?.get("jj2Test.resistPush") ?? process?.legacy2?.resistPush;
  return value === true || value === "true" || value === "on";
};

export function sizePushTestContext(process) {
  const isTest = !process?.hookNames?.includes("initiativeDialog") && !process?.tool
    && !!(process?.ability || process?.skill);
  const rule = sizeRules(process?.subject);
  return isTest && (rule.pushAdvantages || rule.pushImmune)
    ? { immune: rule.pushImmune, advantages: rule.pushAdvantages, selected: resistingPush(process) } : null;
}

export function preventSizePushRoll(actor, config) {
  if (!resistingPush(config) || !sizeRules(actor).pushImmune) return false;
  globalThis.ui?.notifications?.info?.(`${actor.name} é Imenso e imune a empurrão.`);
  return true;
}
