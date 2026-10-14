import { NPC_PROFILE_FIELDS, validNpcScale } from "../../../systems/legacy2-npc-profiles.mjs";
const readableProfile = item => item.testUserPermission?.(game.user, "OBSERVER") ?? (item.visible !== false);

/** Standard Foundry copies keep NPC preparation synchronous and work on synthetic tokens. */
export async function assignNpcProfile(actor, type, selection, { resolve = globalThis.fromUuid, config = globalThis.CONFIG?.JUJUTSU } = {}) {
  const field = NPC_PROFILE_FIELDS[type];
  if (!field || actor.type !== "npc" || !actor.isOwner) return false;
  const owned = Array.from(actor.items).find(item => item.type === type);
  const legacy = String(selection ?? "").startsWith("legacy:") ? selection.slice(7) : null;
  if (!selection || legacy) {
    if (legacy && !config?.[type === "taxonomy" ? "taxonomias" : "arquetipos"]?.[legacy]) return false;
    await actor.update({ [`system.legacy2.${field}`]: legacy ?? null });
    if (owned) await owned.delete();
    return true;
  }
  const source = typeof selection === "string" ? await resolve(selection) : selection;
  if (!source || source.type !== type || !readableProfile(source) || !validNpcScale(source.system.pesos)) return false;
  if (source.parent?.uuid === actor.uuid) {
    await actor.update({ [`system.legacy2.${field}`]: source.id });
    return true;
  }
  const data = source.toObject(), flags = data.flags ?? {};
  flags["jujutsu-system"] = { ...flags["jujutsu-system"], npcProfileSource: source.uuid };
  let applied;
  if (owned) applied = await owned.update({ name: data.name, img: data.img, system: data.system, flags,
    "_stats.compendiumSource": source.pack ? source.uuid : null });
  else {
    delete data._id; delete data.folder; delete data.ownership;
    data.flags = flags;
    data._stats = { compendiumSource: source.pack ? source.uuid : null };
    [applied] = await actor.createEmbeddedDocuments("Item", [data]);
  }
  if (!applied) return false;
  await actor.update({ [`system.legacy2.${field}`]: applied.id });
  return true;
}

/** The world/compendium definition survives removal of its owned profile tag. */
export async function removeNpcProfile(sheet, type) {
  if (!sheet.isEditable) return false;
  return assignNpcProfile(sheet.actor, type, "");
}
