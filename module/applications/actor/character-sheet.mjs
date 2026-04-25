import { formatNumber } from "../../utils.mjs";
import AdvancementManager from "../advancement/advancement-manager.mjs";
import EnergyGenerationDialog from "./energy-generation-dialog.mjs";
import { EnergySystem } from "../../systems/energy.mjs";
import CompendiumBrowser from "../compendium-browser.mjs";
import ContextMenu5e from "../context-menu.mjs";
import BaseActorSheet from "./api/base-actor-sheet.mjs";
import { prepareManipulationAbilities, prepareTrainings } from "../../systems/manipulation-data.mjs";
import Item5e from "../../documents/item.mjs";
import * as Trait from "../../documents/actor/trait.mjs";

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
    { tab: "effects", label: "DND5E.Effects", icon: "fas fa-bolt" },
    { tab: "bastion", label: "DND5E.Bastion.Label", icon: "fas fa-chess-rook", condition: this.hasBastion },
    // { tab: "specialTraits", label: "DND5E.SpecialTraits", icon: "fas fa-star" },
    { 
  tab: "manipulation", 
  label: "JUJUTSU.Manipulation.Tab", 
  icon: "fas fa-hand-sparkles",
  condition: actor => !actor.itemTypes.class.some(c => c.identifier === "restringido")
},
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
    context.showClassDrop = !context.classes.length || this.isEditMode;
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
    // Context menus de manipulação e treinamentos
    // Context menus de manipulação e treinamentos
new foundry.applications.ux.ContextMenu.implementation(
  this.element,
  ".ability-card[data-item-id]",
  this._getManipulationContextOptions(),
  { jQuery: false }
);

