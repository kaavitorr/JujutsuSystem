/**
 * The D&D fifth edition game system for Foundry Virtual Tabletop
 * A system for playing the fifth edition of the world's most popular role-playing game.
 * Author: Atropos
 * Software License: MIT
 * Content License: https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf
 *                  https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf
 * Repository: https://github.com/foundryvtt/dnd5e
 * Issue Tracker: https://github.com/foundryvtt/dnd5e/issues
 */

// Import Configuration
import DND5E from "./module/config.mjs";
import {
  applyLegacyRules, disableExhaustionAutomation, registerDeferredSettings, registerSystemKeybindings,
  registerSystemSettings
} from "./module/settings.mjs";

// Import Submodules
import * as applications from "./module/applications/_module.mjs";
import * as canvas from "./module/canvas/_module.mjs";
import * as dataModels from "./module/data/_module.mjs";
import * as dice from "./module/dice/_module.mjs";
import * as documents from "./module/documents/_module.mjs";
import * as enrichers from "./module/enrichers.mjs";
import * as Filter from "./module/filter.mjs";
import * as inserts from "./module/inserts.mjs";
import * as migrations from "./module/migration.mjs";
import { registerModuleData, registerModuleRedirects, setupModulePacks } from "./module/module-registration.mjs";
import { default as registry } from "./module/registry.mjs";
import * as rules from "./module/rules/_module.mjs";
import Tooltips5e from "./module/tooltips.mjs";
import * as utils from "./module/utils.mjs";
import DragDrop5e from "./module/drag-drop.mjs";
import { registerCreationHooks } from "./module/applications/actor/creation/creation-hooks-2.mjs";
import { registerEnergyShieldTreeUpdate } from "./module/systems/legacy2-energy-shield-tree.mjs";
import { presentWorldRules } from "./module/applications/world-rules-dialog.mjs";

registerCreationHooks();
registerEnergyShieldTreeUpdate();

/* -------------------------------------------- */
/*  Define Module Structure                     */
/* -------------------------------------------- */

