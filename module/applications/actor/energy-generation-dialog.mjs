import Dialog5e from "../api/dialog.mjs";
import { EnergySystem } from "../../systems/energy.mjs";
import Ruleset from "../../systems/ruleset.mjs";
import { mountLegacy2DocumentTheme } from "../shared/legacy2-document-theme.mjs";

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
    return `${Ruleset.isV2() ? "Refinamento de Energia" : "Geração de Energia"} — ${this.actor?.name ?? ""}`;
  }

  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if ( Ruleset.isV2() && parts.content ) {
      parts.content.template = "systems/jujutsu-system/templates/actors/energy-generation-dialog-2.hbs";
      parts.content.templates ??= [];
      parts.content.templates.push("systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs");
    }
    return parts;
  }

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    mountLegacy2DocumentTheme(this.element, "energy-generation", { enabled: Ruleset.isV2() });
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const level = actor.system.details?.level ?? 1;
    const abilities = actor.system.energyAbilities;
    const isV2 = Ruleset.isV2();
    const baseMultiplier = EnergySystem.generationBaseMultiplier(actor);
    const trainingBonus = EnergySystem.calculateGenerationBonus(actor);
    const limite = EnergySystem.calculateLimit(level, baseMultiplier) + trainingBonus
      + EnergySystem.refinamentoBonus(actor);

    context.actor = actor;
    context.rootId = this.id;
    context.level = level;
    context.baseMultiplier = baseMultiplier;
    context.limite = limite;
    context.geradaAtual = actor.system.energy.generated;
    context.totalAtual = actor.system.energy.total;

    // Acúmulo de Energia (nível 5+)
    context.hasAccumulation = !isV2 && abilities.accumulation.enabled;
    context.accumulationUses = abilities.accumulation.uses;
    context.accumulationMax = abilities.accumulation.max;

    // Liberação de Energia
    context.hasLiberation = !isV2 && abilities.liberation.enabled;
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
            label: Ruleset.isV2() ? "Refinar Energia" : "Gerar Energia",
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