new foundry.applications.ux.ContextMenu.implementation(
  this.element,
  ".training-card[data-item-id]",
  this._getTrainingContextOptions(),
  { jQuery: false }
);
  }


    // Colapso de seções das abas Features, Spells e Inventory
    setTimeout(() => {
      for ( const tabName of ["features", "spells", "inventory"] ) {
        const tab = this.element.querySelector(`[data-tab="${tabName}"]`);
        if ( !tab ) continue;
        tab.querySelectorAll('.items-header').forEach(header => {
          header.style.cursor = 'pointer';
          header.addEventListener('click', (event) => {
            if ( event.target.closest('.item-controls') ) return;
            const itemList = header.nextElementSibling;
            if ( !itemList || !itemList.classList.contains('item-list') ) return;
            const isCollapsed = header.classList.toggle('collapsed');
            itemList.style.display = isCollapsed ? 'none' : '';
            const indicator = header.querySelector('.accordion-indicator');
            if ( indicator ) indicator.style.transform = isCollapsed ? 'rotate(-90deg)' : '';
          });
        });
      }
    }, 100);

    // Injetar seção de condições Jujutsu na aba Effects
    _injectJJConditions(this.element, this.actor);

    // Seções customizadas de Features (JJ)
    _setupFeatureSectionDrops(this.element, this.actor);
    _unhideFeatureSections(this.element);

    // Botão de Explosão Defensiva — listener no botão do HBS
    this.element.querySelector("[data-action='jj-expdef-trigger']")
      ?.addEventListener("click", () => _onExplosaoDefensiva(this.actor));

    // Seis Olhos — listener nos radio buttons
    this.element.querySelectorAll("input[name='flags.jujutsu-system.seisOlhosMode']")
      .forEach(radio => radio.addEventListener("change", async (event) => {
        const mode = event.target.value;
        await this.actor.setFlag("jujutsu-system", "seisOlhosMode", mode);
        await _applySeiOlhosEffects(this.actor, mode);
      }));

    // Formatar inputs de Yen com pontuação (ex: 5000 → 5.000)
    const _formatYen = val => {
      const num = parseInt(String(val).replace(/\./g, "").replace(/,/g, "")) || 0;
      return num.toLocaleString("pt-BR");
    };
    this.element.querySelectorAll("input.jj-yen-input, input[name='system.currency.yen']").forEach(input => {
      if ( input.dataset.yenFormatted ) return;
      input.dataset.yenFormatted = "1";
      if ( input.value ) input.value = _formatYen(input.value);
      input.addEventListener("focus", () => {
        input.value = String(parseInt(input.value.replace(/\./g, "").replace(/,/g, "")) || 0);
        input.select();
      });
      input.addEventListener("blur", () => {
        input.value = _formatYen(input.value);
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
   * @param {object} context
   * @param {ApplicationRenderOptions} options
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareManipulationContext(context, options) {
    try {
      const result = prepareManipulationAbilities(this.actor);
      console.log("JujutsuLegacy | abilities prepared:", JSON.stringify(Object.keys(result)));
      context.abilities = result;
    } catch(err) {
      console.error("JujutsuLegacy | Erro Manipulacao:", err);
      context.abilities = { basic: {}, advanced: {}, extreme: {}, barrier: {} };
    }
    return context;
  }

  /* -------------------------------------------- */

  async _prepareTrainingsContext(context, options) {
    try {
      const result = prepareTrainings(this.actor);
      console.log("JujutsuLegacy | trainings prepared:", JSON.stringify(Object.keys(result)));
      context.trainings = result;
    } catch(err) {
      console.error("JujutsuLegacy | Erro Treinamentos:", err);
      context.trainings = { general: {}, domain: {}, immaculate: {} };
    }
    return context;
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
  if ( action === "toggleSection" ) {
  return this._onToggleSection(target.dataset.section);
}

  return super._onClickAction(event, target);
}

  /* -------------------------------------------- */

  /**
   * Colapsa ou expande uma seção da aba Features, persistindo o estado no localStorage.
   */
  _onToggleSection(sectionId) {
    const storageKey = `jujutsu-system.features.collapsed.${this.actor.id}`;
    let collapsed;
    try { collapsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { collapsed = []; }

    // O wrapper .section-accordion é pai de header e content
    const wrapper = this.element.querySelector(`.section-accordion[data-section-id="${sectionId}"]`);
    if ( !wrapper ) return;

    const isCollapsed = wrapper.classList.toggle("collapsed");
    const accordionContent = wrapper.querySelector(".accordion-content");

    if ( accordionContent ) {
      if ( isCollapsed ) {
        accordionContent.style.height = accordionContent.scrollHeight + "px";
        requestAnimationFrame(() => { accordionContent.style.height = "0px"; });
      } else {
        accordionContent.style.height = accordionContent.scrollHeight + "px";
        accordionContent.addEventListener("transitionend", () => { accordionContent.style.height = ""; }, { once: true });
      }
    }

    const idx = collapsed.indexOf(sectionId);
    if ( isCollapsed && idx === -1 ) collapsed.push(sectionId);
    else if ( !isCollapsed && idx !== -1 ) collapsed.splice(idx, 1);
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }

  /* -------------------------------------------- */

  /**
   * Restaura o estado colapsado das seções da aba Features ao renderizar a ficha.
   */
  _restoreCollapsedSections() {
    const storageKey = `jujutsu-system.features.collapsed.${this.actor.id}`;
    let collapsed;
    try { collapsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { collapsed = []; }

    for ( const sectionId of collapsed ) {
      const wrapper = this.element.querySelector(`.section-accordion[data-section-id="${sectionId}"]`);
      if ( !wrapper ) continue;
      wrapper.classList.add("collapsed");
      const accordionContent = wrapper.querySelector(".accordion-content");
      if ( accordionContent ) accordionContent.style.height = "0px";
    }
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia uma habilidade de manipulação, deduzindo os PM e registrando.
   */
  async _onUnlockManipulationAbility(abilityId, cost) {
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
    if ( cursePoints < cost ) {
      ui.notifications.warn(`PM insuficientes! Você tem ${cursePoints} PM, precisa de ${cost}.`);
      return;
    }

    const currentInvested = this.actor.system.manipulation?.pointsInvested ?? 0;

    // Buscar técnicas vinculadas do compêndio e adicioná-las ao ator
    const { MANIPULATION_ABILITIES } = await import("../../systems/manipulation-data.mjs");
    const abilityDef = MANIPULATION_ABILITIES[abilityId];
    if ( abilityDef?.techniques?.length ) {
      await this._grantLinkedTechniques(abilityDef.techniques);
    }

    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
      "system.manipulation.pointsInvested": currentInvested + cost,
      "system.curseResources.cursePoints": cursePoints - cost
    });

    ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `<strong>${this.actor.name}</strong> desbloqueou a habilidade de manipulação: <strong>${abilityDef?.label ?? abilityId}</strong>!`
});
  }

  /* -------------------------------------------- */

  /**
   * Abre o dialog de Treinamento Intenso para escolher a opção de melhoria.
   */
  async _onIntensiveTraining() {
    const actor = this.actor;
    const it = actor.system.energy?.intensiveTraining ?? {};
    const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
    const generatedAtLimit = (it.generatedEnergy ?? 0) >= 20;

    const currentMaxPA = actor.system.energy?.max ?? 0;
    const currentGeneratedBonus = it.generatedEnergy ?? 0;

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: "⚔️ Treinamento Intenso — Evolução na Prática" },
      content: `
        <div style="padding:4px 0; font-size:13px; color:#ccc; line-height:1.5;">
          <p style="margin:0 0 10px; font-size:12px; color:#aaa;">
            Escolha o benefício do seu <strong>Treinamento Intenso (10 dias)</strong>:
          </p>
          <div style="display:flex; flex-direction:column; gap:6px;">

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="maxEnergy" style="flex:0 0 auto;">
              <div>
                <strong style="color:#c0a0ff;">↑ PA Máximo +5</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${currentMaxPA} → ${currentMaxPA + 5} (treino ${(it.maxEnergy ?? 0) + 1})</div>
              </div>
            </label>

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer; ${generatedAtLimit ? "opacity:0.4;" : ""}">
              <input type="radio" name="jj-training-choice" value="generatedEnergy"
                     ${generatedAtLimit ? "disabled" : ""} style="flex:0 0 auto;">
              <div>
                <strong style="color:#60c0ff;">⚡ PA Gerada +1/turno</strong>
                <div style="font-size:11px; color:#8080a0;">
                  ${generatedAtLimit
                    ? "⛔ Limite atingido (20 treinos)"
                    : `Treinos: ${currentGeneratedBonus}/20 — bônus de +${currentGeneratedBonus} → +${currentGeneratedBonus + 1} por turno`}
                </div>
              </div>
            </label>

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="cursePoints" style="flex:0 0 auto;">
              <div>
                <strong style="color:#ffa060;">💀 Pontos de Maldição +4</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${cursePoints} PM → ${cursePoints + 4} PM</div>
              </div>
            </label>

          </div>
          <p style="margin:10px 0 0; font-size:11px; color:#6060a0;">
            ⚠️ Treino de <em>PA Gerada</em> requer 10 dias de espera antes de repetir.
          </p>
        </div>`,
      buttons: [
        {
          label: "Confirmar Treinamento",
          action: "ok",
          default: true,
          callback: (event, button, dialog) => {
            const selected = (dialog.element ?? document).querySelector("input[name='jj-training-choice']:checked");
            return selected?.value ?? null;
          }
        },
        {
          label: "Cancelar",
          action: "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });

    if ( !choice ) return;

    const it2 = actor.system.energy?.intensiveTraining ?? {};

    const updates = {};
    let chatMsg = "";

    if ( choice === "maxEnergy" ) {
      // intensiveTraining.maxEnergy é um CONTADOR de treinos — character.mjs faz (contador * 5)
      const novoContador = (it2.maxEnergy ?? 0) + 1;
      updates["system.energy.intensiveTraining.maxEnergy"] = novoContador;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Máximo +5</strong> (${novoContador} treino(s) = +${novoContador * 5} PA Máx total de treino).`;
    } else if ( choice === "generatedEnergy" ) {
      if ( generatedAtLimit ) {
        ui.notifications.warn("Limite de treinos de PA Gerada atingido (20 vezes).");
        return;
      }
      // intensiveTraining.generatedEnergy é um CONTADOR — EnergySystem soma direto ao bônus de geração
      const novoContador = (it2.generatedEnergy ?? 0) + 1;
      updates["system.energy.intensiveTraining.generatedEnergy"] = novoContador;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Gerada +1</strong> por turno (treino ${novoContador}/20).`;
    } else if ( choice === "cursePoints" ) {
      const current = actor.system.curseResources?.cursePoints ?? 0;
      updates["system.curseResources.cursePoints"] = current + 4;
      updates["system.energy.intensiveTraining.cursePoints"] = (it2.cursePoints ?? 0) + 4;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>+4 Pontos de Maldição</strong> (total: ${current + 4} PM).`;
    }

    await actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatMsg
    });

    ui.notifications.info("Treinamento Intenso concluído!");
  }

  /* -------------------------------------------- */

  /**
   * Desfaz o último registro de treinamento intensivo no campo indicado.
   * @param {"maxEnergy"|"generatedEnergy"|"cursePoints"} field
   */
  async _onUndoIntensiveTraining(field) {
    const actor = this.actor;
    const it = actor.system.energy?.intensiveTraining ?? {};

    const FIELD_CONFIG = {
      maxEnergy: {
        label: "PA Máximo",
        amount: 1,
        undo: (it) => ({
          "system.energy.intensiveTraining.maxEnergy": Math.max(0, (it.maxEnergy ?? 0) - 1)
        })
      },
      generatedEnergy: {
        label: "PA Gerada",
        amount: 1,
        undo: (it) => ({
          "system.energy.intensiveTraining.generatedEnergy": Math.max(0, (it.generatedEnergy ?? 0) - 1)
        })
      },
      cursePoints: {
        label: "Pontos de Maldição",
        amount: 4,
        undo: (it) => ({
          "system.curseResources.cursePoints": Math.max(0, (actor.system.curseResources?.cursePoints ?? 0) - 4),
          "system.energy.intensiveTraining.cursePoints": Math.max(0, (it.cursePoints ?? 0) - 4)
        })
      }
    };

    const config = FIELD_CONFIG[field];
    if ( !config ) return;

    const currentCount = it[field] ?? 0;
    if ( currentCount <= 0 ) {
      ui.notifications.warn(`Não há treinos de ${config.label} para desfazer.`);
      return;
    }

    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: "↩️ Desfazer Treinamento" },
      content: `<p>Desfazer o último treino de <strong>${config.label}</strong>?<br>
                <span style="font-size:12px;color:#aaa;">Isso reverterá o bônus de <strong>-${config.amount}</strong>.</span></p>`,
      yes: { label: "Desfazer" },
      no: { label: "Cancelar" }
    });
    if ( !confirm ) return;

    const updates = config.undo(it);
    await actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `↩️ <strong>${actor.name}</strong> desfez um Treinamento de <strong>${config.label}</strong> (-${config.amount}).`
    });

    ui.notifications.info(`Treinamento de ${config.label} desfeito.`);
  }

  /* -------------------------------------------- */

  /**
   * Tenta conceder automaticamente técnicas vinculadas a partir do compêndio.
   */
  async _grantLinkedTechniques(techniqueNames) {
    for ( const name of techniqueNames ) {
      // Busca no compêndio do sistema
      const pack = game.packs.find(p => p.metadata.type === "Item");
      if ( !pack ) continue;
      await pack.getIndex();
      const entry = pack.index.find(i => i.name === name);
      if ( !entry ) continue;
      const item = await pack.getDocument(entry._id);
      if ( item && !this.actor.items.find(i => i.name === name) ) {
        await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
        ui.notifications.info(`Técnica "${name}" adicionada automaticamente.`);
      }
    }
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

/**
 * Context menu para habilidades de manipulação (botão direito)
 */
_getManipulationContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const abilityId = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked === true;
      },
      callback: element => {
        const abilityId = element.dataset.abilityId;
        this._onUndoManipulationAbility(abilityId);
      }
    }
  ];
}

/* -------------------------------------------- */

/* -------------------------------------------- */

/**
 * Context menu para habilidades de manipulação (botão direito)
 */
_getManipulationContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const abilityId = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked === true;
      },
      callback: element => {
        const abilityId = element.dataset.abilityId;
        this._onUndoManipulationAbility(abilityId);
      }
    }
  ];
}

/* -------------------------------------------- */

/**
 * Context menu para treinamentos (botão direito)
 */
_getTrainingContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const trainingId = element.dataset.trainingId;
        return (this.actor.system.trainings?.[trainingId]?.rank ?? 0) > 0;
      },
      callback: element => {
        const trainingId = element.dataset.trainingId;
        this._onUndoTraining(trainingId);
      }
    }
  ];
}

/* -------------------------------------------- */

async _onUndoManipulationAbility(abilityId) {
  const { MANIPULATION_ABILITIES } = await import("../../systems/manipulation-data.mjs");
  const def = MANIPULATION_ABILITIES[abilityId];
  if ( !def ) return;

  const invested = this.actor.system.manipulation?.pointsInvested ?? 0;
  const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;

  await this.actor.update({
    [`system.manipulation.abilities.${abilityId}.unlocked`]: false,
    "system.manipulation.pointsInvested": Math.max(0, invested - def.cost),
    "system.curseResources.cursePoints": cursePoints + def.cost
  });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `↩️ <strong>${this.actor.name}</strong> desfez a habilidade: <strong>${def.label}</strong>. +${def.cost} PM devolvidos.`
  });
}

/* -------------------------------------------- */

async _onUndoTraining(trainingId) {
  const { TRAININGS_DATA } = await import("../../systems/manipulation-data.mjs");
  const def = TRAININGS_DATA[trainingId];
  if ( !def ) return;

  const currentRank = this.actor.system.trainings?.[trainingId]?.rank ?? 0;
  if ( currentRank === 0 ) return;

  const prevRankIdx = currentRank - 1;
  const ptRefund = def.ptCost[prevRankIdx] ?? def.ptCost[0];
  const currentDC = this.actor.system.trainings?.[trainingId]?.currentDC ?? def.baseDC;
  const prevDC = Math.max(def.baseDC, currentDC - (def.dcIncrement ?? 5));

await this.actor.update({
  [`system.trainings.${trainingId}.rank`]: currentRank - 1,
  [`system.trainings.${trainingId}.currentDC`]: prevDC,
  "system.masteryPoints": Math.max(0, (this.actor.system.masteryPoints ?? 0) - ptRefund),
  "system.curseResources.trainingPoints": (this.actor.system.curseResources?.trainingPoints ?? 0) + ptRefund
});
await this._syncTrainingEffect(trainingId, currentRank - 1);  // ← aqui

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `↩️ <strong>${this.actor.name}</strong> desfez um nível de <strong>${def.label}</strong>. Rank voltou para ★${"★".repeat(currentRank - 1) || "0"}.`
  });
}


/* -------------------------------------------- */

/**
 * Sincroniza o Active Effect de um treinamento com o rank atual.
 * Cria, atualiza ou remove o effect conforme necessário.
 */
async _syncTrainingEffect(trainingId, rank) {
  const effectId = `training-${trainingId}`;

  // Configurações de cada treinamento
  const TRAINING_EFFECTS = {
    protecaoEnergia: {
      label: "Proteção de Energia",
      icon: "icons/svg/shield.svg",
      changes: rank => [
        { key: "system.attributes.ac.bonus", mode: 2, value: String(rank), priority: 20 }
      ]
    },
    robusto: {
      label: "Robusto",
      icon: "icons/svg/heart.svg",
      changes: rank => [
        { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${rank} * @details.level`, priority: 20 }
      ]
    },
    agilidadeAvancada: {
      label: "Agilidade Avançada",
      icon: "icons/svg/wing.svg",
      changes: rank => {
        const bonus = rank === 1 ? 5 : rank === 2 ? 10 : 20;
        return [
          { key: "system.attributes.movement.walk", mode: 2, value: String(bonus), priority: 20 }
        ];
      }
    },
    energiaAdaptavel: {
      label: "Energia Adaptável",
      icon: "icons/svg/aura.svg",
      changes: rank => {
        const mult = rank + 2; // rank1=3, rank2=4, rank3=5
        return [
          { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${mult} * @abilities.con.mod`, priority: 20 }
        ];
      }
    },
    golpePenetrante: {
      label: "Golpe Penetrante",
      icon: "icons/svg/sword.svg",
      changes: rank => [
        { key: "system.bonuses.mwak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.rwak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.msak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.rsak.attack", mode: 2, value: String(rank), priority: 20 }
      ]
    }
  };

  const def = TRAINING_EFFECTS[trainingId];
  if ( !def ) return; // Treinamento sem automação, ignora

  // Procura effect existente pela flag
  const existing = this.actor.effects.find(e => e.getFlag("jujutsu-system", "trainingId") === trainingId);

  // Se rank 0, remove o effect se existir
  if ( rank === 0 ) {
    if ( existing ) await existing.delete();
    return;
  }

  const effectData = {
    name: `${def.label} (${"★".repeat(rank)})`,
    icon: def.icon,
    origin: this.actor.uuid,
    disabled: false,
    flags: { "jujutsu-system": { trainingId } },
    changes: def.changes(rank)
  };

  if ( existing ) {
    // Atualiza effect existente
    await existing.update(effectData);
  } else {
    // Cria novo effect
    await this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}

  /**
   * Realiza ou avança um treinamento.
   * @param {string} trainingId  ID do treinamento
   * @param {boolean} instant    true = Avanço Instantâneo (gasta PM)
   */
  async _onTrainAbility(trainingId, instant) {
    const { TRAININGS_DATA } = await import("../../systems/manipulation-data.mjs");
    const def = TRAININGS_DATA[trainingId];
    if ( !def ) return;

    const savedTrainings = this.actor.system.trainings ?? {};
    const saved = savedTrainings[trainingId] ?? { rank: 0, currentDC: def.baseDC };
    const rank = saved.rank ?? 0;
    const currentDC = saved.currentDC ?? def.baseDC;

    const nextPtCost = def.ptCost[rank] ?? def.ptCost[def.ptCost.length - 1];
    const nextPaCost = def.paCost[rank] ?? def.paCost[def.paCost.length - 1];
    const trainingPoints = this.actor.system.curseResources?.trainingPoints ?? 0;
    const energyTotal = this.actor.system.energy?.total ?? 0;
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;

    // Avanço Instantâneo: gasta PM igual ao custo de PT
    if ( instant ) {
      if ( cursePoints < nextPtCost ) {
        ui.notifications.warn(`PM insuficientes! Precisa de ${nextPtCost} PM.`);
        return;
      }
      const newDC = currentDC + (def.dcIncrement ?? 5);
      await this.actor.update({
        [`system.trainings.${trainingId}.rank`]: rank + 1,
        [`system.trainings.${trainingId}.currentDC`]: newDC,
        "system.curseResources.cursePoints": cursePoints - nextPtCost,
        "system.masteryPoints": (this.actor.system.masteryPoints ?? 0) + nextPtCost
      });
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `⚡ <strong>${this.actor.name}</strong> usou Avanço Instantâneo em <strong>${def.label}</strong>! (★${"★".repeat(rank + 1)})`
});
      return;
    }

    // Treinamento normal: verificar custos
    if ( trainingPoints < nextPtCost ) {
      ui.notifications.warn(`PT insuficientes! Precisa de ${nextPtCost} PT.`);
      return;
    }
    if ( energyTotal < nextPaCost ) {
      ui.notifications.warn(`PA Total insuficiente! Precisa de ${nextPaCost} PA.`);
      return;
    }

    // Deduzir custos
    await this.actor.update({
      "system.curseResources.trainingPoints": trainingPoints - nextPtCost,
      "system.energy.total": energyTotal - nextPaCost
    });

    // Rolar Teste de Constituição (Controle de Energia) — skill "Cont"
    // Usa o total da skill que já considera proficiência, maestria e bônus
    const contSkill = this.actor.system.skills?.Cont;
    const skillTotal = contSkill?.total ?? (
      (this.actor.system.abilities?.con?.mod ?? 0) +
      Math.floor((this.actor.system.attributes?.prof ?? 2) * (contSkill?.value ?? 0))
    );
    const roll = await new Roll("1d20 + @bonus", { bonus: skillTotal }).evaluate();
    if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Controle de Energia (CON)<br><strong>${def.label}</strong> — CD ${currentDC}`
    });

    if ( roll.total >= currentDC ) {
      // Sucesso
      // Sucesso
const newDC = currentDC + (def.dcIncrement ?? 5);
await this.actor.update({
  [`system.trainings.${trainingId}.rank`]: rank + 1,
  [`system.trainings.${trainingId}.currentDC`]: newDC,
  "system.masteryPoints": (this.actor.system.masteryPoints ?? 0) + nextPtCost,
  "system.curseResources.cursePoints": (this.actor.system.curseResources?.cursePoints ?? 0) + 1
});
await this._syncTrainingEffect(trainingId, rank + 1); 
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `✅ <strong>${this.actor.name}</strong> treinou <strong>${def.label}</strong> com sucesso! (★${"★".repeat(rank + 1)}) +1 Ponto de Maldição.`
});
    } else {
      // Falha: CD reduz em -1, registra PT perdidos
      const lostPt = this.actor.system.curseResources?.lostTrainingPoints ?? 0;
      await this.actor.update({
        [`system.trainings.${trainingId}.currentDC`]: Math.max(0, currentDC - 1),
        "system.curseResources.lostTrainingPoints": lostPt + nextPtCost
      });
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `❌ <strong>${this.actor.name}</strong> falhou no treino de <strong>${def.label}</strong>. CD reduzida em 1 (nova CD: ${Math.max(0, currentDC - 1)}). <strong>${nextPtCost} PT perdidos</strong>.`
});
    }
  }
}
/**
 * jujutsu-chat-card.mjs
 * JujutsuLegacy — Chat Card Customizado
 *
 * Substitui completamente o card nativo do dnd5e para ataques.
 * Fluxo:
 *   1. Jogador clica na técnica/arma na ficha
 *   2. Card aparece no chat com: nome, descrição, botões de Rolar Ataque e Rolar Dano
 *   3. Ao clicar em Rolar Ataque: dialog pergunta quantos dados de PA quer gastar
 *      (0 até dobro do bônus de proficiência, limitado pela PA gerada disponível)
 *   4. Rolagem de acerto aparece no card com breakdown clicável
 *   5. Ao clicar em Rolar Dano: mesma pergunta de PA
 *   6. Dano aparece no card — se múltiplos tipos, divide em colunas
 *
 * INTEGRAÇÃO: adicionar ao final do character-sheet.mjs (como o consumo de PA)
 */

