const { DocumentIdField, SchemaField, StringField } = foundry.data.fields;

/** A game condition and the separate saving throw that can resist it. */
export default class AppliedConditionField extends SchemaField {
  constructor(options = {}) {
    super({
      _id: new DocumentIdField({ initial: () => foundry.utils.randomID() }),
      condition: new StringField(),
      save: new StringField({ initial: "con" })
    }, options);
  }
}
