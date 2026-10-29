import { npcProficiencyBonus, npcProficiencyRank } from "./legacy2-npc-profiles.mjs";

export const ALTERNATIVE_SAVES = Object.freeze([
  { key: "fortitude", label: "Fortitude", abilities: ["str", "wis"], names: ["Força", "Sabedoria"], icon: "con" },
  { key: "vontade", label: "Vontade", abilities: ["con", "cha"], names: ["Constituição", "Presença"], icon: "wis" },
  { key: "reflexo", label: "Reflexo", abilities: ["dex", "int"], names: ["Agilidade", "Intelecto"], icon: "dex" }
]);

/** Strict booleans keep the optional rule dormant in old worlds and in 1.0. */
export function alternativeSavesEnabled() {
  return globalThis.game?.settings?.get("jujutsu-system", "rulesetVersion") === "2.0"
    && game.settings.get("jujutsu-system", "regraSalvaguarda") === true;
}

export function alternativeSaveDefinition(key) {
  return ALTERNATIVE_SAVES.find(save => save.key === key || save.abilities.includes(key)) ?? null;
}

export function alternativeSaveData(actor, key, ruleset) {
  if ( !alternativeSavesEnabled() ) return null;
  const definition = alternativeSaveDefinition(key);
  if ( !definition ) return null;
  const values = definition.abilities.map(ability => Number(actor.system.abilities?.[ability]?.value) || 0);
  const average = (values[0] + values[1]) / 2;
  const base = Math.floor(average);
  const rank = npcProficiencyRank(actor, "alternativeSaves", definition.key);
  const bonus = ruleset.rankBonus(rank), total = base + bonus;
  const sign = bonus < 0 ? "−" : "+";
  return { ...definition, ability: definition.abilities[0], base, rank, total,
    grantedRank: npcProficiencyBonus(actor, "alternativeSaves", definition.key),
    rankLabel: ruleset.rankLabel(rank),
    tooltip: `${definition.label}: (${definition.names[0]} ${values[0]} + ${definition.names[1]} ${values[1]}) ÷ 2 = ${average.toLocaleString("pt-BR")}; base ${base} (arredondado para baixo); ${ruleset.rankLabel(rank)} ${sign}${Math.abs(bonus)} = ${total}.` };
}
