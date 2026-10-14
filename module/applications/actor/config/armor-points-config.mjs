import BaseConfigSheet from "../api/base-config-sheet.mjs";

/**
 * Configuration application for NPC armor points (current & maximum).
 * O máximo do NPC é manual (não há derivação por manipulações como no personagem).
 */
export default class ArmorPointsConfig extends BaseConfigSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["armor-points"],
    position: { width: 380 }
  };

  /** @override */
  static PARTS = {
    config: {
      template: "systems/jujutsu-system/templates/actors/config/armor-points-config.hbs"
    }
  };

  /** @override */
  get title() {
    return "Pontos de Armadura";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    // NPCs criados antes do campo podem não tê-lo no _source — cai pro valor do modelo.
    const armor = this.document.system.armorPoints;
    context.source = this.document.system._source.armorPoints
      ?? { value: armor?.value ?? 0, max: armor?.max ?? 0 };
    return context;
  }
}