(function _registerJujutsuChatCard() {

  // ── HOOK PRINCIPAL: intercepta o uso de qualquer atividade ──────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;

    // Só interceptamos atividades de ataque
    if ( activity.type !== "attack" ) return;

    // Cancelar o comportamento nativo
    _postJujutsuCard(activity, item);
    return false;
  });

  // ── CRIAR O CARD CUSTOMIZADO ─────────────────────────────────────────────────
  async function _postJujutsuCard(activity, item) {
    const actor = item.actor;
    const isSpell = item.type === "spell";

    // Processar consumo de PA configurado na activity (Attribute type)
    // antes de criar o card, já que bloqueamos o processamento nativo
    if ( actor ) {
      const targets = activity.consumption?.targets ?? [];
      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custo = Number(target.value ?? 0);
        if ( custo <= 0 ) continue;
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada
          ? (actor.system?.energy?.generated ?? 0)
          : (actor.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${actor.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return; // aborta criação do card
        }
        await actor.update({ [campo]: atual - custo }, { isEnergySystem: true });
      }
    }

    // Dados de dano da activity
    const damageParts = activity.damage?.parts ?? [];

    // Montar o HTML do card
    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";

    // Tipo de dado bônus de PA
    const baseDenomination = isSpell
      ? (damageParts[0]?.denomination ?? 6)
      : 4;

    const cardData = {
      itemId:       item.id,
      actorId:      actor?.id ?? null,
      tokenId:      actor?.token?.id ?? null,
      activityId:   activity.id,
      itemName:     item.name,
      itemImg:      item.img,
      isSpell,
      hasDescription,
      description:  hasDescription ? description : "",
      damageParts:  damageParts.map(p => ({
        formula: _buildDamageFormula(p, actor),
        types:   p.types ?? [],
        label:   _damageTypeLabel(p.types)
      })),
      hasAttack:    true,
      hasDamage:    damageParts.length > 0,
      paBonus:      baseDenomination,
      profBonus:    actor?.system?.attributes?.prof ?? 2,
      userId:       game.user.id
    };

    const content = _renderCardHTML(cardData);

    const rollMode = game.settings.get("core", "rollMode");
    const chatData = {
      speaker:  ChatMessage.getSpeaker({ actor }),
      content,
      rollMode,
      flags: {
        "jujutsu-system": {
          jujutsuCard: true,
          cardData
        }
      }
    };
    ChatMessage.applyRollMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  // ── RENDERIZAR HTML DO CARD ──────────────────────────────────────────────────
  function _renderCardHTML(data) {
    return `
<div class="jujutsu-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-user-id="${data.userId ?? ""}"
     data-pa-bonus="${data.paBonus}"
     data-prof-bonus="${data.profBonus}"
     data-is-spell="${data.isSpell}">

  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.isSpell ? "Técnica" : "Ataque"}</span>
  </div>

  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}

  ${data.hasAttack ? `
  <div class="jj-adv-row">
    <button class="jj-adv-btn" data-adv="advantage" title="Vantagem">
      <i class="fas fa-angles-up"></i> Vantagem
    </button>
    <button class="jj-adv-btn" data-adv="disadvantage" title="Desvantagem">
      <i class="fas fa-angles-down"></i> Desvantagem
    </button>
  </div>` : ""}

  <div class="jj-roll-btns">
    ${data.hasAttack ? `
    <button class="jj-btn jj-attack-btn" data-action="jj-attack">
      <i class="fas fa-dice-d20"></i> Acerto
    </button>` : `<div></div>`}
    ${data.hasDamage ? `
    <button class="jj-btn jj-damage-btn" data-action="jj-damage">
      <i class="fas fa-burst"></i> Dano
    </button>` : `<div></div>`}
  </div>

  <div class="jj-panels">
    <div class="jj-panel" id="jj-atk-panel">
      <div class="jj-panel-label">Acerto</div>
      <div class="jj-panel-val" id="jj-atk-val">—</div>
      <div class="jj-panel-breakdown" id="jj-atk-break"></div>
    </div>
    <div class="jj-panel" id="jj-dmg-panel">
      <div class="jj-panel-label">Dano</div>
      <div class="jj-panel-val dmg" id="jj-dmg-val">—</div>
      <div class="jj-panel-breakdown" id="jj-dmg-break"></div>
    </div>
  </div>

  <div class="jj-footer" id="jj-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico — rola dados novamente"><input type="checkbox" data-mod="crit"> Crit</label>
      <label class="jj-mod-check jj-kokusen" title="Fulgor Negro ×2,5"><input type="checkbox" data-mod="kokusen"> K <i class="fas fa-bolt"></i></label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-total-display">0</strong></span>
    <button class="jj-apply-btn" data-action="jj-apply-damage">Aplicar</button>
  </div>

</div>`;
  }

  // ── LISTENERS DO CHAT ────────────────────────────────────────────────────────
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jujutsu-card:not(.jj-extra-card)");
    if ( !card ) return;

    const cardUserId = card.dataset.userId ?? "";
    const isAuthor = cardUserId === game.user.id;

    const atkBtn = card.querySelector("[data-action='jj-attack']");
    const dmgBtn = card.querySelector("[data-action='jj-damage']");

    if ( !isAuthor ) {
      if ( atkBtn ) { atkBtn.style.display = "none"; atkBtn.disabled = true; }
      if ( dmgBtn ) { dmgBtn.style.display = "none"; dmgBtn.disabled = true; }
    }

    atkBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleAttackRoll(card, message);
    });

    dmgBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleDamageRoll(card, message);
    });

    card.querySelector("[data-action='jj-apply-damage']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const activeMod = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const final = _applyModifier(base, activeMod);
      _applyDamageToSelected(final, card);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", async () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-total-display");
        if ( !el ) return;

        if ( mod === "crit" ) {
          // Crítico: rola dados extras se ainda não foram rolados
          if ( !card.dataset.critBonus ) {
            const critBonus = await _rollCritDice(card);
            card.dataset.critBonus = critBonus;
            const dmgBreak = card.querySelector("#jj-dmg-break");
            if ( dmgBreak && critBonus > 0 ) {
              dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020">+${critBonus} crit</span>`;
            }
          }
          const critBonus = Number(card.dataset.critBonus ?? 0);
          el.textContent = _applyModifier(base, "crit", critBonus);
        } else if ( mod === "kokusen" ) {
          // Black Flash: NÃO rola dados, apenas multiplica o base por 2,5
          card.dataset.critBonus = "";
          el.textContent = _applyModifier(base, "kokusen", 0);
        } else {
          card.dataset.critBonus = "";
          el.textContent = _applyModifier(base, mod);
        }
      });
    });

    // Toggles de vantagem/desvantagem — mutuamente exclusivos
    card.querySelectorAll(".jj-adv-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const adv = btn.dataset.adv;
        const active = btn.classList.contains("active");
        card.querySelectorAll(".jj-adv-btn").forEach(b => b.classList.remove("active"));
        if ( !active ) {
          btn.classList.add("active");
          card.dataset.rollMode = adv;
        } else {
          card.dataset.rollMode = "normal";
        }
      });
    });
  });

  // ── ROLAR ATAQUE ─────────────────────────────────────────────────────────────
  async function _handleAttackRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity ) return;

    // Dialog de PA — escolha feita ANTES do ataque, dados adicionados ao DANO depois
    const paGastos = await _paDialog(actor, profBonus, paBonus);
    if ( paGastos === null ) return; // cancelado

    // Consumir PA imediatamente
    if ( paGastos > 0 ) {
      const ok = await _consumePA(actor, paGastos);
      if ( !ok ) return;
    }

    // Guardar PA gastos no card para usar automaticamente no dano
    card.dataset.paGastos = paGastos;

    // Montar fórmula de acerto usando labels.toHit (já inclui FOR + Prof + bônus)
    const toHitStr  = item.labels?.toHit ?? "+0";
    const rollMode  = card.dataset.rollMode ?? "normal";
    let formula;
    if ( rollMode === "advantage" )    formula = `2d20kh1 ${toHitStr}`;
    else if ( rollMode === "disadvantage" ) formula = `2d20kl1 ${toHitStr}`;
    else                               formula = `1d20 ${toHitStr}`;

    const roll = await new Roll(formula, actor.getRollData()).evaluate();
    // Mostrar resultado IMEDIATAMENTE, animar dados em paralelo
    if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
    const isCrit = roll.total >= (activity.attack?.critical?.threshold ?? 20);

    const isNat20 = roll.dice[0]?.results[0]?.result === 20;
    const isNat1  = roll.dice[0]?.results[0]?.result === 1;

    // Renderizar no painel de acerto (Layout B)
    const atkPanel = card.querySelector("#jj-atk-panel");
    const atkVal   = card.querySelector("#jj-atk-val");
    const atkBreak = card.querySelector("#jj-atk-break");

    if ( atkPanel ) {
      atkPanel.classList.add("visible");
      atkVal.textContent = roll.total;
      atkVal.className = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
      const modeLabel = rollMode === "advantage" ? '<span class="jj-pa-badge" style="color:#50a050;border-color:#306030">Vantagem</span>' 
                      : rollMode === "disadvantage" ? '<span class="jj-pa-badge" style="color:#a05050;border-color:#603030">Desvantagem</span>'
                      : "";
      atkBreak.innerHTML = _buildBreakdown(roll) + modeLabel;
      if ( paGastos > 0 ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge">⚡ +${paGastos}d${paBonus} no dano</span>`;
      }
    }

    // Ativar o painel de dano (para mostrar o botão)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    if ( dmgPanel ) dmgPanel.classList.add("visible");

    // Desabilitar botão de acerto após rolar
    const atkBtn = card.querySelector(".jj-attack-btn");
    if ( atkBtn ) { atkBtn.disabled = true; atkBtn.style.opacity = "0.4"; atkBtn.style.cursor = "default"; }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── ROLAR DANO ───────────────────────────────────────────────────────────────
  async function _handleDamageRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity ) return;

    // PA já gastos no ataque (se houver)
    // PA já foi escolhido e consumido no Rolar Ataque — usa direto
    const paGastos = Number(card.dataset.paGastos ?? 0);

    // Usar labels.damages que já tem fórmula e tipo de dano calculados
    const damageParts  = activity.damage?.parts ?? [];
    const damageLabels = item.labels?.damages ?? [];
    const rollData     = actor.getRollData();
    const isSpell      = card.dataset.isSpell === "true";
    const resultsEl    = card.querySelector(".jj-damage-results");

    const rolls = [];
    // Avaliar todos os rolls de dano em paralelo
    const rollPromises = damageParts.map(async (part, i) => {
      const lbl     = damageLabels[i];
      const formula = lbl?.formula ?? _buildDamageFormula(part, actor);
      const label   = lbl?.label ?? _damageTypeLabel(part.types);
      const roll    = await new Roll(formula, rollData).evaluate();
      return { roll, part, label };
    });

    // PA bônus em paralelo com os demais
    let paRollPromise = null;
    if ( paGastos > 0 ) {
      const paDenomination = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      paRollPromise = new Roll(`${paGastos}d${paDenomination}`, rollData).evaluate();
    }

    const resolvedRolls = await Promise.all(rollPromises);
    rolls.push(...resolvedRolls);
    let paRoll = paRollPromise ? await paRollPromise : null;

    // Animar todos os dados simultaneamente (sem await — resultado já está calculado)
    if ( game.dice3d ) {
      const allRolls = [...resolvedRolls.map(r => r.roll), ...(paRoll ? [paRoll] : [])];
      Promise.all(allRolls.map(r => game.dice3d.showForRoll(r, game.user, true)));
    }

    // Total geral de dano
    const totalBase = rolls.reduce((sum, { roll }) => sum + roll.total, 0);
    const totalPA   = paRoll?.total ?? 0;
    const totalDmg  = totalBase + totalPA;
    card.dataset.totalDmg = totalDmg;

    // Guardar fórmula de dados puros para o crítico (apenas dados, sem modificadores fixos)
    // Ex: "1d10" para rolar novamente sem o +4 do modificador
    const critParts = damageParts.map(p => {
      const n = p.number ?? 1;
      const d = p.denomination ?? 6;
      return `${n}d${d}`;
    });
    if ( paGastos > 0 ) {
      const paDen = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      critParts.push(`${paGastos}d${paDen}`);
    }
    card.dataset.critFormula = critParts.join(" + ");

    // Label do tipo de dano (todos juntos ou primeiro)
    const dmgLabel = rolls.map(r => r.label).join(" + ");

    // Renderizar no painel de dano (Layout B)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    const dmgVal   = card.querySelector("#jj-dmg-val");
    const dmgBreak = card.querySelector("#jj-dmg-break");

    if ( dmgPanel ) {
      dmgPanel.classList.add("visible");
      dmgPanel.querySelector(".jj-panel-label").textContent = dmgLabel || "Dano";
      dmgVal.textContent = totalDmg;
      dmgBreak.innerHTML = rolls.map(({ roll }) => _buildBreakdown(roll)).join('<span class="jj-mod-pip"> + </span>');
      if ( paRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(paRoll)}<span class="jj-pa-badge">PA</span>`;
      }
    }

    // Mostrar footer com modificadores
    const footer = card.querySelector("#jj-footer");
    if ( footer ) {
      footer.classList.add("visible");
      const totalEl = footer.querySelector("#jj-total-display");
      if ( totalEl ) totalEl.textContent = totalDmg;
    }

    // Desabilitar botão de dano após rolar
    const dmgBtn = card.querySelector(".jj-damage-btn");
    if ( dmgBtn ) { dmgBtn.disabled = true; dmgBtn.style.opacity = "0.4"; dmgBtn.style.cursor = "default"; }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── DIALOG DE PA ─────────────────────────────────────────────────────────────
  async function _paDialog(actor, profBonus, denomination) {
    const paDisp = actor.system?.energy?.generated ?? 0;
    const maxPA  = Math.min(profBonus * 2, paDisp);

    if ( maxPA === 0 ) return 0; // sem PA disponível, não pergunta

    return foundry.applications.api.DialogV2.wait({
      window: { title: "⚡ Explosão Ofensiva" },
      content: `
        <div style="padding: 8px 0;">
          <p style="margin:0 0 8px">Gastar PA para adicionar dados de dano?</p>
          <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
            PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
            Máximo: <strong>${maxPA}</strong> d${denomination}
          </p>
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <label style="flex:0 0 auto">Dados de PA:</label>
            <input type="number" id="jj-pa-input"
                   value="0" min="0" max="${maxPA}"
                   style="width:60px; text-align:center;">
            <span style="font-size:12px; color:#aaa;">d${denomination} por dado</span>
          </div>
        </div>`,
      buttons: [
        {
          label:    "Confirmar",
          action:   "ok",
          default:  true,
          callback: (event, button, dialog) => {
            const input = dialog.element?.querySelector("#jj-pa-input") ?? document.querySelector("#jj-pa-input");
            return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
          }
        },
        {
          label:  "Sem PA",
          action: "skip",
          callback: () => 0
        },
        {
          label:  "Cancelar",
          action: "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
  }

  // ── CONSUMIR PA GERADA ───────────────────────────────────────────────────────
  async function _consumePA(actor, quantidade) {
    const atual = actor.system?.energy?.generated ?? 0;
    if ( atual < quantidade ) {
      ui.notifications.warn(`${actor.name} não tem PA Gerada suficiente! (${atual} disponível, ${quantidade} necessário)`);
      return false;
    }
    await actor.update({ "system.energy.generated": atual - quantidade }, { isEnergySystem: true });
    return true;
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  function _resolveCardData(card) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const profBonus  = Number(card.dataset.profBonus ?? 2);
    const paBonus    = Number(card.dataset.paBonus ?? 4);

    let actor = tokenId
      ? canvas.tokens.get(tokenId)?.actor
      : game.actors.get(actorId);

    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);

    return { actor, item, activity, profBonus, paBonus };
  }

  function _buildDamageFormula(part, actor) {
    const num  = part.number ?? 1;
    const den  = part.denomination ?? 6;
    const bon  = part.bonus ?? "";
    const mod  = actor ? _resolveAbilityMod(part, actor) : 0;
    let formula = `${num}d${den}`;
    if ( bon ) formula += ` + ${bon}`;
    if ( mod ) formula += ` + ${mod}`;
    return formula;
  }

  function _resolveAbilityMod(part, actor) {
    // Por padrão usa o mod da habilidade de ataque do ator
    const ability = actor.system?.attributes?.spellcasting
      ?? Object.keys(actor.system?.abilities ?? {})[0]
      ?? "str";
    return actor.system?.abilities?.[ability]?.mod ?? 0;
  }

  function _damageTypeLabel(types) {
    if ( !types?.length ) return "Dano";
    const labels = {
      bludgeoning: "Contundente", piercing: "Perfurante", slashing: "Cortante",
      fire: "Fogo", cold: "Frio", lightning: "Raio", acid: "Ácido",
      poison: "Veneno", necrotic: "Necrótico", radiant: "Radiante",
      thunder: "Trovão", force: "Força", psychic: "Psíquico"
    };
    return types.map(t => labels[t] ?? t).join(" + ");
  }

function _buildBreakdown(roll) {
    return roll.terms.map(term => {
      if ( term.results ) {
        // Vantagem/desvantagem: múltiplos dados, um descartado
        if ( term.results.length > 1 ) {
          const parts = term.results.map(r => {
            const active = !r.discarded;
            const cls = active
              ? (r.result === term.faces ? "jj-die max" : r.result === 1 ? "jj-die min" : "jj-die active")
              : "jj-die discarded";
            return `<span class="${cls}">${r.result}</span>`;
          });
          return parts.join('<span class="jj-mod-pip"> | </span>');
        }
        // Dado único normal
        return term.results.map(r => {
          const cls = r.result === term.faces ? "jj-die max" : r.result === 1 ? "jj-die min" : "jj-die";
          return `<span class="${cls}">${r.result}</span>`;
        }).join("");
      }
      if ( typeof term.number === "number" && term.number !== 0 ) {
        return `<span class="jj-mod-pip">${term.number > 0 ? "+" : ""}${term.number}</span>`;
      }
      return "";
    }).join("");
  }

  async function _updateCardMessage(message, cardHTML) {
    await message.update({ content: cardHTML });
  }

  // ── MODIFICADOR DE DANO ──────────────────────────────────────────────────────
  // Nota: "crit" é tratado separadamente em _handleCritRoll (rola dados extras)
  // Os demais modificam o total base diretamente
  function _applyModifier(base, mod, critBonus = 0) {
    switch ( mod ) {
      case "half":    return Math.floor(base / 2);
      case "quarter": return Math.floor(base / 4);
      case "crit":    return base + critBonus; // base + dados extras rolados
      case "kokusen": return Math.ceil((base + critBonus) * 2.5); // ×2,5 no total
      default:        return base;
    }
  }

  // ── ROLAR DADOS EXTRAS DE CRÍTICO ────────────────────────────────────────────
  async function _rollCritDice(card) {
    // Pegar a fórmula dos dados usados no dano (sem modificadores fixos)
    // Guardamos a fórmula de dados pura quando rolamos o dano
    const critFormula = card.dataset.critFormula;
    if ( !critFormula ) return 0;
    try {
      const roll = await new Roll(critFormula).evaluate();
      if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
      return roll.total;
    } catch(e) {
      console.error("JujutsuLegacy | Erro ao rolar crítico:", e);
      return 0;
    }
  }

  // ── APLICAR DANO NOS TOKENS SELECIONADOS ────────────────────────────────────
  async function _applyDamageToSelected(amount, card) {
    const tokens = canvas.tokens?.controlled ?? [];
    if ( !tokens.length ) {
      ui.notifications.warn("Selecione um ou mais tokens no canvas antes de aplicar o dano.");
      return;
    }

    for ( const token of tokens ) {
      const actor = token.actor;
      if ( !actor ) continue;
      const hp = actor.system?.attributes?.hp;
      if ( hp === undefined ) continue;

      let restante = amount;

      // 0. Verificar Explosão Defensiva pendente
const expDefFlag = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente") ?? null;
const expDefPendente = expDefFlag?.reducao ?? 0;
if ( expDefPendente > 0 ) {
  const reducao = Math.min(expDefPendente, restante);
        restante = Math.max(0, restante - reducao);
        await actor.unsetFlag("jujutsu-system", "explosaoDefensivaPendente");
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🛡️ <strong>${actor.name}</strong> reduziu <strong>${reducao}</strong> de dano com Explosão Defensiva!`
        });
      }

      // 1. Consumir PV temporário primeiro
      const tempAtual = hp.temp ?? 0;
      if ( tempAtual > 0 ) {
        const consumido = Math.min(tempAtual, restante);
        restante -= consumido;
        await actor.update({ "system.attributes.hp.temp": tempAtual - consumido });
      }

      // 2. Aplicar restante nos PV normais
      if ( restante > 0 ) {
        const novoHP = Math.max(0, (hp.value ?? 0) - restante);
        await actor.update({ "system.attributes.hp.value": novoHP });
      }
    }

    const nomes = tokens.map(t => t.name).join(", ");
    ui.notifications.info(`${amount} de dano aplicado em: ${nomes}`);

    // Feedback visual no botão
    const btn = card.querySelector("[data-action='jj-apply-damage']");
    if ( btn ) {
      btn.textContent = `✓ ${amount} aplicado`;
      btn.disabled = true;
      btn.style.opacity = "0.6";
    }
  }

  console.log("JujutsuLegacy | Chat card customizado registrado ✓");
})();

