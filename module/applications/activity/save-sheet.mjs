import ActivitySheet from "./activity-sheet.mjs";

/**
 * Sheet for the save activity.
 */
export default class SaveSheet extends ActivitySheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["save-activity"]
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    effect: {
      template: "systems/jujutsu-system/templates/activity/save-effect.hbs",
      templates: [
        ...super.PARTS.effect.templates,
        "systems/jujutsu-system/templates/activity/parts/damage-part.hbs",
        "systems/jujutsu-system/templates/activity/parts/damage-parts.hbs",
        "systems/jujutsu-system/templates/activity/parts/save-damage.hbs",
        "systems/jujutsu-system/templates/activity/parts/save-details.hbs",
        "systems/jujutsu-system/templates/activity/parts/save-effect-settings.hbs",
        "systems/jujutsu-system/templates/activity/parts/jj-scale.hbs"
      ]
    }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  _prepareAppliedEffectContext(context, effect) {
    effect.additionalSettings = "systems/jujutsu-system/templates/activity/parts/save-effect-settings.hbs";
    return effect;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareEffectContext(context, options) {
    context = await super._prepareEffectContext(context, options);

    context.abilityOptions = Object.entries(CONFIG.DND5E.abilities).map(([value, config]) => ({
      value, label: config.label
    }));
    context.calculationOptions = [
      { value: "", label: _loc("DND5E.SAVE.FIELDS.save.dc.CustomFormula") },
      { rule: true },
      { value: "spellcasting", label: _loc("DND5E.SpellAbility") },
      ...Object.entries(CONFIG.DND5E.abilities).map(([value, config]) => ({
        value, label: config.label, group: _loc("DND5E.Abilities")
      }))
    ];
    context.onSaveOptions = [
      { value: "none", label: _loc("DND5E.SAVE.FIELDS.damage.onSave.None") },
      { value: "half", label: _loc("DND5E.SAVE.FIELDS.damage.onSave.Half") },
      { value: "full", label: _loc("DND5E.SAVE.FIELDS.damage.onSave.Full") }
    ];

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareIdentityContext(context) {
    context = await super._prepareIdentityContext(context);
    context.behaviorFields.push({
      field: context.fields.save.fields.visible,
      value: context.source.save.visible,
      input: context.inputs.createCheckboxInput
    });
    return context;
  }
}
