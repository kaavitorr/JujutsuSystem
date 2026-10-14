import ChatLog5e from "./applications/chat-log.mjs";
import CompendiumBrowser from "./applications/compendium-browser.mjs";
import BastionSettingsConfig from "./applications/settings/bastion-settings.mjs";
import CalendarSettingsConfig from "./applications/settings/calendar-settings.mjs";
import CombatSettingsConfig from "./applications/settings/combat-settings.mjs";
import CompendiumBrowserSettingsConfig from "./applications/settings/compendium-browser-settings.mjs";
import VariantRulesSettingsConfig from "./applications/settings/variant-rules-settings.mjs";
import VisibilitySettingsConfig from "./applications/settings/visibility-settings.mjs";
import BastionSetting from "./data/settings/bastion-setting.mjs";
import { CalendarConfigSetting, CalendarPreferencesSetting } from "./data/settings/calendar-setting.mjs";
import PrimaryPartySetting from "./data/settings/primary-party-setting.mjs";
import TransformationSetting from "./data/settings/transformation-setting.mjs";
import * as LEGACY from "./config-legacy.mjs";

const { ArrayField, NumberField, StringField } = foundry.data.fields;

/**
 * Register all of the system's keybindings.
 */
export function registerSystemKeybindings() {
  game.keybindings.register("jujutsu-system", "skipDialogNormal", {
    name: "KEYBINDINGS.DND5E.SkipDialogNormal",
    editable: [{ key: "ShiftLeft" }, { key: "ShiftRight" }]
  });

  game.keybindings.register("jujutsu-system", "skipDialogAdvantage", {
    name: "KEYBINDINGS.DND5E.SkipDialogAdvantage",
    editable: [{ key: "AltLeft" }, { key: "AltRight" }]
  });

  game.keybindings.register("jujutsu-system", "skipDialogDisadvantage", {
    name: "KEYBINDINGS.DND5E.SkipDialogDisadvantage",
    editable: [{ key: "ControlLeft" }, { key: "ControlRight" }, { key: "OsLeft" }, { key: "OsRight" }]
  });

  game.keybindings.register("jujutsu-system", "dragCopy", {
    name: "KEYBINDINGS.DND5E.DragCopy",
    editable: [{ key: "ControlLeft" }, { key: "ControlRight" }, { key: "AltLeft" }, { key: "AltRight" }]
  });

  game.keybindings.register("jujutsu-system", "dragMove", {
    name: "KEYBINDINGS.DND5E.DragMove",
    editable: [{ key: "ShiftLeft" }, { key: "ShiftRight" }, { key: "OsLeft" }, { key: "OsRight" }]
  });

  game.keybindings.register("dnd5e", "toggleSheetMode", {
    name: "KEYBINDINGS.DND5E.ToggleSheetMode",
    editable: [{ key: "KeyE", modifiers: ["Shift"] }],
    onDown: () => {
      const app = ui.activeWindow;
      if ( !app?.rendered || !app.changeMode || !app.isEditable ) return false;
      app.changeMode();
      return true;
    }
  });

  game.keybindings.register("dnd5e", "openCompendiumBrowser", {
    name: "KEYBINDINGS.DND5E.OpenCompendiumBrowser",
    editable: [{ key: "KeyB", modifiers: ["Shift"] }],
    onDown: () => {
      const existing = Array.from(foundry.applications.instances.values())
        .find(app => app instanceof CompendiumBrowser && app.rendered);
      if ( existing ) existing.bringToFront();
      else new CompendiumBrowser().render({ force: true });
      return true;
    }
  });
}

/* -------------------------------------------- */

/**
 * Register all of the system's settings.
 */
