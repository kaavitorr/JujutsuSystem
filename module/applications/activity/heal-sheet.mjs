import ActivitySheet from "./activity-sheet.mjs";

/**
 * Sheet for the healing activity.
 */
export default class HealSheet extends ActivitySheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["heal-activity"],
    actions: {
      jjResetHealLimit: HealSheet.#resetHealLimit
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    effect: {
      template: "systems/jujutsu-system/templates/activity/heal-effect.hbs",
      templates: [
        ...super.PARTS.effect.templates,
        "systems/jujutsu-system/templates/activity/parts/damage-part.hbs",
        "systems/jujutsu-system/templates/activity/parts/heal-healing.hbs",
        "systems/jujutsu-system/templates/activity/parts/heal-limit.hbs",
        "systems/jujutsu-system/templates/activity/parts/jj-scale.hbs"
      ]
    }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareEffectContext(context, options) {
    context = await super._prepareEffectContext(context, options);
    context.typeOptions = Object.entries(CONFIG.DND5E.healingTypes).map(([value, config]) => ({
      value, label: config.label, selected: context.activity.healing.types.has(value)
    }));
    const scaleKey = (this.item.type === "spell" && this.item.system.level === 0) ? "labelCantrip" : "label";
    context.scalingOptions = [
      { value: "", label: game.i18n.localize("DND5E.DAMAGE.Scaling.None") },
      ...Object.entries(CONFIG.DND5E.damageScalingModes).map(([value, { [scaleKey]: label }]) => ({ value, label }))
    ];

    // ── Limite total de cura (mecânica JJK) ─────────────────────────────────
    const lim = this.activity.getHealLimit();
    const reset = this.activity.healLimit?.reset ?? "";
    context.healLimit = {
      enabled: lim.enabled,
      max: Number.isFinite(lim.max) ? lim.max : 0,
      spent: lim.spent,
      remaining: Number.isFinite(lim.remaining) ? lim.remaining : 0,
      reset,
      isLongRest: reset === "longRest",
      isTechnique: reset === "technique"
    };
    context.healResetOptions = [
      { value: "",            label: "Manual (só botão / reset manual)" },
      { value: "shortRest",   label: "Descanso Curto" },
      { value: "longRest",    label: "Descanso Longo" },
      { value: "fulgorNegro", label: "Atingir um Fulgor Negro" },
      { value: "technique",   label: "Técnica específica" }
    ];
    // Técnicas do ator (itens ativáveis) para o gatilho de reset por técnica.
    const actor = this.item.actor;
    const selTech = this.activity.healLimit?.technique ?? "";
    context.healTechniqueOptions = actor
      ? [
          { value: "", label: "— selecione uma técnica —" },
          ...actor.items
            .filter(i => (i.id !== this.item.id) && ((i.system.activities?.size ?? 0) > 0 || i.type === "spell"))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(i => ({ value: i.id, label: i.name, selected: i.id === selTech }))
        ]
      : [];
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Reseta manualmente o total de cura já usado.
   * @this {HealSheet}
   */
  static async #resetHealLimit() {
    await this.activity.update({ "healLimit.spent": 0, "healLimit.restCount": 0 });
    ui.notifications.info(`${this.item.name}: limite de cura resetado.`);
  }
}
