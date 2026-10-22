/** Armor in 2.0 replaces the unarmored formula and uses whole attributes. */
export const ARMOR_ABILITIES_2 = Object.freeze([
  { value: "", label: "Nenhum" }, { value: "str", label: "Força" }, { value: "dex", label: "Agilidade" },
  { value: "con", label: "Constituição" }, { value: "int", label: "Intelecto" },
  { value: "wis", label: "Sabedoria" }, { value: "cha", label: "Presença" }
]);
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const specified = value => value !== null && value !== undefined && value !== "";

/** Existing natural armors already contain base/attribute flags; retain them as defaults. */
export function armor2Configuration(item) {
  const system = item?.system ?? {}, armor = system.armor ?? {};
  const source = system._source?.armor ?? item?._source?.system?.armor ?? armor;
  const legacy = item?.flags?.["jujutsu-system"]?.cr;
  const candidate = armor.ability ?? legacy?.atributo ?? (system.type?.value === "heavy" ? "" : "dex");
  const ability = ARMOR_ABILITIES_2.some(entry => entry.value === candidate) ? candidate : "";
  const base = specified(source.value) ? number(source.value) : number(legacy?.base);
  const limit = specified(armor.dex) && Number.isFinite(Number(armor.dex)) ? Math.max(0, Number(armor.dex)) : null;
  const legacyBaseMissing = !specified(source.value) && legacy && armor.base !== base;
  const preparedBase = legacyBaseMissing ? base + number(armor.value) : specified(armor.value) ? number(armor.value) : base;
  const abilityLabel = ARMOR_ABILITIES_2.find(entry => entry.value === ability).label;
  return { base, preparedBase, ability, abilityLabel, limit, choices: ARMOR_ABILITIES_2,
    shield: system.type?.value === "shield", formula: `${base}${ability ? ` + ${abilityLabel}` : ""}` };
}

export function prepareLegacy2ArmorClass(actor, unarmoredBase, { bonus = 0, maximum = Infinity } = {}) {
  const ac = actor.system.attributes.ac;
  const equipment = actor.itemTypes?.equipment ?? Array.from(actor.items ?? []);
  const equipped = equipment.filter(item => item.type === "equipment" && item.system.equipped
    && Object.hasOwn(globalThis.CONFIG?.DND5E?.armorTypes ?? { light: 1, medium: 1, heavy: 1, natural: 1, shield: 1 }, item.system.type?.value));
  const item = equipped.find(item => item.system.type.value !== "shield");
  const shield = equipped.find(item => item.system.type.value === "shield");
  const config = item ? armor2Configuration(item) : null;
  const fullAttribute = config?.ability ? number(actor.system.abilities?.[config.ability]?.value) : 0;
  const appliedAttribute = config?.limit === null || config?.limit === undefined ? fullAttribute : Math.min(fullAttribute, config.limit);
  const base = config ? config.preparedBase + appliedAttribute : unarmoredBase;
  ac.equippedArmor = item;
  ac.equippedShield = shield;
  ac.base = base;
  ac.armor = config?.preparedBase ?? unarmoredBase;
  ac.shield = shield ? armor2Configuration(shield).preparedBase : 0;
  ac.calc = config ? "armored" : "resistencia";
  ac.label = item?.name ?? "Defesa padrão (2.0)";
  ac.formula = config ? `@attributes.ac.armor${config.ability ? ` + ${config.limit === null ? `@abilities.${config.ability}.value` : `min(@abilities.${config.ability}.value, ${config.limit})`}` : ""}`
    : String(unarmoredBase);
  ac.activeFormula = { id: ac.calc, type: "base", label: ac.label, formula: ac.formula };
  ac.value = Math.max(0, Math.min(maximum, base + ac.shield + bonus));
  if (Number.isFinite(ac.override)) ac.value = ac.override;
  return { item, config, fullAttribute, appliedAttribute, base, shield: ac.shield, value: ac.value };
}

/** The old natural-armor ADD effect is replaced by the equipped item's formula, never stacked on top. */
export function isLegacyArmorClassChange(model, change) {
  return globalThis.game?.settings?.get("jujutsu-system", "rulesetVersion") === "2.0"
    && ["character", "npc"].includes(model?.type) && change.key === "system.attributes.ac.bonus"
    && !!change.effect?.flags?.["jujutsu-system"]?.armaduraNaturalCR;
}