/* ============================================================
 * CARDS CUSTOMIZADOS — Dano, Cura, Salvaguarda, Teste, Usar
 * ============================================================ */
(function _registerJujutsuExtraCards() {

  const CARD_TYPES = new Set(["damage", "heal", "save", "check", "utility"]);

  // ── HOOK PRINCIPAL ───────────────────────────────────────────────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;
    if ( !CARD_TYPES.has(activity.type) ) return;
    _postExtraCard(activity, item);
    return false;
  });

  // ── CRIAR CARD ───────────────────────────────────────────────────────────────
  async function _postExtraCard(activity, item) {
    const actor = item.actor;
    const type  = activity.type;

    // Consumir PA configurado
    if ( actor ) {
      const targets = activity.consumption?.targets ?? [];

      // Redução de PA do Seis Olhos
      const seisOlhosItem = actor.items?.find(i => i.name === "Seis Olhos" && i.type === "feat");
      const seisOlhosMode = actor.getFlag("jujutsu-system", "seisOlhosMode");
      let paReduction = 0;
      if ( seisOlhosItem && seisOlhosMode ) {
        const prof    = actor.system.attributes?.prof ?? 2;
        const halfProf = Math.max(1, Math.floor(prof / 2));
        paReduction = seisOlhosMode === "full" ? prof : halfProf;
      }

      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custoBase = Number(target.value ?? 0);
        if ( custoBase <= 0 ) continue;
        const custo = Math.max(1, custoBase - paReduction);
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada ? (actor.system?.energy?.generated ?? 0) : (actor.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${actor.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return;
        }
        await actor.update({ [campo]: atual - custo }, { isEnergySystem: true });
      }
    }

    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";
    const typeConfig = _getTypeConfig(activity, item, actor);

    const cardData = {
      itemId:      item.id,
      actorId:     actor?.id ?? null,
      tokenId:     actor?.token?.id ?? null,
      activityId:  activity.id,
      itemName:    item.name,
      itemImg:     item.img,
      type,
      typeLabel:   typeConfig.typeLabel,
      hasDescription,
      description: hasDescription ? description : "",
      btnLabel:    typeConfig.btnLabel,
      btnIcon:     typeConfig.btnIcon,
      btnColor:    typeConfig.btnColor,
      hasApply:    type === "damage",
    };

    const content = _renderExtraCardHTML(cardData);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      flags: { "jujutsu-system": { jujutsuExtraCard: true, cardData } }
    });
  }

  // ── CONFIG POR TIPO ──────────────────────────────────────────────────────────
  function _getTypeConfig(activity, item, actor) {
    const type = activity.type;
    if ( type === "damage" ) {
      return { typeLabel: "Dano", btnLabel: "Rolar Dano", btnIcon: "fa-burst", btnColor: "#c06040" };
    } else if ( type === "heal" ) {
      return { typeLabel: "Cura", btnLabel: "Rolar Cura", btnIcon: "fa-heart", btnColor: "#40a060" };
    } else if ( type === "save" ) {
      const dc = activity.save?.dc?.value ?? activity.save?.dc ?? "?";
      return { typeLabel: "Salvaguarda", btnLabel: `Salv. CD ${dc}`, btnIcon: "fa-shield-halved", btnColor: "#6040c0" };
    } else if ( type === "check" ) {
      return { typeLabel: "Teste", btnLabel: "Rolar Teste", btnIcon: "fa-dice-d20", btnColor: "#4080c0" };
    } else if ( type === "utility" ) {
      return { typeLabel: "Usar", btnLabel: "Usar", btnIcon: "fa-wand-sparkles", btnColor: "#8060a0" };
    }
    return { typeLabel: "Ação", btnLabel: "Rolar", btnIcon: "fa-dice-d20", btnColor: "#8080a0" };
  }

  // ── HTML DO CARD ─────────────────────────────────────────────────────────────
  function _renderExtraCardHTML(data) {
    const footerHTML = data.hasApply ? `
  <div class="jj-footer" id="jj-extra-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico"><input type="checkbox" data-mod="crit"> Crit</label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-extra-total">0</strong></span>
    <button type="button" class="jj-apply-btn" data-action="jj-extra-apply">Aplicar</button>
  </div>` : "";

    return `<div class="jujutsu-card jj-extra-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-card-type="${data.type}">
  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.typeLabel}</span>
  </div>
  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}
  <div class="jj-roll-btns" style="grid-template-columns: 1fr;">
    <button type="button" class="jj-btn jj-extra-btn" data-action="jj-extra-roll"
            style="background: color-mix(in srgb, ${data.btnColor} 20%, #0e0e18); color: ${data.btnColor};">
      <i class="fas ${data.btnIcon}"></i> ${data.btnLabel}
    </button>
  </div>
  <div class="jj-panels" style="grid-template-columns: 1fr;">
    <div class="jj-panel" id="jj-extra-panel">
      <div class="jj-panel-label" id="jj-extra-label">${data.typeLabel}</div>
      <div class="jj-panel-val ${data.type === "heal" ? "jj-heal-val" : data.type === "damage" ? "dmg" : ""}" id="jj-extra-val">—</div>
      <div class="jj-panel-breakdown" id="jj-extra-break"></div>
    </div>
  </div>
  ${footerHTML}
</div>`;
  }

  // ── LISTENERS ────────────────────────────────────────────────────────────────
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jj-extra-card");
    if ( !card ) return;

    card.querySelector("[data-action='jj-extra-roll']")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await _handleExtraRoll(card, message);
    });

    card.querySelector("[data-action='jj-extra-apply']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const mod  = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const final = _applyMod(base, mod);
      _applyDmg(final, card);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-extra-total");
        if ( el ) el.textContent = _applyMod(base, mod);
      });
    });
  });

  // ── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
  async function _handleExtraRoll(card, message) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const type       = card.dataset.cardType;

    const actor    = tokenId ? canvas.tokens.get(tokenId)?.actor : game.actors.get(actorId);
    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);
    if ( !actor || !item ) return;

    const rollData = actor.getRollData();
    const panel    = card.querySelector("#jj-extra-panel");
    const valEl    = card.querySelector("#jj-extra-val");
    const breakEl  = card.querySelector("#jj-extra-break");
    const labelEl  = card.querySelector("#jj-extra-label");

    if ( type === "damage" || type === "heal" ) {
      const damageParts  = activity?.damage?.parts ?? [];
      const damageLabels = item.labels?.damages ?? [];

      // Para heal sem damage.parts, tenta activity.healing
      if ( damageParts.length === 0 ) {
        const healFormula = activity?.healing?.formula ?? "1d6";
        const roll = await new Roll(healFormula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const total = roll.total;
        card.dataset.totalDmg = total;
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Cura";
        if ( valEl ) { valEl.textContent = total; valEl.className = "jj-panel-val jj-heal-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);
        _showHealFooter(card, total);
        return;
      }

      const rollPromises = damageParts.map(async (part, i) => {
        const lbl     = damageLabels[i];
        const formula = lbl?.formula ?? _buildDmgFormula(part, actor);
        const label   = lbl?.label ?? (type === "heal" ? "Cura" : "Dano");
        const roll    = await new Roll(formula, rollData).evaluate();
        return { roll, label };
      });

      const resolved = await Promise.all(rollPromises);
      if ( game.dice3d ) Promise.all(resolved.map(r => game.dice3d.showForRoll(r.roll, game.user, true)));

      const total = resolved.reduce((s, r) => s + r.roll.total, 0);
      card.dataset.totalDmg = total;
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = resolved.map(r => r.label).join(" + ") || (type === "heal" ? "Cura" : "Dano");
      if ( valEl ) { valEl.textContent = total; valEl.className = `jj-panel-val ${type === "heal" ? "jj-heal-val" : "dmg"}`; }
      if ( breakEl ) breakEl.innerHTML = resolved.map(r => _buildBreakdown(r.roll)).join('<span class="jj-mod-pip"> + </span>');

      if ( type === "damage" ) {
        const footer = card.querySelector("#jj-extra-footer");
        if ( footer ) {
          footer.classList.add("visible");
          const totalEl = footer.querySelector("#jj-extra-total");
          if ( totalEl ) totalEl.textContent = total;
        }
      } else {
        _showHealFooter(card, total);
      }

    } else if ( type === "save" ) {
      // No V14, activity.save.ability é um Set — usar .first()
      const abilitySet   = activity?.save?.ability;
      const ability      = (abilitySet instanceof Set ? abilitySet.first() : null)
                        ?? (typeof abilitySet === "string" ? abilitySet : null)
                        ?? "con";
      const dc           = activity?.save?.dc?.value ?? activity?.save?.dc ?? "?";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const targetToken  = [...(game.user.targets ?? [])][0] ?? canvas.tokens?.controlled?.[0];
      const targetActor  = targetToken?.actor;

      if ( targetActor ) {
        const saveMod = targetActor.system?.abilities?.[ability]?.save?.value
                     ?? targetActor.system?.abilities?.[ability]?.mod
                     ?? 0;
        const roll = await new Roll(`1d20 + ${Number(saveMod)}`, targetActor.getRollData()).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const isNat20 = roll.dice[0]?.results[0]?.result === 20;
        const isNat1  = roll.dice[0]?.results[0]?.result === 1;
        const success  = roll.total >= Number(dc);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel} (${targetActor.name})`;
        if ( valEl ) {
          valEl.textContent = roll.total;
          valEl.className   = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
          valEl.style.color = success ? "#60c080" : "#e05050";
        }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll)
          + `<span class="jj-mod-pip"> vs CD ${dc} — ${success ? "✓ Sucesso" : "✗ Falha"}</span>`;

        // Se tiver dano, injetar botão de rolar dano
        const damageParts = activity?.damage?.parts ?? [];
        if ( damageParts.length && !card.querySelector("[data-action='jj-save-damage']") ) {
          const dmgFooter = document.createElement("div");
          dmgFooter.className = "jj-footer visible";
          dmgFooter.innerHTML = `
            <span class="jj-footer-total" style="color:#c06040">Dano da Salvaguarda</span>
            <button type="button" class="jj-apply-btn" data-action="jj-save-damage"
                    style="background:#2a1010;border-color:#804020;color:#c06040">
              <i class="fas fa-burst"></i> Rolar Dano
            </button>`;
          dmgFooter.querySelector("[data-action='jj-save-damage']").addEventListener("click", async () => {
            const dmgLabels = item.labels?.damages ?? [];
            const dmgRolls  = await Promise.all(damageParts.map(async (part, i) => {
              const lbl     = dmgLabels[i];
              const formula = lbl?.formula ?? _buildDmgFormula(part, actor);
              const label   = lbl?.label ?? "Dano";
              const r       = await new Roll(formula, rollData).evaluate();
              return { r, label };
            }));
            if ( game.dice3d ) Promise.all(dmgRolls.map(({ r }) => game.dice3d.showForRoll(r, game.user, true)));
            const totalDmg = dmgRolls.reduce((s, { r }) => s + r.total, 0);

            const dmgPanel = document.createElement("div");
            dmgPanel.className = "jj-panels";
            dmgPanel.style.cssText = "margin-top:6px;grid-template-columns:1fr;";
            dmgPanel.innerHTML = `
              <div class="jj-panel visible">
                <div class="jj-panel-label">Dano</div>
                <div class="jj-panel-val dmg">${totalDmg}</div>
                <div class="jj-panel-breakdown">${dmgRolls.map(({ r }) => _buildBreakdown(r)).join('<span class="jj-mod-pip"> + </span>')}</div>
              </div>`;
            card.appendChild(dmgPanel);

            const applyFooter = document.createElement("div");
            applyFooter.className = "jj-footer visible";
            applyFooter.innerHTML = `
              <div class="jj-mods">
                <label class="jj-mod-check" title="Metade"><input type="checkbox" data-save-mod="half"> ½</label>
                <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-save-mod="quarter"> ¼</label>
              </div>
              <span class="jj-footer-total">Total <strong id="jj-save-total">${totalDmg}</strong></span>
              <button type="button" class="jj-apply-btn" data-action="jj-apply-save-dmg">Aplicar</button>`;
            applyFooter.querySelectorAll("[data-save-mod]").forEach(cb => {
              cb.addEventListener("change", () => {
                applyFooter.querySelectorAll("[data-save-mod]").forEach(o => { if (o !== cb) o.checked = false; });
                const el = applyFooter.querySelector("#jj-save-total");
                if ( el ) el.textContent = _applyMod(totalDmg, cb.checked ? cb.dataset.saveMod : null);
              });
            });
            applyFooter.querySelector("[data-action='jj-apply-save-dmg']").addEventListener("click", () => {
              const mod   = applyFooter.querySelector("[data-save-mod]:checked")?.dataset.saveMod ?? null;
              _applyDmg(_applyMod(totalDmg, mod), card);
            });
            card.appendChild(applyFooter);
            dmgFooter.remove();
          });
          card.appendChild(dmgFooter);
        }
      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel}`;
        if ( valEl ) { valEl.textContent = `CD ${dc}`; valEl.className = "jj-panel-val"; valEl.style.fontSize = "28px"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">CD ${dc} — selecione um alvo para rolar</span>`;
      }

    } else if ( type === "check" ) {
      const ability      = activity?.check?.associated?.[0] ?? "int";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const mod          = actor.system?.abilities?.[ability]?.mod ?? 0;
      const roll         = await new Roll(`1d20 + ${mod}`, rollData).evaluate();
      game.dice3d?.showForRoll(roll, game.user, true);
      const isNat20 = roll.dice[0]?.results[0]?.result === 20;
      const isNat1  = roll.dice[0]?.results[0]?.result === 1;
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = `Teste de ${abilityLabel}`;
      if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : ""); }
      if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);

    } else if ( type === "utility" ) {
      const formula = activity?.roll?.formula ?? activity?.rolls?.[0]?.formula ?? null;
      if ( formula ) {
        const roll = await new Roll(formula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = item.name;
        if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);
      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Usado!";
        if ( valEl ) { valEl.textContent = "✓"; valEl.className = "jj-panel-val"; valEl.style.color = "#60c080"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">${item.name} ativado</span>`;
      }
    }
  }

  // ── HELPER: botão de aplicar cura ────────────────────────────────────────────
  function _showHealFooter(card, total) {
    if ( card.querySelector("[data-action='jj-apply-heal']") ) return;
    const healFooter = document.createElement("div");
    healFooter.className = "jj-footer visible";
    healFooter.style.cssText = "border-top-color: #30a030;";
    healFooter.innerHTML = `
      <span class="jj-footer-total" style="color:#60c080">Cura <strong>${total}</strong></span>
      <button type="button" class="jj-apply-btn" data-action="jj-apply-heal"
              style="background:#1a3a1a;border-color:#30a030;color:#60c080">Aplicar Cura</button>`;
    healFooter.querySelector("[data-action='jj-apply-heal']").addEventListener("click", async () => {
      const targets = [...(game.user.targets ?? [])];
      const tokens  = targets.length ? targets : (canvas.tokens?.controlled ?? []);
      if ( !tokens.length ) { ui.notifications.warn("Selecione um token para aplicar a cura."); return; }
      for ( const token of tokens ) {
        const a  = token.actor ?? token;
        const hp = a?.system?.attributes?.hp;
        if ( !hp ) continue;
        const novoHP = Math.min(hp.effectiveMax ?? hp.max, (hp.value ?? 0) + total);
        await a.update({ "system.attributes.hp.value": novoHP });
      }
      ui.notifications.info(`${total} de cura aplicada!`);
      const btn = healFooter.querySelector("[data-action='jj-apply-heal']");
      if ( btn ) { btn.textContent = `✓ ${total} curado`; btn.disabled = true; btn.style.opacity = "0.6"; }
    });
    card.appendChild(healFooter);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function _buildDmgFormula(part, actor) {
    const num     = part.number ?? 1;
    const den     = part.denomination ?? 6;
    const bon     = part.bonus ?? "";
    const ability = actor.system?.attributes?.spellcasting ?? "str";
    const mod     = actor.system?.abilities?.[ability]?.mod ?? 0;
    let f = `${num}d${den}`;
    if ( bon ) f += ` + ${bon}`;
    if ( mod ) f += ` + ${mod}`;
    return f;
  }

  function _buildBreakdown(roll) {
    return roll.terms.map(term => {
      if ( term.results ) {
        if ( term.results.length > 1 ) {
          return term.results.map(r => {
            const cls = !r.discarded
              ? (r.result === term.faces ? "jj-die max" : r.result === 1 ? "jj-die min" : "jj-die active")
              : "jj-die discarded";
            return `<span class="${cls}">${r.result}</span>`;
          }).join('<span class="jj-mod-pip"> | </span>');
        }
        return term.results.map(r => {
          const cls = r.result === term.faces ? "jj-die max" : r.result === 1 ? "jj-die min" : "jj-die";
          return `<span class="${cls}">${r.result}</span>`;
        }).join("");
      }
      if ( typeof term.number === "number" && term.number !== 0 ) {
        return `<span class="jj-mod-pip">${term.number > 0 ? "+" : ""}${term.number}</span>`;
      }
      return "";
    }).join("");
  }

  function _applyMod(base, mod) {
    if ( mod === "half" )    return Math.floor(base / 2);
    if ( mod === "quarter" ) return Math.floor(base / 4);
    if ( mod === "crit" )    return base * 2;
    return base;
  }

  async function _applyDmg(amount, card) {
    const tokens = canvas.tokens?.controlled ?? [];
    if ( !tokens.length ) { ui.notifications.warn("Selecione um ou mais tokens no canvas."); return; }
    for ( const token of tokens ) {
      const a  = token.actor;
      if ( !a ) continue;
      const hp = a.system?.attributes?.hp;
      if ( !hp ) continue;
      await a.update({ "system.attributes.hp.value": Math.max(0, (hp.value ?? 0) - amount) });
    }
    ui.notifications.info(`${amount} de dano aplicado em: ${tokens.map(t => t.name).join(", ")}`);
    const btn = card.querySelector("[data-action='jj-extra-apply']");
    if ( btn ) { btn.textContent = `✓ ${amount} aplicado`; btn.disabled = true; btn.style.opacity = "0.6"; }
  }

  console.log("JujutsuLegacy | Cards extras registrados ✓");
})();