globalThis.dnd5e = {
  applications,
  canvas,
  config: DND5E,
  dataModels,
  dice,
  documents,
  enrichers,
  Filter,
  inserts,
  migrations,
  registry,
  rules,
  ui: {},
  utils
};

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", function() {

  // ── CSS da Skill Tree 2.0 ─────────────────────────────────────────────────
  // Registrado no system.json > styles; injetado aqui porque o servidor
  // guarda o manifest em cache até o mundo reiniciar (padrão do tab-feitico).
  {
    const href = "systems/jujutsu-system/less/jujutsu-skill-tree-2.css";
    if ( !document.querySelector(`link[href="${href}"]`) ) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  globalThis.dnd5e = game.dnd5e = Object.assign(game.system, globalThis.dnd5e);
  utils.log(`Initializing the D&D Fifth Game System - Version ${dnd5e.version}\n${DND5E.ASCII}`);

  // Record Configuration Values
  CONFIG.DND5E = DND5E;

  // ── Jujutsu Legacy: remover cálculos de CR não utilizados ─────────────────
  for ( const key of ["natural", "default", "mage", "draconic", "unarmoredMonk", "unarmoredBarb", "unarmoredBard"] ) {
    delete CONFIG.DND5E.armorClasses[key];
  }

  // ── Jujutsu Legacy: remover cálculos de CR não utilizados
  for ( const key of ["natural", "default", "mage", "draconic", "unarmoredMonk", "unarmoredBarb", "unarmoredBard"] ) {
    delete CONFIG.DND5E.armorClasses[key];
  }

  // ── JUJUTSU LEGACY 2.0 ─────────────────────────────────────────────────
  // Estilos de Combate virão de COMPENDIUM (nenhum placeholder hardcode).
  // Os fallbacks de fórmula vivem em Ruleset (vidaBase 4 / energiaBase 10).
  CONFIG.JUJUTSU = Object.assign(CONFIG.JUJUTSU ?? {}, {});
  Object.assign(CONFIG.JUJUTSU, {
    trainingPoints: { criacao: 4 },
    estilos: {}
  });

  // Legacy identifiers remain usable alongside the authorable NPC profile Items.
  Object.assign(CONFIG.JUJUTSU, {
    categoriasNpc: { lacaio: 0.5, lacain: 0.5, normal: 1, elite: 1.5, chefe: 2 },
    taxonomias: {
      espirito: { label: "Espírito Amaldiçoado", vidaEnergia: true, usaEquipamento: false, pvPorNd: 20, energiaBase: 20 },
      humano:   { label: "Humano / Feiticeiro", usaEquipamento: true },
      objeto:   { label: "Objeto Amaldiçoado", usaEquipamento: false },
      hibrido:  { label: "Meio-Humano", usaEquipamento: true }
    },
    arquetipos: {
      bruto:    { label: "Bruto",      pesos: { str: 4, dex: 1, con: 4, int: 0, wis: 1, cha: 2 } },
      veloz:    { label: "Veloz",      pesos: { str: 1, dex: 5, con: 2, int: 1, wis: 2, cha: 1 } },
      arcano:   { label: "Arcano",     pesos: { str: 0, dex: 1, con: 2, int: 5, wis: 2, cha: 2 } },
      tanque:   { label: "Colosso",    pesos: { str: 3, dex: 0, con: 6, int: 1, wis: 1, cha: 1 } },
      predador: { label: "Predador",   pesos: { str: 3, dex: 4, con: 2, int: 1, wis: 2, cha: 0 } },
      lider:    { label: "Líder",      pesos: { str: 2, dex: 1, con: 2, int: 2, wis: 2, cha: 3 } }
    }
  });

  // ── Jujutsu Legacy: Cálculos de CR customizados ─────────────────────────
  // "Corpo de Lutador" — 10 + mod principal + min(mod CON, floor(nível / 2))
  // "Defesa Ofensiva"  — 10 + mod AGI + mod principal (sem cap)
  Object.assign(CONFIG.DND5E.armorClasses, {

    // ── CORPO DE LUTADOR ─────────────────────────────────────────────────
    corpoLutadorStr: {
      label: "Corpo de Lutador (Força)",
      formula: "10 + @abilities.str.mod + min(@abilities.con.mod, floor(@details.level / 2))"
    },
    corpoLutadorDex: {
      label: "Corpo de Lutador (Agilidade)",
      formula: "10 + @abilities.dex.mod + min(@abilities.con.mod, floor(@details.level / 2))"
    },
    corpoLutadorInt: {
      label: "Corpo de Lutador (Intelecto)",
      formula: "10 + @abilities.int.mod + min(@abilities.con.mod, floor(@details.level / 2))"
    },
    corpoLutadorWis: {
      label: "Corpo de Lutador (Sabedoria)",
      formula: "10 + @abilities.wis.mod + min(@abilities.con.mod, floor(@details.level / 2))"
    },
    corpoLutadorCha: {
      label: "Corpo de Lutador (Presença)",
      formula: "10 + @abilities.cha.mod + min(@abilities.con.mod, floor(@details.level / 2))"
    },

    // ── DEFESA OFENSIVA ──────────────────────────────────────────────────
    defesaOfensivaStr: {
      label: "Defesa Ofensiva (Força)",
      formula: "10 + @abilities.dex.mod + @abilities.str.mod"
    },
    defesaOfensivaDex: {
      label: "Defesa Ofensiva (Agilidade)",
      formula: "10 + @abilities.dex.mod + @abilities.dex.mod"
    },
    defesaOfensivaInt: {
      label: "Defesa Ofensiva (Intelecto)",
      formula: "10 + @abilities.dex.mod + @abilities.int.mod"
    },
    defesaOfensivaWis: {
      label: "Defesa Ofensiva (Sabedoria)",
      formula: "10 + @abilities.dex.mod + @abilities.wis.mod"
    },
    defesaOfensivaCha: {
      label: "Defesa Ofensiva (Presença)",
      formula: "10 + @abilities.dex.mod + @abilities.cha.mod"
    }
  });
  // ────────────────────────────────────────────────────────────────────────

  CONFIG.ActiveEffect.documentClass = documents.ActiveEffect5e;
  Object.assign(CONFIG.ActiveEffect.expiryEvents, CONFIG.DND5E.expiryEvents);
  CONFIG.Actor.collection = dataModels.collection.Actors5e;
  CONFIG.Actor.documentClass = documents.Actor5e;
  CONFIG.Adventure.documentClass = documents.Adventure5e;
  CONFIG.Canvas.layers.tokens.layerClass = canvas.layers.TokenLayer5e;
  CONFIG.Canvas.vfx.enabled = true;
  CONFIG.ChatMessage.documentClass = documents.ChatMessage5e;
  CONFIG.Combat.documentClass = documents.Combat5e;
  CONFIG.Combatant.documentClass = documents.Combatant5e;
  CONFIG.CombatantGroup.documentClass = documents.CombatantGroup5e;
  CONFIG.Item.collection = dataModels.collection.Items5e;
  CONFIG.Item.compendiumIndexFields.push("system.container", "system.identifier", "system.source");
  CONFIG.Item.documentClass = documents.Item5e;
  CONFIG.JournalEntryPage.documentClass = documents.JournalEntryPage5e;
  CONFIG.RollTable.documentClass = documents.RollTable5e;
  CONFIG.Token.documentClass = documents.TokenDocument5e;
  CONFIG.Token.hudClass = applications.hud.TokenHUD5e;
  CONFIG.Token.objectClass = canvas.Token5e;
  CONFIG.Token.rulerClass = canvas.TokenRuler5e;
  CONFIG.Token.movement.TerrainData = dataModels.TerrainData5e;
  CONFIG.User.documentClass = documents.User5e;
  CONFIG.time.roundTime = 6;
  Roll.TOOLTIP_TEMPLATE = "systems/jujutsu-system/templates/chat/roll-breakdown.hbs";
  CONFIG.Dice.BasicDie = CONFIG.Dice.terms.d = dice.BasicDie;
  CONFIG.Dice.BasicRoll = dice.BasicRoll;
  CONFIG.Dice.DamageRoll = dice.DamageRoll;
  CONFIG.Dice.D20Die = dice.D20Die;
  CONFIG.Dice.D20Roll = dice.D20Roll;
  CONFIG.MeasuredTemplate.defaults.angle = 53.13; // 5e cone RAW should be 53.13 degrees
  CONFIG.Note.objectClass = canvas.Note5e;
  CONFIG.ui.chat = applications.ChatLog5e;
  CONFIG.ui.combat = applications.combat.CombatTracker5e;
  CONFIG.ui.items = applications.item.ItemDirectory5e;
  CONFIG.ux.DragDrop = DragDrop5e;

  // Add configuration sections for activities & advancement
  CONFIG.Activity = {
    documentClass: documents.activity.UtilityActivity,
    embedHandlers: [],
    sidebarIcon: "fa-solid fa-person-hiking",
    typeLabels: new Proxy(CONFIG.DND5E.activityTypes, {
      get(target, prop) {
        return target[prop]?.documentClass?.metadata?.title;
      }
    })
  };
  CONFIG.Advancement = {
    documentClass: documents.advancement.Advancement,
    embedHandlers: [],
    sidebarIcon: "fa-solid fa-person-dress-burst",
    typeLabels: new Proxy(CONFIG.DND5E.advancementTypes, {
      get(target, prop) {
        return target[prop]?.documentClass?.metadata?.title;
      }
    })
  };

  // Register System Settings
  registerSystemSettings();
  registerSystemKeybindings();

  // Configure bastions
  game.dnd5e.bastion = new documents.Bastion();

  // Configure tooltips
  game.dnd5e.tooltips = new Tooltips5e();

  // Remove honor & sanity from configuration if they aren't enabled
  if ( !game.settings.get("jujutsu-system", "honorScore") ) delete DND5E.abilities.hon;
  if ( !game.settings.get("jujutsu-system", "sanityScore") ) delete DND5E.abilities.san;

  // Legacy rules.
  if ( dnd5e.settings.rulesVersion === "legacy" ) applyLegacyRules();

  // Remove exhaustion automation if disabled. Must run after legacy rules are applied.
  if ( dnd5e.settings.disableExhaustion ) disableExhaustionAutomation();

  // Register system
  DND5E.SPELL_LISTS.forEach(uuid => dnd5e.registry.spellLists.register(uuid));

  // Register module data from manifests
  registerModuleData();
  registerModuleRedirects();

  // Register Roll Extensions
  CONFIG.Dice.rolls = [dice.BasicRoll, dice.D20Roll, dice.DamageRoll];

  // Hook up system data types
  Object.assign(CONFIG.ActiveEffect.changeTypes, DND5E.activeEffectChangeTypes);
  Object.assign(CONFIG.ActiveEffect.dataModels, dataModels.activeEffect.config);
  CONFIG.Actor.dataModels = dataModels.actor.config;
  CONFIG.ChatMessage.dataModels = dataModels.chatMessage.config;
  CONFIG.Item.dataModels = dataModels.item.config;
  CONFIG.JournalEntryPage.dataModels = dataModels.journal.config;
  Object.assign(CONFIG.JournalEntryPage.typeIcons, dataModels.journal.icons);
  Object.assign(CONFIG.RegionBehavior.dataModels, dataModels.regionBehavior.config);
  Object.assign(CONFIG.RegionBehavior.typeIcons, dataModels.regionBehavior.icons);

  // Add fonts
  _configureFonts();

  // Register sheet application classes
  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.registerSheet(ActiveEffect, "dnd5e", applications.activeEffect.ActiveEffectSheet5e, {
    makeDefault: true,
    label: "DND5E.SheetClass.ActiveEffect"
  });

  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  DocumentSheetConfig.registerSheet(Actor, "jujutsu-system", applications.actor.CharacterActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "DND5E.SheetClass.Character"
  });
  DocumentSheetConfig.registerSheet(Actor, "jujutsu-system", applications.actor.NPCActorSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "DND5E.SheetClass.NPC"
  });
  DocumentSheetConfig.registerSheet(Actor, "jujutsu-system", applications.actor.VehicleActorSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "DND5E.SheetClass.Vehicle"
  });
  DocumentSheetConfig.registerSheet(Actor, "jujutsu-system", applications.actor.GroupActorSheet, {
    types: ["group"],
    makeDefault: true,
    label: "DND5E.SheetClass.Group"
  });
  DocumentSheetConfig.registerSheet(Actor, "jujutsu-system", applications.actor.EncounterActorSheet, {
    types: ["encounter"],
    makeDefault: true,
    label: "DND5E.SheetClass.Encounter"
  });

  DocumentSheetConfig.registerSheet(Adventure, "dnd5e", applications.adventure.AdventureImporter5e, {
    canBeDefault: false,
    label: "DND5E.SheetClass.AdventureImporter"
  });

  DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  DocumentSheetConfig.registerSheet(Item, "jujutsu-system", applications.item.ItemSheet5e, {
    makeDefault: true,
    label: "DND5E.SheetClass.Item"
  });
  DocumentSheetConfig.unregisterSheet(Item, "jujutsu-system", applications.item.ItemSheet5e, { types: ["container"] });
  DocumentSheetConfig.registerSheet(Item, "jujutsu-system", applications.item.ContainerSheet, {
    makeDefault: true,
    types: ["container"],
    label: "DND5E.SheetClass.Container"
  });
  DocumentSheetConfig.unregisterSheet(Item, "jujutsu-system", applications.item.ItemSheet5e, { types: ["feiticoTemplate"] });
  DocumentSheetConfig.registerSheet(Item, "jujutsu-system", applications.item.FeiticoTemplateSheet, {
    makeDefault: true,
    types: ["feiticoTemplate"],
    label: "TYPES.Item.feiticoTemplate"
  });
  DocumentSheetConfig.unregisterSheet(Item, "jujutsu-system", applications.item.ItemSheet5e, {
    types: ["taxonomy", "archetype"]
  });
  DocumentSheetConfig.registerSheet(Item, "jujutsu-system", applications.item.NpcProfileSheet, {
    makeDefault: true, types: ["taxonomy", "archetype"], label: "JUJUTSU.NpcProfile.Sheet"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "jujutsu-system", applications.journal.JournalEntrySheet5e, {
    makeDefault: true,
    label: "DND5E.SheetClass.JournalEntry"
  });
  DocumentSheetConfig.registerSheet(JournalEntry, "jujutsu-system", applications.journal.JournalSheet5e, {
    makeDefault: false,
    canConfigure: false,
    canBeDefault: false,
    label: "DND5E.SheetClass.JournalEntrySheetLegacy"
  });
  DocumentSheetConfig.registerSheet(JournalEntryPage, "jujutsu-system", applications.journal.JournalClassPageSheet, {
    label: "DND5E.SheetClass.ClassSummary",
    types: ["class", "subclass"]
  });
  DocumentSheetConfig.registerSheet(JournalEntryPage, "jujutsu-system", applications.journal.JournalMapLocationPageSheet, {
    label: "DND5E.SheetClass.MapLocation",
    types: ["map"]
  });
  DocumentSheetConfig.registerSheet(JournalEntryPage, "jujutsu-system", applications.journal.JournalRulePageSheet, {
    label: "DND5E.SheetClass.Rule",
    types: ["rule"]
  });
  DocumentSheetConfig.registerSheet(JournalEntryPage, "jujutsu-system", applications.journal.JournalSpellListPageSheet, {
    label: "DND5E.SheetClass.SpellList",
    types: ["spells"]
  });

  DocumentSheetConfig.unregisterSheet(RegionBehavior, "core", foundry.applications.sheets.RegionBehaviorConfig, {
    types: ["dnd5e.difficultTerrain", "dnd5e.rotateArea"]
  });
  DocumentSheetConfig.registerSheet(RegionBehavior, "jujutsu-system", applications.regionBehavior.DifficultTerrainConfig, {
    label: "DND5E.SheetClass.DifficultTerrain",
    types: ["dnd5e.difficultTerrain"]
  });
  DocumentSheetConfig.registerSheet(RegionBehavior, "jujutsu-system", applications.regionBehavior.RotateAreaConfig, {
    label: "DND5E.SheetClass.RotateArea",
    types: ["dnd5e.rotateArea"]
  });

  DocumentSheetConfig.registerSheet(RollTable, "jujutsu-system", applications.RollTableSheet5e, {
    makeDefault: true,
    label: "DND5E.SheetClass.RollTable"
  });

  CONFIG.Token.prototypeSheetClass = applications.PrototypeTokenConfig5e;
  DocumentSheetConfig.unregisterSheet(TokenDocument, "core", foundry.applications.sheets.TokenConfig);
  DocumentSheetConfig.registerSheet(TokenDocument, "jujutsu-system", applications.TokenConfig5e, {
    label: "DND5E.SheetClass.Token"
  });

  // Preload Handlebars helpers & partials
  utils.registerHandlebarsHelpers();
  utils.preloadHandlebarsTemplates();

  // Enrichers
  enrichers.registerCustomEnrichers();

  // Set up token movement actions
  documents.TokenDocument5e.registerMovementActions();

  // Custom movement cost aggregator
  CONFIG.Token.movement.costAggregator = (results, distance, segment) => {
    return Math.max(...results.map(i => i.cost));
  };

  // Setup Calendar
  _configureCalendar();
});

