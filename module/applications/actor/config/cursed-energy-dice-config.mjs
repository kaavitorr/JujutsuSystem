import BaseConfigSheet from "../api/base-config-sheet.mjs";

export default class CursedEnergyDiceConfig extends BaseConfigSheet {
  /** @override */
static DEFAULT_OPTIONS = {
    classes: ["cursed-energy-dice"],
    actions: {
      decrease: CursedEnergyDiceConfig.#stepValue,
      increase: CursedEnergyDiceConfig.#stepValue,
      decreaseBonus: CursedEnergyDiceConfig.#stepBonus,
      increaseBonus: CursedEnergyDiceConfig.#stepBonus,
      roll: CursedEnergyDiceConfig.#rollDie
    },
    position: { width: 420 }
  };

  /** @override */
  static PARTS = {
    config: {
      template: "systems/jujutsu-system/templates/actors/config/cursed-energy-dice-config.hbs"
    }
  };

  /** @override */
  get title() {
    return "Cursed Energy Dice";
  }

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    const energyDice = this.document.system.energyDice;
    const level = this.document.system.details?.level ?? 1;
    context.energyDice = {
      value: energyDice.value,
      max: energyDice.max,
      denomination: energyDice.denomination,
      denominationNum: Number(energyDice.denomination.slice(1)),
      autoMax: level * 2
    };
    return context;
  }

  static async #rollDie(event, target) {
    const actor = this.document;
    const energyDice = actor.system.energyDice;

    // Verificar se tem dados disponíveis
    if (energyDice.value <= 0) {
      ui.notifications.warn(`${actor.name} não tem Cursed Energy Dice disponíveis!`);
      return;
    }

    const denomination = energyDice.denomination;
    const conMod = actor.system.abilities?.con?.mod ?? 0;
    const conPart = conMod >= 0 ? ` + ${conMod}` : ` - ${Math.abs(conMod)}`;
    const formula = `${denomination}${conPart}`;
    const roll = await new Roll(formula).evaluate();
    const current = actor.system.energy.total;
    const max = actor.system.energy.max;
    const recovered = Math.min(Math.max(0, roll.total), max - current);
    const newTotal = current + recovered;

    await actor.update({
      "system.energy.total": newTotal,
      "system.energyDice.value": energyDice.value - 1
    });

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Cursed Energy Dice (${denomination} + mod. CON) — Recuperou ${recovered} PA`
    });
    this.render();
  }

  static #stepValue(event, target) {
    const valueField = target.closest(".form-group").querySelector("input");
    if ( target.dataset.action === "increase" ) valueField?.stepUp();
    else valueField?.stepDown();
    this.submit();
  }

  static #stepBonus(event, target) {
    const actor = this.document;
    const current = actor.system.energyDice.bonus ?? 0;
    const newBonus = target.dataset.action === "increaseBonus" 
      ? current + 1 
      : Math.max(0, current - 1);
    actor.update({ "system.energyDice.bonus": newBonus }).then(() => this.render());
  }
  
  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);
    return submitData;
  }
}