(function _registerCursedEnergyConsumption() {
  const PATH_GERADA = "energy.generated";
  const PATH_TOTAL  = "energy.total";
  function _addPaths() {
    const res = CONFIG.DND5E?.consumableResources;
    if ( !Array.isArray(res) ) return;
    for ( const path of [PATH_GERADA, PATH_TOTAL] ) {
      if ( !res.includes(path) ) res.push(path);
    }
    const attrType = CONFIG.DND5E?.activityConsumptionTypes?.attribute;
    if ( attrType ) {
      attrType.scalingModes ??= [];
      if ( !attrType.scalingModes.some(m => m.value === "pa") ) {
        attrType.scalingModes.push({ value: "pa", label: "PA Extra (+1 por step)" });
      }
    }
  }
  Hooks.on("setup", _addPaths);
  Hooks.once("ready", _addPaths);
  function _injectLabels(app, html) {
    const name = app.constructor?.name ?? "";
    if ( !name.toLowerCase().includes("activity") ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if ( !root ) return;
    root.querySelectorAll("option").forEach(opt => {
      if ( opt.value === PATH_GERADA ) opt.textContent = "⚡ Energia Gerada (PA)";
      if ( opt.value === PATH_TOTAL  ) opt.textContent = "🔮 Energia Total (PA)";
    });
  }
  Hooks.on("renderApplication",   _injectLabels);
  Hooks.on("renderDocumentSheet", _injectLabels);
  Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
    const actor = activity.item?.actor ?? activity.actor;
    if ( !actor ) return;
    // Não bloqueamos mais aqui — o chat card customizado já trata isso
  });
})();

