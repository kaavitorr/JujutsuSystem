/** Canonical damage keys also serve as stable automation attributes. */
export const NUMERIC_DAMAGE_TYPES = Object.freeze([
  { key: "bludgeoning", label: "Contundente", icon: "M7 3h10v6H7zM12 9v12M9 21h6" },
  { key: "piercing", label: "Perfurante", icon: "m4 20 13-13M12 4l8-1-1 8M6 15l3 3" },
  { key: "slashing", label: "Cortante", icon: "m4 20 3-3m-3-3 6 6M7 17 19 3l2 2-12 14" },
  { key: "poison", label: "Veneno", icon: "M9 3h6m-5 0v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8" },
  { key: "acid", label: "Ácido", icon: "M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12ZM8 16h8M10 19h4" },
  { key: "fire", label: "Fogo", icon: "M13 2c1 6-4 6-2 10 2-1 3-3 4-5 4 4 6 8 3 12-3 4-10 4-13 0-3-5 1-10 4-13-1 4 1 5 2 5" },
  { key: "cold", label: "Frio", icon: "M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3" },
  { key: "lightning", label: "Eletricidade", icon: "m13 2-9 12h7l-1 8 10-12h-7z" },
  { key: "radiant", label: "Energia", icon: "M12 3 3 12l9 9 9-9-9-9Zm0 5-4 4 4 4 4-4-4-4" },
  { key: "psychic", label: "Psíquico", icon: "M10 3a4 4 0 0 0-5 4 5 5 0 0 0-1 9 4 4 0 0 0 6 5V3Zm4 0a4 4 0 0 1 5 4 5 5 0 0 1 1 9 4 4 0 0 1-6 5V3Z" },
  { key: "soul", label: "Alma", icon: "M12 3a7 7 0 0 0-7 7v10l4-2 3 3 3-3 4 2V10a7 7 0 0 0-7-7ZM9 10v2m6-2v2M10 15h4" }
]);
const signed = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
const immuneValue = value => value === true || value === "true" || value === 1;
const numericTypes = new Set(NUMERIC_DAMAGE_TYPES.map(type => type.key));

export function resistanceCards(actor) {
  const prepared = actor.system?.legacy2?.resistances ?? {};
  const source = actor._source?.system?.legacy2?.resistances ?? actor.system?._source?.legacy2?.resistances ?? prepared;
  const scale = Math.max(10, ...NUMERIC_DAMAGE_TYPES.flatMap(({key}) =>
    [Math.abs(signed(prepared[key]?.value)), Math.abs(signed(source[key]?.value))]));
  return NUMERIC_DAMAGE_TYPES.map(type => {
    const value = signed(prepared[type.key]?.value), baseValue = signed(source[type.key]?.value);
    const immune = immuneValue(prepared[type.key]?.immune), baseImmune = immuneValue(source[type.key]?.immune);
    const prefix = `system.legacy2.resistances.${type.key}`;
    return { ...type, value, baseValue, immune, baseImmune, valuePath: `${prefix}.value`, immunePath: `${prefix}.immune`,
      displayValue: value > 0 ? `+${value}` : String(value), modified: value !== baseValue || immune !== baseImmune,
      barPercent: Math.abs(value) / scale * 100, baseBarPercent: Math.abs(baseValue) / scale * 100,
      baseState: baseImmune ? "immune" : baseValue > 0 ? "positive" : baseValue < 0 ? "negative" : "neutral",
      state: immune ? "immune" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral" };
  });
}

/** Damage stays non-negative; vulnerability cannot exceed twice its integer base. */
export function resistedDamage(damage, resistance = 0, immune = false) {
  const base = Math.max(0, signed(damage)), value = signed(resistance);
  if (immuneValue(immune)) return 0;
  return value >= 0 ? Math.max(0, base - value) : base + Math.min(base, -value);
}
const ignored = (options, category, type) => options.ignore === true || options.ignore?.[category] === true
  || options.ignore?.[category]?.has?.(type) || options.ignore?.[category]?.has?.("ALL");

/** Keep a multiplied damage card's type breakdown consistent with its displayed total. */
export function scaleTypedDamage(damages, multiplier) {
  const parts = damages.map(damage => ({ type: damage.type, value: Math.max(0, Number(damage.value) || 0) }));
  const total = parts.reduce((sum, damage) => sum + damage.value, 0);
  const target = Math.ceil(total * multiplier);
  if (!total) return parts;
  const shares = parts.map((damage, index) => ({ index, exact: target * damage.value / total }));
  parts.forEach((damage, index) => { damage.value = Math.floor(shares[index].exact); });
  let remainder = target - parts.reduce((sum, damage) => sum + damage.value, 0);
  for (const share of shares.sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (remainder-- > 0) parts[share.index].value++;
  }
  return parts;
}

/** Operates on the caller's damage clone, grouping a type once per application. */
export function applyNumericResistances(actor, damages, options = {}) {
  const groups = new Map();
  for (const damage of damages) if (numericTypes.has(damage.type) && Number.isFinite(damage.value) && damage.value > 0) {
    if (!groups.has(damage.type)) groups.set(damage.type, []);
    groups.get(damage.type).push(damage);
  }
  for (const [type, entries] of groups) {
    const definition = actor.system?.legacy2?.resistances?.[type];
    let value = signed(definition?.value);
    const downgraded = options.downgrade === true || options.downgrade?.has?.(type) || options.downgrade?.has?.("ALL");
    const immune = immuneValue(definition?.immune) && !ignored(options, "immunity", type) && !downgraded;
    const category = value < 0 ? "vulnerability" : "resistance";
    if (ignored(options, category, type)) value = 0;
    if (!immune && !value) continue;
    const base = entries.reduce((sum, damage) => sum + damage.value, 0), result = resistedDamage(base, value, immune);
    const shares = entries.map((damage, index) => {
      const exact = result * damage.value / base;
      return { index, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let remaining = result - shares.reduce((sum, share) => sum + share.value, 0);
    for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) if (remaining-- > 0) share.value++;
    entries.forEach((damage, index) => {
      damage.value = shares[index].value;
      (damage.active ??= {}).type ??= {};
      damage.active.type[immune ? "immunity" : category] = true;
      if (immune) damage.active.multiplier = 0;
    });
  }
  return damages;
}
