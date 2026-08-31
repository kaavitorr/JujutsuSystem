import ItemSheet5e from "./item-sheet.mjs";
import { ensureFeiticoPack } from "../../data/item/feitico-template.mjs";

const SLOTS = [
  { id: "inata", label: "Reversões de Feitiço", tecnicasLabel: "Técnicas de Reversão" },
  { id: "m1",    label: "1ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
  { id: "m2",    label: "2ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
  { id: "m3",    label: "3ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" }
];

const SLOT_NAMES = Object.fromEntries(SLOTS.map(s => [s.id, s.label]));

/**
 * Sheet for configuring a Molde de Feitiço directly — add manifestações/técnicas, assign them
 * to slots, and edit them using their normal (full) spell sheet.
 */
export default class FeiticoTemplateSheet extends ItemSheet5e {

  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      feiticoCreateManif: FeiticoTemplateSheet.#onFeiticoCreateManif,
      feiticoCreateTecnica: FeiticoTemplateSheet.#onFeiticoCreateTecnica,
      feiticoEdit: FeiticoTemplateSheet.#onFeiticoEdit,
      feiticoRemove: FeiticoTemplateSheet.#onFeiticoRemove,
      feiticoReqAdd: FeiticoTemplateSheet.#onFeiticoReqAdd,
      feiticoReqRemove: FeiticoTemplateSheet.#onFeiticoReqRemove
    },
    position: {
      width: 520,
      height: 700
    },
    window: {
      resizable: true
    }
  };

  /** @override */
  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    feitico: {
      template: "systems/jujutsu-system/templates/items/feitico-template-feitico.hbs",
      scrollable: [""]
    },
    description: super.PARTS.description
  };

  /** @override */
  static TABS = [
    { tab: "feitico", label: "JUJUTSU.Feitico.Label" },
    { tab: "description", label: "DND5E.ITEM.SECTIONS.Description" }
  ];

  /** @override */
  tabGroups = {
    primary: "feitico"
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( partId === "feitico" ) context = await this._prepareFeiticoContext(context, options);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the Feitiço tab.
   * @param {ApplicationRenderContext} context
   * @param {HandlebarsRenderOptions} options
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareFeiticoContext(context, options) {
    context.tab = context.tabs.feitico;

    const items = Array.from(await this.item.system.contents);

    const slots = SLOTS.map(def => {
      const manifestacao = items.find(i => i.getFlag("jujutsu-system", "feitico.slot") === def.id) ?? null;
      const tecnicas = items
        .filter(i => (i.getFlag("jujutsu-system", "feitico.parent") === def.id) && (i !== manifestacao))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

      // Requisitos de Maestria (até 6) — armazenados na manifestação
      const rawReqs = manifestacao?.getFlag("jujutsu-system", "feitico.requirements") ?? [];
      const manifestacaoId = manifestacao?.id ?? null;
      const requirements = rawReqs.map((req, idx) => ({
        index: idx,
        manifestacaoId,
        level: req.level ?? 1
      }));

      const _lite = s => s ? {
        id: s.id,
        name: s.name,
        img: s.img,
        subtitle: s.system?.school ? CONFIG.DND5E.spellSchools?.[s.system.school]?.label : "",
        grau: s.system?.level ?? 0
      } : null;

      const reqsCols = requirements.length <= 1 ? 1 : requirements.length <= 4 ? 2 : 3;

      // Duas colunas dentro da manifestação (mesmo padrão da ficha do personagem):
      // técnicas com Grau (>=1) à esquerda, Auxiliares (grau 0) à direita.
      const tecnicasLite = tecnicas.map(t => _lite(t));
      let tecnicasGrau = tecnicasLite.filter(t => (t.grau ?? 0) >= 1);
      let tecnicasAux  = tecnicasLite.filter(t => (t.grau ?? 0) === 0);
      // Sem técnicas de Grau (só Auxiliares): elas ocupam a coluna da esquerda para
      // não flutuarem à direita numa manifestação Focada.
      if ( !tecnicasGrau.length ) { tecnicasGrau = tecnicasAux; tecnicasAux = []; }

      return {
        ...def,
        manifestacao: _lite(manifestacao),
        tecnicas: tecnicasLite,
        tecnicasGrau,
        tecnicasAux,
        hasTecnicas: tecnicasLite.length > 0,
        requirements,
        reqsCols,
        canAddReq: !!manifestacao && (requirements.length < 6)
      };
    });

    context.feitico = { slots };
    return context;
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelectorAll(".feitico-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => e.preventDefault());
      zone.addEventListener("dragleave", e => {
        if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover");
      });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    this.element.querySelectorAll("[data-feitico-req]").forEach(el => {
      el.addEventListener("change", e => {
        this._onFeiticoReqChange(el.dataset.itemId, parseInt(el.dataset.index), el.dataset.feiticoReq, el.value);
      });
    });

    this._syncContentsFolder();
  }

  /* -------------------------------------------- */

  /**
   * Move any manifestação/técnica that isn't in the Molde's folder into it — catches items
   * created before this Molde had a folder, or ones dragged in some other way.
   */
  async _syncContentsFolder() {
    const folder = await this.item.system.ensureFolder();
    if ( !folder ) return;
    const items = await this.item.system.contents;
    const stray = items.filter(i => i.folder?.id !== folder.id);
    if ( stray.length ) {
      const pack = await ensureFeiticoPack();
      await Item.updateDocuments(stray.map(i => ({ _id: i.id, folder: folder.id })), { pack: pack.metadata.id });
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  static async #onFeiticoCreateManif(event, target) {
    const slotId = target.dataset.slot;
    const items = await this.item.system.contents;
    const existing = items.find(i => i.getFlag("jujutsu-system", "feitico.slot") === slotId);
    if ( existing ) return existing.sheet?.render(true);

    const folder = await this.item.system.ensureFolder();
    const pack = await ensureFeiticoPack();
    const created = await Item.implementation.create([{
      name: SLOT_NAMES[slotId] ?? "Nova Manifestação",
      type: "spell",
      folder: folder?.id,
      system: { level: 0, method: "atwill" },
      flags: { "jujutsu-system": { feiticoTemplate: this.item.id, feitico: { slot: slotId } } }
    }], { pack: pack.metadata.id });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onFeiticoCreateTecnica(event, target) {
    const slotId = target.dataset.slot;
    const folder = await this.item.system.ensureFolder();
    const pack = await ensureFeiticoPack();
    const created = await Item.implementation.create([{
      name: "Nova Técnica",
      type: "spell",
      folder: folder?.id,
      system: { level: 0 },
      flags: { "jujutsu-system": { feiticoTemplate: this.item.id, feitico: { parent: slotId } } }
    }], { pack: pack.metadata.id });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onFeiticoEdit(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    item?.sheet?.render(true);
  }

  /* -------------------------------------------- */

  static async #onFeiticoRemove(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remover do Molde" },
      content: `<p>Remover "<strong>${item.name}</strong>" deste Molde de Feitiço? O item será excluído permanentemente.</p>`
    });
    if ( !confirmed ) return;
    await item.delete();
    this.render();
  }

  /* -------------------------------------------- */

  static async #onFeiticoReqAdd(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( reqs.length >= 6 ) {
      ui.notifications.warn("Máximo de 6 requisitos por manifestação.");
      return;
    }
    reqs.push({ level: 1 });
    await item.setFlag("jujutsu-system", "feitico.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onFeiticoReqRemove(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    reqs.splice(Number(target.dataset.index), 1);
    await item.setFlag("jujutsu-system", "feitico.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle a change to a Maestria requirement's input.
   * @param {string} itemId
   * @param {number} index
   * @param {string} field
   * @param {string} rawValue
   */
  async _onFeiticoReqChange(itemId, index, field, rawValue) {
    const items = await this.item.system.contents;
    const item = items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( !reqs[index] ) return;
    if ( field === "level" ) reqs[index].level = Math.max(1, Math.min(7, parseInt(rawValue) || 1));
    await item.setFlag("jujutsu-system", "feitico.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, data) {
    const feiticoTarget = event.target.closest("[data-feitico-drop]");
    if ( !feiticoTarget ) return super._onDropItem(event, data);

    const item = await Item.implementation.fromDropData(data);
    if ( !item || (item.type !== "spell") ) return super._onDropItem(event, data);

    const slotId = feiticoTarget.closest("[data-feitico-slot]")?.dataset.feiticoSlot;
    if ( !slotId ) return;

    const folder = await this.item.system.ensureFolder();
    const pack = await ensureFeiticoPack();
    const itemData = item.toObject();
    delete itemData._id;
    itemData.folder = folder?.id;
    foundry.utils.setProperty(itemData, "flags.jujutsu-system.feiticoTemplate", this.item.id);

    if ( feiticoTarget.dataset.feiticoDrop === "manif" ) {
      foundry.utils.setProperty(itemData, "system.method", "atwill");
      foundry.utils.setProperty(itemData, "flags.jujutsu-system.feitico", { slot: slotId });

      const items = await this.item.system.contents;
      const existing = items.find(i => i.getFlag("jujutsu-system", "feitico.slot") === slotId);
      if ( existing ) await existing.delete();
    } else {
      foundry.utils.setProperty(itemData, "flags.jujutsu-system.feitico", { parent: slotId });
    }

    await Item.implementation.create([itemData], { pack: pack.metadata.id });
    this.render();
  }
}
