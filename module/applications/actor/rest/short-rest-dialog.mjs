import BaseRestDialog from "./base-rest-dialog.mjs";

const { BooleanField } = foundry.data.fields;

/**
 * Dialog for configuring a short rest.
 */
export default class ShortRestDialog extends BaseRestDialog {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["short-rest"],
    actions: {
      rollHitDie: ShortRestDialog.#rollHitDie,
      rollEnergyDie: ShortRestDialog.#rollEnergyDie
    },
    window: {
      title: "DND5E.REST.Short.Label"
    }
  };

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    content: {
      template: "systems/jujutsu-system/templates/actors/rest/short-rest.hbs"
    }
  };

  #denom;

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.autoRoll = new BooleanField({
      label: game.i18n.localize("DND5E.REST.HitDice.AutoSpend.Label"),
      hint: game.i18n.localize("DND5E.REST.HitDice.AutoSpend.Hint")
    });
  context.autoRoll = new BooleanField({
  label: game.i18n.localize("DND5E.REST.HitDice.AutoSpend.Label"),
  hint: game.i18n.localize("DND5E.REST.HitDice.AutoSpend.Hint")
});
context.autoEnergyRoll = new BooleanField({
  label: "Auto Spend Energy Dice",
  hint: "Gasta dados automaticamente até acabar ou a energia ficar cheia."
});

    if ( this.actor.system.isNPC ) {
      const hd = this.actor.system.attributes.hd;
      context.hitDice = {
        canRoll: hd.value > 0,
        denomination: `d${hd.denomination}`,
        options: [{
          value: `d${hd.denomination}`,
          label: `d${hd.denomination} (${game.i18n.format("DND5E.HITDICE.Available", { number: hd.value })})`
        }]
      };
    } else if ( foundry.utils.hasProperty(this.actor, "system.attributes.hd") ) {
      context.hitDice = {
        canRoll: this.actor.system.attributes.hd.value > 0,
        options: Object.entries(this.actor.system.attributes.hd.bySize).map(([value, number]) => ({
          value, label: `${value} (${game.i18n.format("DND5E.HITDICE.Available", { number })})`, number
        }))
      };
      context.denomination = (this.actor.system.attributes.hd.bySize[this.#denom] > 0)
        ? this.#denom : context.hitDice.options.find(o => o.number > 0)?.value;
    } else {
      if ( !context.fields.length ) {
        context.formSections.unshift({ legend: "DND5E.REST.Configuration", fields: context.fields });
      }
      context.fields.unshift({
        field: context.autoRoll,
        input: context.inputs.createCheckboxInput,
        name: "autoHD",
        value: context.config.autoHD
      });
    }

    // Cursed Energy Dice
    const ed = this.actor.system.energyDice;
    if ( ed ) {
      const edOptions = [];
      for ( let i = 1; i <= ed.value; i++ ) {
        edOptions.push({
          value: i,
          label: `${i}x ${ed.denomination} (${ed.value} disponíveis)`
        });
      }
      context.energyDice = {
        canRoll: ed.value > 0,
        denomination: ed.denomination,
        value: ed.value,
        max: ed.max,
        options: edOptions
      };
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  static async #rollHitDie(event, target) {
    this.#denom = this.form.denom.value;
    await this.actor.rollHitDie({ denomination: this.#denom });
    foundry.utils.mergeObject(this.config, new foundry.applications.ux.FormDataExtended(this.form).object);
    this.render();
  }

  static async #rollEnergyDie(event, target) {
    const actor = this.actor;
    const ed = actor.system.energyDice;
    const formData = new foundry.applications.ux.FormDataExtended(this.form).object;
const autoSpend = formData.autoEnergyED ?? false;
    const quantity = Number(this.form.energyDenom?.value ?? 1);

    if ( ed.value <= 0 ) {
      ui.notifications.warn("Sem Cursed Energy Dice disponíveis!");
      return;
    }

    let totalRecovered = 0;
    let diceSpent = 0;
    const currentEnergy = actor.system.energy.total;
    const maxEnergy = actor.system.energy.max;

    if ( autoSpend ) {
      let currentTotal = currentEnergy;
      let remainingDice = ed.value;
      while ( remainingDice > 0 && currentTotal < maxEnergy ) {
        const roll = await new Roll(ed.denomination).evaluate();
        totalRecovered += roll.total;
        currentTotal += roll.total;
        remainingDice--;
        diceSpent++;
      }
    } else {
      const rollsToMake = Math.min(quantity, ed.value);
      for ( let i = 0; i < rollsToMake; i++ ) {
        const roll = await new Roll(ed.denomination).evaluate();
        totalRecovered += roll.total;
        diceSpent++;
      }
    }

    const newTotal = Math.min(currentEnergy + totalRecovered, maxEnergy);
    await actor.update({
      "system.energy.total": newTotal,
      "system.energyDice.value": ed.value - diceSpent
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `Rolou ${diceSpent}x ${ed.denomination} e recuperou ${Math.min(totalRecovered, maxEnergy - currentEnergy)} PA de Energia Amaldiçoada.`
    });

    this.render();
  }
}