import { formatNumber } from "../../utils.mjs";
import AdvancementManager from "../advancement/advancement-manager.mjs";
import EnergyGenerationDialog from "./energy-generation-dialog.mjs";
import { EnergySystem } from "../../systems/energy.mjs";
import CompendiumBrowser from "../compendium-browser.mjs";
import ContextMenu5e from "../context-menu.mjs";
import BaseActorSheet from "./api/base-actor-sheet.mjs";
import Item5e from "../../documents/item.mjs";
import * as Trait from "../../documents/actor/trait.mjs";

// ── Módulos JJ ──────────────────────────────────────────────────────────────
import { injectSkillRefs, injectTrainingRefs, injectAbilityRefs, injectAbilityKanjis, applyJJTextTooltips } from "./jj/tooltips.mjs";
import { JJ_CONDITIONS, injectJJConditions } from "./jj/conditions.mjs";
import { setupFeatureSectionCollapse, unhideFeatureSections, setupFeatureSectionDrops, JJ_FEATURE_SECTIONS } from "./jj/features.mjs";
import { onExplosaoDefensiva, onEnergiaReversa, onFocoDefensivo } from "./jj/explosao-defensiva.mjs";
import { canShowExpansaoDominio, onExpansaoDominio, configureExpansaoDominio } from "./jj/expansao-dominio.mjs";
import { checkFulgorNegro, applyFulgorZonaEffect, setupFulgorNegro, getFulgorSecundaria } from "./jj/fulgor-negro.mjs";
import { applySeiOlhosEffects } from "./jj/seis-olhos.mjs";
import {
  prepareManipulationContext, prepareTrainingsContext,
  onUnlockManipulationAbility, onUndoManipulationAbility,
  onIntensiveTraining, onUndoIntensiveTraining,
  grantLinkedTechniques, syncTrainingEffect,
  onTrainAbility, onUndoTraining
} from "./jj/manipulation-handlers.mjs";
// módulos de side-effects (registram Hooks no import)
import "./jj/executor.mjs";
import "./jj/chat-card.mjs";
import "./jj/extra-cards.mjs";
import "./jj/energy-consumption.mjs";
import "./jj/socket.mjs";
import "./jj/mastery-milestones.mjs";
import "./jj/reducao-dano.mjs";
import "./jj/npc-generator-dialog.mjs";
import "./jj/combat-sacrifice-hud.mjs";
import "./jj/heal-limit.mjs";
import "./jj/constant-cost.mjs";
import { ensureFeiticoPack } from "../../data/item/feitico-template.mjs";


const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * @import { FavoriteData5e } from "../../data/abstract/_types.mjs";
 * @import { ActorFavorites5e } from "../../data/actor/_types.mjs";
 * @import { FacilityOccupants } from "../../data/item/_types.mjs";
 */

/**
 * Extension of base actor sheet for characters.
 */
