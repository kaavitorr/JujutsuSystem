import { validNpcScale } from "../../../systems/legacy2-npc-profiles.mjs";
import { isNpcGenerator2Weapon, npcGeneratorWeaponFolder } from "./npc-generator-weapons.mjs";
import { npcGeneratorProfileKey, npcGeneratorArchetypeAllowed } from "./npc-generator-archetypes.mjs";
import { npcProfileImage } from "../../../systems/npc-profile-art.mjs";

const TYPES = ["taxonomy", "archetype"];
const CATALOG_TYPES = [...TYPES, "weapon"];
const readable = document => document.testUserPermission?.(game.user, "OBSERVER") ?? document.visible !== false;

/**
 * Read indexes only; full documents are resolved after the GM chooses them.
 * @returns {Promise<object>} Taxonomy, archetype and weapon choices.
 */
export async function npcGeneratorProfiles() {
  const profiles = { taxonomy: [], archetype: [], weapon: [] };
  for (const item of game.items ?? []) {
    if (CATALOG_TYPES.includes(item.type) && readable(item) && (item.type !== "weapon" || isNpcGenerator2Weapon(item))) profiles[item.type].push({ value: item.uuid, label: item.name, group: "Mundo", img: npcProfileImage(item),
      ...(item.type === "weapon" ? { folder: npcGeneratorWeaponFolder(item) } : { profileKey: npcGeneratorProfileKey(item) }) });
  }
  const packs = Array.from(game.packs ?? []).filter(pack => pack.documentName === "Item" && readable(pack));
  const indexes = await Promise.allSettled(packs.map(pack => pack.getIndex({
    fields: ["img", "system.identifier", "flags.jujutsu-system.encyclopedia.key", "flags.jujutsu-system.elemento", "system.damage", "system.activities"]
  })));
  indexes.forEach((result, index) => {
    const pack = packs[index];
    if (result.status === "rejected") {
      console.warn(`Jujutsu Legacy | Não foi possível consultar o compêndio ${pack.collection}.`, result.reason);
      return;
    }
    for (const entry of result.value) if (CATALOG_TYPES.includes(entry.type) && (entry.type !== "weapon" || isNpcGenerator2Weapon(entry))) profiles[entry.type].push({
      value: `Compendium.${pack.collection}.Item.${entry._id}`, label: entry.name, group: pack.metadata?.label ?? pack.collection, img: npcProfileImage(entry),
      ...(entry.type === "weapon" ? { folder: npcGeneratorWeaponFolder(entry) } : { profileKey: npcGeneratorProfileKey(entry) })
    });
  });
  // Keep the original built-in profiles available when the world has no authored profiles.
  for (const [type, key] of [["taxonomy", "taxonomias"], ["archetype", "arquetipos"]]) {
    if (!profiles[type].length) {
      profiles[type] = Object.entries(CONFIG.JUJUTSU?.[key] ?? {}).map(([id, definition]) => ({
        value: `legacy:${id}`, label: definition.label, group: "Padrão", img: npcProfileImage({ ...definition, key: id }, type), profileKey: npcGeneratorProfileKey({ key: id })
      }));
    }
  }
  for (const choices of Object.values(profiles)) {
    choices.sort((a, b) => a.label.localeCompare(b.label, "pt-BR") || a.group.localeCompare(b.group, "pt-BR"));
  }
  return profiles;
}

/** Keep general archetypes alongside the selected taxonomy's exclusive profiles. */
export function npcGeneratorArchetypesForTaxonomy(profiles, selection) {
  const taxonomy = profiles.taxonomy.find(choice => choice.value === selection);
  return profiles.archetype.filter(archetype => npcGeneratorArchetypeAllowed(taxonomy, archetype));
}

/**
 * Preserve the full profile, including ND grants, effects, movement and equipment.
 * @param {string} type         Taxonomy or archetype.
 * @param {string} selection    Source UUID or built-in key.
 * @returns {Promise<object|null>} A validated profile or null when unavailable.
 */
export async function npcGeneratorProfile(type, selection) {
  if (!TYPES.includes(type) || !selection) return null;
  const key = type === "taxonomy" ? "taxonomias" : "arquetipos";
  const legacy = selection.startsWith("legacy:") ? selection.slice(7) : selection;
  if (CONFIG.JUJUTSU?.[key]?.[legacy]) return { key: legacy, label: CONFIG.JUJUTSU[key][legacy].label };
  let source;
  try { source = await fromUuid(selection); } catch { return null; }
  if (source?.type !== type || !readable(source) || !validNpcScale(source.system?.pesos)) return null;
  const data = source.toObject();
  const image = npcProfileImage(source);
  if (image) data.img = image;
  delete data._id;
  delete data.folder;
  delete data.ownership;
  ((data.flags ??= {})["jujutsu-system"] ??= {}).npcProfileSource = source.uuid;
  data._stats = { compendiumSource: source.pack ? source.uuid : null };
  return { label: source.name, data };
}
