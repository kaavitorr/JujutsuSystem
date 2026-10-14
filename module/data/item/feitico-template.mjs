import ItemDataModel from "../abstract/item-data-model.mjs";
import ItemDescriptionTemplate from "./templates/item-description.mjs";

const FEITICO_PACK_ID = "world.feitico-tecnicas";

/**
 * Get-or-create the world compendium that stores every Molde de Feitiço's manifestações/técnicas,
 * keeping them out of the flat world Items sidebar while still being genuine editable Items.
 * @returns {Promise<CompendiumCollection>}
 */
export async function ensureFeiticoPack() {
  let pack = game.packs.get(FEITICO_PACK_ID);
  if ( !pack ) pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
    type: "Item",
    label: "Técnicas de Feitiço",
    name: "feitico-tecnicas"
  });
  return pack;
}

/**
 * Data definition for Molde de Feitiço items. Um Molde não guarda suas manifestações/técnicas
 * como dados brutos — ele liga a Itens reais mantidos no compendium compartilhado (ver
 * `ensureFeiticoPack`) via a flag `jujutsu-system.feiticoTemplate`, do mesmo jeito que
 * containers ligam conteúdos via `system.container`. Assim cada técnica/manifestação continua
 * sendo um Item editável de verdade (activities, dano etc.) sem poluir a sidebar de Itens.
 */
export default class FeiticoTemplateData extends ItemDataModel.mixin(ItemDescriptionTemplate) {

  static LOCALIZATION_PREFIXES = ["DND5E.SOURCE"];

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {});
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.prepareDescriptionData();
  }

  /* -------------------------------------------- */

  /**
   * Manifestações/técnicas que pertencem a este Molde. Sempre async: elas vivem no
   * compendium compartilhado, nunca como itens embutidos ou soltos no mundo.
   * @type {Promise<Collection<Item5e>>}
   */
  get contents() {
    if ( !this.parent ) return Promise.resolve(new foundry.utils.Collection());
    return this.#fetchContents();
  }

  async #fetchContents() {
    const pack = await ensureFeiticoPack();
    const docs = await pack.getDocuments({ type: "spell" });
    return docs.reduce((collection, item) => {
      if ( item.getFlag("jujutsu-system", "feiticoTemplate") === this.parent.id ) collection.set(item.id, item);
      return collection;
    }, new foundry.utils.Collection());
  }

  /* -------------------------------------------- */

  /**
   * Pasta do compendium que agrupa as manifestações/técnicas deste Molde, criando uma
   * (com o nome do Molde) se ainda não tiver.
   * @returns {Promise<Folder|null>}
   */
  async ensureFolder() {
    if ( this.parent.isEmbedded || this.parent.pack ) return null;
    const pack = await ensureFeiticoPack();

    const existingId = this.parent.getFlag("jujutsu-system", "feiticoFolder");
    const existing = existingId ? pack.folders.get(existingId) : null;
    if ( existing ) return existing;

    const folder = await Folder.implementation.create(
      { name: this.parent.name, type: "Item" },
      { pack: pack.metadata.id }
    );
    await this.parent.setFlag("jujutsu-system", "feiticoFolder", folder.id);
    return folder;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getSheetData(context) {
    context.subtitles = [{ label: game.i18n.localize("TYPES.Item.feiticoTemplate") }];
  }

  /* -------------------------------------------- */
  /*  Socket Event Handlers                       */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( userId !== game.user.id ) return;

    const contents = await this.contents;
    if ( contents.size ) {
      const pack = await ensureFeiticoPack();
      await Item.deleteDocuments(Array.from(contents.map(i => i.id)), { pack: pack.metadata.id });
    }
  }
}

/* -------------------------------------------- */
/*  Importação: reconstrói os filhos empacotados */
/* -------------------------------------------- */

/**
 * Reconstrói as manifestações/técnicas de um Molde que veio empacotado no JSON
 * (`flags.jujutsu-system.feiticoBundle`, gerado pelo Export Data — ver documents/item.mjs).
 * Recria os filhos no pack deste mundo, religados ao novo Molde, e limpa o pacote.
 * Remove filhos atuais antes (importar sobre um Molde existente não duplica).
 * @param {Item5e} item
 */
async function _importarBundleFeitico(item) {
  const bundle = item.getFlag("jujutsu-system", "feiticoBundle");
  if ( !Array.isArray(bundle) || !bundle.length ) return;
  try {
    const pack = await ensureFeiticoPack();
    const atuais = await item.system.contents;
    if ( atuais.size ) await Item.deleteDocuments([...atuais.keys()], { pack: pack.metadata.id });
    // folder herdado não existe neste mundo: descarta e cria um novo
    await item.unsetFlag("jujutsu-system", "feiticoFolder").catch(() => null);
    const folder = await item.system.ensureFolder();
    const toCreate = bundle.map(raw => {
      const data = foundry.utils.deepClone(raw);
      delete data._id;
      data.folder = folder?.id ?? null;
      foundry.utils.setProperty(data, "flags.jujutsu-system.feiticoTemplate", item.id);
      return data;
    });
    await Item.implementation.create(toCreate, { pack: pack.metadata.id });
    await item.update({ "flags.jujutsu-system.-=feiticoBundle": null });
    ui.notifications.info(`Molde "${item.name}": ${toCreate.length} técnica(s)/manifestação(ões) importada(s).`);
  } catch ( err ) {
    console.error("JujutsuLegacy | falha ao importar os filhos do Molde de Feitiço:", err);
  }
}

// Novo Molde (drag do JSON / criar) OU Import Data sobre um Molde existente.
Hooks.on("createItem", (item, options, userId) => {
  if ( userId === game.user.id && item.type === "feiticoTemplate"
    && item.getFlag("jujutsu-system", "feiticoBundle") ) _importarBundleFeitico(item);
});
Hooks.on("updateItem", (item, changed, options, userId) => {
  if ( userId === game.user.id && item.type === "feiticoTemplate"
    && foundry.utils.getProperty(changed, "flags.jujutsu-system.feiticoBundle") ) _importarBundleFeitico(item);
});
