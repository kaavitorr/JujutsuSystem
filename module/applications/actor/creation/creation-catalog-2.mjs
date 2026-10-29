import { carregarGrafo } from "../../../systems/especializacoes-2.mjs";
import { CUSTOMIZATION_SECTIONS, isCustomizationCategory } from "../jj/legacy2-customization.mjs";

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const categories = { defeitos: "jj-flaws", defeito: "jj-flaws", flaws: "jj-flaws",
  peculiaridades: "jj-peculiarities", peculiaridade: "jj-peculiarities",
  desvantagens: "jj-variant-penalties", "penalidades variantes": "jj-variant-penalties",
  "modificadores lendarios": "jj-legendary-modifiers" };

export function creationCustomizationCategory(doc, folderName = "") {
  if (doc.type !== "feat") return null;
  const explicit = doc.getFlag?.("jujutsu-system", "featureSection") ?? doc.flags?.["jujutsu-system"]?.featureSection;
  if (isCustomizationCategory(explicit)) return explicit;
  const labels = [doc.folder?.name, folderName, doc.flags?.["custom-character-sheet-sections"]?.sectionName,
    doc.flags?.["jujutsu-system"]?.bioKind, doc.system?.type?.value];
  return labels.map(label => categories[normalize(label)]).find(Boolean) ?? null;
}

/** Actual available content only. Empty customization categories remain ready for future feats. */
export async function loadCreationCatalog() {
  const pack = game.packs.get("jujutsu-compendium.geral-2-0");
  const docs = pack && pack.visible !== false ? await pack.getDocuments() : [];
  const all = [...docs, ...Array.from(game.items ?? []).filter(doc => !doc.testUserPermission || doc.testUserPermission(game.user, "OBSERVER"))];
  let species = all.filter(doc => doc.type === "race");
  if (!species.length) {
    const original = game.packs.get("jujutsu-compendium.geral");
    if (original && original.visible !== false) species.push(...(await original.getDocuments()).filter(doc => doc.type === "race"));
  }
  // Origens duplicadas (compendium + cópia solta no mundo): o compendium vence.
  const origensUnicas = new Map();
  for (const doc of species) if (!origensUnicas.has(doc.name)) origensUnicas.set(doc.name, doc);
  species = [...origensUnicas.values()];
  const styles = all.filter(doc => doc.type === "class" && !!(doc.getFlag?.("jujutsu-system", "legacy2") ?? doc.flags?.["jujutsu-system"]?.legacy2));
  const customization = Object.fromEntries(CUSTOMIZATION_SECTIONS.map(section => [section.id, []]));
  for (const doc of all) {
    const category = creationCustomizationCategory(doc, pack?.folders?.get?.(doc.folder)?.name);
    if (category && !customization[category].some(item => item.uuid === doc.uuid)) customization[category].push(doc);
  }
  const sort = list => list.sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));
  return { species: sort(species), styles: sort(styles), customization,
    graph: await carregarGrafo() };
}

/** Legacy origin grants sometimes point to older pack IDs; resolve the actual copied item when necessary. */
export async function resolveCreationDocument(uuid) {
  let doc;
  try { doc = await fromUuid(uuid); }
  catch (error) {
    // Foundry may throw for a removed legacy pack instead of returning null.
    if (!/^Compendium\.[^.]+\.[^.]+\.Item\.[^.]+$/.test(uuid ?? "")) throw error;
  }
  if (doc || !/^Compendium\.[^.]+\.[^.]+\.Item\.[^.]+$/.test(uuid ?? "")) return doc;
  const id = uuid.split(".").at(-1);
  return fromUuid(`Compendium.jujutsu-compendium.geral-2-0.Item.${id}`);
}