/* -------------------------------------------- */

/**
 * Configure world calendar based on setting.
 */
function _configureCalendar() {
  CONFIG.time.earthCalendarClass = dataModels.calendar.CalendarData5e;
  CONFIG.time.worldCalendarClass = dataModels.calendar.CalendarData5e;

  /**
   * A hook event that fires during the `init` step to give modules a chance to customize the calendar
   * configuration before loading the world calendar.
   * @function dnd5e.preSetupCalendar
   * @memberof hookEvents
   * @returns               Explicitly return `false` to prevent system from setting up the calendar.
   */
  if ( Hooks.call("dnd5e.setupCalendar") === false ) return;

  const calendar = game.settings.get("jujutsu-system", "calendar");
  const calendarConfig = CONFIG.DND5E.calendar.calendars.find(c => c.value === calendar);
  if ( calendarConfig ) {
    CONFIG.time.worldCalendarConfig = calendarConfig.config;
    if ( calendarConfig.class ) CONFIG.time.worldCalendarClass = calendarConfig.class;
  }
}

/* -------------------------------------------- */

/**
 * Configure explicit lists of attributes that are trackable on the token HUD and in the combat tracker.
 * @internal
 */
function _configureTrackableAttributes() {
  const common = {
    bar: [],
    value: [
      ...Object.keys(DND5E.abilities).map(ability => `abilities.${ability}.value`),
      ...Object.keys(DND5E.movementTypes).map(movement => `attributes.movement.speeds.${movement}`),
      "attributes.ac.value", "attributes.init.total"
    ]
  };

  const creature = {
    bar: [
      ...common.bar,
      "attributes.hp",
      ..._trackedSpellAttributes()
    ],
    value: [
      ...common.value,
      ...Object.keys(DND5E.skills).map(skill => `skills.${skill}.passive`),
      ...Object.keys(DND5E.senses).map(sense => `attributes.senses.ranges.${sense}`),
      "attributes.hp.temp", "attributes.spell.attack", "attributes.spell.dc"
    ]
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: [...creature.bar, "resources.primary", "resources.secondary", "resources.tertiary", "details.xp"],
      value: [...creature.value]
    },
    npc: {
      bar: [...creature.bar, "resources.legact", "resources.legres"],
      value: [...creature.value, "attributes.spell.level", "details.cr", "details.xp.value"]
    },
    vehicle: {
      bar: [...common.bar, "attributes.hp"],
      value: [...common.value]
    },
    group: {
      bar: [],
      value: []
    }
  };
}

