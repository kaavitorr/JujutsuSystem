import { buildLegacy2Context, legacy2ActionMax, prepareRankUpdate } from "./legacy2-sheet.mjs";
import { npc2AbilityValue } from "../../../systems/legacy2-npc-attributes.mjs";
import { npcProfile, npcAttributeDistribution, npcProficiencyDistribution, NPC_ABILITIES } from "../../../systems/legacy2-npc-profiles.mjs";
import { NPC_CLASSIFICATIONS, npcClassification, npcClassificationKey } from "../../../systems/legacy2-npc-classification.mjs";
import { proficiencyOrderContext } from "./npc-proficiency-order.mjs";

export const NPC2_TABS = [["details", "Resumo", "summary"], ["features", "Habilidades", "weapons"],
  ["spells", "Técnicas", "int"], ["skills", "Perícias", "dice"], ["inventory", "Equipamentos", "inventory"],
  ["effects", "Efeitos", "effects"], ["biography", "Biografia", "biography"],
  ["specialTraits", "Detalhes", "config"]];
const choices = (configs, selected) => Object.entries(configs).map(([value, config]) => ({
  value, label: config.label ?? config, selected: value === selected
}));

/** NPC presentation uses prepared values; it never changes the source actor. */
export function buildNpc2Context(actor, config, ruleset, npcConfig = {}) {
  const data = buildLegacy2Context(actor, config, ruleset), source = actor.system.legacy2 ?? {};
  const tax = npcProfile(actor, "taxonomy", npcConfig), archetype = npcProfile(actor, "archetype", npcConfig);
  const distribution = npcAttributeDistribution(actor, npcConfig);
  const categories = Object.fromEntries(Object.entries(NPC_CLASSIFICATIONS).map(([key, value]) => [key, value.label]));
  const classification = npcClassification(actor);
  data.abilities = data.abilities.map(ability => ({ ...ability,
    value: actor.system.abilities[ability.key]?.value ?? ability.value,
    sourceValue: npc2AbilityValue(actor.system.abilities[ability.key]?._source?.value ?? ability.value),
    principal: ability.key === (archetype ? ruleset.npcPrincipal(actor) : ruleset.atributoPrincipal(actor)) }));
  delete data.atributos;
  delete data.wounds;
  data.npc = { nd: ruleset.nivel(actor), longName: String(actor.name ?? "").length > 45,
    taxonomy: tax?.label ?? "NPC", taxonomyUuid: tax?.item?.uuid,
    archetype: archetype?.label, archetypeUuid: archetype?.item?.uuid,
    profileTags: [["taxonomy", "Taxonomia", tax], ["archetype", "Arquétipo", archetype]]
      .filter(([, , profile]) => profile).map(([type, kind, profile]) => ({
        type, kind, label: profile.label, uuid: profile.item?.uuid
      })),
    category: classification.label, classificationHp: classification.hpMultiplier.toLocaleString("pt-BR"),
    proficiency: (() => {
      const distribution = npcProficiencyDistribution(actor);
      return proficiencyOrderContext(distribution.order, distribution);
    })(),
    classificationActions: classification.actions, hasTaxonomy: !!tax,
    derivedAttributes: !!tax,
    distribution: distribution ? { ...distribution, rows: NPC_ABILITIES.map(key => ({ key,
      label: config.abilities[key]?.abbreviation ?? config.abilities[key]?.label ?? key,
      initial: distribution.initial[key], growth: distribution.growth[key], value: distribution.values[key] })) } : null,
    categories: choices(categories, npcClassificationKey(source.categoria)),
    armorPct: percent(actor.system.armorPoints?.value, actor.system.armorPoints?.max),
    legendaries: ["legact", "legres"].map(key => ({ key, label: key === "legact" ? "Ações Lendárias" : "Resistências Lendárias",
      max: actor.system.resources?.[key]?.max ?? 0, spent: actor.system.resources?.[key]?.spent ?? 0,
      value: actor.system.resources?.[key]?.value ?? 0 })),
    override: {
      hpMax: actor.system.attributes?.hp?.maxOverride ?? "",
      cr: actor.system.attributes?.acOverride ?? ""
    } };
  return data;
}
const percent = (value, max) => max > 0 ? Math.max(0, Math.min(100, 100 * (Number(value) || 0) / max)) : 0;

export function configureNpc2Parts(parts) {
  const templates = { header: "npc-header-2", sidebar: "npc-sidebar-2", abilityScores: "npc-ability-scores-2",
    details: "tabs/npc-summary-2", skills: "tabs/character-skills-2", tabs: "character-tabs-hunter-2", effects: "tabs/character-effects-2" };
  for (const [id, template] of Object.entries(templates)) if (parts[id]) parts[id].template = `systems/jujutsu-system/templates/actors/${template}.hbs`;
  if (parts.tabs) parts.tabs.classes = ["jj2-tabs-nav"];
  if (parts.sidebar) (parts.sidebar.templates ??= []).push("systems/jujutsu-system/templates/actors/npc-sidebar.hbs");
  if (parts.effects) (parts.effects.templates ??= []).push("systems/jujutsu-system/templates/effects/columns/controls-2.hbs", "systems/jujutsu-system/templates/effects/columns/detail-2.hbs");
  for (const part of Object.values(parts)) (part.templates ??= []).push(
    "systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs", "systems/jujutsu-system/templates/actors/parts/jj2-resource.hbs",
    "systems/jujutsu-system/templates/actors/parts/jj2-action-ring.hbs",
    "systems/jujutsu-system/templates/actors/parts/jj2-alternative-saves.hbs",
    "systems/jujutsu-system/templates/actors/parts/jj2-ranks.hbs",
    "systems/jujutsu-system/templates/actors/parts/jj2-proficiency-order.hbs",
    "systems/jujutsu-system/templates/actors/parts/jj2-resistances.hbs");
  return parts;
}

/** Shared action boxes retain the NPC's native saved action pool. */
export async function updateNpc2Actions(sheet, value) {
  if (!sheet.isEditable || !Number.isInteger(value) || value < 0 || value > legacy2ActionMax(sheet.actor)) return;
  return sheet.actor.update({ "system.legacy2.actions.value": value });
}

/** Use the player's rank ladder with NPC permissions and freely configurable proficiency. */
export async function updateNpc2Rank(sheet, target, ruleset, abilities) {
  if (!ruleset.isV2() || sheet.actor.type !== "npc" || !sheet.isEditable || !sheet.isEditMode) return;
  const container = target.closest(".jj2-dots"), raw = target.dataset.rank;
  if (!container || typeof raw !== "string" || !raw.trim()) return;
  const clicked = Number(raw);
  if (!Number.isInteger(clicked) || clicked < 1 || clicked > 4) return;
  const rank = clicked === Number(container.dataset.currentRank) ? 0 : clicked;
  const result = prepareRankUpdate(sheet.actor, container.dataset.ctx, container.dataset.key, rank, ruleset, abilities);
  if (result?.update) return sheet.actor.update(result.update);
}
