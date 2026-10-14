/** Actor-backed resources. Native activities remain responsible for all consumption. */
const safeId = id => typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id)
  && !["__proto__", "constructor", "prototype", "reverseEnergy"].includes(id);
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function ownedResourceActivities(actor) {
  return Array.from(actor.items ?? []).flatMap(item => item.actor === actor
    ? Array.from(item.system?.activities?.values?.() ?? []).filter(activity => !!activity.uuid) : []);
}

export function resourceActivity(actor, uuid) {
  return ownedResourceActivities(actor).find(activity => activity.uuid === uuid) ?? null;
}

export function extraResourceCards(actor) {
  const l2 = actor.system.legacy2 ?? {};
  const entries = [{ id: "reverseEnergy", label: "Energia Reversa", unit: "PER", icon: "heart",
    base: "system.legacy2.reverseEnergy", data: l2.reverseEnergy ?? { value: 0, max: 30 } },
  ...Object.entries(l2.extraResources ?? {}).filter(([id]) => safeId(id)).map(([id, data]) => ({
    id, label: data.label || "Recurso", unit: "pontos", icon: "energy", custom: true,
    base: `system.legacy2.extraResources.${id}`, data
  }))];
  return entries.map(({ data, ...card }) => {
    const max = integer(data.max);
    const value = Math.min(integer(data.value), max);
    const activity = resourceActivity(actor, data.activity);
    return { ...card, value, max, ...(card.id === "reverseEnergy" ? { maxPerRound: integer(data.maxPerRound ?? 3) } : {}),
      pct: max ? 100 * value / max : 0, path: `${card.base}.value`,
      activity: data.activity ?? "", activityLabel: activity ? `${activity.item.name} · ${activity.name}` : "Nenhuma atividade vinculada",
      canUse: !!activity?.canUse };
  });
}

export function extraResourceById(actor, id) {
  return extraResourceCards(actor).find(card => card.id === id) ?? null;
}

export function extraResourceTargets(actor) {
  return extraResourceCards(actor).map(card => ({ group: "Recursos Extras", value: card.path.slice(7),
    label: card.unit === "PER" ? `${card.label} (PER)` : card.label }));
}

/** Actor-specific labels must be resolved before the generic schema-label cache. */
export function extraResourceLabel(actor, attribute) {
  if ( attribute === "legacy2.reverseEnergy.value" ) return "Energia Reversa (PER)";
  const id = attribute.match(/^legacy2\.extraResources\.([a-zA-Z0-9_-]+)\.value$/)?.[1];
  return id && safeId(id) ? actor.system.legacy2?.extraResources?.[id]?.label : undefined;
}

/** Replace only this resource's cost; retain scaling and every unrelated target. */
export function resourceConsumptionTargets(activity, card, cost) {
  const path = card.path.slice(7);
  const targets = Array.from(activity.consumption?.targets ?? [], target => target.toObject?.() ?? { ...target });
  const matching = target => target.type === "attribute" && target.target === path;
  const previous = targets.find(matching);
  const others = targets.filter(target => !matching(target));
  if ( cost > 0 ) others.push({ ...previous, type: "attribute", target: path, value: String(cost),
    scaling: previous?.scaling ?? { mode: "", formula: "" } });
  return others;
}

export async function saveExtraResource(sheet, id, data, { create = false } = {}) {
  if ( !sheet.isEditable ) return false;
  const actor = sheet.actor;
  const card = extraResourceById(actor, id) ?? (create && safeId(id) ? {
    base: `system.legacy2.extraResources.${id}`, path: `system.legacy2.extraResources.${id}.value`
  } : null);
  if ( !card || (create && extraResourceById(actor, id)) ) return false;
  const label = String(data.label ?? "").trim();
  const max = Number(data.max), value = Number(data.value);
  if ( !label || label.length > 80 || !Number.isInteger(max) || max < 0
    || !Number.isInteger(value) || value < 0 || value > max ) return false;
  const hasRoundMax = id === "reverseEnergy" && data.maxPerRound !== undefined;
  const maxPerRound = hasRoundMax ? Number(data.maxPerRound) : null;
  if (hasRoundMax && (data.maxPerRound === null || String(data.maxPerRound).trim() === ""
    || !Number.isInteger(maxPerRound) || maxPerRound < 0)) return false;
  const activity = data.activity ? resourceActivity(actor, data.activity) : null;
  if ( data.activity && !activity ) return false;
  const cost = data.cost === "" || data.cost == null ? null : Number(data.cost);
  if ( cost !== null && (!Number.isInteger(cost) || cost < 0) ) return false;
  if ( activity && cost !== null ) await activity.item.updateActivity(activity.id, {
    "consumption.targets": resourceConsumptionTargets(activity, card, cost)
  });
  // Leaving the displayed maximum unchanged must not bake an Active Effect into source data.
  await actor.update({ [card.base]: { ...(id !== "reverseEnergy" ? { label } : {}), value,
    ...(create || max !== card.max ? { max } : {}),
    ...(hasRoundMax && maxPerRound !== card.maxPerRound ? { maxPerRound } : {}),
    activity: activity?.uuid ?? "" } });
  return true;
}

export async function useExtraResource(sheet, id, event) {
  if ( !sheet.isEditable ) return;
  const card = extraResourceById(sheet.actor, id);
  const activity = card && resourceActivity(sheet.actor, card.activity);
  if ( !activity?.canUse ) return;
  return activity.use({ event }, { options: { sheet } });
}