/* -------------------------------------------- */

/**
 * Get all trackable spell slot attributes.
 * @param {string} [suffix=""]  Suffix appended to the path.
 * @returns {Set<string>}
 * @internal
 */
function _trackedSpellAttributes(suffix="") {
  return Object.entries(DND5E.spellcasting).reduce((acc, [k, v]) => {
    if ( v.slots ) Array.fromRange(Object.keys(DND5E.spellLevels).length - 1, 1).forEach(l => {
      acc.add(`spells.${v.getSpellSlotKey(l)}${suffix}`);
    });
    return acc;
  }, new Set());
}

/* -------------------------------------------- */

/**
 * Configure which attributes are available for item consumption.
 * @internal
 */
function _configureConsumableAttributes() {
  CONFIG.DND5E.consumableResources = [
    ...Object.keys(DND5E.abilities).map(ability => `abilities.${ability}.value`),
    "attributes.ac.flat",
    "attributes.hp.value",
    "attributes.exhaustion",
    ...Object.keys(DND5E.senses).map(sense => `attributes.senses.ranges.${sense}`),
    ...Object.keys(DND5E.movementTypes).map(type => `attributes.movement.${type}`),
    ...Object.keys(DND5E.currencies).map(denom => `currency.${denom}`),
    "details.xp.value",
    "resources.primary.value", "resources.secondary.value", "resources.tertiary.value",
    "resources.legact.value", "resources.legres.value", "attributes.actions.value",
    ..._trackedSpellAttributes(".value")
  ];
}

