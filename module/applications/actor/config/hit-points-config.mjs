import { formatNumber } from "../../../utils.mjs";
import BaseConfigSheet from "../api/base-config-sheet.mjs";
import Ruleset from "../../../systems/ruleset.mjs";
import { mountLegacy2DocumentTheme } from "../../shared/legacy2-document-theme.mjs";

/**
 * Configuration application for hit point bonuses and current values.
 */
export default class HitPointsConfig extends BaseConfigSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["hit-points"],
    actions: {
      roll: HitPointsConfig.#rollFormula
    },
    position: {
      width: 420
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    config: {
      template: "systems/jujutsu-system/templates/actors/config/hit-points-config.hbs",
      templates: ["systems/jujutsu-system/templates/actors/config/hit-points-config-2.hbs"]
    }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /** @override */
  get title() {
    return _loc("DND5E.HitPoints");
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.data = this.document.system.attributes.hp;
    context.fields = this.document.system.schema.fields.attributes.fields.hp.fields;
    context.source = this.document.system._source.attributes.hp;
    context.otherFields = ["dt", "mt"].flatMap(p => {
      return p in context.fields ? { field: context.fields[p], value: context.source[p] } : [];
    });

    if (Ruleset.isV2() && ["character", "npc"].includes(this.document.type)) {
      const npc = this.document.type === "npc";
      const wounds = npc ? 0 : Math.max(0, Math.floor(Number(this.document.system.legacy2?.wounds?.value) || 0));
      context.jj2Health = {
        npc, automaticMax: Ruleset.maxHitPoints(this.document, { ignoreOverride: true }),
        maximumPath: npc ? "system.attributes.hp.maxOverride" : "system.attributes.hp.max",
        maximumOverride: (npc ? context.source.maxOverride : context.source.max) ?? "",
        wounds, woundReduction: Math.floor(wounds / 2)
      };
      return context;
    }

    // Display positive ability modifier as its own row, but if negative merge into classes totals
    const ability = CONFIG.DND5E.abilities[CONFIG.DND5E.defaultAbilities.hitPoints];
    const mod = this.document.system.abilities?.[CONFIG.DND5E.defaultAbilities.hitPoints]?.mod ?? 0;
    if ( ability && (mod > 0) ) context.ability = { mod, name: ability.label };

    // Summarize HP from classes
    context.classes = Object.values(this.document.classes).map(cls => ({
      id: cls.id,
      anchor: cls.toAnchor().outerHTML,
      name: cls.name,
      total: cls.advancement.byType.HitPoints?.[0]?.[mod > 0 ? "total" : "getAdjustedTotal"](mod) ?? 0
    })).sort((lhs, rhs) => rhs.name - lhs.name);

    // Display active effects targeting bonus fields
    context.effects = {
      bonuses: this.document._prepareActiveEffectAttributions("system.attributes.hp.bonuses.level"),
      max: this.document._prepareActiveEffectAttributions("system.attributes.hp.max"),
      overall: this.document._prepareActiveEffectAttributions("system.attributes.hp.bonuses.overall")
    };
    for ( const [key, value] of Object.entries(context.effects) ) {
      context.effects[key] = value
        .filter(e => e.type === "add")
        .map(e => ({ ...e, anchor: e.document.toAnchor().outerHTML}));
    }

    context.levels = this.document.system.details?.level ?? 0;
    context.levelMultiplier = `
      <span class="multiplier"><span class="times">&times;</span> ${formatNumber(context.levels)}</span>
    `;
    context.showCalculation = context.classes.length || context.fields.bonuses;
    context.showMaxInCalculation = context.showCalculation && this.document.system.isNPC;

    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    mountLegacy2DocumentTheme(this.element, "health", {
      enabled: Ruleset.isV2() && ["character", "npc"].includes(this.document.type)
    });
  }

  /**
   * Handle rolling NPC health values using the provided formula.
   * @this {HitPointsConfig}
   * @param {PointerEvent} event  The triggering click event.
   * @param {HTMLElement} target  The button that was clicked.
   * @protected
   */
  static async #rollFormula(event, target) {
    try {
      const roll = await this.document.rollNPCHitPoints();
      this.submit({ updateData: { "system.attributes.hp.max": roll.total } });
    } catch (err) {
      ui.notifications.error("DND5E.HPFormulaError", { localize: true });
      throw err;
    }
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _processSubmitData(event, form, submitData) {
    const clone = this.document.clone(foundry.utils.deepClone(submitData));
    const { value, max } = this.document.system.attributes.hp;
    const maxDelta = clone.system.attributes.hp.max - max;
    const current = submitData.system.attributes.hp.value ?? value;
    foundry.utils.setProperty(submitData, "system.attributes.hp.value", Math.max(current + maxDelta, 0));
    return super._processSubmitData(event, form, submitData);
  }
}
