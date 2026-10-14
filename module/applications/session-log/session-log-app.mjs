/**
 * session-log-app.mjs
 * "Fazer Log" — ferramenta de GM pra conceder PT/Maldição/itens/Yen a vários jogadores de
 * uma vez e gerar automaticamente uma página no Journal "Logs da Sessão". Aberta pelo botão
 * dedicado no grupo "Notes" dos controles de cena (ver Hooks.on("getSceneControlButtons")
 * no fim deste arquivo).
 */
import Application5e from "../api/application.mjs";
import { findOrCreateSessionLogJournal, buildSessionLogPageHTML, formatYen } from "./session-log-journal.mjs";

/* -------------------------------------------- */
/*  Estilos (injetados via JS — não dependem de reiniciar o mundo pra reler o system.json;
    carregam junto com o módulo e valem também para .session-log-page dentro do Journal) */
/* -------------------------------------------- */

const STYLE_ID = "jj-session-log-styles";
const CSS_TEXT = `
#session-log-app { min-width: 660px; }
.session-log-app { display: flex; flex-direction: column; gap: 14px; padding: 12px 14px; color: #d6e2f0; }
.session-log-portraits { display: flex; flex-wrap: wrap; gap: 10px; }
.session-log-portrait {
  position: relative; width: 56px; height: 56px; padding: 0; border-radius: 8px;
  border: 2px solid rgba(160,110,220,0.3); background: rgba(0,0,0,0.3); cursor: pointer;
  overflow: visible; transition: border-color 0.15s ease, transform 0.1s ease; flex: 0 0 auto;
}
.session-log-portrait:hover { transform: translateY(-2px); border-color: rgba(160,110,220,0.6); }
.session-log-portrait.active { border-color: #b070e0; box-shadow: 0 0 10px rgba(160,110,220,0.4); }
.session-log-portrait.saved { border-color: #6ab86a; }
.session-log-portrait img { width: 100%; height: 100%; object-fit: cover; border-radius: 5px; border: none; }
.session-log-saved-badge {
  position: absolute; bottom: -5px; right: -5px; width: 16px; height: 16px; border-radius: 50%;
  background: #2a6a2a; border: 1px solid #6ab86a; color: #bfe6bf; font-size: 9px;
  display: flex; align-items: center; justify-content: center;
}
.session-log-cards { display: flex; flex-direction: column; gap: 10px; }
.session-log-card {
  background: linear-gradient(135deg, #1a1626 0%, #0b0a12 100%);
  border: 1px solid rgba(160,110,220,0.35); border-radius: 10px; padding: 12px 14px;
}
.session-log-card-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(160,110,220,0.2);
}
.session-log-card-header img { width: 32px; height: 32px; border-radius: 5px; object-fit: cover; border: none; flex: 0 0 auto; }
.session-log-card-name { font-size: 14px; font-weight: 700; letter-spacing: 0.02em; color: #d8b0f0; }
.session-log-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
.session-log-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.session-log-field label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #9098a8; white-space: nowrap; }
.session-log-field input {
  background: rgba(0,0,0,0.35); border: 1px solid rgba(160,110,220,0.35); border-radius: 5px;
  color: #ede0fa; font-size: 13px; font-weight: 700; text-align: center; padding: 5px 0;
}
.session-log-field input:focus { outline: none; border-color: #b070e0; }
.session-log-dropzone {
  min-height: 46px; border: 1px dashed rgba(160,110,220,0.4); border-radius: 6px;
  padding: 8px 10px; margin-bottom: 10px; display: flex; align-items: center;
}
.session-log-dropzone-hint { margin: 0; font-size: 12px; color: #6c6c78; font-style: italic; }
.session-log-items { display: flex; flex-wrap: wrap; gap: 6px; }
.session-log-item-chip {
  display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 20px;
  background: rgba(160,110,220,0.12); border: 1px solid rgba(160,110,220,0.4); font-size: 12px; color: #d8ccff;
}
.session-log-item-chip button {
  background: none; border: none; color: #6c6c78; font-size: 13px; line-height: 1; cursor: pointer; padding: 0;
}
.session-log-item-chip button:hover { color: #ff7676; }
.session-log-save-btn {
  width: 100%; padding: 7px 0; border-radius: 6px; border: 1px solid rgba(160,110,220,0.45);
  background: rgba(160,110,220,0.12); color: #d8ccff; font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; transition: background 0.15s ease;
}
.session-log-save-btn:hover { background: rgba(160,110,220,0.25); }
.session-log-footer { display: flex; justify-content: flex-end; padding-top: 6px; border-top: 1px solid rgba(160,110,220,0.2); }
.session-log-create-btn {
  display: flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: 7px;
  border: 1px solid #b070e0; background: linear-gradient(135deg, rgba(160,110,220,0.3), rgba(160,110,220,0.12));
  color: #e8d8ff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer; transition: background 0.15s ease;
}
.session-log-create-btn:hover { background: linear-gradient(135deg, rgba(160,110,220,0.45), rgba(160,110,220,0.2)); }
.session-log-create-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.session-log-empty { text-align: center; color: #6c6c78; font-size: 13px; padding: 20px 0; }
.session-log-notes { margin-top: 10px; }
.session-log-notes > label, .session-log-session-notes > label {
  display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #9098a8; margin-bottom: 4px;
}
.session-log-session-notes { padding-top: 6px; border-top: 1px solid rgba(160,110,220,0.2); }
.session-log-notes prose-mirror, .session-log-session-notes prose-mirror {
  display: flex; flex-direction: column; border: 1px solid rgba(160,110,220,0.35); border-radius: 6px;
  background: rgba(0,0,0,0.25); overflow: hidden;
}
/* O ProseMirror monta com {mount:target}, então o .editor-content É o próprio editável. O padrão
   do Foundry é position:absolute, que o tira do fluxo e colapsa a área clicável pra uma linha —
   forçamos in-flow (position:relative) + altura real pra caixa inteira ficar digitável. */
.session-log-notes prose-mirror .editor-content, .session-log-session-notes prose-mirror .editor-content {
  position: relative !important; flex: 1 1 auto; min-height: 80px; margin: 0; padding: 6px 8px;
  color: #e2e2ea; overflow: auto; cursor: text;
}
.session-log-session-notes prose-mirror .editor-content { min-height: 130px; }
.session-log-page h2 { color: #b070e0; margin-bottom: 6px; }
.session-log-page h3 { color: #a86ee0; margin-bottom: 4px; }
.session-log-page hr { border: none; border-top: 1px solid rgba(160,110,220,0.3); margin: 12px 0; }
.session-log-page .session-log-note { margin: 4px 0 2px; padding-left: 8px; border-left: 2px solid rgba(160,110,220,0.4); color: #c8c8d4; }
`;

