const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

/** Encyclopedia identities survive renamed labels and imported copies. */
export function npcProfileKey(profile) {
  const source = profile?.flags?.["jujutsu-system"]?.encyclopedia?.key;
  return normalize((typeof source === "string" ? source.split(":").at(-1) : null)
    ?? profile?.system?.identifier ?? profile?.profileKey ?? profile?.key);
}

export const isHumanTaxonomy = profile => ["humano", "humanos"].includes(npcProfileKey(profile));
export const HUMAN_PROFILE_ICON = "systems/jujutsu-system/assets/gerador-pdn-pintado-v1/humano-feiticeiro.webp";
const OLD_HUMAN_ICON = "modules/jujutsu-compendium/assets/perfis-pdn-pintados-v1/taxonomias/humanos.webp";

/** Replace the stock cultivator and empty placeholders, retaining manually selected portraits. */
export function npcProfileImage(profile, type = profile?.type) {
  if (type !== "taxonomy" || !isHumanTaxonomy(profile)) return profile?.img;
  const path = String(profile?.img ?? "").split("?")[0];
  const stock = !path || path === OLD_HUMAN_ICON || path.includes("Immortals-system/assets/wuxia/")
    || ["icons/svg/pawprint.svg", "icons/svg/mystery-man.svg", "systems/jujutsu-system/icons/svg/items/taxonomy.svg"].includes(path);
  return stock ? HUMAN_PROFILE_ICON : profile.img;
}
