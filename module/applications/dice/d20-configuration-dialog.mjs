import RollConfigurationDialog from "./roll-configuration-dialog.mjs";
import Ruleset from "../../systems/ruleset.mjs";
import { mountLegacy2DocumentTheme } from "../shared/legacy2-document-theme.mjs";
import { hasLegacy2Test, testRollChoices, applyLegacy2TestRoll, testRollBreakdown } from "./legacy2-test-roll.mjs";
import { stepActivationCounter } from "../activity/legacy2-activation.mjs";

/**
 * @import {
 *   BasicRollConfigurationDialogOptions, BasicRollMessageConfiguration, D20RollProcessConfiguration
 * } from "../../dice/_types.mjs";
 */

/**
 * Dialog for configuring d20 rolls.
 * @extends {RollConfigurationDialog}
 *
 * @param {D20RollProcessConfiguration} [config={}]           Initial roll configuration.
 * @param {BasicRollMessageConfiguration} [message={}]        Message configuration.
 * @param {BasicRollConfigurationDialogOptions} [options={}]  Dialog rendering options.
 */
export default class D20RollConfigurationDialog extends RollConfigurationDialog {

  static DEFAULT_OPTIONS = { actions: { jj2StepCounter: stepActivationCounter } };

  static PARTS = {
    ...super.PARTS,
    breakdown: { template: "systems/jujutsu-system/templates/dice/test-breakdown-2.hbs" }
  };

  /** @override */
  static get rollType() {
    return CONFIG.Dice.D20Roll;
  }

  /* -------------------------------------------- */

  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if (hasLegacy2Test(this.config) && options.parts?.includes("formulas") && !options.parts.includes("breakdown")) {
      options.parts.push("breakdown");
    }
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!hasLegacy2Test(this.config)) { delete parts.breakdown; return parts; }
    if (parts.formulas) {
      parts.formulas.template = "systems/jujutsu-system/templates/dice/test-formulas-2.hbs";
      parts.formulas.templates = ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"];
    }
    const { buttons, breakdown, ...rest } = parts;
    return { ...rest, ...(breakdown ? { breakdown } : {}), ...(buttons ? { buttons } : {}) };
  }

  async _preparePartContext(partId, context, options) {
    if (partId === "breakdown") return this._prepareFormulasContext(context, options);
    return super._preparePartContext(partId, context, options);
  }

  async _prepareFormulasContext(context, options) {
    context = await super._prepareFormulasContext(context, options);
    if (!hasLegacy2Test(this.config)) return context;
    const choices = testRollChoices(this.config);
    const bonus = Ruleset.netAdvantageBonus(choices.vantagens, choices.desvantagens);
    context.jj2Test = { ...choices, bonus, bonusLabel: `${bonus >= 0 ? "+" : ""}${bonus}` };
    context.rootId = this.id;
    context.breakdowns = this.rolls.map((roll, index) => testRollBreakdown(this.config, roll, index));
    return context;
  }
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    mountLegacy2DocumentTheme(this.element, "roll", { enabled: Ruleset.isV2() });
  }

  /** @override */
  async _prepareButtonsContext(context, options) {
    if (hasLegacy2Test(this.config)) {
      context.buttons = { normal: { default: true, label: "Rolar" } };
      return context;
    }
    let defaultButton = this.options.defaultButton;
    if ( !defaultButton ) {
      let advantage = false;
      let disadvantage = false;
      for ( const roll of this.config.rolls ) {
        if ( !roll.options ) continue;
        if ( roll.options.advantageMode === CONFIG.Dice.D20Roll.ADV_MODE.ADVANTAGE ) advantage = true;
        else if ( roll.options.advantageMode === CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE ) disadvantage = true;
        else if ( roll.options.advantage && !roll.options.disadvantage ) advantage = true;
        else if ( !roll.options.advantage && roll.options.disadvantage ) disadvantage = true;
      }
      if ( advantage && !disadvantage ) defaultButton = "advantage";
      else if ( !advantage && disadvantage ) defaultButton = "disadvantage";
    }
    context.buttons = {
      advantage: {
        default: defaultButton === "advantage",
        label: _loc("DND5E.Advantage")
      },
      normal: {
        default: !["advantage", "disadvantage"].includes(defaultButton),
        label: _loc("DND5E.Normal")
      },
      disadvantage: {
        default: defaultButton === "disadvantage",
        label: _loc("DND5E.Disadvantage")
      }
    };
    return context;
  }

  /* -------------------------------------------- */
  /*  Roll Handling                               */
  /* -------------------------------------------- */

  _afterBuildConfig(config, formData, index) {
    config = super._afterBuildConfig(config, formData, index);
    return applyLegacy2TestRoll(config, this.config, formData);
  }

  /** @override */
  _finalizeConfig(config, action) {
    let advantageMode = CONFIG.Dice.D20Roll.ADV_MODE.NORMAL;
    if (!hasLegacy2Test(this.config)) {
      if ( action === "advantage" ) advantageMode = CONFIG.Dice.D20Roll.ADV_MODE.ADVANTAGE;
      else if ( action === "disadvantage" ) advantageMode = CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE;
    }
    for ( const roll of config.rolls ?? [] ) {
      roll.options ??= {};
      roll.options.advantageMode = advantageMode;
    }
  }
}
