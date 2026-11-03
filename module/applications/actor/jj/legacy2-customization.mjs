/** Item-backed Personalização sections; native documents retain their activities and effects. */
import { PECULIARIDADES } from "../../../systems/peculiaridades-data.mjs";

/** Limite de Defeitos por ficha (regra 2.0). Fonte única — todas as verificações usam este valor. */
export const MAX_DEFEITOS = 3;

/** Limite de Peculiaridades (regra 7.3: máximo de uma, escolha permanente). */
export const MAX_PECULIARIDADES = 1;

export const CUSTOMIZATION_SECTIONS = [
  { id: "jj-flaws", label: "Defeitos", icon: "wounds", max: MAX_DEFEITOS },
  { id: "jj-peculiarities", label: "Peculiaridades", icon: "cha", max: MAX_PECULIARIDADES },
  { id: "jj-variant-penalties", label: "Penalidades Variantes", icon: "con" },
  { id: "jj-legendary-modifiers", label: "Modificadores Lendários", icon: "energy" }
];
const categories = new Set(CUSTOMIZATION_SECTIONS.map(section => section.id));
export const isCustomizationCategory = id => categories.has(id);
export function customizationLimitMessage(category) {
  return category === "jj-peculiarities" ? `A ficha pode ter no máximo ${MAX_PECULIARIDADES} Peculiaridade.`
    : `A ficha pode ter no máximo ${MAX_DEFEITOS} Defeitos.`;
}
export function customizationCategory(item) {
  if ( item.type !== "feat" ) return undefined;
  const key = item.getFlag?.("jujutsu-system", "peculiaridade") ?? item.flags?.["jujutsu-system"]?.peculiaridade;
  if ( Object.hasOwn(PECULIARIDADES, key) ) return "jj-peculiarities";
  return item.getFlag?.("jujutsu-system", "featureSection") ?? item.flags?.["jujutsu-system"]?.featureSection;
}
export const isCustomizationItem = item => isCustomizationCategory(customizationCategory(item));
export const customizationTarget = event => event.target?.closest?.("[data-jj2-customization]")?.dataset.jj2Customization;

export function customizationCharacteristics(actor) {
  return [["height", "Altura"], ["hair", "Cabelo"], ["weight", "Peso"], ["gender", "Gênero"],
    ["skin", "Pele"], ["age", "Idade"]].map(([key, label]) => ({ key, label,
    name: `system.details.${key}`, value: actor.system.details?.[key] ?? "",
    source: actor._source?.system?.details?.[key] ?? actor.system.details?.[key] ?? "" }));
}

export function customizationSections(actor, visibleItems = Array.from(actor.items ?? [])) {
  return CUSTOMIZATION_SECTIONS.map(section => {
    const items = visibleItems.filter(item => customizationCategory(item) === section.id);
    const count = Array.from(actor.items ?? []).filter(item => customizationCategory(item) === section.id).length;
    return { ...section, items, count, canAdd: section.max == null || count < section.max };
  });
}

export function tagCustomizationData(item, category) {
  const data = item.toObject?.() ?? item;
  return { ...data, flags: { ...data.flags, "jujutsu-system": { ...data.flags?.["jujutsu-system"], featureSection: category } } };
}

export function prepareCustomizationImport(actor, category, items) {
  if ( category != null && !isCustomizationCategory(category) ) return { ok: false, reason: "category" };
  if ( category && items.some(item => item.type !== "feat") ) return { ok: false, reason: "type" };
  for ( const section of CUSTOMIZATION_SECTIONS.filter(section => section.max != null) ) {
    const added = items.filter(item => item.type === "feat" && (category ?? customizationCategory(item)) === section.id).length;
    const existing = Array.from(actor.items ?? []).filter(item => customizationCategory(item) === section.id).length;
    if ( added && existing + added > section.max ) return { ok: false, reason: "limit", category: section.id };
  }
  return { ok: true, items: category ? items.map(item => tagCustomizationData(item, category)) : items };
}

export function canAssignCustomization(actor, item, category) {
  if ( item.type !== "feat" || !isCustomizationCategory(category) ) return false;
  if ( customizationCategory(item) === category ) return true;
  if ( category === "jj-flaws" ) return Array.from(actor.items ?? []).filter(entry => customizationCategory(entry) === "jj-flaws").length < MAX_DEFEITOS;
  if ( category === "jj-peculiarities" ) return !Array.from(actor.items ?? []).some(entry => customizationCategory(entry) === "jj-peculiarities");
  return true;
}

