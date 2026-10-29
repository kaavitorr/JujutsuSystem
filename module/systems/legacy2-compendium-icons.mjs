const PACK = "jujutsu-compendium.arquetipos-e-taxonomias";
const PREFIX = `Compendium.${PACK}.Item.`;
const DEFAULTS = {
  feat: "systems/jujutsu-system/icons/svg/items/feature.svg",
  taxonomy: "systems/jujutsu-system/icons/svg/items/taxonomy.svg",
  archetype: "systems/jujutsu-system/icons/svg/items/archetype.svg"
};
const encyclopediaKey = item => {
  const source = item.flags?.["jujutsu-system"]?.encyclopedia;
  return source?.edition === "2.0" ? `${item.type}:${source.key}` : null;
};

/** Refresh stock placeholders in existing copies; retain artwork chosen on a sheet. */
export async function refreshEncyclopediaIcons(world = game) {
  if (!world.user.isGM || world.users.activeGM?.id !== world.user.id) return;
  const pack = world.packs.get(PACK);
  if (!pack) return;
  const documents = await pack.getDocuments();
  const byUuid = new Map(documents.map(item => [item.uuid ?? `${PREFIX}${item.id}`, item]));
  const byKey = new Map(documents.filter(item => encyclopediaKey(item)).map(item => [encyclopediaKey(item), item]));
  const updatesFor = items => Array.from(items ?? []).flatMap(item => {
    if (!DEFAULTS[item.type] || item.img !== DEFAULTS[item.type]) return [];
    const origin = item.flags?.["jujutsu-system"]?.npcProfileFeature?.source
      ?? item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    const source = byUuid.get(origin) ?? byKey.get(encyclopediaKey(item));
    if (source?.type !== item.type || !source.img?.startsWith("icons/")) return [];
    return [{ _id: item.id, img: source.img }];
  });
  const updates = updatesFor(world.items);
  if (updates.length) await CONFIG.Item.documentClass.updateDocuments(updates);
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) for (const token of scene.tokens) {
    if (!token.actorLink && token.actor) actors.add(token.actor);
  }
  for (const actor of actors) {
    const updates = updatesFor(actor.items);
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }
}

export function registerCompendiumIconHooks(hooks = Hooks) {
  hooks.once("dnd5e.ready", () => refreshEncyclopediaIcons().catch(error => {
    console.error("Jujutsu: falha ao atualizar ícones da Enciclopédia.", error);
    ui.notifications.error("Não foi possível atualizar os ícones dos itens da Enciclopédia.");
  }));
}