/* -------------------------------------------- */

/**
 * Configure additional system fonts.
 */
function _configureFonts() {
  Object.assign(CONFIG.fontDefinitions, {
    Roboto: {
      editor: true,
      fonts: [
        { urls: ["systems/jujutsu-system/fonts/roboto/Roboto-Regular.woff2"] },
        { urls: ["systems/jujutsu-system/fonts/roboto/Roboto-Bold.woff2"], weight: "bold" },
        { urls: ["systems/jujutsu-system/fonts/roboto/Roboto-Italic.woff2"], style: "italic" },
        { urls: ["systems/jujutsu-system/fonts/roboto/Roboto-BoldItalic.woff2"], weight: "bold", style: "italic" }
      ]
    },
    "Roboto Condensed": {
      editor: true,
      fonts: [
        { urls: ["systems/jujutsu-system/fonts/roboto-condensed/RobotoCondensed-Regular.woff2"] },
        { urls: ["systems/jujutsu-system/fonts/roboto-condensed/RobotoCondensed-Bold.woff2"], weight: "bold" },
        { urls: ["systems/jujutsu-system/fonts/roboto-condensed/RobotoCondensed-Italic.woff2"], style: "italic" },
        {
          urls: ["systems/jujutsu-system/fonts/roboto-condensed/RobotoCondensed-BoldItalic.woff2"], weight: "bold",
          style: "italic"
        }
      ]
    },
    "Roboto Slab": {
      editor: true,
      fonts: [
        { urls: ["systems/jujutsu-system/fonts/roboto-slab/RobotoSlab-Regular.ttf"] },
        { urls: ["systems/jujutsu-system/fonts/roboto-slab/RobotoSlab-Bold.ttf"], weight: "bold" }
      ]
    }
  });
}

