const PACK = "jujutsu-compendium.arquetipos-e-taxonomias";

/** Remove only the metadata paragraphs added by the encyclopedia importer. */
export function cleanEncyclopediaDescription(html) {
  if (typeof html !== "string") return html;
  return html.replace(/^\s*<p>\s*<strong>\s*ND\s+\d+(?:\s*·\s*([^<]*))?\s*<\/strong>\s*<\/p>/i,
    (_heading, remainder) => remainder?.trim() ? `<p><strong>${remainder.trim()}</strong></p>` : "")
    .replace(/<p>\s*<strong>\s*Arquétipos:\s*<\/strong>[\s\S]*?<\/p>/gi, "");
}

/** Source flags keep unrelated features and manually written descriptions out of the cleanup. */
export function encyclopediaDescriptionUpdates(item) {
  if (item.type !== "feat" || item.flags?.["jujutsu-system"]?.encyclopedia?.edition !== "2.0") return {};
  const updates = {};
  for (const field of ["value", "chat"]) {
    const before = item.system.description?.[field], after = cleanEncyclopediaDescription(before);
    if (after !== before) updates[`system.description.${field}`] = after;
  }
  return updates;
}

function itemUpdates(items) {
  return Array.from(items ?? []).flatMap(item => {
    const update = encyclopediaDescriptionUpdates(item);
    return Object.keys(update).length ? [{ _id: item.id ?? item._id, ...update }] : [];
  });
}

/** Persist the correction through Foundry, including copies already granted to creatures. */
export async function cleanupEncyclopediaDescriptions(world = game) {
  if (!world.user.isGM || world.users.activeGM?.id !== world.user.id) return;
  const ItemClass = CONFIG.Item.documentClass;
  const updates = itemUpdates(world.items);
  if (updates.length) await ItemClass.updateDocuments(updates);
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) for (const token of scene.tokens) {
    if (!token.actorLink && token.actor) actors.add(token.actor);
  }
  for (const actor of actors) {
    const updates = itemUpdates(actor.items);
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }
  const pack = world.packs.get(PACK);
  if (!pack) return;
  const packUpdates = itemUpdates(await pack.getDocuments());
  if (!packUpdates.length) return;
  const locked = pack.locked;
  try {
    if (locked) await pack.configure({ locked: false });
    await ItemClass.updateDocuments(packUpdates, { pack: pack.collection });
  } finally {
    if (locked) await pack.configure({ locked });
  }
}

export function registerEncyclopediaDescriptionHooks(hooks = Hooks) {
  hooks.once("dnd5e.ready", () => cleanupEncyclopediaDescriptions().catch(error => {
    console.error("Jujutsu: falha ao limpar as descrições da Enciclopédia.", error);
    ui.notifications.error("Não foi possível atualizar as descrições da Enciclopédia.");
  }));
}