function injectStyles() {
  if ( document.getElementById(STYLE_ID) ) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

/**
 * @typedef {object} StagedGrant
 * @property {string} actorId
 * @property {string} actorName               Snapshot no momento da configuração.
 * @property {number} trainingPoints          >=0, vai para system.curseResources.narratorTrainingPoints.
 * @property {number} cursePoints              >=0, vai para system.curseResources.cursePoints.
 * @property {number} currency                >=0, vai para system.currency.yen.
 * @property {number} intensiveTrainingsNote   >=0 — só aparece no log, nunca grava em nenhum campo do ator.
 * @property {object[]} items                  Dados de Item (Item5e#toObject()), prontos para createEmbeddedDocuments.
 * @property {string} notes                    Observações por jogador (HTML do ProseMirror) — só aparecem no log.
 */

/** Cria um StagedGrant vazio para um ator. */
function emptyGrant(actor) {
  return {
    actorId: actor.id,
    actorName: actor.name,
    trainingPoints: 0,
    cursePoints: 0,
    currency: 0,
    intensiveTrainingsNote: 0,
    items: [],
    notes: ""
  };
}

/** Tem conteúdo de verdade (ignora HTML vazio tipo "<p></p>" que o ProseMirror deixa). */
function hasRichText(html) {
  return !!html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim().length > 0;
}

/**
 * Atores do tipo "character" com pelo menos um dono não-GM — independente de
 * game.actors.party/primaryParty (funciona mesmo sem grupo primário configurado) e
 * independente do jogador estar online no momento.
 * @returns {Actor5e[]}
 */
function getEligibleActors() {
  return game.actors.filter(actor =>
    (actor.type === "character") &&
    game.users.some(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export default class SessionLogApp extends Application5e {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "session-log-app",
    classes: ["session-log-app"],
    tag: "div",
    window: { title: "Fazer Log", icon: "fa-solid fa-book", resizable: true },
    position: { width: 700, height: "auto" },
    actions: {
      togglePlayerCard: SessionLogApp.#togglePlayerCard,
      savePlayerCard: SessionLogApp.#savePlayerCard,
      removeStagedItem: SessionLogApp.#removeStagedItem,
      createLog: SessionLogApp.#createLog
    }
  };

  /** @inheritDoc */
  static PARTS = {
    body: { template: "systems/jujutsu-system/templates/apps/session-log.hbs" }
  };

  /**
   * Concessões configuradas nesta sessão do app — em memória só, perdidas ao fechar.
   * @type {Map<string, StagedGrant>}
   */
  #staged = new Map();

  /**
   * Quais cards estão expandidos no momento — estado puramente visual.
   * @type {Set<string>}
   */
  #expandedActorIds = new Set();

  /**
   * Narrativa geral da sessão (HTML do ProseMirror) — editor fixo no rodapé.
   * @type {string}
   */
  #sessionNotes = "";

  /**
   * Trava de re-entrância pra "Criar Log" — impede que um clique-duplo aplique tudo duas vezes.
   * @type {boolean}
   */
  #committing = false;

  /**
   * Instância única do app — clicar no botão de novo reaproveita a janela aberta em vez de
   * abrir uma segunda com estado separado (que poderia perder ou duplicar concessões).
   * @type {SessionLogApp|null}
   */
  static #instance = null;

  /**
   * Abre (ou traz pra frente) a única instância do "Fazer Log".
   * @returns {SessionLogApp}
   */
  static open() {
    SessionLogApp.#instance ??= new SessionLogApp();
    SessionLogApp.#instance.render({ force: true });
    return SessionLogApp.#instance;
  }

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    if ( SessionLogApp.#instance === this ) SessionLogApp.#instance = null;
  }

  /* -------------------------------------------- */
  /*  Estado (captura + poda)                     */
  /* -------------------------------------------- */

  /** Uma concessão está "vazia" quando não tem número, item nem nota. */
  #isEmptyGrant(g) {
    return !g.trainingPoints && !g.cursePoints && !g.currency && !g.intensiveTrainingsNote
      && !g.items.length && !hasRichText(g.notes);
  }

  /**
   * Lê tudo que está editável na tela (campos numéricos + notas por card + narrativa geral)
   * e grava no estado, ANTES de qualquer re-render — sem isso, valores digitados mas não
   * salvos seriam apagados quando a tela se redesenha (arrastar item, trocar de card, etc.).
   * Grants que ficam sem nada (zeros, sem item e sem nota) são removidos, pra não gerar badge
   * "salvo" falso nem seção vazia no log.
   */
  #captureState() {
    // Narrativa geral (editor fixo no rodapé, sempre presente).
    const sessionEl = this.element?.querySelector('prose-mirror[name="session-notes"]');
    if ( sessionEl ) this.#sessionNotes = sessionEl.value ?? "";

    // Cards abertos.
    this.element?.querySelectorAll(".session-log-card").forEach(card => {
      const actorId = card.dataset.actorId;
      const actor = actorId ? game.actors.get(actorId) : null;
      if ( !actor ) return;
      // Tira tudo que não for dígito antes de converter — necessário pro campo de Yen,
      // que exibe separador de milhar ("100.000") num input de texto, não numérico.
      const readNum = (field) => Math.max(0, parseInt(String(card.querySelector(`[data-field="${field}"]`)?.value ?? "").replace(/\D/g, "")) || 0);
      const grant = this.#staged.get(actorId) ?? emptyGrant(actor);
      grant.trainingPoints = readNum("trainingPoints");
      grant.cursePoints = readNum("cursePoints");
      grant.currency = readNum("currency");
      grant.intensiveTrainingsNote = readNum("intensiveTrainingsNote");
      grant.notes = card.querySelector("prose-mirror")?.value ?? grant.notes ?? "";
      if ( this.#isEmptyGrant(grant) ) this.#staged.delete(actorId);
      else this.#staged.set(actorId, grant);
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actors = getEligibleActors();

    context.players = actors.map(actor => {
      const staged = this.#staged.get(actor.id);
      return {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        expanded: this.#expandedActorIds.has(actor.id),
        saved: !!staged,
        trainingPoints: staged?.trainingPoints ?? 0,
        cursePoints: staged?.cursePoints ?? 0,
        currency: staged?.currency ?? 0,
        currencyDisplay: formatYen(staged?.currency ?? 0),
        intensiveTrainingsNote: staged?.intensiveTrainingsNote ?? 0,
        items: staged?.items ?? [],
        notes: staged?.notes ?? ""
      };
    });
    context.sessionNotes = this.#sessionNotes;
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    injectStyles();
    this.element.querySelectorAll(".session-log-dropzone").forEach(zone => {
      zone.addEventListener("dragover", event => event.preventDefault());
      zone.addEventListener("drop", event => this.#onDropItem(event, zone));
    });
    // Formata o campo de Yen com separador de milhar enquanto o GM digita.
    this.element.querySelectorAll('[data-field="currency"]').forEach(input => {
      input.addEventListener("input", () => {
        const digits = input.value.replace(/\D/g, "");
        input.value = digits ? formatYen(digits) : "";
      });
    });
  }

  /* -------------------------------------------- */
  /*  Drag & drop de itens                        */
  /* -------------------------------------------- */

  /**
   * Recebe um Item arrastado sobre a dropzone de um jogador e já o inclui na concessão
   * (não depende do botão "Salvar" daquele card — cada item solto já entra na fila).
   * @param {DragEvent} event
   * @param {HTMLElement} zone
   */
  async #onDropItem(event, zone) {
    event.preventDefault();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if ( data?.type !== "Item" ) return;

    const item = await Item.implementation.fromDropData(data);
    if ( !item ) {
      ui.notifications.warn("Não foi possível resolver o item arrastado.");
      return;
    }

    const actorId = zone.closest("[data-actor-id]")?.dataset.actorId;
    const actor = game.actors.get(actorId);
    if ( !actor ) return;

    // Preserva números digitados em cards abertos antes de redesenhar.
    this.#captureState();

    const itemData = item.toObject();
    delete itemData._id;
    delete itemData.folder;
    // Sem lógica de container/mescla de quantidade de propósito — cada item solto
    // vira uma concessão avulsa, mesmo que o jogador já tenha algo com o mesmo nome.

    const grant = this.#staged.get(actorId) ?? emptyGrant(actor);
    grant.items.push(itemData);
    this.#staged.set(actorId, grant);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  /**
   * Expande ou recolhe o card de um jogador.
   * @this {SessionLogApp}
   */
  static #togglePlayerCard(event, target) {
    const actorId = target.closest("[data-actor-id]")?.dataset.actorId;
    if ( !actorId ) return;
    // Preserva o que já foi digitado em cards abertos antes de recolher/expandir.
    this.#captureState();
    if ( this.#expandedActorIds.has(actorId) ) this.#expandedActorIds.delete(actorId);
    else this.#expandedActorIds.add(actorId);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Confirma o card: grava os números digitados em #staged e recolhe. Nada é escrito na
   * ficha ainda — isso só acontece em "Criar Log".
   * @this {SessionLogApp}
   */
  static #savePlayerCard(event, target) {
    const actorId = target.closest(".session-log-card")?.dataset.actorId;
    // #captureState já lê todos os cards abertos (inclusive este) para #staged.
    this.#captureState();
    if ( actorId ) this.#expandedActorIds.delete(actorId);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Remove um item já solto na concessão de um jogador, antes de "Criar Log".
   * @this {SessionLogApp}
   */
  static #removeStagedItem(event, target) {
    const actorId = target.closest("[data-actor-id]")?.dataset.actorId;
    const index = Number(target.dataset.index);
    // Preserva números digitados antes de redesenhar.
    this.#captureState();
    const grant = this.#staged.get(actorId);
    if ( !grant ) return;
    grant.items.splice(index, 1);
    if ( this.#isEmptyGrant(grant) ) this.#staged.delete(actorId);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Aplica todas as concessões configuradas nas fichas de verdade e cria a página do log.
   * @this {SessionLogApp}
   */
  static async #createLog(event, target) {
    if ( !game.user.isGM || this.#committing ) return;
    // Captura o que estiver digitado em cards abertos + narrativa antes de comprometer nada.
    this.#captureState();
    if ( !this.#staged.size && !hasRichText(this.#sessionNotes) ) {
      ui.notifications.warn("Nada configurado ainda — adicione concessões ou uma narrativa.");
      this.render();
      return;
    }

    this.#committing = true;
    try {
      const entries = [];
      const failed = [];
      for ( const [actorId, grant] of this.#staged ) {
        const actor = game.actors.get(actorId);
        if ( !actor ) {
          console.warn(`Jujutsu | Fazer Log: ator ${actorId} não existe mais, pulando.`);
          continue;
        }

        try {
          const current = actor.system.curseResources ?? {};
          const updates = {};
          if ( grant.trainingPoints ) {
            updates["system.curseResources.narratorTrainingPoints"] = (current.narratorTrainingPoints ?? 0) + grant.trainingPoints;
          }
          if ( grant.cursePoints ) {
            updates["system.curseResources.cursePoints"] = (current.cursePoints ?? 0) + grant.cursePoints;
          }
          if ( grant.currency ) {
            updates["system.currency.yen"] = (actor.system.currency?.yen ?? 0) + grant.currency;
          }
          if ( Object.keys(updates).length ) await actor.update(updates);
          if ( grant.items.length ) await actor.createEmbeddedDocuments("Item", grant.items);
          entries.push(grant);
        } catch(err) {
          // Um ator que falha (permissão, bloqueio, etc.) não aborta o lote inteiro —
          // registra o erro, avisa, e segue para os outros.
          console.error(`Jujutsu | Fazer Log: falha ao aplicar em ${actor.name}:`, err);
          failed.push(actor.name);
        }
      }

      // Só aborta se não sobrou nada pra registrar (nenhuma concessão aplicada E sem narrativa).
      if ( !entries.length && !hasRichText(this.#sessionNotes) ) {
        ui.notifications.error("Nenhuma concessão pôde ser aplicada. Nada foi registrado.");
        return;
      }

      const journal = await findOrCreateSessionLogJournal();
      if ( !journal ) {
        ui.notifications.error("As fichas foram atualizadas, mas o Journal do log não pôde ser criado.");
        return;
      }
      const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const pages = await journal.createEmbeddedDocuments("JournalEntryPage", [{
        name: dateLabel,
        type: "text",
        text: { content: buildSessionLogPageHTML(entries, this.#sessionNotes), format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML }
      }]);

      // Mostra o log grande pra todo mundo (força independente de permissão individual).
      const page = pages?.[0];
      if ( page ) {
        try { await foundry.documents.collections.Journal.show(page, { force: true }); }
        catch(err) { console.error("Jujutsu | Fazer Log: falha ao mostrar o log aos jogadores:", err); }
      }

      const suffix = failed.length ? ` (${failed.length} com falha: ${failed.join(", ")})` : "";
      ui.notifications.info(`Log da sessão criado — ${entries.length} jogador(es) atualizados${suffix}.`);
      this.#staged.clear();
      this.#expandedActorIds.clear();
      this.#sessionNotes = "";
      this.close();
    } finally {
      this.#committing = false;
    }
  }
}

/* -------------------------------------------- */
/*  Botão dedicado no grupo "Notes" dos controles de cena                       */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  const notes = controls.notes;
  if ( !notes ) return;
  notes.tools.sessionLog = {
    name: "sessionLog",
    // Ordem alta pra sentar no fim do grupo, sem empatar com as ferramentas nativas (select,
    // journal, toggle...) — o empate deixava a posição indeterminada.
    order: 100,
    title: "Fazer Log",
    icon: "fa-solid fa-clipboard-list",
    button: true,
    visible: game.user.isGM,
    onChange: (event, active) => {
      if ( !game.user.isGM ) return;
      SessionLogApp.open();
    }
  };
});
