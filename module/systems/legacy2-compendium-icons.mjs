import { canRunCatalogRepair, catalogRepairDocuments, catalogRepairGroups, registerCatalogRepair,
  registerCatalogRepairHooks, runCatalogRepair } from "./catalog-repair-cache.mjs";
import { npcProfileImage } from "./npc-profile-art.mjs";

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
export async function refreshEncyclopediaIcons(world = game, scope = {}) {
  if (!canRunCatalogRepair(world, scope)) return;
  return runCatalogRepair(world, "encyclopedia-icons", async () => {
    const pack = world.packs?.get(PACK);
    const groups = new Map(Array.from(catalogRepairGroups(world, scope), ([actor, items]) =>
      [actor, items.filter(item => DEFAULTS[item.type] && item.img === DEFAULTS[item.type]
        || npcProfileImage(item) !== item.img)]).filter(([, items]) => items.length));
    if (!groups.size) return;
    const needsSource = [...groups.values()].some(items => items.some(item => npcProfileImage(item) === item.img));
    const documents = needsSource && pack ? await catalogRepairDocuments(world, PACK) : [];
    const byUuid = new Map(documents.map(item => [item.uuid ?? `${PREFIX}${item.id}`, item]));
    const byKey = new Map(documents.filter(item => encyclopediaKey(item)).map(item => [encyclopediaKey(item), item]));
    const updatesFor = items => Array.from(items ?? []).flatMap(item => {
      const image = npcProfileImage(item);
      if (image !== item.img) return [{ _id: item.id, img: image }];
      if (!DEFAULTS[item.type] || item.img !== DEFAULTS[item.type]) return [];
      const origin = item.flags?.["jujutsu-system"]?.npcProfileFeature?.source
        ?? item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
      const source = byUuid.get(origin) ?? byKey.get(encyclopediaKey(item));
      if (source?.type !== item.type || !source.img?.startsWith("icons/")) return [];
      return [{ _id: item.id, img: source.img }];
    });
    for (const [actor, items] of groups) {
      const updates = updatesFor(items);
      if (!updates.length) continue;
      if (actor) await actor.updateEmbeddedDocuments("Item", updates, { jjCatalogRepair: true });
      else await CONFIG.Item.documentClass.updateDocuments(updates, { jjCatalogRepair: true });
    }
  }, scope);
}

registerCatalogRepair("encyclopedia-icons", { packs: [PACK], refresh: refreshEncyclopediaIcons });

export function registerCompendiumIconHooks(hooks = Hooks) {
  registerCatalogRepairHooks(hooks);
  hooks.once("dnd5e.ready", () => refreshEncyclopediaIcons().catch(error => {
    console.error("Jujutsu: falha ao atualizar ícones da Enciclopédia.", error);
    ui.notifications.error("Não foi possível atualizar os ícones dos itens da Enciclopédia.");
  }));
}
