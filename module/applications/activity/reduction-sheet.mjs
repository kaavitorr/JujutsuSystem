import ActivitySheet from "./activity-sheet.mjs";

/**
 * Ficha de configuração da atividade de Redução de Dano.
 * Adiciona o campo de fórmula do escudo na aba Efeito.
 */
export default class ReductionSheet extends ActivitySheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["reduction-activity"]
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    effect: {
      template: "systems/jujutsu-system/templates/activity/reduction-effect.hbs",
      templates: [
        ...super.PARTS.effect.templates,
        "systems/jujutsu-system/templates/activity/parts/jj-scale.hbs"
      ]
    }
  };
}
