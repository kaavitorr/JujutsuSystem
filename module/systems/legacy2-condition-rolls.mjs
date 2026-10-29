/** Counts, never flat +2/-2 bonuses: the shared ruleset converts each count to +1/-1. */
const CORE = Object.freeze({ "jj-cego": "blind", "jj-invisivel": "invisible", "jj-caido": "prone",
  "jj-atordoado": "stunned", "jj-impedido": "restrained", "jj-amedrontado": "frightened" });
const SAVE_ABILITIES = { fortitude: ["str", "wis"], vontade: ["con", "cha"], reflexo: ["dex", "int"] };
const SOCIAL_SKILLS = new Set(["dec", "per", "itm", "prf"]);

function has(actor, id) {
  const core = CORE[id], immunities = actor?.system?.traits?.ci?.value;
  if (immunities?.has?.(id) || (core && immunities?.has?.(core))) return false;
  return !!(actor?.statuses?.has?.(id) || (core && actor?.statuses?.has?.(core)));
}

function sourceActor(document) {
  if (!document) return null;
  if (document.documentName === "Actor" || ["character", "npc"].includes(document.type)) return document;
  if (document.actor) return document.actor;
  if (document.getAssociatedActor) return document.getAssociatedActor();
  if (document.parent?.actor) return document.parent.actor;
  const speaker = document.speaker;
  if (speaker?.scene && speaker?.token) {
    const token = globalThis.fromUuidSync?.(`Scene.${speaker.scene}.Token.${speaker.token}`, { strict: false });
    if (token?.actor) return token.actor;
  }
  return speaker?.actor ? globalThis.game?.actors?.get(speaker.actor) : null;
}

export function conditionSourceActorUuid(origin) {
  if (!origin) return null;
  try { return sourceActor(globalThis.fromUuidSync?.(origin, { strict: false }))?.uuid ?? null; }
  catch { return null; }
}

/** Origin may be an Actor/Item UUID, a usage ChatMessage, or an explicit source flag. */
function fromSource(actor, id, target) {
  if (!has(actor, id) || !target?.uuid) return false;
  return Array.from(actor.effects ?? []).some(effect => {
    if (effect.disabled || effect.isSuppressed || !(effect.statuses?.has?.(id) || effect.statuses?.has?.(CORE[id]))) return false;
    const reference = effect.flags?.["jujutsu-system"]?.conditionSourceActor ?? effect.origin;
    if (!reference) return false;
    if (reference === target.uuid || reference.startsWith(`${target.uuid}.`)) return true;
    try {
      return sourceActor(globalThis.fromUuidSync?.(reference, { strict: false }))?.uuid === target.uuid;
    } catch { return false; }
  });
}

/** Jujutsu 2.0 condition rules shared by PC/NPC weapons, techniques, checks and saves. */
export function conditionRollAdvantages(actor, { kind, ability, skill, target, melee = false } = {}) {
  let vantagens = 0, desvantagens = 0;
  if (kind === "attack") {
    for (const id of ["jj-cego", "jj-caido", "jj-estremecido", "jj-impedido", "jj-hipotermico"])
      if (has(actor, id)) desvantagens++;
    if (melee && has(actor, "jj-pesado")) desvantagens++;
    if (has(actor, "jj-invisivel")) vantagens++;
    for (const id of ["jj-cego", "jj-atordoado"]) if (has(target, id)) vantagens++;
    if (has(target, "jj-caido")) { if (melee) vantagens++; else desvantagens++; }
    if (has(target, "jj-invisivel")) desvantagens++;
    if (fromSource(actor, "jj-amedrontado", target)) desvantagens++;
    if (fromSource(actor, "jj-apaixonado", target)) desvantagens += 3;
  } else if (kind === "check" || kind === "save") {
    const abilities = kind === "save" ? (SAVE_ABILITIES[ability] ?? [ability]) : [ability];
    if (abilities.includes("dex")) {
      for (const id of ["jj-bebado", "jj-concussao", "jj-hipotermico"]) if (has(actor, id)) desvantagens++;
    }
    if (kind === "save") {
      if (abilities.some(id => ["dex", "wis"].includes(id)) && has(actor, "jj-sonolento")) desvantagens++;
      if (abilities.includes("dex") && has(actor, "jj-sufocado")) desvantagens++;
    } else if (SOCIAL_SKILLS.has(skill) || (!skill && ability === "cha")) {
      if (fromSource(actor, "jj-apaixonado", target)) desvantagens += 3;
      if (fromSource(target, "jj-apaixonado", actor)) vantagens = 6;
      if (fromSource(target, "jj-enfeiticado", actor)) vantagens++;
    }
  }
  return { vantagens: Math.min(vantagens, 6), desvantagens: Math.min(desvantagens, 6) };
}

/** These legacy DnD penalties are absent from the corresponding 2.0 condition rules. */
export function replacesNativeConditionRoll(key, status) {
  return ((key === "abilityCheckDisadvantage" || key === "attackDisadvantage") && status === "poisoned")
    || (key === "dexteritySaveDisadvantage" && status === "restrained");
}
