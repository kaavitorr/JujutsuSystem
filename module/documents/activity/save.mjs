import SaveSheet from "../../applications/activity/save-sheet.mjs";
import BaseSaveActivityData from "../../data/activity/save-data.mjs";
import { getSceneTargets } from "../../utils.mjs";
import { maybePromptJJScale } from "../../applications/actor/jj/native-cards.mjs";
import ActivityMixin from "./mixin.mjs";
import { alternativeSavesEnabled, alternativeSaveDefinition } from "../../systems/legacy2-alternative-saves.mjs";
import { activityConditionsSnapshot } from "../../systems/activity-conditions.mjs";

/**
 * Activity for making saving throws and rolling damage.
 */
export default class SaveActivity extends ActivityMixin(BaseSaveActivityData) {
  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, "DND5E.SAVE"];

  /* -------------------------------------------- */

  /** @inheritDoc */
  static metadata = Object.freeze(
    foundry.utils.mergeObject(super.metadata, {
      type: "save",
      img: "systems/jujutsu-system/icons/svg/activity/save.svg",
      title: "DND5E.SAVE.Title.one",
      hint: "DND5E.SAVE.Hint",
      sheetClass: SaveSheet,
      targetPhase: "pre",
      usage: {
        applyEffectsInChat: false,
        actions: {
          rollDamage: SaveActivity.#rollDamage,
          rollSave: SaveActivity.#rollSave
        }
      }
    }, { inplace: false })
  );

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /** @override */
  get hasOutcomes() {
    return Number.isFinite(this.save.dc.value);
  }

  /* -------------------------------------------- */
  /*  Activation                                  */
  /* -------------------------------------------- */

  /** @override */
  _usageChatButtons(message) {
    const buttons = [];
    const conditions = activityConditionsSnapshot(this);
    const dc = this.save.dc.value;
    const alternativeSaves = alternativeSavesEnabled();

    for ( const abilityId of (conditions && !conditions.damageSave) ? [] : this.save.ability ) {
      const alternative = alternativeSaves ? alternativeSaveDefinition(abilityId) : null;
      const ability = alternative?.label ?? CONFIG.DND5E.abilities[abilityId]?.label ?? "";
      const promptTitle = _loc("DND5E.SavePromptTitle", { ability });
      const button = {
        action: "rollSave",
        canGroup: true,
        dataset: { dc, ability: abilityId, ...(alternative ? { jj2AlternativeSave: true } : {}) },
        icon: "fa-solid fa-shield-heart",
        label: {
          hidden: promptTitle,
          value: dc ? _loc("DND5E.SavingThrowDC", { ability, dc }) : promptTitle
        },
        visibility: this.save.visible ? "all" : undefined
      };
      if ( this.save.visible ) button.visibility = "all";
      buttons.push(button);
    }

    if ( this.damage.parts.length ) buttons.push({
      action: "rollDamage",
      icon: "fa-solid fa-burst",
      label: { value: "DND5E.Damage" }
    });
    return buttons.concat(super._usageChatButtons(message));
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async rollDamage(config={}, dialog={}, message={}) {
    // jujutsu: diálogo assíncrono de Energia/PA da técnica antes de rolar.
    if ( await maybePromptJJScale(this) === false ) return null;

    message = foundry.utils.mergeObject({
      "data.system.onSave": this.damage.onSave
    }, message);
    return super.rollDamage(config, dialog, message);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle performing a damage roll.
   * @this {SaveActivity}
   * @param {PointerEvent} event     Triggering click event.
   * @param {HTMLElement} target     The capturing HTML element which defined a [data-action].
   * @param {ChatMessage5e} message  Message associated with the activation.
   */
  static #rollDamage(event, target, message) {
    this.rollDamage({ event }, {}, { data: { system: { targets: message.system.targets } } });
  }

  /* -------------------------------------------- */

  /**
   * Handle performing a saving throw.
   * @this {SaveActivity}
   * @param {PointerEvent} event     Triggering click event.
   * @param {HTMLElement} target     The capturing HTML element which defined a [data-action].
   * @param {ChatMessage5e} message  Message associated with the activation.
   */
  static async #rollSave(event, target, message) {
    const targets = message.system?.evaluatedTargets ?? getSceneTargets();
    if ( !targets.length && game.user.character ) targets.push(game.user.character);
    if ( !targets.length ) ui.notifications.warn("DND5E.ActionWarningNoToken", { localize: true });
    const { ability, dc } = message.system.getButton(target)?.dataset ?? {};
    const bonus = CONFIG.Dice.BasicRoll.replaceFormulaData(this.save.bonus ?? "", this.getRollData(), { missing: 0 });
    const bonusData = CONFIG.Dice.BasicRoll.constructParts({ activityBonus: bonus });
    for ( const token of targets ) {
      const actor = token instanceof Actor ? token : token.actor;
      const tokenDocument = token instanceof Actor ? undefined : token.document ?? token;
      const speaker = ChatMessage.getSpeaker({ actor, scene: tokenDocument?.parent ?? canvas.scene, token: tokenDocument });
      const rollData = {
        event,
        ability: ability ?? this.save.ability.first(),
        target: Number.isFinite(dc) ? dc : this.save.dc.value
      };
      if ( bonusData.parts.length ) rollData.rolls = [bonusData];
      await actor.rollSavingThrow(rollData, {}, {
        data: { speaker, system: { ...this.messageSources, origin: message.id } }
      });
    }
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async getFavoriteData() {
    return foundry.utils.mergeObject(await super.getFavoriteData(), { save: this.save });
  }
}
