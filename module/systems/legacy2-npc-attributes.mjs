import Ruleset from "./ruleset.mjs";

/** NPCs share the 2.0 integer attribute scale. Keep legacy saved sources intact. */
export const npc2AbilityValue = value => Number.isFinite(Number(value))
  ? Math.min(12, Math.max(1, Math.trunc(Number(value)))) : 1;

/** Run before native derived rolls so sheets, attacks and derived defenses agree. */
export function prepareNpc2Abilities(actor) {
  const system = actor.system;
  const derived = Ruleset.npcAbilityValues(actor);
  for (const [key, ability] of Object.entries(system.abilities ?? {}))
    ability.value = npc2AbilityValue(derived?.[key] ?? ability.value);
}
