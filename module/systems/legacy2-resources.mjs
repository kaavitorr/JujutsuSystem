import { savedSystemValue } from "./actor-source.mjs";
import { npcProfile } from "./legacy2-npc-profiles.mjs";

const numeric = value => value !== null && value !== undefined && String(value).trim() !== ""
  && Number.isFinite(Number(value)) ? Number(value) : null;
const number = value => numeric(value) ?? 0;
const flag = (item, key) => item.getFlag?.("jujutsu-system", key) ?? item.flags?.["jujutsu-system"]?.[key];
const energyRoot = (actor, style) => style && ("energiaBase" in style)
  ? number(style.energiaBase) : number(npcProfile(actor, "taxonomy")?.energiaBase ?? 10);
const originBonus = (actor, resource) => {
  const carrier = resource === "hp" ? "pvBonusOrigem" : "energiaBonusOrigem";
  const key = resource === "hp" ? "pvAdicional" : "energiaAdicional";
  return number(actor.system?.legacy2?.[carrier])
    + Array.from(actor.itemTypes?.race ?? []).reduce((sum, race) => sum + number(flag(race, key)), 0);
};
const legacyKeys = Object.freeze({
  "system.legacy2.pvEspecie": "system.attributes.hp.base",
  "system.legacy2.energiaEspecie": "system.energy.base"
});
const inputKeys = new Set([...Object.keys(legacyKeys), ...Object.values(legacyKeys),
  "system.attributes.hp.bonus", "system.energy.bonus"]);

/**
 * Resource inputs are prepared before deriving maxima; final maximum effects keep their normal phase.
 * @param {Actor} actor                 Target actor.
 * @param {object} change               Active Effect change.
 * @param {boolean} enabled             Whether the 2.0 ruleset is active.
 * @returns {object}                    Change with its effective resource key and phase.
 */
export function legacy2ResourceChange(actor, change, enabled) {
  if (!enabled || actor?.type !== "character" || !inputKeys.has(change.key)) return change;
  return { ...change, key: legacyKeys[change.key] ?? change.key, phase: "initial" };
}

/**
 * Resolve the numeric Colossal flag before seeding the style root, without persisting it or altering native changes.
 * @param {Actor} actor                 Target actor.
 * @returns {boolean}                   Whether enabled initial effects grant Energia Colossal.
 */
function colossalBeforeEffects(actor) {
  const sourceFlags = actor._source ? actor._source.flags ?? {} : actor.flags ?? {};
  let value = number(sourceFlags["jujutsu-system"]?.energiaColossal);
  const effects = actor.allApplicableEffects ? Array.from(actor.allApplicableEffects())
    : [...Array.from(actor.effects ?? []), ...Array.from(actor.items ?? []).flatMap(item =>
      Array.from(item.effects ?? []).filter(effect => effect.transfer !== false))];
  const rollData = actor.getRollData?.() ?? actor.system;
  const changes = [];
  for (const effect of effects) {
    const candidates = Array.from(effect.system?.changes ?? effect.changes ?? []).filter(change =>
      change.key === "flags.jujutsu-system.energiaColossal" && (!change.phase || change.phase === "initial"));
    if (!candidates.length) continue;
    if (effect.disabled || effect.active === false || effect.isSuppressed) continue;
    const data = effect.getReplacementData?.(rollData) ?? rollData;
    if (effect.system?.conditions?.check?.(data) === false) continue;
    for (const change of candidates) {
      if (change.conditions?.check && !change.conditions.check(data)) continue;
      if (typeof change.conditions === "string" && change.conditions !== "{}" && change.conditions.trim()) continue;
      if (numeric(change.value) === null) continue;
      changes.push(change);
    }
  }
  for (const change of changes.sort((a, b) => number(a.priority) - number(b.priority))) {
    const amount = number(change.value);
    const type = change.type ?? ["custom", "multiply", "add", "downgrade", "upgrade", "override"][change.mode];
    if (type === "override") value = amount;
    else if (type === "add") value += amount;
    else if (type === "subtract") value -= amount;
    else if (type === "multiply") value *= amount;
    else if (type === "upgrade") value = Math.max(value, amount);
    else if (type === "downgrade") value = Math.min(value, amount);
  }
  return value > 0;
}

/**
 * Seed each cycle from saved values and live origin/style data, immediately before initial Active Effects.
 * @param {object} system               Prepared actor system data.
 * @param {Actor} actor                 Target actor.
 * @param {object} ruleset              Ruleset API.
 * @param {object} [options]            Preparation options.
 * @param {boolean} [options.projectColossal=true]  Project the initial Colossal flag before native changes.
 */
