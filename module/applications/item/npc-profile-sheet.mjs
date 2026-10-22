import ItemSheet5e from "./item-sheet.mjs";
import { NUMERIC_DAMAGE_TYPES } from "../../systems/legacy2-resistances.mjs";
import { distributeNpcAttributes, NPC_ABILITIES, NPC_EQUAL_SCALE, validNpcScale,
  npcProfileProficiencyOrder, npcProficiencyMode } from "../../systems/legacy2-npc-profiles.mjs";
import { proficiencyOrderContext, updateNpcProficiencyOrder } from "../actor/jj/npc-proficiency-order.mjs";
import { NPC_MOVEMENT_TYPES } from "../../systems/legacy2-npc-movement.mjs";
import { configureNpcEquipment, npcEquipmentContext } from "./npc-profile-equipment.mjs";

/** Save all six weights together, rather than rejecting intermediate edits. */
export default class NpcProfileSheet extends ItemSheet5e {
  static DEFAULT_OPTIONS = {
    actions: {
      jj2ProficiencyOrder: function(event, target) { return updateNpcProficiencyOrder(this, target); },
      jj2ProfileEquipment: function(event, target) { return configureNpcEquipment(this, target); }
    },
    classes: ["jj2-npc-profile-sheet"],
    form: { submitOnChange: false, closeOnSubmit: false },
    position: { width: 560, height: 650 }, window: { resizable: true }
  };
  static PARTS = {
    header: super.PARTS.header, tabs: super.PARTS.tabs,
    scales: { template: "systems/jujutsu-system/templates/items/npc-profile-scales.hbs",
      templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs",
        "systems/jujutsu-system/templates/items/npc-profile-resistencias.hbs",
        "systems/jujutsu-system/templates/items/npc-profile-movement.hbs"], scrollable: [""] },
    equipamentos: { template: "systems/jujutsu-system/templates/items/npc-profile-equipment.hbs", scrollable: [""] },
    proficiencias: { template: "systems/jujutsu-system/templates/items/npc-profile-proficiencias.hbs",
      templates: ["systems/jujutsu-system/templates/actors/parts/jj2-proficiency-order.hbs"], scrollable: [""] },
    habilidades: { template: "systems/jujutsu-system/templates/items/npc-profile-habilidades.hbs",
      templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"], scrollable: [""] },
    description: super.PARTS.description,
    footer: { template: "systems/jujutsu-system/templates/items/npc-profile-footer.hbs" }
  };
  static TABS = [ { tab: "scales", label: "Detalhes" },
    { tab: "equipamentos", label: "Equipamentos", condition: item => item.type === "archetype" },
    { tab: "proficiencias", label: "Proficiências" },
    { tab: "habilidades", label: "Habilidades" },
    { tab: "description", label: "Descrição" } ];
  tabGroups = { primary: "scales" };

  async _configureRenderOptions(options) {
    if (options.isFirstRender && options.mode === undefined) options.mode = this.constructor.MODES.EDIT;
    await super._configureRenderOptions(options);
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === "proficiencias") {
      context.profile = { ...(context.profile ?? {}), combinedSaves: npcProficiencyMode() === "alternative",
        proficiency: proficiencyOrderContext(npcProfileProficiencyOrder(context.source), { profile: true }) };
      return context;
    }
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
    if (partId === "equipamentos") {
      context.profile = await npcEquipmentContext(this.item);
      return context;
    }
    if (partId !== "scales") return context;
    const taxonomy = this.item.type === "taxonomy", weights = context.source.pesos;
    const fontes = context.source.resistencias ?? {};
    const result = distributeNpcAttributes(taxonomy ? weights : NPC_EQUAL_SCALE, taxonomy ? null : weights, taxonomy ? 1 : 13);
    context.profile = { taxonomy, total: NPC_ABILITIES.reduce((sum, key) => sum + weights[key], 0),
      movement: NPC_MOVEMENT_TYPES.map(([key, label]) => ({ key, label, value: context.source.movimento?.[key] })),
      resistencias: NUMERIC_DAMAGE_TYPES.map(({ key, label }) => ({ key, label,
        value: Number(fontes[key]?.value) || 0, immune: !!fontes[key]?.immune })),
      attributes: NPC_ABILITIES.map(key => ({ key, label: game.i18n.localize(CONFIG.DND5E.abilities[key].label),
        weight: weights[key], preview: taxonomy ? result.initial[key] : result.growth[key] })) };
    return context;
  }

  /** Drop de característica (feat) na aba Habilidades: entra com ND 1. */
  async _onDrop(event) {
    if (!this.isEditable || !this.isEditMode) return false;
    const data = TextEditor.getDragEventData(event);
    if ( data.type === "Item" ) {
      const doc = await fromUuid(data.uuid).catch(() => null);
      if (event.target.closest?.(".jj2-npc-equipment")) return configureNpcEquipment(this, null, doc);
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
    if ( habilidades && this.isEditable && this.isEditMode ) {
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
