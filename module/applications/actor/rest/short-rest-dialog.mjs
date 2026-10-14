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

    if ( this.actor.system.isNPC ) {
      const hd = this.actor.system.attributes.hd;
      context.hitDice = {
        canRoll: hd.value > 0,
        denomination: `d${hd.denomination}`,
        options: [{
          value: `d${hd.denomination}`,
          label: `d${hd.denomination} (${_loc("DND5E.HITDICE.Available", { number: hd.value })})`,
          number: hd.value
        }]
      };
    } else if ( foundry.utils.hasProperty(this.actor, "system.attributes.hd") ) {
      context.hitDice = {
        canRoll: this.actor.system.attributes.hd.value > 0,
        options: Object.entries(this.actor.system.attributes.hd.bySize).map(([value, number]) => ({
          value, label: `${value} (${_loc("DND5E.HITDICE.Available", { number })})`, number
        }))
      };
      context.hitDice.denomination = (this.actor.system.attributes.hd.bySize[this.#denom] > 0)
        ? this.#denom : context.hitDice.options.find(o => o.number > 0)?.value;
    }

    const denom = Number(context.hitDice?.denomination?.slice(1));
    if ( denom ) {
      const { pct, effectiveMax: max } = this.actor.system.attributes.hp;
      context.progress = { pct };
      const con = this.actor.system.abilities.con.mod;
      let minRegain = Math.max(1 + con, 1);
      let maxRegain = Math.max(denom + con, 1);
      if ( context.config.autoHD ) {
        minRegain = minRegain * context.hd.value;
        maxRegain = context.hitDice.options.reduce((acc, hd) => {
          return acc + (Math.max(Number(hd.value.slice(1)) + con, 1) * hd.number);
        }, 0);
      }
      context.progress.potential = { max: 100 * (maxRegain - minRegain) / max, min: 100 * minRegain / max };
      context.progress.left = context.progress.potential.min + pct;
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

  /** @inheritDoc */
  async _prepareFields(context, options) {
    await super._prepareFields(context, options);

    context.autoRoll = new BooleanField({
      label: _loc("DND5E.REST.HitDice.AutoSpend.Label"),
      hint: _loc("DND5E.REST.HitDice.AutoSpend.Hint")
    });

    // Energia (jujutsu): gasto automático de dados de energia no descanso curto.
    // O template short-rest.hbs renderiza via {{ formField autoEnergyRoll name="autoEnergyED" }}.
    if ( foundry.utils.hasProperty(this.actor, "system.energyDice") ) {
      context.autoEnergyRoll = new BooleanField({
        label: "Gasto Automático de DE",
        hint: "Gasta dados de energia automaticamente até acabar ou a energia ficar cheia."
      });
    }

    if ( this.actor.system.isNPC || foundry.utils.hasProperty(this.actor, "system.attributes.hd") ) return;
    context.fields.unshift({
      field: context.autoRoll,
      input: context.inputs.createCheckboxInput,
      name: "autoHD",
      value: this.config.autoHD
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  static async #rollHitDie(event, target) {
    this.#denom = this.form.denom.value;
    await this.actor.rollHitDie({ denomination: this.#denom });
    const formData = new foundry.applications.ux.FormDataExtended(this.form);
    foundry.utils.mergeObject(this.config, this._processFormData(event, this.form, formData));
    this.render();
  }

  static async #rollEnergyDie(event, target) {
    const actor = this.actor;
    const ed = actor.system.energyDice;
    const formData = new foundry.applications.ux.FormDataExtended(this.form).object;
    const autoSpend = formData.autoEnergyED ?? false;
    const quantity = Number(this.form.energyDenom?.value ?? 1);

    if ( ed.value <= 0 ) {
      ui.notifications.warn("Sem Dados de Energia disponíveis!");
      return;
    }

    const currentEnergy = actor.system.energy.total;
    const maxEnergy = actor.system.energy.max;
    let diceSpent = 0;

    // Determina quantos dados rolar
    let diceCount;
    if ( autoSpend ) {
      // Rola até encher ou acabar os dados
      const energyNeeded = maxEnergy - currentEnergy;
      const avgPerDie = parseInt(ed.denomination.replace("d", "")) / 2;
      diceCount = Math.min(ed.value, Math.max(1, Math.ceil(energyNeeded / avgPerDie)));
    } else {
      diceCount = Math.min(quantity, ed.value);
    }

    // Monta fórmula única com mod CON incluído para rolar todos os dados de uma vez
    const conMod = actor.system.abilities?.con?.mod ?? 0;
    const conPart = conMod >= 0 ? ` + ${conMod}` : ` - ${Math.abs(conMod)}`;
    // Cada dado inclui mod CON: ex "d6 + 2 + d6 + 2"
    const formula = Array(diceCount).fill(`${ed.denomination}${conPart}`).join(" + ");
    const roll = await new Roll(formula).evaluate();
    diceSpent = diceCount;

    // Envia o roll pro chat igual ao dado de vida
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${actor.name} recupera PA de Energia Amaldiçoada (${diceSpent}× ${ed.denomination} + mod. CON)`
    });

    // Aplica a recuperação (mínimo 0 por dado)
    const recovered = Math.min(Math.max(0, roll.total), maxEnergy - currentEnergy);
    const newTotal = currentEnergy + recovered;
    await actor.update({
      "system.energy.total": newTotal,
      "system.energyDice.value": ed.value - diceSpent
    }, { isEnergySystem: true });

    this.render();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    this.#denom = this.form.denom?.value;
    const formData = new foundry.applications.ux.FormDataExtended(this.form);
    foundry.utils.mergeObject(this.config, this._processFormData(event, this.form, formData));
    this.render();
  }
}
