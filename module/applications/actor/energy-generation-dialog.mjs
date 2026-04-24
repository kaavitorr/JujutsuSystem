import Dialog5e from "../api/dialog.mjs";


/**
 * Dialog para escolha de geração de energia no início do turno.
 */
export default class EnergyGenerationDialog extends Dialog5e {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["energy-generation"],
    form: {
      handler: EnergyGenerationDialog.#handleFormSubmission
    },
    position: { width: 380 }
  };

  /** @override */
  static PARTS = {
    ...super.PARTS,
    content: {
      template: "systems/jujutsu-system/templates/actors/energy-generation-dialog.hbs"
    }
  };

  constructor(options={}) {
    super(options);
    this.actor = options.document;
  }

  /** @override */
  get title() {
    return `Geração de Energia — ${this.actor?.name ?? ""}`;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const level = actor.system.details?.level ?? 1;
    const abilities = actor.system.energyAbilities;
    const limite = level * (actor.system.energy.generation.baseMultiplier ?? 2);

    context.actor = actor;
    context.level = level;
    context.limite = limite;
    context.geradaAtual = actor.system.energy.generated;
    context.totalAtual = actor.system.energy.total;

    // Acúmulo de Energia (nível 5+)
    context.hasAccumulation = abilities.accumulation.enabled;
    context.accumulationUses = abilities.accumulation.uses;
    context.accumulationMax = abilities.accumulation.max;

    // Liberação de Energia
    context.hasLiberation = abilities.liberation.enabled;
    context.liberationUses = abilities.liberation.uses;

    return context;
  }

static async #handleFormSubmission(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    this.#config = data;
    this.#resolved = true;
    await this.close();
  }

#config = {};
  #resolved = false;

  get config() { return this.#config; }
  get resolved() { return this.#resolved; }

  /**
   * Abre o dialog e retorna as escolhas do jogador.
   */
  static async configure(actor) {
    return new Promise((resolve, reject) => {
      const app = new this({
        document: actor,
        config: {},
        buttons: [
          {
            default: true,
            icon: "fa-solid fa-bolt",
            label: "Gerar Energia",
            name: "generate",
            type: "submit"
          },
          {
            icon: "fa-solid fa-xmark",
            label: "Pular",
            name: "skip",
            action: "skip"
          }
        ]
      });
      app.addEventListener("close", () => {
        if ( app.resolved ) resolve(app.config);
        else resolve(null);
      }, { once: true });
      app.render({ force: true });
    });
  }
}