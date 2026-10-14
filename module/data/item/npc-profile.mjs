import ItemDataModel from "../abstract/item-data-model.mjs";
import ItemDescriptionTemplate from "./templates/item-description.mjs";
import { NPC_ABILITIES, validNpcScale } from "../../systems/legacy2-npc-profiles.mjs";

/** Authorable NPC scales, stored as genuine world/compendium/owned Items. */
export class NpcProfileData extends ItemDataModel.mixin(ItemDescriptionTemplate) {
  static LOCALIZATION_PREFIXES = ["DND5E.SOURCE"];
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, { singleton: true }, { inplace: false }));

  static defineSchema() {
    const { ArrayField, NumberField, SchemaField, StringField } = foundry.data.fields;
    return this.mergeSchema(super.defineSchema(), {
      pesos: new SchemaField(Object.fromEntries(NPC_ABILITIES.map(key => [key,
        new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 12, initial: 2 })]))),
      // Habilidades concedidas pelo perfil: características (feats) com o ND
      // a partir do qual o NPC pode recebê-las.
      habilidades: new ArrayField(new SchemaField({
        uuid: new StringField({ required: true, nullable: false, blank: false }),
        nd: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 30, initial: 1 })
      }), { required: false, nullable: false, initial: [] })
    });
  }

  static _validateJoint(data) {
    super._validateJoint(data);
    // Some Foundry update paths validate partial changes before merging with source.
    if (data.pesos && NPC_ABILITIES.every(key => key in data.pesos) && !validNpcScale(data.pesos))
      throw new Error("A escala dos seis atributos deve somar exatamente 12 pontos.");
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.prepareDescriptionData();
  }

  async getSheetData(context) {
    context.subtitles = [{ label: game.i18n.localize(`TYPES.Item.${this.parent.type}`) }];
    context.singleDescription = true;
  }
}

export class TaxonomyData extends NpcProfileData {
  static defineSchema() {
    const { BooleanField, NumberField } = foundry.data.fields;
    return this.mergeSchema(super.defineSchema(), {
      vidaEnergia: new BooleanField({ initial: false }),
      energiaBase: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 10 })
    });
  }
}

export class ArchetypeData extends NpcProfileData {}