/* ============================================================
 * CONDIÇÕES DO SISTEMA JUJUTSU LEGACY
 * ============================================================ */

const JJ_CONDITIONS = [
  { id: "jj-agarrado",        label: "Agarrado",         icon: "fas fa-hand-grab",         desc: "Deslocamento 0. Encerra se quem agarrou ficar incapacitado ou soltar." },
  { id: "jj-alucinado",       label: "Alucinado",        icon: "fas fa-brain",             desc: "Ataca qualquer criatura próxima indiscriminadamente. ND −2." },
  { id: "jj-amedrontado",     label: "Amedrontado",      icon: "fas fa-person-running",    desc: "Desvantagem em testes e ataques enquanto fonte do medo estiver visível." },
  { id: "jj-apaixonado",      label: "Apaixonado",       icon: "fas fa-heart",             desc: "Não pode atacar quem a apaixonou. Quem apaixonou tem vantagem em testes sociais." },
  { id: "jj-atordoado",       label: "Atordoado",        icon: "fas fa-stars",             desc: "Incapacitado, imóvel, fala hesitante. Falha em For/Agi. Ataques contra têm vantagem." },
  { id: "jj-bebado",          label: "Bêbado",           icon: "fas fa-beer-mug-empty",    desc: "Desvantagem em Salv. e testes de Agilidade. Encerra com Salv. CON ou situação adequada." },
  { id: "jj-caido",           label: "Caído",            icon: "fas fa-person-falling",    desc: "Só pode rastejar. Desvantagem em ataques. Ataques a 1,5m têm vantagem." },
  { id: "jj-cego",            label: "Cego",             icon: "fas fa-eye-slash",         desc: "Falha em testes que requeiram visão. Ataques contra têm vantagem; seus ataques têm desvantagem." },
  { id: "jj-congelado",       label: "Congelado",        icon: "fas fa-snowflake",         desc: "Incapacitado, imóvel. Resistência a todos os danos. Imune a veneno e doenças." },
  { id: "jj-desidratado",     label: "Desidratado",      icon: "fas fa-droplet-slash",     desc: "Deslocamento ÷2. 1 nível de exaustão por hora. Só ação OU ação bônus por turno." },
  { id: "jj-empoderado",      label: "Empoderado",       icon: "fas fa-fist-raised",       desc: "Dano corpo-a-corpo → 1d12. PA de técnicas mal-sucedidas não descontados." },
  { id: "jj-enfeiticado",     label: "Enfeitiçado",      icon: "fas fa-wand-sparkles",     desc: "Não pode atacar quem a enfeitiçou. Quem enfeitiçou tem vantagem em testes sociais." },
  { id: "jj-enfurecido",      label: "Enfurecido",       icon: "fas fa-fire-flame-curved", desc: "Ataca fonte da fúria com desvantagem. Dano corpo-a-corpo +1d4. Dura 1 minuto." },
  { id: "jj-energia-esgotada",label: "Energia Esgotada", icon: "fas fa-battery-empty",     desc: "Não pode usar nenhuma habilidade ou técnica. Também está Letárgica." },
  { id: "jj-estremecido",     label: "Estremecido",      icon: "fas fa-person-trembling",  desc: "Desvantagem em ataques. Não pode usar técnicas com concentração. Deslocamento custa 2×." },
  { id: "jj-exausto",         label: "Exausto",          icon: "fas fa-tired",             desc: "−2 em rolagens d20. −1,5m de deslocamento. Acumulável até 3× por técnicas." },
  { id: "jj-envenenado",      label: "Envenenado",       icon: "fas fa-skull-crossbones",  desc: "Desvantagem em ataques e testes. Após 1 dia, Salv. CON CD 15 para encerrar." },
  { id: "jj-hipotermico",     label: "Hipotérmico",      icon: "fas fa-temperature-low",   desc: "Desvantagem em Salv. Agi, testes e ataques. Encerra com Medicina CD 10 ou Sobrev. CD 17." },
  { id: "jj-impedido",        label: "Impedido",         icon: "fas fa-ban",               desc: "Deslocamento 0. Ataques contra têm vantagem; seus ataques têm desvantagem." },
  { id: "jj-incapacitado",    label: "Incapacitado",     icon: "fas fa-circle-xmark",      desc: "Não pode realizar ações ou reações." },
  { id: "jj-inconsciente",    label: "Inconsciente",     icon: "fas fa-moon",              desc: "Incapacitado, imóvel, sem ciência. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m." },
  { id: "jj-invisivel",       label: "Invisível",        icon: "fas fa-ghost",             desc: "Impossível de ver sem técnicas especiais. Seus ataques têm vantagem; ataques contra têm desvantagem." },
  { id: "jj-letargico",       label: "Letárgico",        icon: "fas fa-person-walking",    desc: "Deslocamento ÷2. Dano de ataques ÷2 (exceto armas de fogo)." },
  { id: "jj-mudo",            label: "Mudo",             icon: "fas fa-volume-xmark",      desc: "Falha em testes que requeiram fala. Não emite sons pela boca." },
  { id: "jj-paralisado",      label: "Paralisado",       icon: "fas fa-person-rays",       desc: "Incapacitado, imóvel. Sem ações bônus. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m." },
  { id: "jj-pesado",          label: "Pesado",           icon: "fas fa-weight-hanging",    desc: "Deslocamento ÷2. Desvantagem em ataques corpo-a-corpo." },
  { id: "jj-petrificado",     label: "Petrificado",      icon: "fas fa-monument",          desc: "Incapacitado, imóvel, peso ×10. Resistência a todos os danos. Imune a veneno/doenças." },
  { id: "jj-queimado",        label: "Queimado",         icon: "fas fa-fire",              desc: "1d6 Fogo irredutível na primeira ação/movimento por turno. Sem técnicas com concentração." },
  { id: "jj-queimadura",      label: "Queimadura",       icon: "fas fa-fire-flame-simple", desc: "Desvantagem em Testes de Concentração. Encerra com Medicina CD 13 ou Sobrev. CD 17." },
  { id: "jj-sangramento",     label: "Sangramento",      icon: "fas fa-droplet",           desc: "1d6 Cortante irredutível na primeira ação/movimento. Acumulável 3×. Encerra com Medicina CD 12." },
  { id: "jj-sonolento",       label: "Sonolento",        icon: "fas fa-bed",               desc: "Sem ações bônus ou reações. Desv. Salv. Agi e Sab. Máx. 1 ataque corpo-a-corpo por turno." },
  { id: "jj-sufocado",        label: "Sufocado",         icon: "fas fa-lungs-virus",       desc: "Desv. Salv. Agi. Após turnos (1+mod.CON), Teste CON CD 10 ou desmaia. CD +2 por turno." },
  { id: "jj-surdo",           label: "Surdo",            icon: "fas fa-ear-deaf",          desc: "Falha em testes que requeiram audição." }
];