const mutations = new WeakMap();
const creations = new WeakMap();
const validatedBatches = new WeakSet();
export const isValidatedDefectBatch = actor => validatedBatches.has(actor);
/** Validate after preceding writes finish so simultaneous drops cannot bypass the section limits. */
export async function serializeCustomization(actor, mutate) {
  const pending = mutations.get(actor) ?? Promise.resolve();
  const next = pending.catch(() => {}).then(mutate);
  mutations.set(actor, next);
  try { return await next; }
  finally { if ( mutations.get(actor) === next ) mutations.delete(actor); }
}

/** A separate queue guards document creation without nesting the sheet's mutation queue. */
export async function serializeDefectCreation(actor, create) {
  const pending = creations.get(actor) ?? Promise.resolve();
  const next = pending.catch(() => {}).then(create);
  creations.set(actor, next);
  try { return await next; }
  finally { if ( creations.get(actor) === next ) creations.delete(actor); }
}

/** Count the final item state, allowing atomic replacements while preventing stacked peculiarities. */
export function validateCustomizationBatch(actor, operations) {
  const stableKey = item => item.getFlag?.("jujutsu-system", "peculiaridade") ?? item.flags?.["jujutsu-system"]?.peculiaridade;
  const states = new Map(Array.from(actor.items ?? [], item => [item.id ?? item._id ?? Symbol(), {
    type: item.type, category: customizationCategory(item), peculiaridade: stableKey(item)
  }]));
  const addedCategories = new Set();
  for ( const operation of operations ) {
    if ( operation.documentName !== "Item" || operation.parent !== actor ) continue;
    if ( operation.action === "delete" ) {
      for ( const id of operation.ids ?? [] ) states.delete(id);
    } else if ( operation.action === "create" ) {
      for ( const item of operation.data ?? [] ) {
        const category = customizationCategory(item);
        if ( item.type === "feat" ) addedCategories.add(category);
        states.set(item._id ?? item.id ?? Symbol(), { type: item.type, category, peculiaridade: stableKey(item) });
      }
    } else if ( operation.action === "update" ) {
      for ( const update of operation.updates ?? [] ) {
        const state = states.get(update._id);
        if ( !state ) continue;
        const previousCategory = state.type === "feat" ? state.category : null;
        state.type = update.type ?? state.type;
        const flags = update.flags?.["jujutsu-system"];
        if ( Object.hasOwn(update, "flags.jujutsu-system.featureSection") ) state.category = update["flags.jujutsu-system.featureSection"];
        else if ( flags && Object.hasOwn(flags, "featureSection") ) state.category = flags.featureSection;
        else if ( Object.hasOwn(update, "flags.jujutsu-system.-=featureSection")
          || (flags && Object.hasOwn(flags, "-=featureSection")) ) state.category = undefined;
        else if ( operation.recursive === false && Object.hasOwn(update, "flags") ) state.category = flags?.featureSection;
        if ( Object.hasOwn(update, "flags.jujutsu-system.peculiaridade") ) state.peculiaridade = update["flags.jujutsu-system.peculiaridade"];
        else if ( flags && Object.hasOwn(flags, "peculiaridade") ) state.peculiaridade = flags.peculiaridade;
        else if ( Object.hasOwn(update, "flags.jujutsu-system.-=peculiaridade")
          || (flags && Object.hasOwn(flags, "-=peculiaridade"))
          || (operation.recursive === false && Object.hasOwn(update, "flags")) ) state.peculiaridade = undefined;
        if ( Object.hasOwn(PECULIARIDADES, state.peculiaridade) ) state.category = "jj-peculiarities";
        if ( state.type === "feat" && state.category !== previousCategory ) addedCategories.add(state.category);
      }
    }
  }
  const counts = Object.fromEntries(CUSTOMIZATION_SECTIONS.filter(section => section.max != null).map(section => [section.id,
    Array.from(states.values()).filter(state => state.type === "feat" && state.category === section.id).length]));
  const overflow = CUSTOMIZATION_SECTIONS.find(section => addedCategories.has(section.id)
    && section.max != null && counts[section.id] > section.max);
  return { ok: !overflow, count: counts["jj-flaws"], ...(overflow ? { category: overflow.id } : {}) };
}

/** Hold the guard until modifyBatch completes; its intermediate createDocuments call is only a dry run. */
export function performValidatedCustomizationBatch(actor, operations, commit) {
  return serializeDefectCreation(actor, async () => {
    const result = validateCustomizationBatch(actor, operations);
    if ( !result.ok ) throw new Error(customizationLimitMessage(result.category));
    validatedBatches.add(actor);
    try { return await commit(); }
    finally { validatedBatches.delete(actor); }
  });
}