/* -------------------------------------------- */

/**
 * Configure system status effects.
 */
function _configureStatusEffects() {
  const statusEffects = {};
  const addEffect = ({special, ...data}) => {
    data = foundry.utils.deepClone(data);
    data._id = utils.staticID(`dnd5e${data.id}`);
    data.order ??= Infinity;
    statusEffects[data.id] = data;
    if ( special ) CONFIG.specialStatusEffects[special] = data.id;
    if ( data.neverBlockMovement ) DND5E.neverBlockStatuses.add(data.id);
  };
  for ( const [id, data] of Object.entries(CONFIG.DND5E.statusEffects) ) {
    const original = CONFIG.statusEffects[id];
    addEffect(foundry.utils.mergeObject(original ?? {}, { id, ...data }, { inplace: false }));
  }
  for ( const [id, data] of Object.entries(CONFIG.DND5E.conditionTypes) ) {
    addEffect({ id, ...data });
  }
  for ( const [id, data] of Object.entries(CONFIG.DND5E.encumbrance.effects) ) {
    addEffect({ id, ...data, hud: false });
  }
  CONFIG.statusEffects = statusEffects;
}

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * Prepare attribute lists.
 */
Hooks.once("setup", function() {
  // Configure trackable & consumable attributes.
  _configureTrackableAttributes();
  _configureConsumableAttributes();

  Tooltips5e.activateListeners();
  game.dnd5e.tooltips.observe();

  // Register settings after modules have had a chance to initialize
  registerDeferredSettings();

  // Set up compendiums with custom applications & sorting
  setupModulePacks();

  // Create CSS for currencies
  const style = document.createElement("style");
  const currencies = append => Object.entries(CONFIG.DND5E.currencies)
    .map(([key, { icon }]) => `&.${key}${append ?? ""} { background-image: url("${icon}"); }`);
  style.innerHTML = `
    :is(.dnd5e2, .dnd5e2-journal) :is(i, span).currency {
      ${currencies().join("\n")}
    }
    .dnd5e2 .form-group label.label-icon.currency {
      ${currencies("::after").join("\n")}
    }
  `;
  document.head.append(style);

  // Measure the space a scrollbar takes up so that sheets can center theirs within their padding.
  const probe = document.createElement("div");
  probe.style.cssText = "position: absolute; visibility: hidden; overflow-y: auto; scrollbar-gutter: stable; "
    + "scrollbar-width: thin; inline-size: 100px; block-size: 100px";
  document.body.append(probe);
  document.documentElement.style.setProperty("--dnd5e-scrollbar-width", `${probe.offsetWidth - probe.clientWidth}px`);
  probe.remove();

  // Patch Document Index
  _originalLookup = game.documentIndex.lookup;
  game.documentIndex.lookup = documentIndexLookup;
});

/* --------------------------------------------- */

let _originalLookup;

/**
 * Return entries that match the given string prefix.
 * @param {string} query                      The search prefix or phrase.
 * @param {object} [options]                  Additional options to configure behavior.
 * @param {boolean} [options.ignoreCompendiumFiltering]  Don't filter based on pack source configuration.
 * @returns {Record<string, WordTreeEntry[]>} A number of entries that have the given prefix, grouped by document type.
 */
function documentIndexLookup(query, { ignoreCompendiumFiltering, ...options }={}) {
  return _originalLookup.call(this, query, {
    ...options,
    filterEntries: entry => {
      if ( entry.entry.system?.container ) return false;
      if ( !ignoreCompendiumFiltering && (dnd5e.settings.packSourceConfiguration[entry.pack] === false) ) return false;
      return options.filterEntries?.(entry) ?? true;
    }
  });
}

/* --------------------------------------------- */

/**
 * Perform one-time pre-localization and sorting of some configuration objects
 */