export function registerSystemSettings() {
  game.settings.register("jujutsu-system", "characterCreation2Enabled", {
    name: "Criação de Personagem — Jujutsu 2.0",
    hint: "Abrir o criador em tela cheia ao criar uma nova ficha de personagem na versão 2.0.",
    scope: "world", config: true, type: Boolean, default: true
  });
  // Internal System Migration Version
  game.settings.register("jujutsu-system", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // Track whether this the first time the GM has launched this world
  game.settings.register("jujutsu-system", "firstRun", {
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  // Jujutsu Legacy 2.0 — requisitos de especialização editados pelo GM
  // (camada sobre o compendium: nome do nó → lista efetiva de requisitos)
  // Jujutsu Legacy 2.0 — linhas de conexão escondidas pelo GM
  // (pares "origem|destino" que não devem ser desenhados)
  game.settings.register("jujutsu-system", "especializacoesOcultas", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register("jujutsu-system", "especializacoesReq", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Jujutsu Legacy 2.0 — versão das regras da ficha (1.0 = d20 clássico do fork)
  game.settings.register("jujutsu-system", "rulesetVersion", {
    name: "JUJUTSU.2.Settings.RulesetVersion.Name",
    hint: "JUJUTSU.2.Settings.RulesetVersion.Hint",
    scope: "world",
    config: true,
    default: "1.0",
    type: String,
    requiresReload: true,
    choices: {
      "1.0": "JUJUTSU.2.Settings.RulesetVersion.V1",
      "2.0": "JUJUTSU.2.Settings.RulesetVersion.V2"
    }
  });

  // Polymorph Settings
  game.settings.register("jujutsu-system", "transformationSettings", {
    scope: "client",
    config: false,
    type: TransformationSetting
  });

  // Rules version
  game.settings.register("jujutsu-system", "rulesVersion", {
    name: "SETTINGS.DND5E.RULESVERSION.Name",
    hint: "SETTINGS.DND5E.RULESVERSION.Hint",
    scope: "world",
    config: true,
    default: "modern",
    type: String,
    choices: {
      modern: "SETTINGS.DND5E.RULESVERSION.Modern",
      legacy: "SETTINGS.DND5E.RULESVERSION.Legacy"
    },
    requiresReload: true
  });

  // Movement automation
  game.settings.register("jujutsu-system", "movementAutomation", {
    name: "SETTINGS.DND5E.AUTOMATION.Movement.Name",
    hint: "SETTINGS.DND5E.AUTOMATION.Movement.Hint",
    scope: "world",
    config: true,
    default: "full",
    type: String,
    choices: {
      full: "SETTINGS.DND5E.AUTOMATION.Movement.Full",
      noBlocking: "SETTINGS.DND5E.AUTOMATION.Movement.NoBlocking",
      none: "SETTINGS.DND5E.AUTOMATION.Movement.None"
    }
  });

  // Falling automation
  game.settings.register("jujutsu-system", "disableFalling", {
    config: true,
    default: false,
    hint: "SETTINGS.DND5E.AUTOMATION.Falling.Hint",
    name: "SETTINGS.DND5E.AUTOMATION.Falling.Name",
    scope: "world",
    type: Boolean
  });

  // Token size sync
  game.settings.register("jujutsu-system", "tokenSizeSync", {
    name: "SETTINGS.DND5E.AUTOMATION.Autosize.Name",
    hint: "SETTINGS.DND5E.AUTOMATION.Autosize.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    requiresReload: true
  });

  // Sense-to-token vision sync
  game.settings.register("jujutsu-system", "senseVisionSync", {
    name: "SETTINGS.DND5E.AUTOMATION.SenseVision.Name",
    hint: "SETTINGS.DND5E.AUTOMATION.SenseVision.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => {
      if ( canvas?.ready ) canvas.draw();
    }
  });

  // Allow rotating square templates
  game.settings.register("jujutsu-system", "gridAlignedSquareTemplates", {
    name: "SETTINGS.5eGridAlignedSquareTemplatesN",
    hint: "SETTINGS.5eGridAlignedSquareTemplatesL",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  // Loyalty
  game.settings.register("jujutsu-system", "loyaltyScore", {
    name: "SETTINGS.DND5E.LOYALTY.Name",
    hint: "SETTINGS.DND5E.LOYALTY.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  // Piety
  game.settings.register("jujutsu-system", "pietyScore", {
    name: "SETTINGS.DND5E.PIETY.Name",
    hint: "SETTINGS.DND5E.PIETY.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  // Disable Advancements
  game.settings.register("jujutsu-system", "disableAdvancements", {
    name: "SETTINGS.5eNoAdvancementsN",
    hint: "SETTINGS.5eNoAdvancementsL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Disable Concentration Tracking
  game.settings.register("jujutsu-system", "disableConcentration", {
    name: "SETTINGS.5eNoConcentrationN",
    hint: "SETTINGS.5eNoConcentrationL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Disable Exhaustion Automation
  game.settings.register("jujutsu-system", "disableExhaustion", {
    name: "SETTINGS.5eNoExhaustionN",
    hint: "SETTINGS.5eNoExhaustionL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  // Chat card summaries
  game.settings.register("jujutsu-system", "chatCardSummary", {
    config: true,
    default: true,
    hint: "SETTINGS.DND5E.SUMMARIZECHAT.Hint",
    name: "SETTINGS.DND5E.SUMMARIZECHAT.Name",
    scope: "client",
    type: Boolean
  });

  // Collapse Item Cards (by default)
  game.settings.register("jujutsu-system", "autoCollapseItemCards", {
    name: "SETTINGS.5eAutoCollapseCardN",
    hint: "SETTINGS.5eAutoCollapseCardL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: s => {
      ui.chat.render();
    }
  });

  // Collapse Chat Card Trays
  game.settings.register("jujutsu-system", "autoCollapseChatTrays", {
    name: "SETTINGS.DND5E.COLLAPSETRAYS.Name",
    hint: "SETTINGS.DND5E.COLLAPSETRAYS.Hint",
    scope: "client",
    config: true,
    default: "older",
    type: String,
    choices: {
      manual: "SETTINGS.DND5E.COLLAPSETRAYS.Manual",
      never: "SETTINGS.DND5E.COLLAPSETRAYS.Never",
      older: "SETTINGS.DND5E.COLLAPSETRAYS.Older",
      always: "SETTINGS.DND5E.COLLAPSETRAYS.Always"
    }
  });

  // Chat log theme
  game.settings.register("jujutsu-system", "chatLogTheme", {
    config: true,
    hint: "SETTINGS.DND5E.CHATLOG.Hint",
    name: "SETTINGS.DND5E.CHATLOG.Name",
    onChange: () => ChatLog5e.applyTheme(),
    scope: "client",
    type: new foundry.data.fields.StringField({
      blank: true,
      choices: {
        "": "SETTINGS.DND5E.CHATLOG.Options.blank",
        dark: "SETTINGS.DND5E.CHATLOG.Options.dark",
        light: "SETTINGS.DND5E.CHATLOG.Options.light"
      },
      initial: "",
      required: true
    })
  });

  // Allow Player use of Damage Application Tray
  game.settings.register("jujutsu-system", "allowPlayerDamageTray", {
    name: "SETTINGS.DND5E.PERMISSIONS.AllowDamage.Name",
    hint: "SETTINGS.DND5E.PERMISSIONS.AllowDamage.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Allow Player use of Effect Application Tray
  game.settings.register("jujutsu-system", "allowPlayerEffectsTray", {
    name: "SETTINGS.DND5E.PERMISSIONS.AllowEffects.Name",
    hint: "SETTINGS.DND5E.PERMISSIONS.AllowEffects.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Allow Rests from Sheet
  game.settings.register("jujutsu-system", "allowRests", {
    name: "SETTINGS.DND5E.PERMISSIONS.AllowRests.Name",
    hint: "SETTINGS.DND5E.PERMISSIONS.AllowRests.Hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  // Allow Polymorphing
  game.settings.register("jujutsu-system", "allowPolymorphing", {
    name: "SETTINGS.DND5E.PERMISSIONS.AllowTransformation.Name",
    hint: "SETTINGS.DND5E.PERMISSIONS.AllowTransformation.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Allow Summoning
  game.settings.register("jujutsu-system", "allowSummoning", {
    name: "SETTINGS.DND5E.PERMISSIONS.AllowSummoning.Name",
    hint: "SETTINGS.DND5E.PERMISSIONS.AllowSummoning.Hint",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  // Metric Length Weights
  game.settings.register("jujutsu-system", "metricLengthUnits", {
    name: "SETTINGS.DND5E.METRIC.LengthUnits.Name",
    hint: "SETTINGS.DND5E.METRIC.LengthUnits.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Metric Volume Weights
  game.settings.register("jujutsu-system", "metricVolumeUnits", {
    name: "SETTINGS.DND5E.METRIC.VolumeUnits.Name",
    hint: "SETTINGS.DND5E.METRIC.VolumeUnits.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Metric Unit Weights
  game.settings.register("jujutsu-system", "metricWeightUnits", {
    name: "SETTINGS.DND5E.METRIC.WeightUnits.Name",
    hint: "SETTINGS.DND5E.METRIC.WeightUnits.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Strict validation
  game.settings.register("jujutsu-system", "strictValidation", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  // Compendium Browser source exclusion
  game.settings.registerMenu("jujutsu-system", "packSourceConfiguration", {
    name: "DND5E.CompendiumBrowser.Sources.Name",
    label: "DND5E.CompendiumBrowser.Sources.Label",
    hint: "DND5E.CompendiumBrowser.Sources.Hint",
    icon: "fas fa-book-open-reader",
    type: CompendiumBrowserSettingsConfig,
    restricted: true
  });

  game.settings.register("jujutsu-system", "packSourceConfiguration", {
    name: "Pack Source Configuration",
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => {
      // Refresh all open Compendium Browser instances when source configuration changes
      foundry.applications.instances.forEach(app => {
        if ( app instanceof CompendiumBrowser ) {
          app.render({ parts: ["results", "filters"], changedTab: true });
        }
      });
    }
  });

  // Bastions
  game.settings.registerMenu("jujutsu-system", "bastionConfiguration", {
    name: "DND5E.Bastion.Configuration.Name",
    label: "DND5E.Bastion.Configuration.Label",
    hint: "DND5E.Bastion.Configuration.Hint",
    icon: "fas fa-chess-rook",
    type: BastionSettingsConfig,
    restricted: true
  });

  game.settings.register("jujutsu-system", "bastionConfiguration", {
    name: "Bastion Configuration",
    scope: "world",
    config: false,
    type: BastionSetting,
    default: {
      button: false,
      enabled: false,
      duration: 7
    },
    onChange: () => game.dnd5e.bastion.initializeUI()
  });

  game.settings.register("jujutsu-system", "bastionTurns", {
    name: "Bastion Turns",
    scope: "world",
    config: false,
    type: new ArrayField(new NumberField())
  });

  // Calendar Settings
  game.settings.registerMenu("jujutsu-system", "calendarConfiguration", {
    name: "DND5E.CALENDAR.Configuration.Name",
    label: "DND5E.CALENDAR.Configuration.Label",
    hint: "DND5E.CALENDAR.Configuration.Hint",
    icon: "fas fa-calendar-days",
    type: CalendarSettingsConfig
  });

  game.settings.register("jujutsu-system", "calendar", {
    name: "DND5E.CALENDAR.FIELDS.calendar.label",
    hint: "DND5E.CALENDAR.FIELDS.calendar.hint",
    scope: "world",
    config: false,
    type: new StringField({
      required: true, blank: false, initial: "gregorian", choices: () => Object.fromEntries(
        CONFIG.DND5E.calendar.calendars.map(({ value, label }) => [value, label])
      )
    }),
    requiresReload: true
  });

  game.settings.register("jujutsu-system", "calendarConfig", {
    name: "Calendar Configuration",
    scope: "world",
    config: false,
    type: CalendarConfigSetting,
    onChange: () => {
      dnd5e.bastion.initializeUI();
      dnd5e.ui.calendar?.onUpdateSettings?.();
    }
  });

  game.settings.register("jujutsu-system", "calendarPreferences", {
    name: "Calendar Preferences",
    scope: "user",
    config: false,
    type: CalendarPreferencesSetting,
    onChange: () => dnd5e.ui.calendar?.onUpdateSettings?.()
  });

  // Combat Settings
  game.settings.registerMenu("jujutsu-system", "combatConfiguration", {
    name: "SETTINGS.DND5E.COMBAT.Name",
    label: "SETTINGS.DND5E.COMBAT.Label",
    hint: "SETTINGS.DND5E.COMBAT.Hint",
    icon: "fas fa-explosion",
    type: CombatSettingsConfig,
    restricted: true
  });

  game.settings.register("jujutsu-system", "autoRecharge", {
    name: "SETTINGS.DND5E.NPCS.AutoRecharge.Name",
    hint: "SETTINGS.DND5E.NPCS.AutoRecharge.Hint",
    scope: "world",
    config: false,
    default: "no",
    type: String,
    choices: {
      no: "SETTINGS.DND5E.NPCS.AutoRecharge.No",
      silent: "SETTINGS.DND5E.NPCS.AutoRecharge.Silent",
      yes: "SETTINGS.DND5E.NPCS.AutoRecharge.Yes"
    }
  });

  game.settings.register("jujutsu-system", "autoRollNPCHP", {
    name: "SETTINGS.DND5E.NPCS.AutoRollNPCHP.Name",
    hint: "SETTINGS.DND5E.NPCS.AutoRollNPCHP.Hint",
    scope: "world",
    config: false,
    default: "no",
    type: String,
    choices: {
      no: "SETTINGS.DND5E.NPCS.AutoRollNPCHP.No",
      silent: "SETTINGS.DND5E.NPCS.AutoRollNPCHP.Silent",
      yes: "SETTINGS.DND5E.NPCS.AutoRollNPCHP.Yes"
    }
  });

  game.settings.register("jujutsu-system", "criticalDamageModifiers", {
    name: "SETTINGS.DND5E.CRITICAL.MultiplyModifiers.Name",
    hint: "SETTINGS.DND5E.CRITICAL.MultiplyModifiers.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("jujutsu-system", "criticalDamageMaxDice", {
    name: "SETTINGS.DND5E.CRITICAL.MaxDice.Name",
    hint: "SETTINGS.DND5E.CRITICAL.MaxDice.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register("jujutsu-system", "encounterPlacementBehavior", {
    name: "SETTINGS.DND5E.ENCOUNTERS.EncounterPlacementBehavior.Name",
    hint: "SETTINGS.DND5E.ENCOUNTERS.EncounterPlacementBehavior.Hint",
    scope: "world",
    config: false,
    default: "none",
    type: String,
    choices: {
      none: "SETTINGS.DND5E.ENCOUNTERS.EncounterPlacementBehavior.None",
      createCombatants: "SETTINGS.DND5E.ENCOUNTERS.EncounterPlacementBehavior.CreateCombatants",
      rollInitiative: "SETTINGS.DND5E.ENCOUNTERS.EncounterPlacementBehavior.RollInitiative"
    }
  });

  game.settings.register("jujutsu-system", "initiativeDexTiebreaker", {
    name: "SETTINGS.DND5E.COMBAT.DexTiebreaker.Name",
    hint: "SETTINGS.DND5E.COMBAT.DexTiebreaker.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  // 2.0: iniciativa dinâmica — todos rerolam no início de cada rodada
  game.settings.register("jujutsu-system", "iniciativaDinamica", {
    name: "Iniciativa Dinâmica (2.0)",
    hint: "No início de cada rodada a iniciativa de todos é rolada novamente e o resultado aparece num card compacto no chat.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register("jujutsu-system", "initiativeGroupCombatants", {
    name: "SETTINGS.DND5E.COMBAT.InitiativeGroupCombatants.Name",
    hint: "SETTINGS.DND5E.COMBAT.InitiativeGroupCombatants.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("jujutsu-system", "initiativeGroupRoll", {
    name: "SETTINGS.DND5E.COMBAT.InitiativeGroupRoll.Name",
    hint: "SETTINGS.DND5E.COMBAT.InitiativeGroupRoll.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("jujutsu-system", "initiativeScore", {
    name: "SETTINGS.DND5E.COMBAT.InitiativeScore.Name",
    hint: "SETTINGS.DND5E.COMBAT.InitiativeScore.Hint",
    scope: "world",
    config: false,
    default: "none",
    type: String,
    choices: {
      none: "SETTINGS.DND5E.COMBAT.InitiativeScore.None",
      npcs: "SETTINGS.DND5E.COMBAT.InitiativeScore.NPCs",
      all: "SETTINGS.DND5E.COMBAT.InitiativeScore.All"
    }
  });

  game.settings.register("jujutsu-system", "autoApplyDowned", {
    name: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.Name",
    hint: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.Hint",
    scope: "world",
    config: false,
    default: "none",
    type: String,
    choices: {
      none: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.None",
      deadOnly: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.DeadOnly",
      npcs: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.NPCs",
      all: "SETTINGS.DND5E.COMBAT.AutoApplyDowned.All"
    }
  });

  // Variant Rules
  game.settings.registerMenu("jujutsu-system", "variantRulesConfiguration", {
    name: "SETTINGS.DND5E.VARIANT.Name",
    label: "SETTINGS.DND5E.VARIANT.Label",
    hint: "SETTINGS.DND5E.VARIANT.Hint",
    icon: "fas fa-list-check",
    type: VariantRulesSettingsConfig,
    restricted: true
  });

  game.settings.register("jujutsu-system", "allowFeats", {
    name: "SETTINGS.DND5E.VARIANT.AllowFeats.Name",
    hint: "SETTINGS.DND5E.VARIANT.AllowFeats.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("jujutsu-system", "currencyWeight", {
    name: "SETTINGS.DND5E.VARIANT.CurrencyWeight.Name",
    hint: "SETTINGS.DND5E.VARIANT.CurrencyWeight.Hint",
    scope: "world",
    config: false,
    default: true,
    type: Boolean
  });

  game.settings.register("jujutsu-system", "encumbrance", {
    name: "SETTINGS.DND5E.VARIANT.Encumbrance.Name",
    hint: "SETTINGS.DND5E.VARIANT.Encumbrance.Hint",
    scope: "world",
    config: false,
    default: "none",
    type: String,
    choices: {
      none: "SETTINGS.DND5E.VARIANT.Encumbrance.None",
      normal: "SETTINGS.DND5E.VARIANT.Encumbrance.Normal",
      variant: "SETTINGS.DND5E.VARIANT.Encumbrance.Variant"
    }
  });

  game.settings.register("jujutsu-system", "honorScore", {
    name: "SETTINGS.DND5E.VARIANT.HonorScore.Name",
    hint: "SETTINGS.DND5E.VARIANT.HonorScore.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  game.settings.register("jujutsu-system", "levelingMode", {
    name: "SETTINGS.DND5E.VARIANT.LevelingMode.Name",
    hint: "SETTINGS.DND5E.VARIANT.LevelingMode.Hint",
    scope: "world",
    config: false,
    default: "xpBoons",
    type: String,
    choices: {
      noxp: "SETTINGS.DND5E.VARIANT.LevelingMode.NoXP",
      xp: "SETTINGS.DND5E.VARIANT.LevelingMode.XP",
      xpBoons: "SETTINGS.DND5E.VARIANT.LevelingMode.XPBoons"
    }
  });

  game.settings.register("jujutsu-system", "proficiencyModifier", {
    name: "SETTINGS.DND5E.VARIANT.ProficiencyModifier.Name",
    hint: "SETTINGS.DND5E.VARIANT.ProficiencyModifier.Hint",
    scope: "world",
    config: false,
    default: "bonus",
    type: String,
    choices: {
      bonus: "SETTINGS.DND5E.VARIANT.ProficiencyModifier.Bonus",
      dice: "SETTINGS.DND5E.VARIANT.ProficiencyModifier.Dice"
    }
  });

  game.settings.register("jujutsu-system", "restVariant", {
    name: "SETTINGS.DND5E.VARIANT.Rest.Name",
    hint: "SETTINGS.DND5E.VARIANT.Rest.Hint",
    scope: "world",
    config: false,
    default: "normal",
    type: String,
    choices: {
      normal: "SETTINGS.DND5E.VARIANT.Rest.Normal",
      gritty: "SETTINGS.DND5E.VARIANT.Rest.Gritty",
      epic: "SETTINGS.DND5E.VARIANT.Rest.Epic"
    }
  });

  game.settings.register("jujutsu-system", "sanityScore", {
    name: "SETTINGS.DND5E.VARIANT.SanityScore.Name",
    hint: "SETTINGS.DND5E.VARIANT.SanityScore.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean,
    requiresReload: true
  });

  // Visibility Settings
  game.settings.registerMenu("jujutsu-system", "visibilityConfiguration", {
    name: "SETTINGS.DND5E.VISIBILITY.Name",
    label: "SETTINGS.DND5E.VISIBILITY.Label",
    hint: "SETTINGS.DND5E.VISIBILITY.Hint",
    icon: "fas fa-eye",
    type: VisibilitySettingsConfig,
    restricted: true
  });

  game.settings.register("jujutsu-system", "attackRollVisibility", {
    name: "SETTINGS.DND5E.VISIBILITY.Attack.Name",
    hint: "SETTINGS.DND5E.VISIBILITY.Attack.Hint",
    scope: "world",
    config: false,
    default: "none",
    type: String,
    choices: {
      all: "SETTINGS.DND5E.VISIBILITY.Attack.All",
      hideAC: "SETTINGS.DND5E.VISIBILITY.Attack.HideAC",
      none: "SETTINGS.DND5E.VISIBILITY.Attack.None"
    }
  });

  game.settings.register("jujutsu-system", "bloodied", {
    name: "SETTINGS.DND5E.BLOODIED.Name",
    hint: "SETTINGS.DND5E.BLOODIED.Hint",
    scope: "world",
    config: false,
    default: "player",
    type: String,
    choices: {
      all: "SETTINGS.DND5E.BLOODIED.All",
      player: "SETTINGS.DND5E.BLOODIED.Player",
      none: "SETTINGS.DND5E.BLOODIED.None"
    }
  });

  game.settings.register("jujutsu-system", "challengeVisibility", {
    name: "SETTINGS.DND5E.VISIBILITY.Challenge.Name",
    hint: "SETTINGS.DND5E.VISIBILITY.Challenge.Hint",
    scope: "world",
    config: false,
    default: "player",
    type: String,
    choices: {
      all: "SETTINGS.DND5E.VISIBILITY.Challenge.All",
      player: "SETTINGS.DND5E.VISIBILITY.Challenge.Player",
      none: "SETTINGS.DND5E.VISIBILITY.Challenge.None"
    }
  });

  game.settings.register("jujutsu-system", "concealItemDescriptions", {
    name: "SETTINGS.DND5E.VISIBILITY.ItemDescriptions.Name",
    hint: "SETTINGS.DND5E.VISIBILITY.ItemDescriptions.Hint",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
  });

  // Primary Group
  game.settings.register("jujutsu-system", "primaryParty", {
    name: "Primary Party",
    scope: "world",
    config: false,
    default: null,
    type: PrimaryPartySetting,
    onChange: s => ui.actors.render()
  });

  // Control hints
  game.settings.register("jujutsu-system", "controlHints", {
    name: "DND5E.Controls.Name",
    hint: "DND5E.Controls.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // NPC sheet default skills
  game.settings.register("jujutsu-system", "defaultSkills", {
    name: "SETTINGS.DND5E.DEFAULTSKILLS.Name",
    hint: "SETTINGS.DND5E.DEFAULTSKILLS.Hint",
    type: new foundry.data.fields.SetField(
      new foundry.data.fields.StringField({
        choices: () => CONFIG.DND5E.skills
      })
    ),
    default: [],
    config: true
  });

  cacheSettings();
}

/* -------------------------------------------- */

/**
 * Cache various World settings to improve performance.
 */
function cacheSettings() {
  dnd5e.settings = {};
  for ( const setting of game.settings.settings.values() ) {
    const { key, namespace, onChange, requiresReload, scope } = setting;
    if ( (scope !== "world") || (namespace !== "jujutsu-system") ) continue;
    dnd5e.settings[key] = game.settings.get(namespace, key);
    if ( !requiresReload ) setting.onChange = (value, ...args) => {
      dnd5e.settings[key] = value;
      onChange?.(value, ...args);
    };
  }
}

/* -------------------------------------------- */

/**
 * Register additional settings after modules have had a chance to initialize to give them a chance to modify choices.
 */
export function registerDeferredSettings() {
  game.settings.register("jujutsu-system", "defaultDocumentSubtypes", {
    name: "Default Document Subtypes",
    scope: "client",
    config: false,
    type: Object,
    default: { Actor: game.user.isGM ? "npc" : "character", Item: "feat" }
  });

  matchMedia("(prefers-contrast: more)").addEventListener("change", setThemeFlags);
  setThemeFlags();
}

/* -------------------------------------------- */

/**
 * Update configuration data when legacy rules are set.
 */
export function applyLegacyRules() {
  const DND5E = CONFIG.DND5E;

  // Set half-casters to round down.
  DND5E.spellcasting.spell.progression.half.roundUp = false;

  // Adjust Wild Shape and Polymorph presets.
  for ( const preset of ["polymorph", "wildshape"] ) {
    DND5E.transformation.presets[preset].settings.keep.delete("hp");
    DND5E.transformation.presets[preset].settings.keep.delete("languages");
    DND5E.transformation.presets[preset].settings.keep.delete("type");
    delete DND5E.transformation.presets[preset].settings.tempFormula;
  }

  // Adjust language categories.
  delete DND5E.languages.standard.children.sign;
  DND5E.languages.exotic.children.draconic = DND5E.languages.standard.children.draconic;
  delete DND5E.languages.standard.children.draconic;
  DND5E.languages.cant = DND5E.languages.exotic.children.cant;
  delete DND5E.languages.exotic.children.cant;
  DND5E.languages.druidic = DND5E.languages.exotic.children.druidic;
  delete DND5E.languages.exotic.children.druidic;

  // Stunned stops movement in legacy & surprised doesn't provide initiative disadvantage.
  DND5E.conditionEffects.noMovement.add("stunned");
  DND5E.conditionEffects.initiativeAdvantage.delete("invisible");
  DND5E.conditionEffects.initiativeDisadvantage.delete("incapacitated");
  DND5E.conditionEffects.initiativeDisadvantage.delete("surprised");

  // Add exhaustion effects.
  DND5E.conditionEffects.noMovement.add("exhaustion-5");
  DND5E.conditionEffects.halfMovement.add("exhaustion-2");
  DND5E.conditionEffects.halfHealth.add("exhaustion-4");
  DND5E.conditionEffects.abilityCheckDisadvantage.add("exhaustion-1");
  DND5E.conditionEffects.abilitySaveDisadvantage.add("exhaustion-3");
  DND5E.conditionEffects.attackDisadvantage.add("exhaustion-3");
  delete DND5E.conditionTypes.exhaustion.reduction;

  // Incapacitated creatures within 2 size categories still cannot be moved through in legacy
  delete DND5E.conditionTypes.incapacitated.neverBlockMovement;

  // Adjust references.
  Object.assign(DND5E.rules, LEGACY.RULES);
  for ( const [cat, value] of Object.entries(LEGACY.REFERENCES) ) {
    Object.entries(value).forEach(([k, v]) => DND5E[cat][k].reference = v);
  }

  // Adjust base item IDs.
  for ( const [cat, value] of Object.entries(LEGACY.IDS) ) {
    if ( cat === "focusTypes" ) Object.entries(value).forEach(([k, v]) => DND5E[cat][k].itemIds = v);
    else if ( cat === "tools" ) Object.entries(value).forEach(([k, v]) => DND5E[cat][k].id = v);
    else DND5E[cat] = value;
  }

  // Swap spell lists.
  DND5E.SPELL_LISTS = LEGACY.SPELL_LISTS;
}

/* -------------------------------------------- */

/**
 * Disable exhaustion automation if applicable.
 */
export function disableExhaustionAutomation() {
  const DND5E = CONFIG.DND5E;

  // Roll and speed reductions (modern) and death at maximum level.
  delete DND5E.conditionTypes.exhaustion.reduction;
  delete DND5E.conditionTypes.exhaustion.conditions;

  // Graded condition effects (legacy).
  for ( const effects of Object.values(DND5E.conditionEffects) ) {
    for ( const key of effects ) {
      if ( key.startsWith("exhaustion-") ) effects.delete(key);
    }
  }

  // Exhaustion recovered on a long rest.
  delete DND5E.restTypes.long.exhaustionDelta;
}

/* -------------------------------------------- */

/**
 * Apply theming flag classes to the document body based on user preferences.
 */
export function setThemeFlags() {
  document.body.classList.toggle("dnd5e-flag-high-contrast", matchMedia("(prefers-contrast: more)").matches);
}