export default class CharacterActorSheet extends BaseActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      deleteFavorite: CharacterActorSheet.#deleteFavorite,
      deleteOccupant: CharacterActorSheet.#deleteOccupant,
      findItem: CharacterActorSheet.#findItem,
      setSpellcastingAbility: CharacterActorSheet.#setSpellcastingAbility,
      toggleDeathTray: CharacterActorSheet.#toggleDeathTray,
      toggleInspiration: CharacterActorSheet.#toggleInspiration,
      useFacility: CharacterActorSheet.#useFacility,
      useFavorite: CharacterActorSheet.#useFavorite
    },
    classes: ["character", "vertical-tabs"],
    position: {
      width: 800,
      height: 1000
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: "systems/jujutsu-system/templates/actors/character-header.hbs"
    },
    sidebar: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/jujutsu-system/templates/actors/character-sidebar.hbs"
    },
    details: {
      classes: ["col-2"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-details.hbs",
      scrollable: [""]
    },
    inventory: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-inventory.hbs",
      templates: [
        "systems/jujutsu-system/templates/inventory/inventory.hbs", "systems/jujutsu-system/templates/inventory/activity.hbs",
        "systems/jujutsu-system/templates/inventory/encumbrance.hbs", "systems/jujutsu-system/templates/inventory/containers.hbs"
      ],
      scrollable: [""]
    },
    features: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-features.hbs",
      templates: ["systems/jujutsu-system/templates/inventory/inventory.hbs", "systems/jujutsu-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    spells: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/creature-spells.hbs",
      templates: ["systems/jujutsu-system/templates/inventory/inventory.hbs", "systems/jujutsu-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    effects: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/actor-effects.hbs",
      scrollable: [""]
    },
    biography: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-biography.hbs",
      scrollable: [""]
    },
    bastion: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-bastion.hbs",
      scrollable: [""]
    },
    // specialTraits: {
    //   classes: ["flexcol"],
    //   container: { classes: ["tab-body"], id: "tabs" },
    //   template: "systems/jujutsu-system/templates/actors/tabs/creature-special-traits.hbs",
    //   scrollable: [""]
    // },
    manipulation: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-manipulation.hbs",
      scrollable: [""]
    },
    trainings: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-trainings.hbs",
      scrollable: [""]
    },
    feitico: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/character-feitico.hbs",
      scrollable: [""]
    },
    abilityScores: {
      template: "systems/jujutsu-system/templates/actors/character-ability-scores.hbs"
    },
    warnings: {
      template: "systems/jujutsu-system/templates/actors/parts/actor-warnings-dialog.hbs"
    },
    tabs: {
      id: "tabs",
      classes: ["tabs-right"],
      template: "systems/jujutsu-system/templates/shared/sidebar-tabs.hbs"
    }
  };

  /* -------------------------------------------- */

  /**
   * Proficiency class names.
   * @enum {string}
   */
  static PROFICIENCY_CLASSES = {
    0: "none",
    0.5: "half",
    1: "full",
    2: "double"
  };

  /* -------------------------------------------- */

  /** @override */
  static TABS = [
    { tab: "details", label: "DND5E.Details", icon: "fas fa-cog" },
    { tab: "inventory", label: "DND5E.Inventory", svg: "systems/jujutsu-system/icons/svg/backpack.svg" },
    { tab: "features", label: "DND5E.Features", icon: "fas fa-list" },
    { tab: "spells", label: "TYPES.Item.spellPl", icon: "fas fa-book" },
    { tab: "feitico", label: "JUJUTSU.Feitico.Tab", icon: "fas fa-hand-fist" },
    { tab: "effects", label: "DND5E.Effects", icon: "fas fa-bolt" },
    { tab: "bastion", label: "DND5E.Bastion.Label", icon: "fas fa-chess-rook", condition: this.hasBastion },
    // { tab: "specialTraits", label: "DND5E.SpecialTraits", icon: "fas fa-star" },
    { tab: "manipulation", label: "JUJUTSU.Manipulation.Tab", icon: "fas fa-hand-sparkles" },
    { tab: "trainings", label: "JUJUTSU.Trainings.Tab", icon: "fas fa-dumbbell" },
    { tab: "biography", label: "DND5E.Biography", icon: "fas fa-feather" }
  ];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Whether the user has manually opened the death save tray.
   * @type {boolean}
   * @protected
   */
  _deathTrayOpen = false;

  /* -------------------------------------------- */

  /** @override */
  _filters = {
    features: { name: "", properties: new Set() },
    effects: { name: "", properties: new Set() },
    inventory: { name: "", properties: new Set() },
    spells: { name: "", properties: new Set() }
  };

  /* -------------------------------------------- */

  /** @override */
  tabGroups = {
    primary: "details"
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _configureInventorySections(sections) {
    sections.forEach(s => {
      s.minWidth = 250;
      if ( s.id === "weapons" ) s.columns = ["price", "weight", "quantity", "charges", "roll", "formula", "controls"];
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = {
      ...await super._prepareContext(options),
      abilityRows: {
        bottom: [], top: [], optional: Object.keys(CONFIG.DND5E.abilities).length - 6
      },
      isCharacter: true
    };
    context.spellbook = this._prepareSpellbook(context);
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch ( partId ) {
      case "abilityScores": return this._prepareAbilityScoresContext(context, options);
      case "bastion": return this._prepareBastionContext(context, options);
      case "biography": return this._prepareBiographyContext(context, options);
      case "details": return this._prepareDetailsContext(context, options);
      case "effects": return this._prepareEffectsContext(context, options);
      case "features": return this._prepareFeaturesContext(context, options);
      case "header": return this._prepareHeaderContext(context, options);
      case "inventory": return this._prepareInventoryContext(context, options);
      case "sidebar": return this._prepareSidebarContext(context, options);
      case "specialTraits": return this._prepareSpecialTraitsContext(context, options);
      case "spells": return this._prepareSpellsContext(context, options);
      case "manipulation": return this._prepareManipulationContext(context, options);
      case "trainings": return this._prepareTrainingsContext(context, options);
      case "feitico": return this._prepareFeiticoContext(context, options);
      default: return context;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the ability scores.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareAbilityScoresContext(context, options) {
    for ( const ability of this._prepareAbilities(context) ) {
      if ( context.abilityRows.bottom.length > 5 ) context.abilityRows.top.push(ability);
      else context.abilityRows.bottom.push(ability);
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the bastion tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareBastionContext(context, options) {
    context.bastion = {
      description: await TextEditor.enrichHTML(this.actor.system.bastion.description, {
        secrets: this.actor.isOwner, relativeTo: this.actor, rollData: context.rollData
      })
    };
    context.defenders = [];
    context.facilities = { basic: { chosen: [] }, special: { chosen: [] } };

    for ( const facility of context.itemCategories.facilities ?? [] ) {
      const ctx = context.itemContext[facility.id] ?? {};
      context.defenders.push(...ctx.defenders.map(({ actor }) => {
        if ( !actor ) return null;
        const { img, name, uuid } = actor;
        return { img, name, uuid, facility: facility.id };
      }).filter(_ => _));
      if ( ctx.isSpecial ) context.facilities.special.chosen.push(ctx);
      else context.facilities.basic.chosen.push(ctx);
    }

    for ( const [type, facilities] of Object.entries(context.facilities) ) {
      const config = CONFIG.DND5E.facilities.advancement[type];
      let [, available] = Object.entries(config).reverse().find(([level]) => {
        return level <= this.actor.system.details.level;
      }) ?? [];
      facilities.value = facilities.chosen.filter(({ free }) => (type === "basic") || !free).length;
      facilities.max = available ?? 0;
      available = (available ?? 0) - facilities.value;
      facilities.available = Array.fromRange(Math.max(0, available)).map(() => {
        return { label: `DND5E.FACILITY.AvailableFacility.${type}.free` };
      });
    }

    if ( !context.facilities.basic.available.length ) {
      context.facilities.basic.available.push({ label: "DND5E.FACILITY.AvailableFacility.basic.build" });
    }

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the biography tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareBiographyContext(context, options) {
    const enrichmentOptions = {
      secrets: this.actor.isOwner, relativeTo: this.actor, rollData: context.rollData
    };
    context.enriched = {
      label: "DND5E.Biography",
      value: await TextEditor.enrichHTML(this.actor.system.details.biography.value, enrichmentOptions)
    };

    // Characteristics
    context.characteristics = [
      "alignment", "eyes", "height", "faith", "hair", "weight", "gender", "skin", "age"
    ].map(k => {
      const field = this.actor.system.schema.fields.details.fields[k];
      const name = `system.details.${k}`;
      return {
        name, label: field.label,
        value: foundry.utils.getProperty(this.actor, name) ?? "",
        source: foundry.utils.getProperty(this.actor._source, name) ?? ""
      };
    });

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the details tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareDetailsContext(context, options) {
    const { details, traits } = this.actor.system;

    // Origin
    context.creatureType = {
      class: details.type.value === "custom" ? "none" : "",
      icon: CONFIG.DND5E.creatureTypes[details.type.value]?.icon ?? "icons/svg/mystery-man.svg",
      title: details.type.value === "custom"
        ? details.type.custom
        : CONFIG.DND5E.creatureTypes[details.type.value]?.label,
      reference: CONFIG.DND5E.creatureTypes[details.type.value]?.reference,
      subtitle: details.type.subtype
    };
    if ( details.race instanceof dnd5e.documents.Item5e ) context.species = details.race;
    if ( details.background instanceof dnd5e.documents.Item5e ) context.background = details.background;
    context.labels.size = CONFIG.DND5E.actorSizes[traits.size]?.label ?? traits.size;

    // Saving Throws
    context.saves = {};
    for ( let ability of Object.values(this._prepareAbilities(context)) ) {
      ability = context.saves[ability.key] = { ...ability };
      ability.class = this.constructor.PROFICIENCY_CLASSES[context.editable ? ability.baseProf : ability.proficient];
    }
    if ( this.actor.statuses.has(CONFIG.specialStatusEffects.CONCENTRATING) || context.editable ) {
      context.saves.concentration = {
        isConcentration: true,
        class: "colspan concentration",
        label: game.i18n.localize("DND5E.Concentration"),
        abbr: game.i18n.localize("DND5E.Concentration"),
        save: { value: context.system.attributes.concentration.save }
      };
    }

    // Senses
    context.senses = this._prepareSenses(context);

    // Skills & Tools
    context.skills = this._prepareSkillsTools(context, "skills");
    context.tools = this._prepareSkillsTools(context, "tools");
    for ( const entry of context.skills.concat(context.tools) ) {
      const key = entry.key;
      entry.class = this.constructor.PROFICIENCY_CLASSES[context.editable ? entry.baseValue : entry.value];
      if ( key in CONFIG.DND5E.skills ) entry.reference = CONFIG.DND5E.skills[key].reference;
      else if ( key in CONFIG.DND5E.tools ) entry.reference = Trait.getBaseItemUUID(CONFIG.DND5E.tools[key].id ?? "");
    }

    // Ordenar skills por atributo e adicionar separadores
const abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
const abilityLabels = {
  str: "Força", dex: "Agilidade", con: "Constituição",
  int: "Intelecto", wis: "Sabedoria", cha: "Presença"
};
const skillsSorted = [];
for ( const ab of abilityOrder ) {
  const group = context.skills.filter(s => (s.baseAbility ?? s.ability) === ab);
  if ( !group.length ) continue;
  skillsSorted.push({ isSeparator: true, label: abilityLabels[ab] });
  skillsSorted.push(...group);
}
context.skills = skillsSorted;
    
    // Traits
    context.traits = this._prepareTraits(context);

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareEffectsContext(context, options) {
    context = await super._prepareEffectsContext(context, options);
    context.hasConditions = true;

    // Condições do sistema Jujutsu para injetar via _onRender
    const activeStatuses = new Set(this.actor.statuses ?? []);
    context.jjConditions = JJ_CONDITIONS.map(cond => ({
      ...cond,
      active: activeStatuses.has(cond.id)
    }));

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the features tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareFeaturesContext(context, options) {
    // Classes
    context.subclasses = context.itemCategories.subclasses ?? [];
    context.classes = (context.itemCategories.classes ?? [])
      .sort((lhs, rhs) => rhs.system.levels - lhs.system.levels);
    for ( const cls of context.classes ) {
      const ctx = context.itemContext[cls.id] ??= {};
      const subclass = context.subclasses.findSplice(s => s.system.classIdentifier === cls.identifier);
      if ( !subclass ) {
        const subclassAdvancement = cls.advancement.byType.Subclass?.[0];
        if ( subclassAdvancement && (subclassAdvancement.level <= cls.system.levels) ) ctx.needsSubclass = true;
      }
    }

    // List
    const Inventory = customElements.get(this.options.elements.inventory);
    const columns = Inventory.mapColumns([{ id: "uses", order: 200 }, "recovery", "controls"]);
    const sections = [
      { columns, id: "active", label: "DND5E.FeatureActive", order: 100, groups: { activation: "active" }, items: [] },
      { columns, id: "passive", label: "DND5E.FeaturePassive", order: 200, groups: { activation: "passive" } },
      ...Object.values(this.actor.classes ?? {})
        .sort((a, b) => b.system.levels - a.system.levels)
        .map((cls, i) => {
          return {
            columns, id: cls.identifier, order: i * 100, groups: { origin: cls.identifier },
            label: game.i18n.format("DND5E.FeaturesClass", { class: cls.name })
          };
        }),
      this.actor.system.details.race instanceof Item5e ? {
        columns, id: "species", label: "DND5E.Species.Features", order: 1000, groups: { origin: "species" }
      } : null,
      this.actor.system.details.background instanceof Item5e ? {
        columns, id: "background", label: "DND5E.FeaturesBackground", order: 2000, groups: { origin: "background" }
      } : null,
      { columns, id: "other", label: "DND5E.FeaturesOther",      order: 3000, groups: { origin: "other" } },
      { columns, id: "jj-origin",  label: "Origem de Poder",     order: 4000, groups: { origin: "jj-origin"  }, items: [] },
      { columns, id: "jj-combat",  label: "Estilo de Combate",   order: 5000, groups: { origin: "jj-combat"  }, items: [] },
      { columns, id: "jj-path",    label: "Caminho",             order: 6000, groups: { origin: "jj-path"    }, items: [] },
      { columns, id: "jj-basic",   label: "Habilidades Básicas", order: 7000, groups: { origin: "jj-basic"   }, items: [] },
      { columns, id: "jj-talents", label: "Talentos",            order: 8000, groups: { origin: "jj-talents" }, items: [] },
      { columns, id: "jj-flaws",   label: "Defeitos",            order: 9000, groups: { origin: "jj-flaws"   }, items: [] },
    ].filter(_ => _);
    sections[0].items = [...(context.itemCategories.features ?? []), ...context.subclasses];
    context.sections = Inventory.prepareSections(sections);
    context.listControls = {
      label: "DND5E.FeatureSearch",
      list: "features",
      filters: [
        { key: "powerAction", label: "DND5E.PowerAction" },
        { key: "action", label: "DND5E.Action" },
        { key: "bonus", label: "DND5E.BonusAction" },
        { key: "reaction", label: "DND5E.Reaction" },
        { key: "sr", label: "DND5E.REST.Short.Label" },
        { key: "lr", label: "DND5E.REST.Long.Label" },
        { key: "concentration", label: "DND5E.Concentration" },
        { key: "mgc", label: "DND5E.ITEM.Property.Magical" }
      ],
      sorting: [
        { key: "m", label: "SIDEBAR.SortModeManual", dataset: { icon: "fa-solid fa-arrow-down-short-wide" } },
        { key: "a", label: "SIDEBAR.SortModeAlpha", dataset: { icon: "fa-solid fa-arrow-down-a-z" } }
      ],
      grouping: [
        {
          key: "origin",
          label: "DND5E.FilterGroupOrigin",
          dataset: { icon: "fa-solid fa-layer-group", classes: "active" }
        },
        { key: "activation", label: "DND5E.FilterGroupOrigin", dataset: { icon: "fa-solid fa-layer-group" } }
      ]
    };

    // TODO: Add this warning during data preparation instead
    // const message = game.i18n.format("DND5E.SubclassMismatchWarn", {
    //   name: subclass.name, class: subclass.system.classIdentifier
    // });
    // context.warnings.push({ message, type: "warning" });
    // Sem multiclasse: só oferece "Adicionar Classe" (Estilo de Combate) quando
    // ainda não houver nenhum. Com um já existente, o botão some (mesmo em edição).
    context.showClassDrop = !context.classes.length;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the header.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareHeaderContext(context, options) {
    if ( this.actor.limited ) {
      context.portrait = await this._preparePortrait(context);
      return context;
    }

    // Classes Label
    context.labels.class = Object.values(this.actor.classes).sort((a, b) => {
      return b.system.levels - a.system.levels;
    }).map(c => `${c.name} ${c.system.levels}`).join(" / ");

    // Experience & Epic Boons
    if ( context.system.details.xp.boonsEarned !== undefined ) {
      const pluralRules = new Intl.PluralRules(game.i18n.lang);
      context.epicBoonsEarned = game.i18n.format(
        `DND5E.ExperiencePoints.Boons.${pluralRules.select(context.system.details.xp.boonsEarned ?? 0)}`,
        { number: formatNumber(context.system.details.xp.boonsEarned ?? 0, { signDisplay: "always" }) }
      );
    }

    // Visibility
    context.showExperience = game.settings.get("jujutsu-system", "levelingMode") !== "noxp";
    context.showRests = game.user.isGM || (this.actor.isOwner && game.settings.get("jujutsu-system", "allowRests"));

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareInventoryContext(context, options) {
    context.itemCategories.inventory = context.itemCategories.inventory?.filter(i => i.type !== "container");
    context = await super._prepareInventoryContext(context, options);
    context.size = {
      label: CONFIG.DND5E.actorSizes[this.actor.system.traits.size]?.label ?? this.actor.system.traits.size,
      abbr: CONFIG.DND5E.actorSizes[this.actor.system.traits.size]?.abbreviation ?? "—",
      mod: this.actor.system.attributes.encumbrance.mod
    };
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the sidebar.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareSidebarContext(context, options) {
    const { attributes } = this.actor.system;
    context.portrait = await this._preparePortrait(context);

    // Death Saves
    const plurals = new Intl.PluralRules(game.i18n.lang, { type: "ordinal" });
    context.death = {
      open: this._deathTrayOpen
    };
    // Percentuais para barras customizadas
const ed = this.actor.system.energyDice;
context.energyDicePct = ed?.max > 0 ? ((ed.value / ed.max) * 100).toFixed(2) : 0;

const energy = this.actor.system.energy;
context.energyPct = energy?.max > 0 ? ((energy.total / energy.max) * 100).toFixed(2) : 0;

const armor = this.actor.system.armorPoints;
context.armorPct = armor?.max > 0 ? ((armor.value / armor.max) * 100).toFixed(2) : 0;

// Expansão de Domínio (Maestria 7)
context.showExpansaoDominio = canShowExpansaoDominio(this.actor);
context.dominioExpandido = this.actor.getFlag("jujutsu-system", "dominioExpandido") === true;
    for ( const deathSave of ["success", "failure"] ) {
      context.death[deathSave] = [];
      for ( let i = 1; i < 4; i++ ) {
        const n = deathSave === "failure" ? i : 4 - i;
        const i18nKey = `DND5E.DeathSave${deathSave.titleCase()}Label`;
        const filled = attributes.death[deathSave] >= n;
        const classes = ["pip"];
        if ( filled ) classes.push("filled");
        if ( deathSave === "failure" ) classes.push("failure");
        context.death[deathSave].push({
          n, filled,
          tooltip: i18nKey,
          label: game.i18n.localize(`${i18nKey}N.${plurals.select(n)}`),
          classes: classes.join(" ")
        });
      }
    }

    // Exhaustion
    if ( CONFIG.DND5E.conditionTypes.exhaustion ) {
      const max = CONFIG.DND5E.conditionTypes.exhaustion.levels;
      context.exhaustion = Array.fromRange(max, 1).reduce((acc, n) => {
        const label = game.i18n.format("DND5E.ExhaustionLevel", { n });
        const classes = ["pip"];
        const filled = attributes.exhaustion >= n;
        if ( filled ) classes.push("filled");
        if ( n === max ) classes.push("death");
        const pip = { n, label, filled, tooltip: label, classes: classes.join(" ") };

        if ( n <= max / 2 ) acc.left.push(pip);
        else acc.right.push(pip);
        return acc;
      }, { left: [], right: [] });
    }

    // Favorites
    context.favorites = await this._prepareFavorites();

    // Speed
    context.speed = Object.entries(CONFIG.DND5E.movementTypes).reduce((obj, [k, { hidden, label }]) => {
      if ( hidden ) return obj;
      const value = attributes.movement[k];
      if ( (k === "fly") && attributes.movement.hover ) {
        label = game.i18n.format("DND5E.MOVEMENT.HoverSpeed", { speed: label });
      }
      if ( value > obj.value ) Object.assign(obj, { label, value });
      return obj;
    }, { label: CONFIG.DND5E.movementTypes.walk?.label, value: 0 });

    // Seis Olhos
    const seisOlhosItem = this.actor.items.find(i => i.name === "Seis Olhos" && i.type === "feat");
    context.seisOlhos = !!seisOlhosItem;
    context.seisOlhosMode = this.actor.getFlag("jujutsu-system", "seisOlhosMode") ?? "sealed";

    // Fulgor Negro
    context.fulgorNegro    = !!this.actor.system.manipulation?.abilities?.fulgorNegro?.unlocked;
    context.fulgorPrimaria  = this.actor.getFlag("jujutsu-system", "fulgorPrimaria")  ?? 20;
    // Limiar secundário efetivo (Fulgor Certeiro reduz a margem para 11–20).
    context.fulgorSecundaria = getFulgorSecundaria(this.actor);
    context.fulgorZona      = this.actor.getFlag("jujutsu-system", "fulgorZona") ?? false;

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareSpellsContext(context, options) {
    context = await super._prepareSpellsContext(context, options);

    // Spellcasting
    context.spellcasting = [];
    const spellcastingClasses = Object.values(this.actor.spellcastingClasses)
      .sort((lhs, rhs) => rhs.system.levels - lhs.system.levels);
    for ( const item of spellcastingClasses ) {
      const sc = item.spellcasting;
      const ability = this.actor.system.abilities[sc.ability];
      const mod = ability?.mod ?? 0;
      const name = item.system.spellcasting.progression === sc.progression ? item.name : item.subclass?.name;
      context.spellcasting.push({
        label: game.i18n.format("DND5E.SpellcastingClass", { class: name }),
        ability: { mod, ability: sc.ability },
        attack: sc.attack,
        preparation: sc.preparation,
        primary: this.actor.system.attributes.spellcasting === sc.ability,
        save: sc.save
      });
      const key = item.system.spellcasting.progression === sc.progression ? item.identifier : item.subclass?.identifier;
      context.listControls.filters.push({ key, label: name });
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  Actor Preparation Helpers                   */
  /* -------------------------------------------- */

  /**
   * Prepare favorites for display.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareFavorites(context) {
    // Legacy resources
    const resources = Object.entries(this.actor.system.resources).reduce((arr, [k, r]) => {
      const { value, max, sr, lr, label } = r;
      const source = this.actor._source.system.resources[k];
      if ( label && max ) arr.push({
        id: `resources.${k}`,
        type: "resource",
        img: "icons/svg/upgrade.svg",
        resource: { value, max, source },
        css: "uses",
        title: label,
        subtitle: [
          sr ? game.i18n.localize("DND5E.AbbreviationSR") : null,
          lr ? game.i18n.localize("DND5E.AbbreviationLR") : null
        ].filterJoin(" &bull; ")
      });
      return arr;
    }, []);

    return resources.concat(await this.actor.system.favorites.reduce(async (arr, f) => {
      const { id, type, sort } = f;
      const favorite = await fromUuid(id, { relative: this.actor });
      if ( !favorite && ((type === "item") || (type === "effect") || (type === "activity")) ) return arr;
      if ( favorite?.dependentOrigin?.active === false ) return arr;
      arr = await arr;

      let data;
      if ( type === "item" ) data = await favorite.system.getFavoriteData();
      else if ( (type === "effect") || (type === "activity") ) data = await favorite.getFavoriteData();
      else data = await this._getFavoriteData(type, id);
      if ( !data ) return arr;
      let {
        img, title, subtitle, value, uses, quantity, modifier, passive,
        save, range, reference, toggle, suppressed, level
      } = data;

      if ( foundry.utils.getType(save?.ability) === "Set" ) save = {
        ...save, ability: save.ability.size > 2
          ? game.i18n.localize("DND5E.AbbreviationDC")
          : Array.from(save.ability).map(k => CONFIG.DND5E.abilities[k]?.abbreviation).filterJoin(" / ")
      };

      const css = [];
      if ( uses?.max ) {
        css.push("uses");
        uses.value = Math.round(uses.value);
      }
      else if ( modifier !== undefined ) css.push("modifier");
      else if ( save?.dc ) css.push("save");
      else if ( value !== undefined ) css.push("value");

      if ( toggle === false ) css.push("disabled");
      if ( uses?.max > 99 ) css.push("uses-sm");
      if ( modifier !== undefined ) {
        const value = Number(modifier.replace?.(/\s+/g, "") ?? modifier);
        if ( !isNaN(value) ) modifier = value;
      }

      const rollableClass = [];
      if ( this.isEditable && (type !== "slots") ) rollableClass.push("rollable");
      if ( type === "skill" ) rollableClass.push("skill-name");
      else if ( type === "tool" ) rollableClass.push("tool-name");

      if ( suppressed ) subtitle = game.i18n.localize("DND5E.Suppressed");
      const itemId = type === "item" ? favorite.id : type === "activity" ? favorite.item.id : null;
      arr.push({
        id, img, type, title, value, uses, sort, save, modifier, passive, range, reference, suppressed, level, itemId,
        draggable: ["item", "effect"].includes(type),
        effectId: type === "effect" ? favorite.id : null,
        parentId: (type === "effect") && (favorite.parent !== favorite.target) ? favorite.parent.id: null,
        activityId: type === "activity" ? favorite.id : null,
        key: (type === "skill") || (type === "tool") ? id : null,
        toggle: toggle === undefined ? null : { applicable: true, value: toggle },
        quantity: quantity > 1 ? quantity : "",
        rollableClass: rollableClass.filterJoin(" "),
        css: css.filterJoin(" "),
        bareName: type === "slots",
        subtitle: Array.isArray(subtitle) ? subtitle.filterJoin(" &bull; ") : subtitle
      });
      return arr;
    }, [])).sort((a, b) => a.sort - b.sort);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for a favorited entry.
   * @param {"skill"|"tool"|"slots"} type  The type of favorite.
   * @param {string} id                    The favorite's identifier.
   * @returns {Promise<FavoriteData5e|void>}
   * @protected
   */
  async _getFavoriteData(type, id) {
    // Spell slots
    if ( type === "slots" ) {
      const { value, max, level, type: method } = this.actor.system.spells?.[id] ?? {};
      const model = CONFIG.DND5E.spellcasting[method];
      const uses = { value, max, name: `system.spells.${id}.value` };
      if ( !model || model.isSingleLevel ) return {
        uses, level, method,
        title: game.i18n.localize(`DND5E.SpellSlots${id.capitalize()}`),
        subtitle: [
          game.i18n.localize(`DND5E.SpellLevel${level}`),
          game.i18n.localize(`DND5E.Abbreviation${model?.isSR ? "SR" : "LR"}`)
        ],
        img: model?.img || CONFIG.DND5E.spellcasting.pact.img
      };

      const plurals = new Intl.PluralRules(game.i18n.lang, { type: "ordinal" });
      return {
        uses, level, method,
        title: game.i18n.format(`DND5E.SpellSlotsN.${plurals.select(level)}`, { n: level }),
        subtitle: game.i18n.localize(`DND5E.Abbreviation${model.isSR ? "SR" : "LR"}`),
        img: model.img.replace("{id}", id)
      };
    }

    // Skills & Tools
    else {
      const data = this.actor.system[`${type}s`]?.[id];
      if ( !data ) return;
      const { total, ability, passive } = data ?? {};
      const subtitle = game.i18n.format("DND5E.AbilityPromptTitle", {
        ability: CONFIG.DND5E.abilities[ability].label
      });
      let img;
      let title;
      let reference;
      if ( type === "tool" ) {
        reference = Trait.getBaseItemUUID(CONFIG.DND5E.tools[id]?.id);
        ({ img, name: title } = Trait.getBaseItem(reference, { indexOnly: true }));
      }
      else if ( type === "skill" ) ({ icon: img, label: title, reference } = CONFIG.DND5E.skills[id]);
      return { img, title, subtitle, modifier: total, passive, reference };
    }
  }

  /* -------------------------------------------- */
  /*  Item Preparation Helpers                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _assignItemCategories(item) {
    switch ( item.type ) {
      case "background": return new Set(["background"]);
      case "class": return new Set(["classes"]);
      case "facility": return new Set(["facilities"]);
      case "race": return new Set(["species"]);
      case "subclass": return new Set(["subclasses"]);
      default: return super._assignItemCategories(item);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare context for a facility.
   * @param {Item5e} item  Item being prepared for display.
   * @param {object} ctx   Item specific context.
   * @protected
   */
  async _prepareItemFacility(item, ctx) {
    const { id, img, labels, name, system } = item;
    const { building, craft, defenders, disabled, free, hirelings, progress, size, trade, type } = system;
    const subtitle = [
      building.built ? CONFIG.DND5E.facilities.sizes[size].label : game.i18n.localize("DND5E.FACILITY.Build.Unbuilt")
    ];
    if ( trade.stock.max ) subtitle.push(`${trade.stock.value ?? 0} &sol; ${trade.stock.max}`);
    Object.assign(ctx, {
      id, labels, name, building, disabled, free, progress,
      craft: craft.item ? await fromUuid(craft.item) : null,
      creatures: await this._prepareItemFacilityLivestock(trade),
      defenders: await this._prepareItemFacilityOccupants(defenders),
      executing: CONFIG.DND5E.facilities.orders[progress.order]?.icon,
      hirelings: await this._prepareItemFacilityOccupants(hirelings),
      img: foundry.utils.getRoute(img),
      isSpecial: type.value === "special",
      subtitle: subtitle.join(" &bull; ")
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare facility livestock for display.
   * @param {object} trade  Facility trade information.
   * @returns {Promise<object[]>}
   * @protected
   */
  async _prepareItemFacilityLivestock(trade) {
    const creatures = await this._prepareItemFacilityOccupants(trade.creatures);
    const pending = trade.pending.creatures;
    return [
      ...(await Promise.all((pending ?? []).map(async (uuid, index) => {
        return { index, actor: await fromUuid(uuid), pending: true };
      }))),
      ...creatures
    ];
  }

  /* -------------------------------------------- */

  /**
   * Prepare facility occupants for display.
   * @param {FacilityOccupants} occupants  The occupants.
   * @returns {Promise<object[]>}
   * @protected
   */
  _prepareItemFacilityOccupants(occupants) {
    const { max, value } = occupants;
    return Promise.all(Array.fromRange(max).map(async index => {
      const uuid = value[index];
      if ( uuid ) return { index, actor: await fromUuid(uuid) };
      return { empty: true };
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareItemFeature(item, ctx) {
    if ( item.type === "facility" ) return this._prepareItemFacility(item, ctx);

    await super._prepareItemFeature(item, ctx);

    const [originId] = (item.getFlag("jujutsu-system", "advancementRoot") ?? item.getFlag("jujutsu-system", "advancementOrigin"))
      ?.split(".") ?? [];
    const group = item.parent.items.get(originId);
    // Verificar se o item tem seção customizada Jujutsu
    const jjSection = item.getFlag("jujutsu-system", "featureSection");
    if ( jjSection && ["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"].includes(jjSection) ) {
      ctx.groups.origin = jjSection;
    } else {
      ctx.groups.origin = "other";
      switch ( group?.type ) {
        case "race": ctx.groups.origin = "species"; break;
        case "background": ctx.groups.origin = "background"; break;
        case "class": ctx.groups.origin = group.identifier; break;
        case "subclass": ctx.groups.origin = group.class?.identifier ?? "other"; break;
      }
    }

    ctx.groups.activation = item.system.properties?.has("trait") || !item.system.activities?.size
      ? "passive"
      : "active";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareItemPhysical(item, ctx) {
    ctx.concealDetails = !game.user.isGM && (item.system.identified === false);
    ctx.isStack = Number.isNumeric(item.system.quantity) && (item.system.quantity !== 1);

    if ( item.system.attunement ) ctx.attunement = item.system.attuned ? {
      icon: "fa-sun",
      cls: "attuned",
      title: "DND5E.AttunementAttuned"
    } : {
      icon: "fa-sun",
      cls: "not-attuned",
      title: CONFIG.DND5E.attunementTypes[item.system.attunement]
    };

    return super._prepareItemPhysical(item, ctx);
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
async _onFirstRender(context, options) {
  await super._onFirstRender(context, options);

  // ... código existente ...

  // Context menus de manipulação e treinamentos
new ContextMenu5e(
  this.element,
  ".ability-card[data-ability-id]",
  [
    {
      name: "Desfazer Habilidade",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const id = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[id]?.unlocked === true;
      },
      callback: element => this._onUndoManipulationAbility(element.dataset.abilityId)
    }
  ],
  { jQuery: false }
);

new ContextMenu5e(
  this.element,
  ".training-card[data-training-id]",
  [
    {
      name: "Desfazer Treinamento",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => (this.actor.system.trainings?.[element.dataset.trainingId]?.rank ?? 0) > 0,
      callback: element => this._onUndoTraining(element.dataset.trainingId)
    }
  ],
  { jQuery: false }
);
}

  /* -------------------------------------------- */

  /** @inheritDoc */
async _onRender(context, options) {
  await super._onRender(context, options);

  if ( !this.actor.limited ) {
    this._renderAttunement(context, options);
    this._renderSpellbook(context, options);
  }


    // Injetar seção de condições Jujutsu na aba Effects
    injectJJConditions(this.element, this.actor);

    // Injetar data-jj-ref nos li de perícias para tooltip de compendium (tipo Text)
    injectSkillRefs(this.element);
    // Injetar data-jj-ref nos cards de treinamento
    injectTrainingRefs(this.element);
    // Injetar kanjis e refs nos cards de habilidade de manipulação
    injectAbilityKanjis(this.element);
    injectAbilityRefs(this.element);
    applyJJTextTooltips(this.element);

    // Seções customizadas de Features (JJ)
    setupFeatureSectionDrops(this.element, this.actor);
    unhideFeatureSections(this.element);
    setupFeatureSectionCollapse(this.element);

    // Botão de Explosão Defensiva — listener no botão do HBS
    this.element.querySelector("[data-action='jj-expdef-trigger']")
      ?.addEventListener("click", () => onExplosaoDefensiva(this.actor));

    // Botão de Energia Reversa
    this.element.querySelector("[data-action='jj-enrev-trigger']")
      ?.addEventListener("click", () => onEnergiaReversa(this.actor));

    // Botão de Foco Defensivo — ativar/desativar Pontos de Armadura
    this.element.querySelector("[data-action='jj-foco-defensivo']")
      ?.addEventListener("click", () => onFocoDefensivo(this.actor));

    // Botão de Expansão de Domínio (Maestria 7) — clique expande; botão direito configura
    const expDomBtn = this.element.querySelector("[data-action='jj-expansao-dominio']");
    if ( expDomBtn ) {
      expDomBtn.addEventListener("click", () => onExpansaoDominio(this.actor));
      expDomBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        configureExpansaoDominio(this.actor);
      });
    }

    // Botão Gerar Energia — raio do lado do título "PA Gerado" na sidebar
    this.element.querySelector("[data-action='jj-gerar-aura']")
      ?.addEventListener("click", async () => {
        const choices = await EnergyGenerationDialog.configure(this.actor);
        if ( choices ) await EnergySystem.processTurnStartWithChoices(this.actor, choices);
      });
    // Seis Olhos — listener nos radio buttons
    this.element.querySelectorAll("input[name='flags.jujutsu-system.seisOlhosMode']")
      .forEach(radio => radio.addEventListener("change", async (event) => {
        const mode = event.target.value;
        await this.actor.setFlag("jujutsu-system", "seisOlhosMode", mode);
        await applySeiOlhosEffects(this.actor, mode);
      }));

    // Fulgor Negro — listeners dos inputs e botão de Zona
    setupFulgorNegro(this.element, this.actor);

    // ── Aba Feitiço: hover dos drop zones + change de requisito/grau ──
    this.element.querySelectorAll(".feitico-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => e.preventDefault());
      zone.addEventListener("dragleave", e => {
        if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover");
      });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    this.element.querySelectorAll("[data-feitico-req]").forEach(el => {
      el.addEventListener("change", () => {
        this._onFeiticoReqChange(el.dataset.itemId, parseInt(el.dataset.index), el.dataset.feiticoReq, el.value);
      });
    });

    // Formatar inputs de Yen com pontuação (ex: 5000 → 5.000)
    const _formatYen = val => {
      const num = parseInt(String(val).replace(/\D/g, "")) || 0;
      return num.toLocaleString("pt-BR");
    };
    this.element.querySelectorAll("input[name='system.currency.yen']").forEach(input => {
      if ( input.dataset.yenFormatted ) return;
      input.dataset.yenFormatted = "1";

      // Criar um input hidden que carrega o valor numérico real para o Foundry
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = input.name;
      hidden.value = parseInt(String(input.value).replace(/\D/g, "")) || 0;
      input.parentNode.insertBefore(hidden, input.nextSibling);

      // Remover o name do input visível para o Foundry não lê-lo
      input.removeAttribute("name");
      input.type = "text";
      input.value = _formatYen(hidden.value);

      input.addEventListener("focus", () => {
        input.value = hidden.value;
        input.select();
      });
      input.addEventListener("blur", () => {
        const raw = parseInt(input.value.replace(/\D/g, "")) || 0;
        hidden.value = raw;
        // Disparar change no hidden para o Foundry salvar
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        input.value = _formatYen(raw);
      });
    });

    // Impede que Enter em inputs de PV/Energia dispare botões do sheet
    this.element.addEventListener("keydown", (event) => {
      if ( event.key !== "Enter" ) return;
      const tag = event.target.tagName;
      if ( tag !== "INPUT" && tag !== "TEXTAREA" ) return;
      // Salva o valor e impede propagação que ativaria botões
      event.preventDefault();
      event.target.blur();
    }, { capture: true });

    // Show death tray at 0 HP
    const renderContext = options.renderContext ?? options.action;
    const renderData = options.renderData ?? options.data;
    const isUpdate = (renderContext === "update") || (renderContext === "updateActor");
    const hp = foundry.utils.getProperty(renderData ?? {}, "system.attributes.hp.value");
    if ( isUpdate && (hp === 0) ) this._toggleDeathTray(true);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle removing a favorite.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #deleteFavorite(event, target) {
    const { favoriteId } = target.closest("[data-favorite-id]")?.dataset ?? {};
    if ( favoriteId ) this.actor.system.removeFavorite(favoriteId);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an occupant from a facility.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #deleteOccupant(event, target) {
    const { facilityId } = target.closest("[data-facility-id]")?.dataset ?? {};
    const { prop } = target.closest("[data-prop]")?.dataset ?? {};
    const { index } = target.closest("[data-index]")?.dataset ?? {};
    const facility = this.actor.items.get(facilityId);
    if ( !facility || !prop || (index === undefined) ) return;

    // Prompt to clear a pending trade
    if ( target.closest(".occupant-slot.pending") ) {
      const result = await foundry.applications.api.DialogV2.confirm({
        content: `
          <p>
            <strong>${game.i18n.localize("AreYouSure")}</strong> ${game.i18n.localize("DND5E.Bastion.Trade.Invalid")}
          </p>
        `,
        window: {
          icon: "fa-solid fa-coins",
          title: "DND5E.Bastion.Trade.Cancel"
        },
        position: { width: 400 }
      }, { rejectClose: false });
      if ( result ) facility.update({
        system: {
          progress: { max: null, order: "", value: null },
          trade: {
            pending: { creatures: [], operation: null }
          }
        }
      });
    }

    // Remove the occupant
    else {
      let { value } = foundry.utils.getProperty(facility, prop);
      value = value.filter((_, i) => i !== Number(index));
      facility.update({ [`${prop}.value`]: value });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle finding an available item of a given type.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #findItem(event, target) {
    if ( !this.isEditable ) return;
    const { classIdentifier, facilityType, itemType: type } = target.dataset;
    const filters = { locked: { types: new Set([type]) } };

    if ( classIdentifier ) filters.locked.additional = { class: { [classIdentifier]: 1 } };
    if ( type === "class" ) {
      const existingIdentifiers = new Set(Object.keys(this.actor.classes));
      filters.initial = { additional: { properties: { sidekick: -1 } } };
      filters.locked.arbitrary = [{ o: "NOT", v: { k: "system.identifier", o: "in", v: existingIdentifiers } }];
    }
    if ( type === "facility" ) {
      const otherType = facilityType === "basic" ? "special" : "basic";
      filters.locked.additional = {
        type: { [facilityType]: 1, [otherType]: -1 },
        level: { max: this.actor.system.details.level }
      };
    }

    const result = await CompendiumBrowser.selectOne({ filters }, this._detachOptions());
    if ( result ) this._onDropCreateItems(event, [game.items.fromCompendium(await fromUuid(result), { keepId: true })]);
  }

  /* -------------------------------------------- */

  /**
   * Handle setting the character's spellcasting ability.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #setSpellcastingAbility(event, target) {
    const ability = target.closest("[data-ability]")?.dataset.ability;
    this.submit({ updateData: { "system.attributes.spellcasting": ability } });
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the death saves tray.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #toggleDeathTray(event, target) {
    this._toggleDeathTray();
  }

  /* -------------------------------------------- */

  /**
   * Toggle the death save tray.
   * @param {boolean} [open]  Force a particular open state.
   * @protected
   */
  _toggleDeathTray(open) {
    const tray = this.form.querySelector(".death-tray");
    const tab = tray.querySelector(".death-tab");
    tray.classList.toggle("open", open);
    this._deathTrayOpen = tray.classList.contains("open");
    tab.dataset.tooltip = `DND5E.DeathSave${this._deathTrayOpen ? "Hide" : "Show"}`;
    tab.setAttribute("aria-label", game.i18n.localize(tab.dataset.tooltip));
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling inspiration.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #toggleInspiration(event, target) {
    this.submit({ updateData: { "system.attributes.inspiration": !this.actor.system.attributes.inspiration } });
  }

  /* -------------------------------------------- */

  /**
   * Handle using a facility.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #useFacility(event, target) {
    if ( !target.classList.contains("rollable") ) return;
    const { facilityId } = target.closest("[data-facility-id]")?.dataset ?? {};
    const facility = this.actor.items.get(facilityId);
    facility?.use({ legacy: false, chooseActivity: true, event });
  }

  /* -------------------------------------------- */

  /**
   * Handle using a favorited item.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #useFavorite(event, target) {
    if ( !this.isEditable || (event.target.tagName === "INPUT") ) return;
    const { favoriteId } = target.closest("[data-favorite-id]").dataset;
    const favorite = await fromUuid(favoriteId, { relative: this.actor });
    if ( (favorite instanceof dnd5e.documents.Item5e) || target.dataset.activityId ) {
      if ( favorite.type === "container" ) this._renderChild(favorite.sheet);
      else favorite.use({ event }, { options: { sheet: this } });
    }
    else if ( favorite instanceof dnd5e.dataModels.activity.BaseActivityData ) {
      if ( favorite.canUse ) favorite.use({ event }, { options: { sheet: this } });
    }
    else if ( favorite instanceof dnd5e.documents.ActiveEffect5e ) favorite.update({ disabled: !favorite.disabled });
    else {
      const { key } = target.closest("[data-key]")?.dataset ?? {};
      if ( key ) {
        if ( target.classList.contains("skill-name") ) this.actor.rollSkill({ event, skill: key });
        else if ( target.classList.contains("tool-name") ) this.actor.rollToolCheck({ event, tool: key });
      }
    }
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @override */
  _defaultDropBehavior(event, data) {
    if ( data.dnd5e?.action === "favorite" || (["Activity", "Item"].includes(data.type)
      && event.target.closest(".favorites")) ) return "link";
    return super._defaultDropBehavior(event, data);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDragStart(event) {
    const methods = CONFIG.DND5E.spellcasting;
    const { key } = event.target.closest("[data-key]")?.dataset ?? {};
    const { level, method } = event.target.closest("[data-level]")?.dataset ?? {};
    const isSlots = event.target.closest("[data-favorite-id]") || event.target.classList.contains("items-header");
    let type;
    if ( key in CONFIG.DND5E.skills ) type = "skill";
    else if ( key in CONFIG.DND5E.tools ) type = "tool";
    else if ( methods[method]?.slots && (level !== "0") && isSlots ) type = "slots";
    if ( !type ) return super._onDragStart(event);

    // Add another deferred deactivation to catch the second pointerenter event that seems to be fired on Firefox.
    requestAnimationFrame(() => game.tooltip.deactivate());
    game.tooltip.deactivate();

    const dragData = { dnd5e: { action: "favorite", type } };
    if ( type === "slots" ) dragData.dnd5e.id = methods[method].getSpellSlotKey(Number(level));
    else dragData.dnd5e.id = key;
    event.dataTransfer.setData("application/json", JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = "link";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDrop(event) {
    if ( !event.target.closest(".favorites") ) return super._onDrop(event);
    const dragData = event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain");
    if ( !dragData ) return super._onDrop(event);
    let data;
    try {
      data = JSON.parse(dragData);
    } catch(e) {
      console.error(e);
      return;
    }
    const { action, type, id } = data.dnd5e ?? {};
    if ( action === "favorite" ) return this._onDropFavorite(event, { type, id });
    if ( data.type === "Activity" ) {
      const activity = await fromUuid(data.uuid);
      if ( activity ) return this._onDropActivity(event, activity);
    }
    return super._onDrop(event);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropActiveEffect(event, effect) {
    if ( !event.target.closest(".favorites") || (effect.target !== this.actor) ) {
      return super._onDropActiveEffect(event, effect);
    }
    const uuid = effect.getRelativeUUID(this.actor);
    return this._onDropFavorite(event, { type: "effect", id: uuid });
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping an Activity onto the sheet.
   * @param {DragEvent} event    The originating drag event.
   * @param {Activity} activity  The dropped Activity document.
   * @returns {Promise<Actor5e|void>}
   * @protected
   */
  async _onDropActivity(event, activity) {
    if ( !event.target.closest(".favorites") || (activity.actor !== this.actor) ) return;
    const uuid = `${activity.item.getRelativeUUID(this.actor)}.Activity.${activity.id}`;
    return this._onDropFavorite(event, { type: "activity", id: uuid });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropActor(event, actor) {
    if ( !event.target.closest(".facility-occupants") || !actor.uuid ) return super._onDropActor(event, actor);
    const { facilityId } = event.target.closest("[data-facility-id]").dataset;
    const facility = this.actor.items.get(facilityId);
    if ( !facility ) return;
    const { prop } = event.target.closest("[data-prop]").dataset;
    const { max, value } = foundry.utils.getProperty(facility, prop);
    if ( (value.length + 1) > max ) return;
    return facility.update({ [`${prop}.value`]: [...value, actor.uuid] });
  }

  /* -------------------------------------------- */

  /**
   * Handle an owned item or effect being dropped in the favorites area.
   * @param {DragEvent} event            The triggering event.
   * @param {ActorFavorites5e} favorite  The favorite that was dropped.
   * @returns {Promise<Actor5e>|void}
   * @protected
   */
  _onDropFavorite(event, favorite) {
    if ( this.actor.system.hasFavorite(favorite.id) ) return this._onSortFavorites(event, favorite.id);
    return this.actor.system.addFavorite(favorite);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, item) {
    // Instalar Molde de Feitiço
    if ( item.type === "feiticoTemplate" ) {
      return this._onFeiticoInstallTemplate(item);
    }

    // Aba Feitiço: drop em slot de manifestação ou em lista de técnicas
    const feiticoTarget = event.target.closest("[data-feitico-drop]");
    if ( feiticoTarget && item.type === "spell" ) {
      return this._onFeiticoDropSpell(event, item, feiticoTarget);
    }

    if ( !event.target.closest(".favorites") || (item.parent !== this.actor) ) return super._onDropItem(event, item);
    const uuid = item.getRelativeUUID(this.actor);
    return this._onDropFavorite(event, { type: "item", id: uuid });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropSingleItem(event, itemData, options={}) {
    // Increment the number of class levels a character instead of creating a new item
    if ( itemData.type === "class" ) {
      const charLevel = this.actor.system.details.level;
      itemData.system.levels = Math.min(itemData.system.levels, CONFIG.DND5E.maxLevel - charLevel);
      if ( itemData.system.levels <= 0 ) {
        const err = game.i18n.format("DND5E.MaxCharacterLevelExceededWarn", { max: CONFIG.DND5E.maxLevel });
        ui.notifications.error(err);
        return;
      }

      const cls = this.actor.itemTypes.class.find(c => c.identifier === itemData.system.identifier);
      if ( cls ) {
        const priorLevel = cls.system.levels;
        if ( !game.settings.get("jujutsu-system", "disableAdvancements") ) {
          const manager = AdvancementManager.forLevelChange(this.actor, cls.id, itemData.system.levels);
          if ( manager.steps.length ) {
            manager.render({ force: true });
            return;
          }
        }
        cls.update({ "system.levels": priorLevel + itemData.system.levels });
        return;
      }
    }

    // If a subclass is dropped, ensure it doesn't match another subclass with the same identifier
    else if ( itemData.type === "subclass" ) {
      const other = this.actor.itemTypes.subclass.find(i => i.identifier === itemData.system.identifier);
      if ( other ) {
        const err = game.i18n.format("DND5E.SubclassDuplicateError", { identifier: other.identifier });
        ui.notifications.error(err);
        return;
      }
      const cls = this.actor.itemTypes.class.find(i => i.identifier === itemData.system.classIdentifier);
      if ( cls && cls.subclass ) {
        const err = game.i18n.format("DND5E.SubclassAssignmentError", { class: cls.name, subclass: cls.subclass.name });
        ui.notifications.error(err);
        return;
      }
    }

    return super._onDropSingleItem(event, itemData, options);
  }

  /* -------------------------------------------- */

  /**
   * Handle re-ordering the favorites list.
   * @param {DragEvent} event  The drop event.
   * @param {string} srcId     The identifier of the dropped favorite.
   * @returns {Promise<Actor5e>|void}
   * @protected
   */
  _onSortFavorites(event, srcId) {
    const dropTarget = event.target.closest("[data-favorite-id]");
    if ( !dropTarget ) return;
    let source;
    let target;
    const targetId = dropTarget.dataset.favoriteId;
    if ( srcId === targetId ) return;
    const siblings = this.actor.system.favorites.filter(f => {
      if ( f.id === targetId ) target = f;
      else if ( f.id === srcId ) source = f;
      return f.id !== srcId;
    });
    const updates = foundry.utils.performIntegerSort(source, { target, siblings });
    const favorites = this.actor.system.favorites.reduce((map, f) => map.set(f.id, { ...f }), new Map());
    for ( const { target, update } of updates ) {
      const favorite = favorites.get(target.id);
      foundry.utils.mergeObject(favorite, update);
    }
    return this.actor.update({ "system.favorites": Array.from(favorites.values()) });
  }

  /* -------------------------------------------- */
  /*  Filtering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _filterItem(item, filters) {
    const allowed = super._filterItem(item, filters);
    if ( allowed !== undefined ) return allowed;
    if ( item.type === "container" ) return true;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  canExpand(item) {
    return !["background", "race", "facility"].includes(item.type) && super.canExpand(item);
  }

  /* -------------------------------------------- */

  /**
   * Determine if the sheet should show a bastion tab.
   * @param {Actor5e} actor
   * @returns {boolean}
   */
  static hasBastion(actor) {
    const { basic, special } = CONFIG.DND5E.facilities.advancement;
    const threshold = Math.min(...Object.keys(basic), ...Object.keys(special));
    return game.settings.get("jujutsu-system", "bastionConfiguration")?.enabled && (actor.system.details.level >= threshold);
  }

  /* -------------------------------------------- */

  /**
   * Prepara o contexto para a aba de Manipulação de Energia (Skill Tree).
   */
  async _prepareManipulationContext(context, options) {
    return prepareManipulationContext(this.actor, context);
  }

  /* -------------------------------------------- */

  async _prepareTrainingsContext(context, options) {
    return prepareTrainingsContext(this.actor, context);
  }

  /* -------------------------------------------- */
  /*  Aba Feitiço (portada da aba Hatsu do hunter-system) */
  /* -------------------------------------------- */

  /** Slots de manifestação + trilha de proficiência por Nível de Maestria. */
  async _prepareFeiticoContext(context, options) {
    const SLOTS = [
      { id: "inata", label: "Reversões de Feitiço", tecnicasLabel: "Técnicas de Reversão" },
      { id: "m1",    label: "1ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m2",    label: "2ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m3",    label: "3ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" }
    ];

    // Graus de técnica (0 = Auxiliar, 1-9) — mesma escala já usada no item de spell (system.level).
    const maestria = this.actor.system.masteryLevel ?? 0;

    const allSpells = this.actor.items.filter(i => i.type === "spell");
    const slots = SLOTS.map(def => {
      const manifestacao = allSpells.find(s => s.getFlag("jujutsu-system", "feitico.slot") === def.id) ?? null;
      const tecnicas = allSpells
        .filter(s => s.getFlag("jujutsu-system", "feitico.parent") === def.id && s !== manifestacao)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

      // Requisitos de Maestria (até 6) — armazenados na manifestação
      const rawReqs = manifestacao?.getFlag("jujutsu-system", "feitico.requirements") ?? [];
      const manifestacaoId = manifestacao?.id ?? null;
      const requirements = rawReqs.map((req, idx) => {
        const level = req.level ?? 1;
        const met = maestria >= level;
        return { index: idx, manifestacaoId, level, currentLevel: maestria, met };
      });
      const unmet = requirements.filter(r => !r.met);
      const blocked = !!manifestacao && unmet.length > 0;
      const blockedReason = blocked
        ? "Requer: " + unmet.map(r => `Maestria Nv${r.level} (atual: ${r.currentLevel})`).join("; ")
        : "";

      const _spellLite = (s, isBlocked = false) => {
        if ( !s ) return null;
        return {
          id: s.id,
          name: s.name,
          img: s.img,
          subtitle: s.system?.school ? CONFIG.DND5E.spellSchools?.[s.system.school]?.label : "",
          blocked: isBlocked,
          grau: s.system?.level ?? 0
        };
      };

      const reqsCols = requirements.length <= 1 ? 1
                     : requirements.length <= 4 ? 2
                     : 3;

      const tecnicasLite = tecnicas.map(t => _spellLite(t, blocked));
      // Duas colunas dentro da manifestação: técnicas com Grau (>=1) à esquerda,
      // Auxiliares (grau 0) à direita.
      let tecnicasGrau = tecnicasLite.filter(t => (t.grau ?? 0) >= 1);
      let tecnicasAux  = tecnicasLite.filter(t => (t.grau ?? 0) === 0);
      // Sem técnicas de Grau (só Auxiliares): elas ocupam a coluna da esquerda para
      // não flutuarem à direita.
      if ( !tecnicasGrau.length ) { tecnicasGrau = tecnicasAux; tecnicasAux = []; }

      return {
        ...def,
        manifestacao: _spellLite(manifestacao, blocked),
        tecnicas: tecnicasLite,
        tecnicasGrau,
        tecnicasAux,
        hasTecnicas: tecnicasLite.length > 0,
        requirements,
        reqsCols,
        canAddReq: !!manifestacao && requirements.length < 6,
        blocked,
        blockedReason
      };
    });

    // Proficiência por Nível de Maestria: 1 Básico · 3 Estendido · 5 Máximo · 7 Expansão
    const TIERS = [
      { id: "basico",    label: "Básico",             mainReq: 1,
        benefits: ["Uso de manifestações e técnicas do Feitiço"] },
      { id: "estendido", label: "Estendido",          mainReq: 3,
        benefits: ["Desbloqueia extensões mais poderosas das técnicas"] },
      { id: "maximo",    label: "Máximo",             mainReq: 5,
        benefits: ["Técnicas no seu potencial máximo"] },
      { id: "expansao",  label: "Expansão de Domínio", mainReq: 7,
        benefits: ["A manifestação suprema — Expansão de Domínio como Feitiço"] }
    ];

    let tier = "none";
    for ( const t of [...TIERS].reverse() ) {
      if ( maestria >= t.mainReq ) { tier = t.id; break; }
    }

    const tiersState = TIERS.map(t => ({
      ...t,
      reqMet: maestria >= t.mainReq,
      isCurrent: tier === t.id
    }));

    const tierLabels = { none: "—", basico: "Básico", estendido: "Estendido", maximo: "Máximo", expansao: "Expansão de Domínio" };

    // Manipulações de Habilidade: lista de consulta na ficha. Ativa-se até `prof` por vez.
    const manipLista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const manipLimite = this.actor.system.attributes?.prof ?? 2;
    const manipAtivas = manipLista.filter(m => m.ativa).length;

    context.feitico = {
      slots,
      maestria,
      manipulacoes: {
        lista: manipLista.map(m => ({
          id: m.id, nome: m.nome, duracao: m.duracao ?? "", requisito: m.requisito ?? "",
          desc: m.desc ?? "", ativa: !!m.ativa,
          // no limite, quem não está ativa fica bloqueada (não pode ligar mais)
          bloqueada: !m.ativa && (manipAtivas >= manipLimite)
        })),
        ativas: manipAtivas,
        limite: manipLimite
      },
      name: this.actor.getFlag("jujutsu-system", "feiticoName") ?? "",
      proficiencia: {
        id: tier,
        label: tierLabels[tier]
      },
      tiers: tiersState,
      isGM: game.user.isGM,
      isEditMode: this.isEditMode
    };

    return context;
  }

  /** Esconde spells da aba Feitiço (manifestações e técnicas filhas) da spellbook normal. */
  _prepareSpellbook(context) {
    const original = context.itemCategories?.spells;
    if ( Array.isArray(original) ) {
      context.itemCategories.spells = original.filter(s => {
        const flag = s.getFlag("jujutsu-system", "feitico") ?? {};
        return !flag.slot && !flag.parent;
      });
    }
    const result = super._prepareSpellbook(context);
    if ( original ) context.itemCategories.spells = original;
    return result;
  }

  async _onFeiticoRoll(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    // Bloqueio: requisitos da própria manifestação ou do pai (se for técnica)
    const blocked = this._isFeiticoItemBlocked(item);
    if ( blocked ) {
      ui.notifications.warn(`"${item.name}" está bloqueada — ${blocked}`);
      return;
    }
    return item.use({}, { event: window.event });
  }

  /**
   * Verifica se um item do Feitiço (manifestação ou técnica) está bloqueado por
   * requisitos de Maestria não atendidos. Retorna a razão (string) ou null se livre.
   */
  _isFeiticoItemBlocked(item) {
    if ( !item ) return null;
    const flag = item.getFlag("jujutsu-system", "feitico") ?? {};
    let manifestacao = null;
    if ( flag.slot ) {
      manifestacao = item;
    } else if ( flag.parent ) {
      manifestacao = this.actor.items.find(i =>
        i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === flag.parent
      ) ?? null;
    }
    if ( !manifestacao ) return null;
    const reqs = manifestacao.getFlag("jujutsu-system", "feitico.requirements") ?? [];
    if ( !reqs.length ) return null;
    const maestria = this.actor.system.masteryLevel ?? 0;
    const unmet = reqs.filter(r => maestria < (r.level ?? 1));
    if ( !unmet.length ) return null;
    return "requer " + unmet.map(r => `Maestria Nv${r.level}`).join(", ");
  }

  async _onFeiticoEdit(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.sheet?.render(true);
  }

  /** Manda o card da manifestação/técnica para o chat (descrição). */
  async _onFeiticoDisplayCard(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.displayCard();
  }

  /** Troca a imagem da manifestação/técnica via FilePicker (só em modo edição). */
  async _onFeiticoChangeImage(itemId) {
    if ( !this.isEditMode ) return;
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    new FP({
      type: "image",
      current: item.img,
      callback: path => item.update({ img: path })
    }).render(true);
  }

  async _onFeiticoUnassign(slotId) {
    const target = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === slotId
    );
    if ( !target ) return;
    await target.unsetFlag("jujutsu-system", "feitico");
    ui.notifications.info(`"${target.name}" removida do slot.`);
  }

  async _onFeiticoUnassignTecnica(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    await item.unsetFlag("jujutsu-system", "feitico");
    ui.notifications.info(`"${item.name}" removida da lista de técnicas.`);
  }

  async _onFeiticoCreateManif(slotId) {
    // Se o slot já tem manifestação, abre ela em vez de criar duplicata
    const existing = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === slotId
    );
    if ( existing ) return existing.sheet?.render(true);

    const SLOT_NAMES = {
      inata: "Reversão de Feitiço",
      m1:    "1ª Manifestação",
      m2:    "2ª Manifestação",
      m3:    "3ª Manifestação"
    };
    const created = await Item.implementation.create([{
      name: SLOT_NAMES[slotId] ?? "Nova Manifestação",
      type: "spell",
      system: { level: 0, method: "atwill" },
      flags: { "jujutsu-system": { feitico: { slot: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  async _onFeiticoCreateTecnica(slotId) {
    const created = await Item.implementation.create([{
      name: "Nova Técnica",
      type: "spell",
      system: { level: 0 },
      flags: { "jujutsu-system": { feitico: { parent: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  /* -------------------------------------------- */
  /*  Manipulações de Habilidade                  */
  /* -------------------------------------------- */

  /** Editor (criar/editar) de uma Manipulação de Habilidade: nome + duração + requisito
   *  + descrição (ProseMirror). Persiste em flags.jujutsu-system.feiticoManipulacoes. */
  async _onManipEdit(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const def = id ? lista.find(m => m.id === id) : null;
    const editando = !!def;

    const content = `
      <div class="jj-manip-form" style="display:flex;flex-direction:column;gap:10px;min-width:460px;padding:4px 2px">
        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Nome</label>
          <input type="text" name="manip-nome" value="${foundry.utils.escapeHTML(def?.nome ?? "")}"
                 placeholder="Ex: Restrição de Alcance" style="width:100%">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Duração</label>
            <input type="text" name="manip-duracao" value="${foundry.utils.escapeHTML(def?.duracao ?? "")}"
                   placeholder="Ex: Até o fim do turno." style="width:100%">
          </div>
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Requisito</label>
            <input type="text" name="manip-requisito" value="${foundry.utils.escapeHTML(def?.requisito ?? "")}"
                   placeholder="Ex: Remote Punch" style="width:100%">
          </div>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Descrição</label>
          <div class="manip-desc-mount" style="min-height:170px"></div>
        </div>
      </div>`;

    const buttons = [{
      action: "ok", label: editando ? "Salvar" : "Criar", default: true, icon: "fas fa-check",
      callback: (event, button, dialog) => {
        const el = dialog.element;
        return {
          nome: el.querySelector("[name='manip-nome']")?.value?.trim() ?? "",
          duracao: el.querySelector("[name='manip-duracao']")?.value?.trim() ?? "",
          requisito: el.querySelector("[name='manip-requisito']")?.value?.trim() ?? "",
          desc: el.querySelector("prose-mirror[name='manip-desc']")?.value ?? ""
        };
      }
    }];
    if ( editando ) buttons.push({ action: "del", label: "Remover", icon: "fas fa-trash", callback: () => "DELETE" });
    buttons.push({ action: "cancel", label: "Cancelar", callback: () => null });

    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: editando ? "Editar Manipulação" : "Manipulação de Habilidade", icon: "fas fa-hand-sparkles" },
      content, buttons,
      render: (event, dialog) => {
        const editor = foundry.applications.elements.HTMLProseMirrorElement.create({
          name: "manip-desc", value: def?.desc ?? ""
        });
        dialog.element.querySelector(".manip-desc-mount")?.replaceChildren(editor);
      },
      rejectClose: false
    });

    if ( res === null || res === undefined ) return;
    const nova = foundry.utils.deepClone(lista);
    if ( res === "DELETE" ) return this._onManipDelete(def.id);
    if ( !res.nome ) { ui.notifications.warn("Dê um nome à manipulação."); return; }

    if ( editando ) {
      const i = nova.findIndex(m => m.id === def.id);
      if ( i >= 0 ) nova[i] = { ...nova[i], ...res };
    } else {
      nova.push({ id: `manip-${foundry.utils.randomID(8)}`, ativa: false, ...res });
    }
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", nova);
  }

  /** Remove uma Manipulação de Habilidade. */
  async _onManipDelete(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", lista.filter(m => m.id !== id));
  }

  /** Liga/desliga uma manipulação, respeitando o limite = bônus de proficiência. */
  async _onManipToggle(id) {
    const lista = foundry.utils.deepClone(this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? []);
    const m = lista.find(x => x.id === id);
    if ( !m ) return;
    if ( !m.ativa ) {
      const limite = this.actor.system.attributes?.prof ?? 2;
      const ativas = lista.filter(x => x.ativa).length;
      if ( ativas >= limite ) {
        ui.notifications.warn(`Máximo de ${limite} manipulação(ões) ativa(s) por vez (bônus de proficiência).`);
        return;
      }
    }
    m.ativa = !m.ativa;
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", lista);
  }

  /** Envia uma Manipulação de Habilidade para o chat como um card (nome + descrição + duração + requisito). */
  async _onManipChat(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const m = lista.find(x => x.id === id);
    if ( !m ) return;
    const esc = foundry.utils.escapeHTML;
    const TE = foundry.applications.ux.TextEditor.implementation;
    const desc = m.desc
      ? await TE.enrichHTML(m.desc, { rollData: this.actor.getRollData(), relativeTo: this.actor })
      : "";
    const metas = [];
    if ( m.duracao )   metas.push(`<div class="jj-manip-chat-meta"><span class="lbl">Duração</span><span>${esc(m.duracao)}</span></div>`);
    if ( m.requisito ) metas.push(`<div class="jj-manip-chat-meta"><span class="lbl">Requisito</span><span>${esc(m.requisito)}</span></div>`);
    const content = `
      <div class="jujutsu-card jj-manip-chat">
        <header class="jj-manip-chat-head">
          <i class="fas fa-hand-sparkles"></i>
          <h3>${esc(m.nome || "Manipulação")}</h3>
        </header>
        ${desc ? `<div class="jj-manip-chat-desc">${desc}</div>` : ""}
        ${metas.length ? `<div class="jj-manip-chat-metas">${metas.join("")}</div>` : ""}
      </div>`;
    return ChatMessage.implementation.create({
      speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
      content
    });
  }

  /* -------------------------------------------- */
  /*  Molde de Feitiço (salvar / instalar / importar) */
  /* -------------------------------------------- */

  async _onFeiticoSaveTemplate() {
    const feiticoItems = this.actor.items.filter(i => {
      if ( i.type !== "spell" ) return false;
      const flag = i.getFlag("jujutsu-system", "feitico");
      return flag?.slot || flag?.parent;
    });

    if ( !feiticoItems.length ) {
      ui.notifications.warn("Nenhuma manifestação ou técnica encontrada para salvar.");
      return;
    }

    try {
      const feiticoName = this.actor.getFlag("jujutsu-system", "feiticoName")?.trim();
      const template = await Item.implementation.create({
        name: feiticoName || `${this.actor.name} — Molde de Feitiço`,
        type: "feiticoTemplate",
        img: "icons/skills/melee/strike-hammer-destructive-blue.webp"
      });
      if ( !template ) return;

      // Cada manifestação/técnica vira um item real (não um blob de dados), ligado ao
      // molde pela flag feiticoTemplate — assim mantém sheet completa (activities, dano
      // etc.) ao configurar o molde depois, igual a container.mjs faz com `system.container`.
      // Todas ficam no compendium compartilhado (não na lista de Itens do mundo).
      const pack = await ensureFeiticoPack();
      const folder = await template.system.ensureFolder();
      const itemsData = feiticoItems.map(i => {
        const data = i.toObject();
        delete data._id;
        data.folder = folder?.id;
        foundry.utils.setProperty(data, "flags.jujutsu-system.feiticoTemplate", template.id);
        return data;
      });
      await Item.implementation.create(itemsData, { pack: pack.metadata.id });

      ui.notifications.info(`Molde "${template.name}" criado com ${itemsData.length} item(ns). Arraste para uma ficha para instalar.`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível criar o Molde de Feitiço (verifique permissões para criar itens).");
    }
  }

  async _onFeiticoInstallTemplate(templateItem) {
    const contents = Array.from(await templateItem.system?.contents ?? []);
    if ( !contents.length ) {
      ui.notifications.warn("Este Molde de Feitiço está vazio.");
      return;
    }
    await this._installFeiticoItems(contents.map(i => i.toObject()));
  }

  /**
   * Instala um conjunto de manifestações/técnicas (dados brutos de itens) nesta ficha:
   * confirma, limpa o vínculo com o molde, libera os slots já ocupados e cria os itens.
   * Fonte compartilhada por "arrastar molde" e "importar JSON".
   * @param {object[]} rawItems  Item datas (spell) com flags jujutsu-system.feitico.
   */
  async _installFeiticoItems(rawItems) {
    const itemsData = (rawItems ?? []).map(raw => {
      const data = foundry.utils.deepClone(raw);
      delete data._id;
      // vínculo com o molde de origem não deve ir para a ficha
      if ( data.flags?.["jujutsu-system"] ) delete data.flags["jujutsu-system"].feiticoTemplate;
      return data;
    }).filter(d => d?.type === "spell");   // só manifestações/técnicas (spell) entram

    if ( !itemsData.length ) {
      ui.notifications.warn("Nenhuma manifestação/técnica válida para instalar.");
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Instalar Molde de Feitiço" },
      content: `<p>Isso vai adicionar <strong>${itemsData.length}</strong> item(ns) de Feitiço nesta ficha, substituindo manifestações que já ocupem os mesmos slots. Continuar?</p>`
    });
    if ( !confirmed ) return;

    // Slots já ocupados no ator: precisam ser liberados antes de instalar o molde,
    // senão dois itens ficam com a mesma flag feitico.slot e um deles some da ficha.
    const incomingSlots = new Set(itemsData.map(d => d.flags?.["jujutsu-system"]?.feitico?.slot).filter(Boolean));
    for ( const slotId of incomingSlots ) {
      const previous = this.actor.items.find(i =>
        (i.type === "spell") && (i.getFlag("jujutsu-system", "feitico.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("jujutsu-system", "feitico");
    }

    try {
      await Item.implementation.create(itemsData, { parent: this.actor });
      ui.notifications.info(`Feitiço instalado: ${itemsData.length} item(ns) adicionado(s).`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível instalar o Molde de Feitiço.");
    }
  }

  /**
   * Importa um Molde a partir de um JSON (o mesmo gerado por "Salvar Molde" → Export Data,
   * que empacota as manifestações/técnicas em flags.jujutsu-system.feiticoBundle) direto
   * nesta ficha, sem passar por um item-molde. Aceita: o objeto do molde com feiticoBundle,
   * um array de itens, ou um único item spell.
   */
  async _onFeiticoImportJSON() {
    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: "Importar Molde de Feitiço (JSON)", icon: "fas fa-file-import" },
      position: { width: 560 },
      content: `
        <p class="hint" style="margin-top:0">Cole o <b>JSON de um Molde</b> (exportado pelo botão Salvar Molde → clique direito no item → <i>Export Data</i>) ou escolha o arquivo. As manifestações e técnicas entram direto nesta ficha.</p>
        <div class="form-group"><label>Arquivo .json</label>
          <input type="file" name="arquivo" accept="application/json,.json"></div>
        <div class="form-group"><label>…ou cole o JSON aqui</label>
          <textarea name="json" rows="8" placeholder='{ "type": "feiticoTemplate", ... }'></textarea></div>`,
      buttons: [
        { action: "importar", label: "Importar", icon: "fas fa-file-import", default: true,
          callback: (ev, b) => ({ texto: b.form.elements.json.value, file: b.form.elements.arquivo.files?.[0] ?? null }) },
        { action: "cancelar", label: "Cancelar" }
      ],
      rejectClose: false
    }).catch(() => null);
    if ( !res || res === "cancelar" ) return;

    let texto = res.texto?.trim() ?? "";
    if ( res.file ) {
      try { texto = await res.file.text(); }
      catch { return void ui.notifications.error("Não foi possível ler o arquivo."); }
    }
    if ( !texto ) return void ui.notifications.warn("Nenhum JSON informado.");

    let data;
    try { data = JSON.parse(texto); }
    catch { return void ui.notifications.error("JSON inválido — verifique o conteúdo."); }

    // Extrai as manifestações/técnicas: bundle do molde, array direto, ou item único.
    const bundle = foundry.utils.getProperty(data, "flags.jujutsu-system.feiticoBundle");
    const rawItems = Array.isArray(bundle) ? bundle
      : Array.isArray(data) ? data
      : (data?.type === "spell") ? [data]
      : null;
    if ( !rawItems?.length ) {
      return void ui.notifications.warn("Esse JSON não parece um Molde de Feitiço (sem manifestações/técnicas).");
    }
    await this._installFeiticoItems(rawItems);
  }

  async _onFeiticoReqAdd(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( reqs.length >= 6 ) {
      ui.notifications.warn("Máximo de 6 requisitos por manifestação.");
      return;
    }
    reqs.push({ level: 1 });
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  async _onFeiticoReqRemove(itemId, index) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( !reqs[index] ) return;
    reqs.splice(index, 1);
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  async _onFeiticoReqChange(itemId, index, field, rawValue) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( !reqs[index] ) return;
    if ( field === "level" ) reqs[index].level = Math.max(1, Math.min(7, parseInt(rawValue) || 1));
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  /**
   * Atribui um spell a um slot de manifestação ou como técnica filha de um slot (drop).
   */
  async _onFeiticoDropSpell(event, item, dropTarget) {
    const dropType = dropTarget.dataset.feiticoDrop;
    const slotId = dropTarget.closest("[data-feitico-slot]")?.dataset.feiticoSlot;
    if ( !slotId ) return;

    let owned = item.parent === this.actor ? item : null;

    // Item externo: criar no actor primeiro
    if ( !owned ) {
      const itemData = item.toObject();
      delete itemData._id;
      if ( dropType === "manif" ) {
        foundry.utils.setProperty(itemData, "system.method", "atwill");
      }
      const created = await Item.implementation.create(itemData, { parent: this.actor });
      owned = Array.isArray(created) ? created[0] : created;
      if ( !owned ) return;
    }

    // Limpar flag anterior antes de setar a nova
    await owned.unsetFlag("jujutsu-system", "feitico");

    if ( dropType === "manif" ) {
      // Se outra manifestação ocupava esse slot, desocupa
      const previous = this.actor.items.find(i =>
        (i !== owned) && (i.type === "spell") &&
        (i.getFlag("jujutsu-system", "feitico.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("jujutsu-system", "feitico");
      await owned.setFlag("jujutsu-system", "feitico", { slot: slotId });
      // Promover método para "atwill" se ainda não for
      if ( owned.system?.method !== "atwill" ) {
        await owned.update({ "system.method": "atwill" });
      }
      ui.notifications.info(`"${owned.name}" atribuída ao slot ${slotId}.`);
    } else {
      await owned.setFlag("jujutsu-system", "feitico", { parent: slotId });
      ui.notifications.info(`"${owned.name}" adicionada como técnica de ${slotId}.`);
    }

    return owned;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickAction(event, target) {
  const action = target.dataset.action;

  if ( action === "unlockManipulation" ) {
    return this._onUnlockManipulationAbility(target.dataset.ability, parseInt(target.dataset.cost ?? 0));
  }
  if ( action === "trainAbility" ) {
    return this._onTrainAbility(target.dataset.training, false);
  }
  if ( action === "instantAdvance" ) {
    return this._onTrainAbility(target.dataset.training, true);
  }
  if ( action === "intensiveTraining" ) {
    return this._onIntensiveTraining();
  }
  if ( action === "undoIntensiveTraining" ) {
    return this._onUndoIntensiveTraining(target.dataset.field);
  }

  // ── Aba Feitiço ──────────────────────────────────────────
  if ( action === "feitico-roll" )             return this._onFeiticoRoll(target.dataset.itemId);
  if ( action === "feitico-edit" )             return this._onFeiticoEdit(target.dataset.itemId);
  if ( action === "feitico-display-card" )     return this._onFeiticoDisplayCard(target.dataset.itemId);
  if ( action === "feitico-change-image" )     return this._onFeiticoChangeImage(target.dataset.itemId);
  if ( action === "feitico-unassign-manif" )   return this._onFeiticoUnassign(target.dataset.slot);
  if ( action === "feitico-unassign-tecnica" ) return this._onFeiticoUnassignTecnica(target.dataset.itemId);
  if ( action === "feitico-create-manif" )     return this._onFeiticoCreateManif(target.dataset.slot);
  if ( action === "feitico-create-tecnica" )   return this._onFeiticoCreateTecnica(target.dataset.slot);
  if ( action === "feitico-req-add" )          return this._onFeiticoReqAdd(target.dataset.itemId);
  if ( action === "feitico-req-remove" )       return this._onFeiticoReqRemove(target.dataset.itemId, parseInt(target.dataset.index));
  if ( action === "feitico-save-template" )    return this._onFeiticoSaveTemplate();
  if ( action === "feitico-import-json" )      return this._onFeiticoImportJSON();
  if ( action === "manip-create" )             return this._onManipEdit(null);
  if ( action === "manip-edit" )               return this._onManipEdit(target.dataset.id);
  if ( action === "manip-del" )                return this._onManipDelete(target.dataset.id);
  if ( action === "manip-toggle" )             return this._onManipToggle(target.dataset.id);
  if ( action === "manip-chat" )               return this._onManipChat(target.dataset.id);

  return super._onClickAction(event, target);
}

  /* -------------------------------------------- */

  async _onUnlockManipulationAbility(abilityId, cost) {
    await onUnlockManipulationAbility(this.actor, abilityId, cost);
  }

  /* -------------------------------------------- */

  async _onIntensiveTraining() {
    await onIntensiveTraining(this.actor);
  }

  /* -------------------------------------------- */

  async _onUndoIntensiveTraining(field) {
    await onUndoIntensiveTraining(this.actor, field);
  }

  /* -------------------------------------------- */

  async _grantLinkedTechniques(techniqueNames) {
    await grantLinkedTechniques(this.actor, techniqueNames);
  }

  /* -------------------------------------------- */

  _getManipulationContextOptions() {
    return [
      {
        name: "Desfazer",
        icon: '<i class="fas fa-rotate-left"></i>',
        condition: element => {
          const abilityId = element.dataset.abilityId;
          return this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked === true;
        },
        callback: element => this._onUndoManipulationAbility(element.dataset.abilityId)
      }
    ];
  }

  /* -------------------------------------------- */

  _getTrainingContextOptions() {
    return [
      {
        name: "Desfazer",
        icon: '<i class="fas fa-rotate-left"></i>',
        condition: element => (this.actor.system.trainings?.[element.dataset.trainingId]?.rank ?? 0) > 0,
        callback: element => this._onUndoTraining(element.dataset.trainingId)
      }
    ];
  }

  /* -------------------------------------------- */

  async _onUndoManipulationAbility(abilityId) {
    await onUndoManipulationAbility(this.actor, abilityId);
  }

  /* -------------------------------------------- */

  async _onUndoTraining(trainingId) {
    await onUndoTraining(this.actor, trainingId);
  }

  /* -------------------------------------------- */

  async _syncTrainingEffect(trainingId, rank) {
    await syncTrainingEffect(this.actor, trainingId, rank);
  }

  /* -------------------------------------------- */

  async _onTrainAbility(trainingId, instant) {
    await onTrainAbility(this.actor, trainingId, instant);
  }
}