Hooks.once("i18nInit", () => {
  // Set up status effects. Explicitly performed after init and before prelocalization.
  _configureStatusEffects();

  if ( dnd5e.settings.rulesVersion === "legacy" ) {
    const { translations, _fallback } = game.i18n;
    foundry.utils.mergeObject(translations, {
      "TYPES.Item": {
        race: _loc("TYPES.Item.raceLegacy"),
        racePl: _loc("TYPES.Item.raceLegacyPl")
      },
      DND5E: {
        "Feature.Class.ArtificerPlan": _loc("DND5E.Feature.Class.ArtificerInfusion"),
        "Feature.Species": _loc("DND5E.Feature.SpeciesLegacy"),
        FlagsAlertHint: _loc("DND5E.FlagsAlertHintLegacy"),
        FlagsRemarkableAthleteHint: _loc("DND5E.FlagsRemarkableAthleteHintLegacy"),
        ItemSpeciesDetails: _loc("DND5E.ItemSpeciesDetailsLegacy"),
        "Language.Category.Rare": _loc("DND5E.Language.Category.Exotic"),
        "MOVEMENT.Type.Speed": _loc("DND5E.MOVEMENT.Type.Walk"),
        RacialTraits: _loc("DND5E.RacialTraitsLegacy"),
        "REST.Long.Hint.Normal": _loc("DND5E.REST.Long.Hint.NormalLegacy"),
        "REST.Long.Hint.Group": _loc("DND5E.REST.Long.Hint.GroupLegacy"),
        "Species.Add": _loc("DND5E.Species.AddLegacy"),
        "Species.Features": _loc("DND5E.Species.FeaturesLegacy"),
        "TARGET.Type.Emanation": foundry.utils.mergeObject(
          _fallback.DND5E?.TARGET?.Type?.Radius ?? {},
          translations.DND5E?.TARGET?.Type?.Radius ?? {},
          { inplace: false }
        ),
        "TRAIT.Armor": foundry.utils.mergeObject(
          _fallback.DND5E?.TRAIT?.ArmorLegacy ?? {},
          translations.DND5E?.TRAIT?.ArmorLegacy ?? {},
          { inplace: false }
        )
      }
    });
  }
  utils.performPreLocalization(CONFIG.DND5E);
  Object.values(CONFIG.DND5E.activityTypes).forEach(c => c.documentClass.localize());
  Object.values(CONFIG.DND5E.activityBehaviorTypes).forEach(c => c.model.localize());
  Object.values(CONFIG.DND5E.advancementTypes).forEach(c => c.documentClass.localize());
  foundry.helpers.Localization.localizeDataModel(dataModels.settings.BastionSetting);
  foundry.helpers.Localization.localizeDataModel(dataModels.settings.CalendarConfigSetting);
  foundry.helpers.Localization.localizeDataModel(dataModels.settings.CalendarPreferencesSetting);
  foundry.helpers.Localization.localizeDataModel(dataModels.settings.TransformationSetting);

  // Spellcasting
  dataModels.spellcasting.SpellcastingModel.fromConfig();
});

/* -------------------------------------------- */
/*  Foundry VTT Ready                           */
/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", function() {
  // Wait to register certain hooks so that modules can register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if ( ["ActiveEffect", "Activity", "Item"].includes(data.type) ) {
      documents.macro.create5eMacro(data, slot);
      return false;
    }
  });
  Hooks.on("updateWorldTime", dataModels.calendar.CalendarData5e.onTimePassage);

  // Adjust sourced items on actors now that compendium UUID redirects have been initialized
  game.actors.forEach(a => a.sourcedItems._redirectKeys());

  // ProseMirror inserts
  inserts.registerProseMirrorInserts();

  // Register items by type
  dnd5e.registry.items.initialize();

  // Chat message listeners
  documents.ChatMessage5e.activateListeners();

  // Bastion initialization
  game.dnd5e.bastion.initializeUI();

  // Display the calendar HUD
  if ( CONFIG.DND5E.calendar.application ) {
    dnd5e.ui.calendar = new CONFIG.DND5E.calendar.application();
    dnd5e.ui.calendar.render({ force: true });
  }

  /**
   * A hook event that fires after core's `ready` hook once any system migrations have completed.
   * @function dnd5e.ready
   * @memberof hookEvents
   */

  // Run migrations & trigger system ready hook once complete
  _handleMigration().then(() => Hooks.callAll("dnd5e.ready"));
});

/* -------------------------------------------- */

/**
 * Determine whether a system migration is required and feasible and run it.
 * @returns {Promise}
 */
async function _handleMigration() {
  if ( !game.user.isGM ) return;
  if ( dnd5e.settings.systemMigrationVersion && dnd5e.settings.firstRun ) {
    await game.settings.set("jujutsu-system", "firstRun", false);
  }

  const cv = dnd5e.settings.systemMigrationVersion || game.world.flags["jujutsu-system"]?.version
    || game.world.flags.JujutsuLegacy?.version;
  const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
  if ( !cv && totalDocuments === 0 ) return game.settings.set("jujutsu-system", "systemMigrationVersion", game.system.version);
  if ( cv && !foundry.utils.isNewerVersion(game.system.flags.needsMigrationVersion, cv) ) return;

  // Compendium pack folder migration.
  if ( foundry.utils.isNewerVersion("3.0.0", cv) ) {
    migrations.reparentCompendiums("DnD5e SRD Content", "D&D SRD Content");
  }

  // Perform the migration
  if ( cv && foundry.utils.isNewerVersion(game.system.flags.compatibleMigrationVersion, cv) ) {
    ui.notifications.error("MIGRATION.DND5E.Warning.VersionTooOld", { localize: true, permanent: true });
  }

  await migrations.migrateWorld();
}

/* -------------------------------------------- */
/*  Post-migration                              */
/* -------------------------------------------- */