/**
 * Injeta a seção de condições Jujutsu na aba Effects.
 * Chamada dentro do _onRender da CharacterActorSheet.
 */
function _injectJJConditions(element, actor) {
  // Só age na aba effects
  const effectsTab = element.querySelector('[data-tab="effects"]');
  if ( !effectsTab ) return;

  // Esconder seção nativa de condições
  const nativeSections = effectsTab.querySelectorAll(".conditions, .conditions-list");
  nativeSections.forEach(el => {
    // Subir até o header + lista
    const section = el.closest("fieldset, section, .flexcol") ?? el;
    section.style.display = "none";
  });

  // Evitar injeção duplicada
  if ( effectsTab.querySelector(".jj-conditions-section") ) {
    // Atualizar estado ativo das condições existentes
    const activeStatuses = new Set(actor.statuses ?? []);
    effectsTab.querySelectorAll(".jj-cond-item").forEach(item => {
      item.classList.toggle("active", activeStatuses.has(item.dataset.condId));
    });
    return;
  }

  const activeStatuses = new Set(actor.statuses ?? []);

  const section = document.createElement("div");
  section.className = "jj-conditions-section";
  section.innerHTML = `
    <div class="jj-cond-header">
      <span>Condições</span>
      <button class="jj-cond-custom-btn" title="Condição customizada">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div class="jj-cond-grid">
      ${JJ_CONDITIONS.map(cond => `
        <div class="jj-cond-item ${activeStatuses.has(cond.id) ? "active" : ""}"
             data-cond-id="${cond.id}"
             data-tooltip="&lt;strong&gt;${cond.label}&lt;/strong&gt;&lt;hr style='margin:4px 0;border-color:#3a3a50'&gt;${cond.desc}"
             data-tooltip-direction="UP">
          <i class="${cond.icon}"></i>
          <span>${cond.label}</span>
        </div>`).join("")}
    </div>`;

  // Listeners de toggle
  section.querySelectorAll(".jj-cond-item").forEach(el => {
    el.addEventListener("click", async () => {
      const condId = el.dataset.condId;
      const isActive = el.classList.contains("active");
      const cond = JJ_CONDITIONS.find(c => c.id === condId);
      if ( !isActive ) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:     cond.label,
          icon:     "icons/svg/aura.svg",
          statuses: [condId],
          flags:    { "jujutsu-system": { isJujutsuCondition: true } }
        }]);
      } else {
        const existing = actor.effects.find(e => e.statuses?.has(condId));
        if ( existing ) await existing.delete();
      }
      // Estado visual atualizado automaticamente pelo re-render
    });
  });

  // Botão condição customizada
  section.querySelector(".jj-cond-custom-btn").addEventListener("click", async () => {
    const name = await foundry.applications.api.DialogV2.wait({
      window: { title: "Condição Customizada" },
      content: `<div style="padding:8px 0">
        <label style="display:block;margin-bottom:6px;font-size:12px;color:#aaa">Nome:</label>
        <input type="text" id="jj-custom-cond" placeholder="Ex: Marcado, Maldito..." style="width:100%">
      </div>`,
      buttons: [
        {
          label:   "Adicionar",
          action:  "ok",
          default: true,
          callback: (event, button, dialog) => (dialog.element?.querySelector("#jj-custom-cond") ?? document.querySelector("#jj-custom-cond"))?.value?.trim() ?? null
        },
        {
          label:    "Cancelar",
          action:   "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
    if ( !name ) return;
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name,
      icon:     "icons/svg/aura.svg",
      statuses: [`jj-custom-${name.toLowerCase().replace(/\s+/g, "-")}`],
      flags:    { "jujutsu-system": { isCustomCondition: true } }
    }]);
    ui.notifications.info(`Condição "${name}" adicionada a ${actor.name}.`);
  });

  effectsTab.appendChild(section);
}

/* ============================================================
 * CAMPO DE CUSTO DE PA NA ABA DE ATIVIDADES
 * Injeta campo de custo (PA Gerada/Total) na listagem de
 * atividades do item sheet. Ao salvar, configura o Consumption
 * da atividade automaticamente — apenas se vazio.
 * ============================================================ */

(function _registerActivityCostField() {

  // Lê o consumption atual de PA de uma atividade
  function _getExistingPaCost(activity) {
    const targets = activity.consumption?.targets ?? [];
    const paTarget = targets.find(t =>
      t.type === "attribute" &&
      (t.target === "energy.generated" || t.target === "energy.total")
    );
    if ( !paTarget ) return { amount: "", pool: "generated" };
    return {
      amount: paTarget.value ?? "",
      pool: paTarget.target === "energy.total" ? "total" : "generated"
    };
  }

  // Injeta os campos de custo em todas as atividades visíveis
  function _injectCostFields(html, item) {
    // Seletor correto: li.item.activity[data-activity-id]
    const rows = html.querySelectorAll("li.activity[data-activity-id], li.item.activity[data-activity-id]");
    if ( !rows.length ) return;

    rows.forEach(row => {
      // Evitar duplicação
      if ( row.querySelector(".jj-pa-cost-field") ) return;

      const activityId = row.dataset.activityId;
      if ( !activityId ) return;

      const activity = item.system.activities?.get(activityId);
      if ( !activity ) return;

      const { amount, pool } = _getExistingPaCost(activity);

      // Criar campo inline
      const wrapper = document.createElement("div");
      wrapper.className = "jj-pa-cost-field";
      wrapper.innerHTML = `
        <input type="number" class="jj-pa-amount" value="${amount}" placeholder="PA" min="0"
               title="Custo em PA" ${amount ? 'disabled' : ''}>
        <select class="jj-pa-pool" ${amount ? 'disabled' : ''}>
          <option value="generated" ${pool === "generated" ? "selected" : ""}>⚡ Gerada</option>
          <option value="total"     ${pool === "total"     ? "selected" : ""}>🔮 Total</option>
        </select>
        ${amount ? `<button class="jj-pa-clear" title="Remover custo">✕</button>` : ""}
      `;

      const input    = wrapper.querySelector(".jj-pa-amount");
      const select   = wrapper.querySelector(".jj-pa-pool");
      const clearBtn = wrapper.querySelector(".jj-pa-clear");

      async function _saveCost() {
        const val = parseInt(input.value);
        if ( !val || val <= 0 ) return;
        const target = select.value === "total" ? "energy.total" : "energy.generated";
        const existing = activity.consumption?.targets ?? [];
        const hasPa = existing.some(t =>
          t.type === "attribute" &&
          (t.target === "energy.generated" || t.target === "energy.total")
        );
        if ( hasPa ) return;
        await activity.update({
          "consumption.targets": [
            ...existing,
            { type: "attribute", target, value: val, scaling: { mode: "", formula: "" } }
          ]
        });
        ui.notifications.info(`Custo de ${val} PA (${select.value === "total" ? "Total" : "Gerada"}) salvo em "${activity.name}".`);
      }

      input.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveCost(); } });
      input.addEventListener("blur", _saveCost);

      if ( clearBtn ) {
        clearBtn.addEventListener("click", async e => {
          e.stopPropagation();
          const existing = activity.consumption?.targets ?? [];
          const filtered = existing.filter(t =>
            !(t.type === "attribute" &&
              (t.target === "energy.generated" || t.target === "energy.total"))
          );
          await activity.update({ "consumption.targets": filtered });
          ui.notifications.info(`Custo de PA removido de "${activity.name}".`);
        });
      }

      // Inserir dentro de .item-row, antes dos controles
      const itemRow = row.querySelector(".item-row") ?? row;
      const controls = itemRow.querySelector(".item-controls, .activity-controls, .controls");
      if ( controls ) itemRow.insertBefore(wrapper, controls);
      else itemRow.appendChild(wrapper);
    });
  }

  // Mapa de observers por form ID para evitar duplicação
  const _formObservers = new Map();

  // Configura observer dentro de um form de item sheet
  function _watchForm(form, item) {
    if ( _formObservers.has(form.id) ) return;

    // Injetar imediatamente
    _injectCostFields(form, item);

    // Observer dentro do form — re-injeta quando a lista mudar
    const obs = new MutationObserver(() => {
      _injectCostFields(form, item);
    });
    obs.observe(form, { childList: true, subtree: true });
    _formObservers.set(form.id, obs);

    // Limpar quando o form for removido do DOM
    const cleanup = new MutationObserver((muts) => {
      for ( const m of muts ) {
        for ( const n of m.removedNodes ) {
          if ( n === form || n.contains?.(form) ) {
            obs.disconnect();
            cleanup.disconnect();
            _formObservers.delete(form.id);
          }
        }
      }
    });
    cleanup.observe(document.body, { childList: true, subtree: true });
  }

  // Observer no body para detectar novos item sheets
  Hooks.once("ready", () => {
    const _bodyObserver = new MutationObserver((mutations) => {
      for ( const mutation of mutations ) {
        for ( const node of mutation.addedNodes ) {
          if ( !(node instanceof HTMLElement) ) continue;
          let form = node.id?.startsWith("ItemSheet5e") ? node
            : node.querySelector?.('form[id^="ItemSheet5e"]');
          if ( !form ) continue;
          const app = foundry.applications.instances.get(form.id);
          if ( !app ) return;
          const item = app.document;
          if ( !item?.system?.activities ) continue;
          setTimeout(() => _watchForm(form, item), 100);
        }
      }
    });
    _bodyObserver.observe(document.body, { childList: true, subtree: true });
  });

  // Fallback: clique na aba de atividades
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest("[data-tab='activities']");
    if ( !btn ) return;
    const form = btn.closest('form[id^="ItemSheet5e"]');
    if ( !form ) return;
    const app = foundry.applications.instances.get(form.id);
    if ( !app ) return;
    const item = app.document;
    if ( !item?.system?.activities ) return;
    setTimeout(() => _watchForm(form, item), 150);
  }, true);

  // CSS inline (via <style> injetado no head)
  if ( !document.querySelector("#jj-pa-cost-style") ) {
    const style = document.createElement("style");
    style.id = "jj-pa-cost-style";
    style.textContent = `
      .jj-pa-cost-field {
        display: flex;
        align-items: center;
        gap: 3px;
        flex: none;
      }
      .jj-pa-amount {
        width: 44px;
        height: 22px;
        padding: 0 4px;
        font-size: 11px;
        text-align: center;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c0a8ff;
      }
      .jj-pa-amount:disabled {
        color: #6060a0;
        opacity: 0.8;
      }
      .jj-pa-pool {
        height: 22px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #a0a0c0;
        cursor: pointer;
      }
      .jj-pa-pool:disabled { opacity: 0.7; cursor: default; }
      .jj-pa-clear {
        width: 18px;
        height: 18px;
        font-size: 9px;
        background: #1a0808;
        border: 1px solid #5a1a1a;
        border-radius: 3px;
        color: #c05050;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .jj-pa-clear:hover { background: #2a0808; color: #ff6060; }
    `;
    document.head.appendChild(style);
  }

  console.log("JujutsuLegacy | Campo de custo de PA nas atividades carregado ✓");
})();

/* ============================================================
 * EXPLOSÃO DEFENSIVA — Botão na Sidebar
 * Aparece abaixo dos Favoritos quando o personagem tiver a
 * habilidade desbloqueada. Permite gastar PA para reduzir o
 * próximo dano recebido no card Jujutsu.
 * ============================================================ */

// Chave do flag onde guardamos a redução pendente
const JJ_DEF_FLAG = "jujutsu-system.explosaoDefensivaPendente";

/**
 * Handler do botão de Explosão Defensiva — chamado pelo listener no _onRender.
 */
