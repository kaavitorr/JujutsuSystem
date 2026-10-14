import D20RollConfigurationDialog from "./d20-configuration-dialog.mjs";
import Ruleset from "../../systems/ruleset.mjs";
import { activationContext, stepActivationCounter } from "../activity/legacy2-activation.mjs";
import { mountLegacy2DocumentTheme } from "../shared/legacy2-document-theme.mjs";

/**
 * @import { AttackRollConfigurationDialogOptions } from "../../dice/_types.mjs";
 */

/**
 * Extended roll configuration dialog that allows selecting attack mode, ammunition, and weapon mastery.
 * @extends D20RollConfigurationDialog<AttackRollConfigurationDialogOptions>
 */
export default class AttackRollConfigurationDialog extends D20RollConfigurationDialog {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: { jj2StepCounter: stepActivationCounter },
    abilityOptions: [],
    ammunitionOptions: [],
    attackModeOptions: [],
    masteryOptions: []
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareConfigurationContext(context, options) {
    context = await super._prepareConfigurationContext(context, options);
    const abilityOptions = this.options.abilityOptions?.length > 1 ? this.options.abilityOptions : [];
    const optionsFields = [
      { key: "ability", label: "DND5E.Ability", options: abilityOptions },
      { key: "attackMode", label: "DND5E.ATTACK.Mode.Label", options: this.options.attackModeOptions },
      { key: "ammunition", label: "DND5E.CONSUMABLE.Type.Ammunition.Label", options: this.options.ammunitionOptions },
      { key: "mastery", label: "DND5E.WEAPON.Mastery.Label", options: this.options.masteryOptions }
    ];
    context.fields = [
      ...optionsFields.filter(() => !Ruleset.isV2()).map(({ key, label, options }) => options.length ? {
        field: new foundry.data.fields.StringField({ label: _loc(label), blank: false, required: true }),
        name: key,
        options,
        value: this.config[key]
      } : null).filter(_ => _),
      ...context.fields
    ];
    return context;
  }
  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (Ruleset.isV2() && this.config.subject?.item?.actor && parts.formulas) {
      parts.formulas.template = "systems/jujutsu-system/templates/dice/attack-configuration-2.hbs";
      parts.formulas.templates = ["systems/jujutsu-system/templates/activity/parts/activation-controls-2.hbs", "systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"];
    }
    return parts;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    mountLegacy2DocumentTheme(this.element, "attack", { enabled: Ruleset.isV2() });
  }

  /** @inheritDoc */
  async _prepareFormulasContext(context, options) {
    context = await super._prepareFormulasContext(context, options);
    if (Ruleset.isV2() && this.config.subject?.item?.actor) {
      context.jj2 = activationContext(this.config.subject, this.config.legacy2);
      context.rootId = this.id;
    }
    return context;
  }

  /** @inheritDoc */
  async _prepareButtonsContext(context, options) {
    if (!Ruleset.isV2()) return super._prepareButtonsContext(context, options);
    context.buttons = { normal: { default: true, label: "Realizar ataque" } };
    return context;
  }
}