export function prepareLegacy2ResourceBases(system, actor, ruleset, { projectColossal = true } = {}) {
  if (actor?.type !== "character" || !ruleset.isV2()) return;
  const style = ruleset.estilo(actor);
  const hp = system.attributes.hp;
  const energy = system.energy;
  const saved = (path, fallback) => savedSystemValue(actor, path, fallback);
  const legacyHP = number(saved("legacy2.pvEspecie", system.legacy2?.pvEspecie));
  const legacyEnergy = number(saved("legacy2.energiaEspecie", system.legacy2?.energiaEspecie));
  const hpOverride = numeric(saved("attributes.hp.base", null));
  const energyOverride = numeric(saved("energy.base", null));
  hp.base = hpOverride ?? number(style?.vidaBase ?? 4) + legacyHP;
  hp.bonus = number(saved("attributes.hp.bonus", 0)) + originBonus(actor, "hp");
  energy.base = energyOverride ?? energyRoot(actor, style) + legacyEnergy;
  energy.bonus = number(saved("energy.bonus", 0)) + originBonus(actor, "energy");
  energy.trainingBonus = 0;
  // Preview the initial flag while the root is still separate. Native base overrides then keep their precedence.
  if (projectColossal && energyOverride === null && style && colossalBeforeEffects(actor)) {
    energy.base += number(style.energiaBase);
  }
  if (ruleset.isRestringido?.(actor)) energy.base = 0;
}

/**
 * Components for the character formula, with a fallback for plain creation previews.
 * @param {Actor} actor                 Target actor or plain creation preview.
 * @param {object} ruleset              Ruleset API.
 * @returns {object}                    Base, fixed bonus, scaling inputs and total hit points.
 */
export function legacy2HitPointParts(actor, ruleset) {
  const hp = actor.system?.attributes?.hp ?? {};
  const style = ruleset.estilo(actor);
  const prepared = ruleset.isV2() && numeric(hp.base) !== null;
  const base = Math.max(1, prepared ? number(hp.base)
    : number(style?.vidaBase ?? 4) + number(actor.system?.legacy2?.pvEspecie));
  const bonus = prepared ? number(hp.bonus) : number(hp.bonus) + originBonus(actor, "hp");
  const level = ruleset.nivel(actor);
  const constitution = numeric(actor.system?.abilities?.con?.value) ?? 1;
  const scaled = (level + constitution) * base;
  return { base, bonus, level, constitution, scaled, total: Math.max(1, scaled + bonus) };
}

/**
 * Training grants one base unit per purchase; the fixed bonus bucket never scales with character level.
 * @param {Actor} actor                 Target actor or plain creation preview.
 * @param {object} ruleset              Ruleset API.
 * @param {object} [options]            Calculation options.
 * @param {number|null} [options.intenseMax=null]  Override the number of maximum-energy trainings.
 * @returns {object}                    Base, fixed bonus, training bonus, level and total energy.
 */
export function legacy2EnergyParts(actor, ruleset, { intenseMax = null } = {}) {
  const energy = actor.system?.energy ?? {};
  const style = ruleset.estilo(actor);
  const prepared = ruleset.isV2() && numeric(energy.base) !== null;
  let base = energyRoot(actor, style);
  if (style && ("energiaBase" in style) && number(actor.flags?.["jujutsu-system"]?.energiaColossal) > 0) base *= 2;
  base = Math.max(0, prepared ? number(energy.base) : base + number(actor.system?.legacy2?.energiaEspecie));
  const trainingBonus = number(intenseMax ?? energy.intensiveTraining?.maxEnergy) * base;
  const bonus = (prepared ? number(energy.bonus) - number(energy.trainingBonus)
    : number(energy.bonus) + originBonus(actor, "energy")) + trainingBonus;
  const level = ruleset.nivel(actor);
  const scaled = level * base;
  return { base, bonus, trainingBonus, level, scaled, total: Math.max(0, scaled + bonus) };
}

/**
 * Publish the complete prepared fixed bonus for roll data, without double counting on subsequent reads.
 * @param {object} system               Prepared actor system data.
 * @param {Actor} actor                 Target actor.
 * @param {object} ruleset              Ruleset API.
 */
export function prepareLegacy2ResourceBonuses(system, actor, ruleset) {
  if (actor?.type !== "character" || !ruleset?.isV2()) return;
  // A nullable base override restores the automatic input, while the fixed bucket is already prepared.
  const style = ruleset.estilo(actor);
  if (system.attributes.hp.base === null) {
    system.attributes.hp.base = Math.max(1, number(style?.vidaBase ?? 4) + number(system.legacy2?.pvEspecie));
  }
  if (system.energy.base === null) {
    let root = energyRoot(actor, style);
    if (style && ("energiaBase" in style) && number(actor.flags?.["jujutsu-system"]?.energiaColossal) > 0) root *= 2;
    system.energy.base = ruleset.isRestringido?.(actor) ? 0 : Math.max(0, root + number(system.legacy2?.energiaEspecie));
  }
  const parts = legacy2EnergyParts(actor, ruleset);
  system.energy.bonus = parts.bonus;
  system.energy.trainingBonus = parts.trainingBonus;
}