async function _onExplosaoDefensiva(actor) {
  const flagData      = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente") ?? null;
  const pendente      = flagData?.reducao ?? 0;
  const pendenteCusto = flagData?.paCusto ?? 0;

  if ( pendente > 0 ) {
    // Perguntar se quer cancelar
    const cancel = await foundry.applications.api.DialogV2.confirm({
      window: { title: "🛡️ Explosão Defensiva Ativa" },
      content: `<p>Há uma redução de <strong>${pendente}</strong> pontos pendente (custo: <strong>${pendenteCusto} PA</strong>).</p><p>Deseja cancelar e recuperar a PA?</p>`,
      yes: { label: "Cancelar e Devolver PA" },
      no:  { label: "Manter" }
    });
    if ( !cancel ) return;
    await actor.unsetFlag("jujutsu-system", "explosaoDefensivaPendente");
    const paAtual = actor.system?.energy?.generated ?? 0;
    await actor.update({ "system.energy.generated": paAtual + pendenteCusto });
    ui.notifications.info("Explosão Defensiva cancelada. PA devolvida.");
    return;
  }

  const result = await _explosaoDefensivaDialog(actor);
  if ( !result ) return;

  await actor.setFlag("jujutsu-system", "explosaoDefensivaPendente", { reducao: result.reducao, paCusto: result.paCusto });
  const paAtual = actor.system?.energy?.generated ?? 0;
  await actor.update({ "system.energy.generated": Math.max(0, paAtual - result.paCusto) });
  ui.notifications.info(`🛡️ Explosão Defensiva ativa! Próximo dano reduzido em ${result.reducao} (${result.paCusto} PA gasto).`);
}

/**
 * Dialog de escolha de PA para Explosão Defensiva.
 * Retorna o total de redução rolado (soma dos Nd4), ou null se cancelado.
 */
async function _explosaoDefensivaDialog(actor) {
  const paDisp   = actor.system?.energy?.generated ?? 0;
  const profBonus = actor.system?.attributes?.prof ?? 2;
  const maxPA = paDisp;

  if ( maxPA === 0 ) {
    ui.notifications.warn("PA Gerada insuficiente para Explosão Defensiva!");
    return null;
  }

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "🛡️ Explosão Defensiva" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar PA para reduzir o próximo dano?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
          Máximo: <strong>${maxPA}</strong> d4
        </p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label style="flex:0 0 auto">Dados d4:</label>
          <input type="number" id="jj-expdef-input"
                 value="0" min="0" max="${maxPA}"
                 style="width:60px; text-align:center;">
          <span style="font-size:12px; color:#aaa;">1 PA por dado</span>
        </div>
      </div>`,
    buttons: [
      {
        label:   "Rolar",
        action:  "ok",
        default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj-expdef-input") ?? document.querySelector("#jj-expdef-input");
          return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
        }
      },
      {
        label:    "Cancelar",
        action:   "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( paGasto === null || paGasto === undefined || paGasto === 0 ) return paGasto ?? 0;

  // Rolar os dados e calcular a redução
  const roll = await new Roll(`${paGasto}d4`).evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const total = roll.total;

  // Mostrar no chat
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `🛡️ <strong>${actor.name}</strong> usa Explosão Defensiva — reduz <strong>${total}</strong> do próximo dano!`,
    rollMode: game.settings.get("core", "rollMode")
  });

  return { reducao: total, paCusto: paGasto };
}

/**
 * Intercepta o botão "Aplicar" do card Jujutsu e subtrai a redução pendente.
 * Chamado em _applyDamageToSelected (já existente no character-sheet.mjs).
 *
 * Para integrar: antes de aplicar o dano final aos tokens selecionados,
 * verificar se algum token tem flag de Explosão Defensiva pendente.
 */
async function _aplicarExplosaoDefensiva(tokens, danoFinal) {
  let danoRestante = danoFinal;

  for ( const token of tokens ) {
    const actor = token.actor;
    if ( !actor ) continue;

      const expDefFlag     = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente") ?? null;
      const expDefPendente = expDefFlag?.reducao ?? 0;
      if ( expDefPendente > 0 ) {
        const reducao = Math.min(expDefPendente, danoRestante);
        danoRestante  = Math.max(0, danoRestante - reducao);
        await actor.unsetFlag("jujutsu-system", "explosaoDefensivaPendente");
        ui.notifications.info(`🛡️ Explosão Defensiva: ${reducao} de dano reduzido para ${actor.name}!`);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🛡️ <strong>${actor.name}</strong> reduziu <strong>${reducao}</strong> de dano com Explosão Defensiva!`
        });
      }
  }

  return danoRestante;
}

// CSS do botão
if ( !document.querySelector("#jj-expdef-style") ) {
  const style = document.createElement("style");
  style.id = "jj-expdef-style";
  style.textContent = `
    .jj-expdef-sidebar {
      padding: 4px 8px 6px;
    }

    .jj-expdef-sidebar-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      background: #0e0e18;
      border: 1px solid #2a2a40;
      border-radius: 4px;
      color: #6060a0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .jj-expdef-sidebar-btn:hover {
      background: #141428;
      border-color: #4a4a70;
      color: #a0a0d0;
    }

    .jj-expdef-sidebar-btn.active {
      background: #0a0a20;
      border-color: #3a5a9a;
      color: #6090e0;
      box-shadow: 0 0 8px rgba(60, 100, 200, 0.3);
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
 * SEÇÕES CUSTOMIZADAS DE FEATURES (JJ)
 * ============================================================ */

function _unhideFeatureSections(element) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;
  ["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"].forEach(id => {
    const section = featuresTab.querySelector(`[data-group-origin="${id}"]`);
    if ( section ) section.removeAttribute("hidden");
  });
}

const JJ_FEATURE_SECTIONS = new Set(["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"]);

/**
 * Configura listeners de drop nas seções customizadas de habilidades.
 * Quando um item é solto numa seção jj-*, salva o flag featureSection.
 */
function _setupFeatureSectionDrops(element, actor) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;

  JJ_FEATURE_SECTIONS.forEach(sectionId => {
    const section = featuresTab.querySelector(`[data-group-origin="${sectionId}"]`);
    if ( !section ) return;

    section.addEventListener("dragover", e => {
      e.preventDefault();
      section.classList.add("jj-drag-over");
    });

    section.addEventListener("dragleave", () => {
      section.classList.remove("jj-drag-over");
    });

    section.addEventListener("drop", async e => {
      section.classList.remove("jj-drag-over");
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor || item.type !== "feat" ) return;
      // Pequeno delay para o nativo processar primeiro
      setTimeout(async () => {
        await item.setFlag("jujutsu-system", "featureSection", sectionId);
      }, 50);
    });
  });

  // Seções nativas — limpar flag quando item volta
  const nativeSections = featuresTab.querySelectorAll("[data-group-origin]:not([data-group-origin^='jj-'])");
  nativeSections.forEach(section => {
    section.addEventListener("drop", async e => {
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor ) return;
      const hasFlag = item.getFlag("jujutsu-system", "featureSection");
      if ( hasFlag ) await item.unsetFlag("jujutsu-system", "featureSection");
    });
  });
}

/* ============================================================
   SEIS OLHOS — Lógica de Active Effects
   ============================================================ */

async function _applySeiOlhosEffects(actor, mode) {
  const prof = actor.system.attributes.prof ?? 2;

  const EFFECT_IDS = {
    sealed:  "jj-seis-olhos-sealed",
    full:    "jj-seis-olhos-full",
    psychic: "jj-seis-olhos-psychic"
  };

  for ( const id of Object.values(EFFECT_IDS) ) {
    const existing = actor.effects.find(e => e.getFlag("jujutsu-system", "seisOlhosId") === id);
    if ( existing ) await existing.delete();
  }

  const sealedSkillBonus = String(prof);
  const fullSkillBonus   = String(prof * 2);

  const sealedChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "1",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: sealedSkillBonus, priority: 20 }
  ];

  const fullChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "3",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: fullSkillBonus,   priority: 20 }
  ];

  if ( mode === "sealed" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Selado)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: sealedChanges,
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.sealed } }
    }]);
  } else if ( mode === "full" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Poder Completo)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: fullChanges,
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.full } }
    }]);

    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos — Dano Psíquico",
      icon: "icons/magic/death/skull-glowing-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: [],
      duration: { rounds: 9999 },
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.psychic, psychicDamage: true } }
    }]);

    _registerSeiOlhosTurnHook(actor);
  }
}

function _registerSeiOlhosTurnHook(actor) {
  if ( actor._seisOlhosHookId ) Hooks.off("combatTurnChange", actor._seisOlhosHookId);

  actor._seisOlhosHookId = Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const combatant = combat.combatants.get(current.combatantId);
    if ( combatant?.actor?.id !== actor.id ) return;

    const hasEffect = actor.effects.some(e =>
      e.getFlag("jujutsu-system", "seisOlhosId") === "jj-seis-olhos-psychic"
    );
    if ( !hasEffect ) {
      Hooks.off("combatTurnChange", actor._seisOlhosHookId);
      actor._seisOlhosHookId = null;
      return;
    }

    const roll = await new Roll("2d8").evaluate();
    const dmg = roll.total;
    const newHp = Math.max(0, (actor.system.attributes.hp.value ?? 0) - dmg);
    await actor.update({ "system.attributes.hp.value": newHp });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-family:var(--dnd5e-font-roboto,sans-serif);padding:6px 10px;background:#0a0a18;border:1px solid #2a1a4a;border-radius:4px;">
        <strong style="color:#9060d0">⬡ Seis Olhos — Poder Completo</strong><br>
        <span style="color:#c0a0ff">${actor.name} sofre <strong>${dmg}</strong> de dano psíquico no início do turno.</span>
      </div>`
    });
  });
}

/* ============================================================
   SOCKET — Geração de Energia (Personagem e NPC)
   ============================================================ */
Hooks.on("ready", () => {
  game.socket.on("system.jujutsu-system", async (data) => {

    // Personagem: jogador recebe pedido do GM para abrir dialog
    if ( data.action === "energyGenerationDialog" && data.userId === game.user.id ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      setTimeout(async () => {
        const choices = await EnergyGenerationDialog.configure(actor);
        if ( choices ) {
          game.socket.emit("system.jujutsu-system", {
            action: "energyChoicesResult",
            actorId: data.actorId,
            choices
          });
        }
      }, 100);
    }

    // Personagem: GM recebe escolhas e processa
    if ( data.action === "energyChoicesResult" && game.user.isGM ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      await EnergySystem.processTurnStartWithChoices(actor, data.choices);
    }

    // NPC: jogador recebe pedido do GM para abrir dialog
    if ( data.action === "npcEnergyDialog" && data.userId === game.user.id ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      const nd = actor.system.details?.cr ?? 1;
      setTimeout(async () => {
        const multiplicador = await foundry.applications.api.DialogV2.wait({
          window: { title: `⚡ Geração de Energia — ${actor.name}` },
          content: `<p style="margin:0 0 10px;">Quantas vezes o ND (<strong>${nd}</strong>) deseja gerar?</p>`,
          buttons: [
            { label: `2× (${nd * 2} PA)`, action: "2", default: true },
            { label: `3× (${nd * 3} PA)`, action: "3" },
            { label: `4× (${nd * 4} PA)`, action: "4" },
            { label: "Pular",             action: "skip" }
          ],
          rejectClose: false,
          close: () => "skip"
        });
        if ( !multiplicador || multiplicador === "skip" ) return;
        game.socket.emit("system.jujutsu-system", {
          action: "npcEnergyChoices",
          actorId: data.actorId,
          nd,
          multiplicador
        });
      }, 100);
    }

    // NPC: GM recebe escolhas e processa
    if ( data.action === "npcEnergyChoices" && game.user.isGM ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      const alvo        = data.nd * Number(data.multiplicador);
      const geradaAtual = actor.system.energy.generated ?? 0;
      const totalAtual  = actor.system.energy.total ?? 0;
      if ( alvo <= geradaAtual ) {
        ui.notifications.info(`${actor.name} já tem ${geradaAtual} PA Gerada.`);
        return;
      }
      const necessario    = alvo - geradaAtual;
      const transferencia = Math.min(necessario, totalAtual);
      if ( transferencia === 0 ) {
        ui.notifications.warn(`${actor.name} não tem PA Total suficiente!`);
        return;
      }
      await actor.update({
        "system.energy.total":     totalAtual - transferencia,
        "system.energy.generated": geradaAtual + transferencia
      }, { isEnergySystem: true });
      const sheet = actor.sheet;
      if ( sheet?.rendered ) sheet.render();
    }
  });
});