/**
 * Display the welcome dialog if required.
 */
Hooks.once("dnd5e.ready", async () => {
  try {
    if ( await presentWorldRules() ) return;
  } catch (error) {
    console.error("Jujutsu Legacy | Falha ao configurar as regras do mundo.", error);
    ui.notifications.error("Não foi possível salvar as regras do mundo. Confira as configurações do sistema.");
  }
  applications.WelcomeScreen.presentScreen();
});

/* -------------------------------------------- */
/*  System Styling                              */
/* -------------------------------------------- */

Hooks.on("renderGamePause", (app, html) => {
  if ( Hooks.events.renderGamePause.length > 1 ) return;
  html.classList.add("dnd5e2");
  const container = document.createElement("div");
  container.classList.add("flexcol");
  container.append(...html.children);
  html.append(container);
  const img = html.querySelector("img");
  img.src = "systems/jujutsu-system/ui/official/ampersand.png";  img.style.width = "200px";
  img.style.height = "200px";
  img.style.objectFit = "contain";
  img.className = "";

  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
});

Hooks.on("renderSettings", (app, html) => applications.settings.sidebar.renderSettings(html));

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("applyCompendiumArt", (documentClass, ...args) => documentClass.applyCompendiumArt?.(...args));

Hooks.on("renderChatInput", () => applications.ChatLog5e.applyTheme());
Hooks.on("renderChatPopout", documents.ChatMessage5e.onRenderChatPopout);
Hooks.on("renderChatPopout", () => applications.ChatLog5e.applyTheme());
Hooks.on("getChatMessageContextOptions", documents.ChatMessage5e.addChatMessageContextOptions);

Hooks.on("renderChatLog", (app, html, data) => {
  documents.Item5e.chatListeners(html);
  documents.ChatMessage5e.onRenderChatLog(html);
});
Hooks.on("renderChatPopout", (app, html, data) => documents.Item5e.chatListeners(html));

Hooks.on("chatMessage", (app, message, data) => enrichers.chatMessage(message));
Hooks.on("createChatMessage", dataModels.chatMessage.RequestMessageData.onCreateMessage);
Hooks.on("updateChatMessage", dataModels.chatMessage.RequestMessageData.onUpdateResultMessage);

Hooks.on("createRegion", documents.activity.UtilityActivity.placeTemplateBehaviors);

Hooks.on("renderActorDirectory", (app, html, data) => documents.Actor5e.onRenderActorDirectory(html));

Hooks.on("getActorContextOptions", documents.Actor5e.addDirectoryContextOptions);
Hooks.on("getItemContextOptions", documents.Item5e.addDirectoryContextOptions);

Hooks.on("preImportAdventure", (adventure, options, toCreate, toUpdate) => {
  for ( const scene of toUpdate.Scene ?? [] ) {
    for ( const token of scene.tokens ?? [] ) {
      for ( const effect of token.delta?.effects ?? [] ) {
        // Wrap effects on deltas in a _replace to workaround https://github.com/foundryvtt/foundryvtt/issues/14373
        if ( effect.type === "condition" ) effect.system = _replace(effect.system);
      }
    }
  }
});

Hooks.on("renderCompendiumDirectory", (app, html) => applications.CompendiumBrowser.injectSidebarButton(html));

Hooks.on("renderJournalEntryPageSheet", applications.journal.JournalEntrySheet5e.onRenderJournalPageSheet);

Hooks.on("renderActiveEffectConfig", documents.ActiveEffect5e.onRenderActiveEffectConfig);

Hooks.on("renderDocumentSheetConfig", (app, html) => {
  const { document } = app.options;
  if ( (document instanceof Actor) && document.system.isGroup ) {
    applications.actor.MultiActorSheet.addDocumentSheetConfigOptions(app, html);
  }
});

Hooks.on("targetToken", canvas.Token5e.onTargetToken);

Hooks.on("renderCombatTracker", (app, html, data) => app.renderGroups(html));

Hooks.on("preCreateScene", (doc, createData, options, userId) => {
  // Set default grid units based on metric length setting
  const units = utils.defaultUnits("length");
  if ( (units !== dnd5e.grid.units) && !foundry.utils.getProperty(createData, "grid.distance")
    && !foundry.utils.getProperty(createData, "grid.units") ) {
    doc.updateSource({
      grid: { distance: utils.convertLength(dnd5e.grid.distance, dnd5e.grid.units, units, { strict: false }), units }
    });
  }
});

Hooks.on("updateWorldTime", (...args) => {
  dataModels.calendar.CalendarData5e.onUpdateWorldTime(...args);
  CONFIG.DND5E.calendar.application?.onUpdateWorldTime?.(...args);
});

/* -------------------------------------------- */
/*  Bundled Module Exports                      */
/* -------------------------------------------- */

export {
  applications,
  canvas,
  dataModels,
  dice,
  documents,
  enrichers,
  Filter,
  inserts,
  migrations,
  registry,
  utils,
  DND5E
};
