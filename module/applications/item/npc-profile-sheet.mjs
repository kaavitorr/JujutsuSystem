import ItemSheet5e from "./item-sheet.mjs";
import { NUMERIC_DAMAGE_TYPES } from "../../systems/legacy2-resistances.mjs";
import { distributeNpcAttributes, NPC_ABILITIES, NPC_EQUAL_SCALE, validNpcScale } from "../../systems/legacy2-npc-profiles.mjs";

/** Save all six weights together, rather than rejecting intermediate edits. */
export default class NpcProfileSheet extends ItemSheet5e {
  static DEFAULT_OPTIONS = {
    classes: ["jj2-npc-profile-sheet"],
    form: { submitOnChange: false, closeOnSubmit: false },
    position: { width: 560, height: 650 }, window: { resizable: true }
  };
  static PARTS = {
    header: super.PARTS.header, tabs: super.PARTS.tabs,
    scales: { template: "systems/jujutsu-system/templates/items/npc-profile-scales.hbs",
      templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"], scrollable: [""] },
    resistencias: { template: "systems/jujutsu-system/templates/items/npc-profile-resistencias.hbs", scrollable: [""] },
    habilidades: { template: "systems/jujutsu-system/templates/items/npc-profile-habilidades.hbs",
      templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"], scrollable: [""] },
    description: super.PARTS.description,
    footer: { template: "systems/jujutsu-system/templates/items/npc-profile-footer.hbs" }
  };
  static TABS = [ { tab: "scales", label: "Escala de Atributos" },
    { tab: "resistencias", label: "Resistências" },
    { tab: "habilidades", label: "Habilidades" },
    { tab: "description", label: "Descrição" } ];
  tabGroups = { primary: "scales" };

  async _configureRenderOptions(options) {
    if (options.isFirstRender && options.mode === undefined) options.mode = this.constructor.MODES.EDIT;
    await super._configureRenderOptions(options);
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === "habilidades") {
      // Resolve cada característica para exibição; ausentes ficam com o
      // placeholder mas continuam removíveis/ajustáveis.
      const entradas = await Promise.all(((this.item.system._source.habilidades ?? []).map(async h => {
        const doc = await fromUuid(h.uuid).catch(() => null);
        return { uuid: h.uuid, nd: h.nd,
          nome: doc?.name ?? "(característica indisponível)",
          img: doc?.img ?? "icons/svg/book.svg" };
      })));
      context.profile = { ...(context.profile ?? {}), habilidades: entradas.sort((a, b) => a.nd - b.nd) };
      return context;
    }
    if (partId === "resistencias") {
      const fontes = context.source.resistencias ?? {};
      context.profile = { ...(context.profile ?? {}), taxonomy: this.item.type === "taxonomy",
        resistencias: NUMERIC_DAMAGE_TYPES.map(({ key, label }) => ({ key, label,
          value: Number(fontes[key]?.value) || 0, immune: !!fontes[key]?.immune })) };
      return context;
    }
    if (partId !== "scales") return context;
    const taxonomy = this.item.type === "taxonomy", weights = context.source.pesos;
    const result = distributeNpcAttributes(taxonomy ? weights : NPC_EQUAL_SCALE, taxonomy ? null : weights, taxonomy ? 1 : 13);
    context.profile = { taxonomy, total: NPC_ABILITIES.reduce((sum, key) => sum + weights[key], 0),
      attributes: NPC_ABILITIES.map(key => ({ key, label: game.i18n.localize(CONFIG.DND5E.abilities[key].label),
        weight: weights[key], preview: taxonomy ? result.initial[key] : result.growth[key] })) };
    return context;
  }

  /** Drop de característica (feat) na aba Habilidades: entra com ND 1. */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if ( data.type === "Item" ) {
      const doc = await fromUuid(data.uuid).catch(() => null);
      if ( (doc?.documentName === "Item") && (doc.type === "feat") ) {
        const atuais = foundry.utils.deepClone(this.item.system._source.habilidades ?? []);
        if ( atuais.some(h => h.uuid === data.uuid) ) {
          ui.notifications.warn(`"${doc.name}" já está na lista de habilidades.`);
          return;
        }
        atuais.push({ uuid: data.uuid, nd: 1 });
        return this.item.update({ "system.habilidades": atuais });
      }
    }
    return super._onDrop(event);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Aba Habilidades: ND de cada característica + remoção. Antes do
    // early-return da aba de escalas — renders parciais podem trazer só
    // uma das seções no DOM.
    const habilidades = this.element.querySelector(".jj2-npc-habilidades");
    if ( habilidades ) {
      const gravar = async mutador => {
        const atuais = foundry.utils.deepClone(this.item.system._source.habilidades ?? []);
        mutador(atuais);
        await this.item.update({ "system.habilidades": atuais });
      };
      habilidades.querySelectorAll("[data-habilidade-nd]").forEach(input => input.addEventListener("change", () => {
        const uuid = input.dataset.habilidadeNd;
        gravar(atuais => {
          const alvo = atuais.find(h => h.uuid === uuid);
          if ( alvo ) alvo.nd = Math.max(1, Math.min(30, Math.trunc(Number(input.value) || 1)));
        });
      }));
      habilidades.querySelectorAll("[data-habilidade-remover]").forEach(botao => botao.addEventListener("click", () => {
        const uuid = botao.dataset.habilidadeRemover;
        gravar(atuais => {
          const indice = atuais.findIndex(h => h.uuid === uuid);
          if ( indice >= 0 ) atuais.splice(indice, 1);
        });
      }));
    }

    const section = this.element.querySelector(".jj2-npc-scale");
    if (!section) return;
    const refresh = () => {
      const inputs = Array.from(section.querySelectorAll("[data-npc-weight]"));
      if (!inputs.length) return;
      const weights = Object.fromEntries(inputs.map(input => [input.dataset.npcWeight, input.value === "" ? NaN : Number(input.value)]));
      const valid = validNpcScale(weights), total = Object.values(weights).reduce((sum, value) => sum + (value || 0), 0);
      section.querySelector("[data-scale-total]").textContent = `${total} / 12`;
      section.classList.toggle("invalid-scale", !valid);
      const status = section.querySelector("[data-scale-status]");
      status.textContent = valid ? "Escala completa" : "Distribua exatamente 12 pontos entre os seis atributos";
      inputs.at(-1).setCustomValidity(valid ? "" : status.textContent);
      const taxonomy = this.item.type === "taxonomy";
      const nd = Number(section.querySelector("[data-preview-nd]")?.value ?? 13);
      const distribution = distributeNpcAttributes(taxonomy ? weights : NPC_EQUAL_SCALE, taxonomy ? null : weights, taxonomy ? 1 : nd);
      for (const value of section.querySelectorAll("[data-preview-ability]"))
        value.textContent = valid ? (taxonomy ? distribution.initial[value.dataset.previewAbility] : `+${distribution.growth[value.dataset.previewAbility]}`) : "—";
    };
    section.querySelectorAll("[data-npc-weight], [data-preview-nd]").forEach(input => input.addEventListener("input", refresh));
    refresh();
  }
}
