import Ruleset from "../../../systems/ruleset.mjs";
import { feiticoProgression2 } from "./legacy2-feitico.mjs";

/** The same Feitiço UI and document actions for player and NPC sheets. */
export default function FeiticoSheetMixin(Base) {
  return class FeiticoSheet extends Base {
    async _onRender(context, options) {
      await super._onRender(context, options);
      if (this.actor.limited || (this.actor.type === "npc" && !Ruleset.isV2())) return;
    // ── Aba Feitiço: hover dos drop zones + change de requisito/grau ──
    this.element.querySelectorAll(".feitico-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => e.preventDefault());
      zone.addEventListener("dragleave", e => {
        if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover");
      });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    this.element.querySelectorAll("[data-feitico-req]").forEach(el => {
      el.addEventListener("change", () => {
        if (this.isEditable) this._onFeiticoReqChange(el.dataset.itemId, parseInt(el.dataset.index), el.dataset.feiticoReq, el.value);
      });
    });


    }

    async _onDropItem(event, item) {
      if (this.actor.type === "npc" && !Ruleset.isV2()) return super._onDropItem(event, item);
      if (!this.isEditable && (item.type === "feiticoTemplate" || event.target.closest("[data-feitico-drop]"))) return false;
    // Instalar Molde de Feitiço
    if ( item.type === "feiticoTemplate" ) {
      return this._onFeiticoInstallTemplate(item);
    }

    // Aba Feitiço: drop em slot de manifestação ou em lista de técnicas
    const feiticoTarget = event.target.closest("[data-feitico-drop]");
    if ( feiticoTarget && item.type === "spell" ) {
      return this._onFeiticoDropSpell(event, item, feiticoTarget);
    }


      return super._onDropItem(event, item);
    }

    _onClickAction(event, target) {
      const action = target.dataset.action ?? "";
      if (action.startsWith("feitico-") || action.startsWith("manip-")) {
        if (!this.isEditable || this.actor.limited || (this.actor.type === "npc" && !Ruleset.isV2())) return;
  // ── Aba Feitiço ──────────────────────────────────────────
  if ( action === "feitico-roll" )             return this._onFeiticoRoll(target.dataset.itemId);
  if ( action === "feitico-edit" )             return this._onFeiticoEdit(target.dataset.itemId);
  if ( action === "feitico-display-card" )     return this._onFeiticoDisplayCard(target.dataset.itemId);
  if ( action === "feitico-change-image" )     return this._onFeiticoChangeImage(target.dataset.itemId);
  if ( action === "feitico-unassign-manif" )   return this._onFeiticoUnassign(target.dataset.slot);
  if ( action === "feitico-unassign-tecnica" ) return this._onFeiticoUnassignTecnica(target.dataset.itemId);
  if ( action === "feitico-create-manif" )     return this._onFeiticoCreateManif(target.dataset.slot);
  if ( action === "feitico-create-tecnica" )   return this._onFeiticoCreateTecnica(target.dataset.slot);
  if ( action === "feitico-req-add" )          return this._onFeiticoReqAdd(target.dataset.itemId);
  if ( action === "feitico-req-remove" )       return this._onFeiticoReqRemove(target.dataset.itemId, parseInt(target.dataset.index));
  if ( action === "feitico-save-template" )    return this._onFeiticoSaveTemplate();
  if ( action === "feitico-import-json" )      return this._onFeiticoImportJSON();
  if ( action === "manip-create" )             return this._onManipEdit(null);
  if ( action === "manip-edit" )               return this._onManipEdit(target.dataset.id);
  if ( action === "manip-del" )                return this._onManipDelete(target.dataset.id);
  if ( action === "manip-toggle" )             return this._onManipToggle(target.dataset.id);
  if ( action === "manip-chat" )               return this._onManipChat(target.dataset.id);


      }
      return super._onClickAction(event, target);
    }

  /** Shared manifestations, techniques and evolution for character levels or NPC threat levels. */
  async _prepareFeiticoContext(context, options) {
    const SLOTS = [
      { id: "inata", label: "Reversões de Feitiço", tecnicasLabel: "Técnicas de Reversão" },
      { id: "m1",    label: "1ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m2",    label: "2ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m3",    label: "3ª Manifestação",      tecnicasLabel: "Técnicas da Manifestação" }
    ];

    // Graus de técnica (0 = Auxiliar, 1-9) — mesma escala já usada no item de spell (system.level).
    const maestria = this.actor.system.masteryLevel ?? 0;
    const progressao2 = Ruleset.isV2() ? feiticoProgression2(this.actor) : null;
    const requisitoAtual = progressao2?.nivel ?? maestria;

    const allSpells = this.actor.items.filter(i => i.type === "spell");
    const slots = SLOTS.map(def => {
      const manifestacao = allSpells.find(s => s.getFlag("jujutsu-system", "feitico.slot") === def.id) ?? null;
      const tecnicas = allSpells
        .filter(s => s.getFlag("jujutsu-system", "feitico.parent") === def.id && s !== manifestacao)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

      // Requisitos de Maestria (até 6) — armazenados na manifestação
      const rawReqs = manifestacao?.getFlag("jujutsu-system", "feitico.requirements") ?? [];
      const manifestacaoId = manifestacao?.id ?? null;
      const requirements = rawReqs.map((req, idx) => {
        const level = req.level ?? 1;
        const met = requisitoAtual >= level;
        return { index: idx, manifestacaoId, level, currentLevel: requisitoAtual, met };
      });
      const unmet = requirements.filter(r => !r.met);
      const blocked = !!manifestacao && unmet.length > 0;
      const blockedReason = blocked
        ? "Requer: " + unmet.map(r => `${progressao2 ? "Nível " : "Maestria Nv"}${r.level} (atual: ${r.currentLevel})`).join("; ")
        : "";

      const _spellLite = (s, isBlocked = false) => {
        if ( !s ) return null;
        return {
          id: s.id,
          name: s.name,
          img: s.img,
          subtitle: s.system?.school ? CONFIG.DND5E.spellSchools?.[s.system.school]?.label : "",
          blocked: isBlocked,
          grau: s.system?.level ?? 0
        };
      };

      const reqsCols = requirements.length <= 1 ? 1
                     : requirements.length <= 4 ? 2
                     : 3;

      const tecnicasLite = tecnicas.map(t => _spellLite(t, blocked));
      // Duas colunas dentro da manifestação: técnicas com Grau (>=1) à esquerda,
      // Auxiliares (grau 0) à direita.
      let tecnicasGrau = tecnicasLite.filter(t => (t.grau ?? 0) >= 1);
      let tecnicasAux  = tecnicasLite.filter(t => (t.grau ?? 0) === 0);
      // Sem técnicas de Grau (só Auxiliares): elas ocupam a coluna da esquerda para
      // não flutuarem à direita.
      if ( !tecnicasGrau.length ) { tecnicasGrau = tecnicasAux; tecnicasAux = []; }

      return {
        ...def,
        manifestacao: _spellLite(manifestacao, blocked),
        tecnicas: tecnicasLite,
        tecnicasGrau,
        tecnicasAux,
        hasTecnicas: tecnicasLite.length > 0,
        requirements,
        reqsCols,
        canAddReq: !!manifestacao && requirements.length < 6,
        blocked,
        blockedReason
      };
    });

    // Proficiência por Nível de Maestria: 1 Básico · 3 Estendido · 5 Máximo · 7 Expansão
    const TIERS = [
      { id: "basico",    label: "Básico",             mainReq: 1,
        benefits: ["Uso de manifestações e técnicas do Feitiço"] },
      { id: "estendido", label: "Estendido",          mainReq: 3,
        benefits: ["Desbloqueia extensões mais poderosas das técnicas"] },
      { id: "maximo",    label: "Máximo",             mainReq: 5,
        benefits: ["Técnicas no seu potencial máximo"] },
      { id: "expansao",  label: "Expansão de Domínio", mainReq: 7,
        benefits: ["A manifestação suprema — Expansão de Domínio como Feitiço"] }
    ];

    let tier = "none";
    for ( const t of [...TIERS].reverse() ) {
      if ( maestria >= t.mainReq ) { tier = t.id; break; }
    }

    const tiersState = TIERS.map(t => ({
      ...t,
      reqMet: maestria >= t.mainReq,
      isCurrent: tier === t.id
    }));

    const tierLabels = { none: "—", basico: "Básico", estendido: "Estendido", maximo: "Máximo", expansao: "Expansão de Domínio" };

    // Manipulações de Habilidade: lista de consulta na ficha. Ativa-se até `prof` por vez.
    const manipLista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const manipLimite = this.actor.system.attributes?.prof ?? 2;
    const manipAtivas = manipLista.filter(m => m.ativa).length;

    context.feitico = {
      slots,
      maestria,
      manipulacoes: {
        lista: manipLista.map(m => ({
          id: m.id, nome: m.nome, duracao: m.duracao ?? "", requisito: m.requisito ?? "",
          desc: m.desc ?? "", ativa: !!m.ativa,
          // no limite, quem não está ativa fica bloqueada (não pode ligar mais)
          bloqueada: !m.ativa && (manipAtivas >= manipLimite)
        })),
        ativas: manipAtivas,
        limite: manipLimite
      },
      name: this.actor.getFlag("jujutsu-system", "feiticoName") ?? "",
      proficiencia: {
        id: tier,
        label: tierLabels[tier]
      },
      tiers: tiersState,
      isGM: game.user.isGM,
      isEditMode: this.isEditMode
    };
    if ( progressao2 ) Object.assign(context.feitico, progressao2);

    return context;
  }

  /** Esconde spells da aba Feitiço (manifestações e técnicas filhas) da spellbook normal. */
  _prepareSpellbook(context) {
    if (this.actor.type === "npc" && !Ruleset.isV2()) return super._prepareSpellbook(context);
    const original = context.itemCategories?.spells;
    if ( Array.isArray(original) ) {
      context.itemCategories.spells = original.filter(s => {
        const flag = s.getFlag("jujutsu-system", "feitico") ?? {};
        return !flag.slot && !flag.parent;
      });
    }
    const result = super._prepareSpellbook(context);
    if ( original ) context.itemCategories.spells = original;
    return result;
  }

  async _onFeiticoRoll(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    // Bloqueio: requisitos da própria manifestação ou do pai (se for técnica)
    const blocked = this._isFeiticoItemBlocked(item);
    if ( blocked ) {
      ui.notifications.warn(`"${item.name}" está bloqueada — ${blocked}`);
      return;
    }
    return item.use({}, { event: window.event });
  }

  /**
   * Verifica se um item do Feitiço (manifestação ou técnica) está bloqueado por
   * requisitos não atendidos (nível na 2.0, Maestria na 1.0).
   */
  _isFeiticoItemBlocked(item) {
    if ( !item ) return null;
    const flag = item.getFlag("jujutsu-system", "feitico") ?? {};
    let manifestacao = null;
    if ( flag.slot ) {
      manifestacao = item;
    } else if ( flag.parent ) {
      manifestacao = this.actor.items.find(i =>
        i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === flag.parent
      ) ?? null;
    }
    if ( !manifestacao ) return null;
    const reqs = manifestacao.getFlag("jujutsu-system", "feitico.requirements") ?? [];
    if ( !reqs.length ) return null;
    const v2 = Ruleset.isV2();
    const nivel = v2 ? Ruleset.nivel(this.actor) : this.actor.system.masteryLevel ?? 0;
    const unmet = reqs.filter(r => nivel < (r.level ?? 1));
    if ( !unmet.length ) return null;
    return "requer " + unmet.map(r => `${v2 ? "Nível " : "Maestria Nv"}${r.level}`).join(", ");
  }

  async _onFeiticoEdit(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.sheet?.render(true);
  }

  /** Manda o card da manifestação/técnica para o chat (descrição). */
  async _onFeiticoDisplayCard(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.displayCard();
  }

  /** Troca a imagem da manifestação/técnica via FilePicker (só em modo edição). */
  async _onFeiticoChangeImage(itemId) {
    if ( !this.isEditMode ) return;
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    new FP({
      type: "image",
      current: item.img,
      callback: path => item.update({ img: path })
    }).render(true);
  }

  async _onFeiticoUnassign(slotId) {
    const target = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === slotId
    );
    if ( !target ) return;
    await target.unsetFlag("jujutsu-system", "feitico");
    ui.notifications.info(`"${target.name}" removida do slot.`);
  }

  async _onFeiticoUnassignTecnica(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    await item.unsetFlag("jujutsu-system", "feitico");
    ui.notifications.info(`"${item.name}" removida da lista de técnicas.`);
  }

  async _onFeiticoCreateManif(slotId) {
    // Se o slot já tem manifestação, abre ela em vez de criar duplicata
    const existing = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("jujutsu-system", "feitico.slot") === slotId
    );
    if ( existing ) return existing.sheet?.render(true);

    const SLOT_NAMES = {
      inata: "Reversão de Feitiço",
      m1:    "1ª Manifestação",
      m2:    "2ª Manifestação",
      m3:    "3ª Manifestação"
    };
    const created = await Item.implementation.create([{
      name: SLOT_NAMES[slotId] ?? "Nova Manifestação",
      type: "spell",
      system: { level: 0, method: "atwill" },
      flags: { "jujutsu-system": { feitico: { slot: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  async _onFeiticoCreateTecnica(slotId) {
    const created = await Item.implementation.create([{
      name: "Nova Técnica",
      type: "spell",
      system: { level: 0 },
      flags: { "jujutsu-system": { feitico: { parent: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  /* -------------------------------------------- */
  /*  Manipulações de Habilidade                  */
  /* -------------------------------------------- */

  /** Editor (criar/editar) de uma Manipulação de Habilidade: nome + duração + requisito
   *  + descrição (ProseMirror). Persiste em flags.jujutsu-system.feiticoManipulacoes. */
  async _onManipEdit(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const def = id ? lista.find(m => m.id === id) : null;
    const editando = !!def;

    const content = `
      <div class="jj-manip-form" style="display:flex;flex-direction:column;gap:10px;min-width:460px;padding:4px 2px">
        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Nome</label>
          <input type="text" name="manip-nome" value="${foundry.utils.escapeHTML(def?.nome ?? "")}"
                 placeholder="Ex: Restrição de Alcance" style="width:100%">
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Duração</label>
            <input type="text" name="manip-duracao" value="${foundry.utils.escapeHTML(def?.duracao ?? "")}"
                   placeholder="Ex: Até o fim do turno." style="width:100%">
          </div>
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Requisito</label>
            <input type="text" name="manip-requisito" value="${foundry.utils.escapeHTML(def?.requisito ?? "")}"
                   placeholder="Ex: Remote Punch" style="width:100%">
          </div>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#c8a84b">Descrição</label>
          <div class="manip-desc-mount" style="min-height:170px"></div>
        </div>
      </div>`;

    const buttons = [{
      action: "ok", label: editando ? "Salvar" : "Criar", default: true, icon: "fas fa-check",
      callback: (event, button, dialog) => {
        const el = dialog.element;
        return {
          nome: el.querySelector("[name='manip-nome']")?.value?.trim() ?? "",
          duracao: el.querySelector("[name='manip-duracao']")?.value?.trim() ?? "",
          requisito: el.querySelector("[name='manip-requisito']")?.value?.trim() ?? "",
          desc: el.querySelector("prose-mirror[name='manip-desc']")?.value ?? ""
        };
      }
    }];
    if ( editando ) buttons.push({ action: "del", label: "Remover", icon: "fas fa-trash", callback: () => "DELETE" });
    buttons.push({ action: "cancel", label: "Cancelar", callback: () => null });

    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: editando ? "Editar Manipulação" : "Manipulação de Habilidade", icon: "fas fa-hand-sparkles" },
      content, buttons,
      render: (event, dialog) => {
        const editor = foundry.applications.elements.HTMLProseMirrorElement.create({
          name: "manip-desc", value: def?.desc ?? ""
        });
        dialog.element.querySelector(".manip-desc-mount")?.replaceChildren(editor);
      },
      rejectClose: false
    });

    if ( res === null || res === undefined ) return;
    const nova = foundry.utils.deepClone(lista);
    if ( res === "DELETE" ) return this._onManipDelete(def.id);
    if ( !res.nome ) { ui.notifications.warn("Dê um nome à manipulação."); return; }

    if ( editando ) {
      const i = nova.findIndex(m => m.id === def.id);
      if ( i >= 0 ) nova[i] = { ...nova[i], ...res };
    } else {
      nova.push({ id: `manip-${foundry.utils.randomID(8)}`, ativa: false, ...res });
    }
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", nova);
  }

  /** Remove uma Manipulação de Habilidade. */
  async _onManipDelete(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", lista.filter(m => m.id !== id));
  }

  /** Liga/desliga uma manipulação, respeitando o limite = bônus de proficiência. */
  async _onManipToggle(id) {
    const lista = foundry.utils.deepClone(this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? []);
    const m = lista.find(x => x.id === id);
    if ( !m ) return;
    if ( !m.ativa ) {
      const limite = this.actor.system.attributes?.prof ?? 2;
      const ativas = lista.filter(x => x.ativa).length;
      if ( ativas >= limite ) {
        ui.notifications.warn(`Máximo de ${limite} manipulação(ões) ativa(s) por vez (bônus de proficiência).`);
        return;
      }
    }
    m.ativa = !m.ativa;
    await this.actor.setFlag("jujutsu-system", "feiticoManipulacoes", lista);
  }

  /** Envia uma Manipulação de Habilidade para o chat como um card (nome + descrição + duração + requisito). */
  async _onManipChat(id) {
    const lista = this.actor.getFlag("jujutsu-system", "feiticoManipulacoes") ?? [];
    const m = lista.find(x => x.id === id);
    if ( !m ) return;
    const esc = foundry.utils.escapeHTML;
    const TE = foundry.applications.ux.TextEditor.implementation;
    const desc = m.desc
      ? await TE.enrichHTML(m.desc, { rollData: this.actor.getRollData(), relativeTo: this.actor })
      : "";
    const metas = [];
    if ( m.duracao )   metas.push(`<div class="jj-manip-chat-meta"><span class="lbl">Duração</span><span>${esc(m.duracao)}</span></div>`);
    if ( m.requisito ) metas.push(`<div class="jj-manip-chat-meta"><span class="lbl">Requisito</span><span>${esc(m.requisito)}</span></div>`);
    const content = `
      <div class="jujutsu-card jj-manip-chat">
        <header class="jj-manip-chat-head">
          <i class="fas fa-hand-sparkles"></i>
          <h3>${esc(m.nome || "Manipulação")}</h3>
        </header>
        ${desc ? `<div class="jj-manip-chat-desc">${desc}</div>` : ""}
        ${metas.length ? `<div class="jj-manip-chat-metas">${metas.join("")}</div>` : ""}
      </div>`;
    return ChatMessage.implementation.create({
      speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
      content
    });
  }

  /* -------------------------------------------- */
  /*  Molde de Feitiço (salvar / instalar / importar) */
  /* -------------------------------------------- */

  async _onFeiticoSaveTemplate() {
    const feiticoItems = this.actor.items.filter(i => {
      if ( i.type !== "spell" ) return false;
      const flag = i.getFlag("jujutsu-system", "feitico");
      return flag?.slot || flag?.parent;
    });

    if ( !feiticoItems.length ) {
      ui.notifications.warn("Nenhuma manifestação ou técnica encontrada para salvar.");
      return;
    }

    try {
      const feiticoName = this.actor.getFlag("jujutsu-system", "feiticoName")?.trim();
      const template = await Item.implementation.create({
        name: feiticoName || `${this.actor.name} — Molde de Feitiço`,
        type: "feiticoTemplate",
        img: "icons/skills/melee/strike-hammer-destructive-blue.webp"
      });
      if ( !template ) return;

      // Cada manifestação/técnica vira um item real (não um blob de dados), ligado ao
      // molde pela flag feiticoTemplate — assim mantém sheet completa (activities, dano
      // etc.) ao configurar o molde depois, igual a container.mjs faz com `system.container`.
      // Todas ficam no compendium compartilhado (não na lista de Itens do mundo).
      const { ensureFeiticoPack } = await import("../../../data/item/feitico-template.mjs");
      const pack = await ensureFeiticoPack();
      const folder = await template.system.ensureFolder();
      const itemsData = feiticoItems.map(i => {
        const data = i.toObject();
        delete data._id;
        data.folder = folder?.id;
        foundry.utils.setProperty(data, "flags.jujutsu-system.feiticoTemplate", template.id);
        return data;
      });
      await Item.implementation.create(itemsData, { pack: pack.metadata.id });

      ui.notifications.info(`Molde "${template.name}" criado com ${itemsData.length} item(ns). Arraste para uma ficha para instalar.`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível criar o Molde de Feitiço (verifique permissões para criar itens).");
    }
  }

  async _onFeiticoInstallTemplate(templateItem) {
    const contents = Array.from(await templateItem.system?.contents ?? []);
    if ( !contents.length ) {
      ui.notifications.warn("Este Molde de Feitiço está vazio.");
      return;
    }
    await this._installFeiticoItems(contents.map(i => i.toObject()));
  }

  /**
   * Instala um conjunto de manifestações/técnicas (dados brutos de itens) nesta ficha:
   * confirma, limpa o vínculo com o molde, libera os slots já ocupados e cria os itens.
   * Fonte compartilhada por "arrastar molde" e "importar JSON".
   * @param {object[]} rawItems  Item datas (spell) com flags jujutsu-system.feitico.
   */
  async _installFeiticoItems(rawItems) {
    const itemsData = (rawItems ?? []).map(raw => {
      const data = foundry.utils.deepClone(raw);
      delete data._id;
      // vínculo com o molde de origem não deve ir para a ficha
      if ( data.flags?.["jujutsu-system"] ) delete data.flags["jujutsu-system"].feiticoTemplate;
      return data;
    }).filter(d => d?.type === "spell");   // só manifestações/técnicas (spell) entram

    if ( !itemsData.length ) {
      ui.notifications.warn("Nenhuma manifestação/técnica válida para instalar.");
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Instalar Molde de Feitiço" },
      content: `<p>Isso vai adicionar <strong>${itemsData.length}</strong> item(ns) de Feitiço nesta ficha, substituindo manifestações que já ocupem os mesmos slots. Continuar?</p>`
    });
    if ( !confirmed ) return;

    // Slots já ocupados no ator: precisam ser liberados antes de instalar o molde,
    // senão dois itens ficam com a mesma flag feitico.slot e um deles some da ficha.
    const incomingSlots = new Set(itemsData.map(d => d.flags?.["jujutsu-system"]?.feitico?.slot).filter(Boolean));
    for ( const slotId of incomingSlots ) {
      const previous = this.actor.items.find(i =>
        (i.type === "spell") && (i.getFlag("jujutsu-system", "feitico.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("jujutsu-system", "feitico");
    }

    try {
      await Item.implementation.create(itemsData, { parent: this.actor });
      ui.notifications.info(`Feitiço instalado: ${itemsData.length} item(ns) adicionado(s).`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível instalar o Molde de Feitiço.");
    }
  }

  /**
   * Importa um Molde a partir de um JSON (o mesmo gerado por "Salvar Molde" → Export Data,
   * que empacota as manifestações/técnicas em flags.jujutsu-system.feiticoBundle) direto
   * nesta ficha, sem passar por um item-molde. Aceita: o objeto do molde com feiticoBundle,
   * um array de itens, ou um único item spell.
   */
  async _onFeiticoImportJSON() {
    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: "Importar Molde de Feitiço (JSON)", icon: "fas fa-file-import" },
      position: { width: 560 },
      content: `
        <p class="hint" style="margin-top:0">Cole o <b>JSON de um Molde</b> (exportado pelo botão Salvar Molde → clique direito no item → <i>Export Data</i>) ou escolha o arquivo. As manifestações e técnicas entram direto nesta ficha.</p>
        <div class="form-group"><label>Arquivo .json</label>
          <input type="file" name="arquivo" accept="application/json,.json"></div>
        <div class="form-group"><label>…ou cole o JSON aqui</label>
          <textarea name="json" rows="8" placeholder='{ "type": "feiticoTemplate", ... }'></textarea></div>`,
      buttons: [
        { action: "importar", label: "Importar", icon: "fas fa-file-import", default: true,
          callback: (ev, b) => ({ texto: b.form.elements.json.value, file: b.form.elements.arquivo.files?.[0] ?? null }) },
        { action: "cancelar", label: "Cancelar" }
      ],
      rejectClose: false
    }).catch(() => null);
    if ( !res || res === "cancelar" ) return;

    let texto = res.texto?.trim() ?? "";
    if ( res.file ) {
      try { texto = await res.file.text(); }
      catch { return void ui.notifications.error("Não foi possível ler o arquivo."); }
    }
    if ( !texto ) return void ui.notifications.warn("Nenhum JSON informado.");

    let data;
    try { data = JSON.parse(texto); }
    catch { return void ui.notifications.error("JSON inválido — verifique o conteúdo."); }

    // Extrai as manifestações/técnicas: bundle do molde, array direto, ou item único.
    const bundle = foundry.utils.getProperty(data, "flags.jujutsu-system.feiticoBundle");
    const rawItems = Array.isArray(bundle) ? bundle
      : Array.isArray(data) ? data
      : (data?.type === "spell") ? [data]
      : null;
    if ( !rawItems?.length ) {
      return void ui.notifications.warn("Esse JSON não parece um Molde de Feitiço (sem manifestações/técnicas).");
    }
    await this._installFeiticoItems(rawItems);
  }

  async _onFeiticoReqAdd(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( reqs.length >= 6 ) {
      ui.notifications.warn("Máximo de 6 requisitos por manifestação.");
      return;
    }
    reqs.push({ level: 1 });
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  async _onFeiticoReqRemove(itemId, index) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( !reqs[index] ) return;
    reqs.splice(index, 1);
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  async _onFeiticoReqChange(itemId, index, field, rawValue) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("jujutsu-system", "feitico.requirements") ?? []);
    if ( !reqs[index] ) return;
    if ( field === "level" ) reqs[index].level = Math.max(1, Math.min(Ruleset.isV2() ? 20 : 7, parseInt(rawValue) || 1));
    await item.setFlag("jujutsu-system", "feitico", {
      ...(item.getFlag("jujutsu-system", "feitico") ?? {}),
      requirements: reqs
    });
  }

  /**
   * Atribui um spell a um slot de manifestação ou como técnica filha de um slot (drop).
   */
  async _onFeiticoDropSpell(event, item, dropTarget) {
    const dropType = dropTarget.dataset.feiticoDrop;
    const slotId = dropTarget.closest("[data-feitico-slot]")?.dataset.feiticoSlot;
    if ( !slotId ) return;

    let owned = item.parent === this.actor ? item : null;

    // Item externo: criar no actor primeiro
    if ( !owned ) {
      const itemData = item.toObject();
      delete itemData._id;
      if ( dropType === "manif" ) {
        foundry.utils.setProperty(itemData, "system.method", "atwill");
      }
      const created = await Item.implementation.create(itemData, { parent: this.actor });
      owned = Array.isArray(created) ? created[0] : created;
      if ( !owned ) return;
    }

    // Limpar flag anterior antes de setar a nova
    await owned.unsetFlag("jujutsu-system", "feitico");

    if ( dropType === "manif" ) {
      // Se outra manifestação ocupava esse slot, desocupa
      const previous = this.actor.items.find(i =>
        (i !== owned) && (i.type === "spell") &&
        (i.getFlag("jujutsu-system", "feitico.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("jujutsu-system", "feitico");
      await owned.setFlag("jujutsu-system", "feitico", { slot: slotId });
      // Promover método para "atwill" se ainda não for
      if ( owned.system?.method !== "atwill" ) {
        await owned.update({ "system.method": "atwill" });
      }
      ui.notifications.info(`"${owned.name}" atribuída ao slot ${slotId}.`);
    } else {
      await owned.setFlag("jujutsu-system", "feitico", { parent: slotId });
      ui.notifications.info(`"${owned.name}" adicionada como técnica de ${slotId}.`);
    }

    return owned;
  }


  };
}
