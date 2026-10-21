import ApplicationV2Mixin from "../../api/application-v2-mixin.mjs";
import {
  carregarGrafo, adquiridas, concedidas, possuidas, aprender, esquecer,
  conceder, revogarConcessao, sincronizarEspecializacoes,
  avaliarNo, escolhasTotais, escolhasDisponiveis, ORDEM_CATEGORIAS, CORES_CATEGORIA
} from "../../../systems/especializacoes-2.mjs";
import { ICONES_CATEGORIA, origensRequisito, contagensRequisito, construirMapaCategoria } from "./skill-tree-map-2.mjs";

/** Mapa de caminhos: one category at a time, real artwork, persistent details. */
export default class SkillTreeApp extends ApplicationV2Mixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "jj2-skill-tree", tag: "form", classes: ["jj2-skill-tree", "standard-form"],
    position: { width: "100%", height: "100%" }, window: { frame: false, positioned: false },
    actions: {
      selecionar: SkillTreeApp.#onSelecionar, categoria: SkillTreeApp.#onCategoria,
      aprender: SkillTreeApp.#onAprender, esquecer: SkillTreeApp.#onEsquecer,
      conceder: SkillTreeApp.#onConceder, revogar: SkillTreeApp.#onRevogar,
      fechar: SkillTreeApp.#onFechar, adm: SkillTreeApp.#onToggleAdm,
      ampliar: SkillTreeApp.#onAmpliar, reduzir: SkillTreeApp.#onReduzir,
      ajustar: SkillTreeApp.#onAjustar, centralizar: SkillTreeApp.#onCentralizar,
      abrir: SkillTreeApp.#onAbrir, requisito: SkillTreeApp.#onRequisito
    }
  };

  static PARTS = { main: {
    template: "systems/jujutsu-system/templates/actors/apps/skill-tree-2.hbs",
    scrollable: [".jj2m-detail", ".jj2m-categories"]
  } };

  #actor;

  #grafo;

  #categoria = null;

  #selecionado = null;

  #admMode = false;

  #zoom = 1;

  #panX = 0;

  #panY = 0;

  #mapa = null;

  #centrar = true;

  #montado = false;

  #listeners = [];

  constructor(actor, options = {}) { super(options); this.#actor = actor; }

  get actor() { return this.#actor; }

  get title() { return `${this.#actor.name} — Árvore de Especialização`; }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#grafo = await carregarGrafo();
    const actor = this.#actor;
    await sincronizarEspecializacoes(actor, this.#grafo);
    const aprendidas = adquiridas(actor);
    const concedidasLista = concedidas(actor);
    const possuidasLista = [...concedidasLista, ...aprendidas];
    this.#categoria ??= this.#grafo.categorias[0]?.nome ?? ORDEM_CATEGORIAS[0];
    const categoria = this.#grafo.categorias.find(c => c.nome === this.#categoria)
      ?? { nome: this.#categoria, caminhos: [] };
    const ocultas = game.settings.get("jujutsu-system", "especializacoesOcultas") ?? {};
    const mapa = construirMapaCategoria(categoria, this.#grafo.porNome, { ocultas });
    const selecaoValida = mapa.nos.some(n => n.nome === this.#selecionado);
    if ( !selecaoValida ) {
      this.#selecionado = mapa.nos.find(n => avaliarNo(actor, n).estado === "disponivel")?.nome
        ?? mapa.nos[0]?.nome ?? null;
    }
    const selecionado = this.#grafo.porNome.get(this.#selecionado);
    const exigidos = new Set((selecionado?.requisitos ?? []).flatMap(r => origensRequisito(r, this.#grafo.porNome)));
    const labels = { adquirido: "Aprendida", disponivel: "Disponível", bloqueado: "Bloqueada" };
    const nos = mapa.nos.map(no => {
      const av = avaliarNo(actor, no);
      const concedida = concedidasLista.includes(no.nome);
      const contagem = (no.requisitos ?? []).flatMap(r => contagensRequisito(r, possuidasLista, this.#grafo.porNome))[0];
      return { ...no, ...av, estadoLabel: concedida ? "Concedida" : labels[av.estado], concedida,
        selecionado: no.nome === this.#selecionado,
        exigido: exigidos.has(no.nome), contagem,
        livre: !(no.requisitos?.length),
        dica: av.estado === "adquirido" ? (concedida ? "Concedida pelo Mestre (não gasta escolha)" : "Habilidade aprendida")
          : [...av.pendencias.map(p => p.texto), ...av.informativos].join("; ") || "Disponível" };
    });
    const porNome = new Map(nos.map(n => [n.nome, n]));
    context.mapa = { ...mapa, nos, linhas: mapa.linhas.map(l => ({ ...l,
      estado: porNome.get(l.para)?.estado,
      destaque: l.para === this.#selecionado || l.de === this.#selecionado })) };
    this.#mapa = context.mapa;
    context.actor = actor;
    context.ehGM = game.user.isGM;
    context.podeEditar = !!actor.isOwner;
    context.admMode = this.#admMode;
    context.categorias = ORDEM_CATEGORIAS.map(nome => {
      const cat = this.#grafo.categorias.find(c => c.nome === nome);
      const habilidades = [...new Set((cat?.caminhos ?? []).flatMap(c => c.nos.map(n => n.nome)))];
      return { nome, icone: ICONES_CATEGORIA[nome], cor: CORES_CATEGORIA[nome], ativa: nome === this.#categoria,
        total: habilidades.length, aprendidas: habilidades.filter(n => possuidasLista.includes(n)).length };
    });
    context.categoria = context.categorias.find(c => c.ativa);
    context.quantidadeCaminhos = categoria.caminhos.length;
    context.escolhas = { totais: escolhasTotais(actor), disponiveis: escolhasDisponiveis(actor), usadas: aprendidas.length,
      concedidas: concedidasLista.length };
    context.temEscolhas = context.escolhas.disponiveis > 0;
    context.selecionado = porNome.get(this.#selecionado) ?? null;
    context.requisitos = (selecionado?.requisitos ?? []).map(texto => {
      // Use the actual rules engine even for an already acquired skill.
      const av = avaliarNo(actor, { nome: "", requisitos: [texto] });
      const origens = origensRequisito(texto, this.#grafo.porNome);
      return { texto, ok: av.estado === "disponivel", informativo: !!av.informativos.length,
        contagens: contagensRequisito(texto, possuidasLista, this.#grafo.porNome),
        links: origens.map(nome => ({ nome, categoria: this.#grafo.porNome.get(nome)?.categoria })) };
    });
    const html = selecionado?.descricao ?? "";
    context.selecionadoHtml = html ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
      secrets: actor.isOwner, relativeTo: actor, rollData: actor.getRollData()
    }) : "";
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#montarInteracoes();
    if ( this.#centrar ) { this.#panX = 0; this.#panY = 0; this.#zoom = 1; this.#centrar = false; }
    this.#aplicarTransform();
  }

  #aplicarTransform() {
    const stage = this.element?.querySelector(".jj2m-stage");
    if ( stage ) stage.style.transform = `translate(${this.#panX}px, ${this.#panY}px) scale(${this.#zoom})`;
    const label = this.element?.querySelector(".jj2m-zoom-value");
    if ( label ) label.textContent = `${Math.round(this.#zoom * 100)}%`;
  }

  #zoomEm(zoom, x, y) {
    const novo = Math.min(1.75, Math.max(0.2, zoom));
    const fator = novo / this.#zoom;
    this.#panX = x - (x - this.#panX) * fator;
    this.#panY = y - (y - this.#panY) * fator;
    this.#zoom = novo;
    this.#aplicarTransform();
  }

  #montarInteracoes() {
    const app = this.element;
    if ( !app || this.#montado ) return;
    this.#montado = true;
    let drag = null;
    const wheel = event => {
      const viewport = event.target.closest(".jj2m-viewport");
      if ( !viewport ) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      this.#zoomEm(this.#zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX - rect.left, event.clientY - rect.top);
    };
    const down = event => {
      const viewport = event.target.closest(".jj2m-viewport");
      if ( !viewport || event.button !== 0 || event.target.closest("button, a, input, select") ) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: this.#panX, panY: this.#panY };
      app.setPointerCapture?.(event.pointerId);
      viewport.classList.add("arrastando");
      event.preventDefault();
    };
    const move = event => {
      if ( !drag || drag.id !== event.pointerId ) return;
      this.#panX = drag.panX + event.clientX - drag.x;
      this.#panY = drag.panY + event.clientY - drag.y;
      this.#aplicarTransform();
    };
    const up = event => {
      if ( !drag || drag.id !== event.pointerId ) return;
      if ( app.hasPointerCapture?.(event.pointerId) ) app.releasePointerCapture(event.pointerId);
      drag = null;
      app.querySelector(".jj2m-viewport")?.classList.remove("arrastando");
    };
    const contextmenu = event => {
      const node = event.target.closest(".jj2m-node.adquirido");
      if ( !node || !this.#actor.isOwner ) return;
      event.preventDefault();
      this.#confirmarEsquecer(node.dataset.nome);
    };
    const dblclick = event => {
      if ( event.target.closest(".jj2m-viewport") && !event.target.closest("button") ) SkillTreeApp.#onCentralizar.call(this);
    };
    for ( const [name, fn] of [["wheel", wheel], ["pointerdown", down], ["pointermove", move],
      ["pointerup", up], ["pointercancel", up], ["contextmenu", contextmenu], ["dblclick", dblclick]] ) {
      app.addEventListener(name, fn, name === "wheel" ? { passive: false } : undefined);
      this.#listeners.push([app, name, fn]);
    }
  }

  static async #onCategoria(event, target) {
    const nome = target.closest("[data-categoria]")?.dataset.categoria;
    if ( !ORDEM_CATEGORIAS.includes(nome) || nome === this.#categoria ) return;
    this.#categoria = nome;
    this.#selecionado = null;
    this.#centrar = true;
    await this.render({ force: true });
  }

  static async #onRequisito(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    const no = this.#grafo?.porNome.get(nome);
    if ( !no ) return;
    this.#categoria = no.categoria;
    this.#selecionado = nome;
    this.#centrar = true;
    await this.render({ force: true });
    this.#focarSelecionado();
  }

  #focarSelecionado() {
    const no = this.#mapa?.nos.find(n => n.nome === this.#selecionado);
    const viewport = this.element?.querySelector(".jj2m-viewport");
    if ( !no || !viewport ) return;
    this.#panX = (viewport.clientWidth - this.#mapa.noLargura) / 2 - no.x;
    this.#panY = (viewport.clientHeight - this.#mapa.noAltura) / 2 - no.y;
    this.#zoom = 1;
    this.#aplicarTransform();
  }

  static #onAmpliar() { const v = this.element?.querySelector(".jj2m-viewport"); if ( v ) this.#zoomEm(this.#zoom * 1.2, v.clientWidth / 2, v.clientHeight / 2); }

  static #onReduzir() { const v = this.element?.querySelector(".jj2m-viewport"); if ( v ) this.#zoomEm(this.#zoom / 1.2, v.clientWidth / 2, v.clientHeight / 2); }

  static #onCentralizar() { this.#zoom = 1; this.#panX = 0; this.#panY = 0; this.#aplicarTransform(); }

  static #onAjustar() {
    const v = this.element?.querySelector(".jj2m-viewport");
    if ( !v || !this.#mapa ) return;
    this.#zoom = Math.min(1, Math.max(0.2, Math.min(v.clientWidth / this.#mapa.largura, v.clientHeight / this.#mapa.altura)));
    this.#panX = (v.clientWidth - this.#mapa.largura * this.#zoom) / 2;
    this.#panY = (v.clientHeight - this.#mapa.altura * this.#zoom) / 2;
    this.#aplicarTransform();
  }

  static async #onAbrir() {
    const no = this.#grafo?.porNome.get(this.#selecionado);
    const doc = no?.uuid ? await fromUuid(no.uuid) : null;
    if ( doc?.sheet ) doc.sheet.render({ force: true });
  }

  /* ── Existing learning, refund, and GM requirement management ── */
  /** [temporário] Liga/desliga o modo ADM (GM). */
  static async #onToggleAdm() {
    if ( !game.user.isGM ) return;
    this.#admMode = !this.#admMode;
    ui.notifications.info(this.#admMode
      ? "Modo ADM ON — clique numa habilidade para gerenciar seus requisitos."
      : "Modo ADM OFF");
    await this.render({ force: true });
  }

  /**
   * [temporário] Gerenciador de requisitos de um nó (GM): lista os requisitos
   * efetivos (removíveis) e um seletor para adicionar. Cada linha pode ser
   * marcada como "OU" — linhas marcadas viram UMA cadeia alternativa
   * ("A ou B"), que o motor avalia como "basta um".
   * Persiste na camada world (settings "especializacoesReq").
   * @param nome
   */
  async #abrirGerenciadorReq(nome) {
    const grafo = await carregarGrafo();
    const no = grafo.porNome?.get(nome);
    if ( !no ) return;
    const overrides = foundry.utils.deepClone(game.settings.get("jujutsu-system", "especializacoesReq") ?? {});
    const brutas = Array.isArray(overrides[nome]) ? [...overrides[nome]] : [...no.requisitos];

    // Linhas editáveis: cadeias "A ou B" entram como UMA linha marcada OU
    const rows = brutas.map(texto => ({ texto, ou: texto.includes(" ou ") && grafo.porNome.has(texto.split(" ou ")[0]) }));

    const listaHTML = () => rows.length
      ? rows.map((r, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;" data-i="${i}">
          <label style="display:flex;align-items:center;gap:3px;font-size:10px;color:#a67bda;" title="Basta um dos marcados com OU">
            <input type="checkbox" data-ou="${i}" ${r.ou ? "checked" : ""}> OU
          </label>
          <span style="flex:1;font-size:13px;">${foundry.utils.escapeHTML(r.texto)}</span>
          <button type="button" data-remover="${i}" style="padding:2px 8px;">remover</button>
        </div>`).join("")
      : "<p style=\"color:#999; font-size:12px;\">Nenhum requisito.</p>";

    const opcoes = [...grafo.porNome.keys()].filter(n => n !== nome)
      .map(n => `<option value="${foundry.utils.escapeHTML(n)}">${foundry.utils.escapeHTML(n)}</option>`).join("");

    const conexoes = [];
    await new Promise(resolve => {
      const dlg = new foundry.applications.api.DialogV2({
        classes: ["jj2t-dialog"],
        window: { title: `Requisitos — ${nome}` },
        content: `
          <fieldset style="border:1px solid #555; padding:8px;">
            <legend>Requisitos efetivos</legend>
            <div id="jj2t-req-lista">${listaHTML()}</div>
            <p style="font-size:11px; color:#999; margin:6px 0 0;">Marque <strong>OU</strong> nas linhas alternativas: basta UMA delas. Sem marca = obrigatório.</p>
          </fieldset>
          <fieldset style="border:1px solid #555; padding:8px; margin-top:10px;">
            <legend>Conexões (linhas)</legend>
            <div id="jj2t-conex-lista"></div>
            <p style="font-size:11px; color:#999; margin:6px 0 0;">Esconder: a linha deixa de ser desenhada (útil para requisitos de outros caminhos que poluem a árvore).</p>
          </fieldset>
          <fieldset style="border:1px solid #555; padding:8px; margin-top:10px;">
            <legend>Adicionar requisito</legend>
            <div style="display:flex; gap:6px;">
              <select id="jj2t-req-novo" style="flex:1;">${opcoes}</select>
              <button type="button" id="jj2t-req-add" style="padding:4px 10px;">Adicionar</button>
            </div>
            <p style="font-size:11px; color:#999; margin:6px 0 0;">Requisitos de nível/atributo/estilo são configurados no compendium — aqui gerencie apenas os nós da árvore.</p>
          </fieldset>`,
        buttons: [{ label: "Salvar", action: "salvar", default: true }, { label: "Cancelar", action: "cancelar" }],
        /**
         * Grava ao clicar SALVAR: requisitos (OU agrupados em cadeia) e as
         * conexões escondidas do nó.
         */
        submit: async () => {
          const ouRows = rows.filter(r => r.ou).map(r => r.texto);
          const fixas = rows.filter(r => !r.ou).map(r => r.texto);
          const finais = [...fixas, ...(ouRows.length > 1 ? [ouRows.join(" ou ")] : ouRows)];
          const atuais = game.settings.get("jujutsu-system", "especializacoesReq") ?? {};
          const originais = no.requisitos ?? [];
          const mudou = (finais.length !== originais.length) || finais.some((r2, i) => r2 !== originais[i]);
          if ( mudou ) {
            atuais[nome] = finais;
            await game.settings.set("jujutsu-system", "especializacoesReq", atuais);
          }
          const ocultasAtuais = game.settings.get("jujutsu-system", "especializacoesOcultas") ?? {};
          let ocultou = false;
          for ( const c2 of conexoes ) {
            const parReal = c2.parReal ?? c2.par;
            if ( c2.oculto && !ocultasAtuais[parReal] ) { ocultasAtuais[parReal] = true; ocultou = true; }
            if ( !c2.oculto && ocultasAtuais[parReal] ) { delete ocultasAtuais[parReal]; ocultou = true; }
          }
          if ( ocultou ) await game.settings.set("jujutsu-system", "especializacoesOcultas", ocultasAtuais);
          if ( mudou ) {
            ui.notifications.info(`Requisitos de "${nome}" atualizados.`);
            await carregarGrafo();
          }
          if ( mudou || ocultou ) await this.render({ force: true });
        },
        render: (event, dialog) => {
          const el = dialog.element;

          // ── Conexões do nó (esconder/mostrar linhas) ──
          const ocultas = foundry.utils.deepClone(game.settings.get("jujutsu-system", "especializacoesOcultas") ?? {});
          conexoes.length = 0;
          for ( const origem of new Set((no.requisitos ?? []).flatMap(r => origensRequisito(r, grafo.porNome))) ) {
            const par = `${origem}|${nome}`;
            conexoes.push({ par, origem, oculto: !!ocultas[par] });
          }
          if ( !conexoes.length ) {
            const par = `${no.categoria}|${nome}`;
            conexoes.push({ par, origem: `${no.categoria} (hub)`, parReal: par, oculto: !!ocultas[par] });
          }
          const conexContainer = el.querySelector("#jj2t-conex-lista");
          const renderConex = () => {
            if ( !conexContainer ) return;
            conexContainer.innerHTML = conexoes.length
              ? conexoes.map((c2, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                  <label style="display:flex;align-items:center;gap:4px;font-size:11px;flex:1;">
                    <input type="checkbox" data-conex="${i}" ${c2.oculto ? "checked" : ""}> Esconder
                  </label>
                  <span style="flex:2;font-size:12px;">${foundry.utils.escapeHTML(c2.origem)} → ${foundry.utils.escapeHTML(nome)}</span>
                </div>`).join("")
              : "<p style=\"font-size:11px;color:#999;\">Sem conexões.</p>";
            conexContainer.querySelectorAll("[data-conex]").forEach(cb => {
              cb.addEventListener("change", () => {
                const c3 = conexoes[Number(cb.dataset.conex)];
                const parReal = c3.parReal ?? c3.par;
                c3.oculto = cb.checked;
                if ( cb.checked ) ocultas[parReal] = true; else delete ocultas[parReal];
              });
            });
          };
          renderConex();

          const bindRemover = base => {
            base.querySelectorAll("[data-remover]").forEach(btn => {
              btn.addEventListener("click", () => {
                rows.splice(Number(btn.dataset.remover), 1);
                base.querySelector("#jj2t-req-lista").innerHTML = listaHTML();
                bindRemover(base);
              });
            });
          };
          bindRemover(el);
          el.addEventListener("change", ev => {
            const cb = ev.target.closest("[data-ou]");
            if ( cb ) rows[Number(cb.dataset.ou)].ou = cb.checked;
          });
          el.querySelector("#jj2t-req-add")?.addEventListener("click", () => {
            const valor = el.querySelector("#jj2t-req-novo")?.value;
            if ( !valor || rows.some(r2 => r2.texto === valor) ) return;
            rows.push({ texto: valor, ou: false });
            el.querySelector("#jj2t-req-lista").innerHTML = listaHTML();
            bindRemover(el);
          });
        },
        close: () => { resolve(); }
      });
      dlg.render({ force: true });
    });
  }

  /**
   * Select the skill in the fixed detail panel, or edit its requirements in GM mode.
   * @param event
   * @param target
   */
  static async #onSelecionar(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    if ( !nome ) return;
    if ( this.#admMode && game.user.isGM ) return this.#abrirGerenciadorReq(nome);
    this.#selecionado = nome;
    await this.render({ force: true });
  }

  static async #onAprender(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    if ( !nome || !this.#actor.isOwner ) return;
    const no = this.#grafo?.porNome?.get(nome);
    if ( !no ) return;
    const av = avaliarNo(this.#actor, no);
    const ehGM = game.user.isGM;

    // Bloqueado: só o Mestre pode conceder (requisitos informativos ficam a
    // critério dele — "Forçar (Mestre)" no card)
    if ( av.estado === "bloqueado" && !ehGM ) {
      const falta = av.pendencias.map(p => p.texto).join("; ")
        || av.informativos.join("; ") || "requisitos não cumpridos";
      ui.notifications.warn(`${nome} está bloqueado. Falta: ${falta}`);
      return;
    }
    // Sem escolhas: só o Mestre pode forçar (o botão dele anuncia a concessão
    // fora do orçamento — conceder — ou o gasto forçado de uma bloqueada).
    if ( escolhasDisponiveis(this.#actor) <= 0 && !ehGM ) {
      ui.notifications.warn("Você não tem escolhas de especialização disponíveis!");
      return;
    }
    const pendentes = av.estado === "bloqueado"
      ? `<p class="jj2t-md-sub">Concessão do Mestre — pendências: ${[
        ...av.pendencias.map(p => p.texto), ...av.informativos
      ].map(t => foundry.utils.escapeHTML(t)).join("; ")}</p>`
      : "";
    const ok = await this.#confirmarManga("Aprender Especialização",
      `<p class="jj2t-md-titulo">Aprender <strong>${foundry.utils.escapeHTML(nome)}</strong>?</p>${pendentes
      }<p class="jj2t-md-sub">${no.requisitos?.length ? `Requisitos: ${no.requisitos.map(t => foundry.utils.escapeHTML(t)).join(", ")}` : "Sem requisitos."}</p>`);
    if ( !ok ) return;
    await aprender(this.#actor, nome);
    ui.notifications.info(`Especialização aprendida: ${nome}`);
    this.#selecionado = nome;
    await this.render({ force: true });
  }

  static async #onEsquecer(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    if ( !nome ) return;
    await this.#confirmarEsquecer(nome);
  }

  /** Concessão do Mestre: desbloqueia a habilidade sem gastar escolha. */
  static async #onConceder(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    if ( !nome || !game.user.isGM ) return;
    const no = this.#grafo?.porNome?.get(nome);
    if ( !no ) return;
    const ok = await this.#confirmarManga("Conceder Especialização",
      `<p class="jj2t-md-titulo">Conceder <strong>${foundry.utils.escapeHTML(nome)}</strong> para ${foundry.utils.escapeHTML(this.#actor.name)}?</p>`
      + '<p class="jj2t-md-sub">A habilidade é desbloqueada no lugar do jogador e NÃO consome ponto de especialização.</p>');
    if ( !ok ) return;
    await conceder(this.#actor, nome);
    ui.notifications.info(`Especialização concedida: ${nome}`);
    this.#selecionado = nome;
    await this.render({ force: true });
  }

  /** Retira uma concessão do Mestre (o ponto regular não é reembolsado). */
  static async #onRevogar(event, target) {
    const nome = target.closest("[data-nome]")?.dataset.nome;
    if ( !nome || !game.user.isGM ) return;
    const ok = await this.#confirmarManga("Revogar Concessão",
      `<p class="jj2t-md-titulo">Revogar a concessão de <strong>${foundry.utils.escapeHTML(nome)}</strong>?</p>`
      + '<p class="jj2t-md-sub">A habilidade sai da ficha. Escolhas regulares não são afetadas.</p>');
    if ( !ok ) return;
    await revogarConcessao(this.#actor, nome);
    ui.notifications.info(`Concessão revogada: ${nome}`);
    if ( this.#selecionado === nome ) this.#selecionado = null;
    await this.render({ force: true });
  }

  /**
   * Modal de confirmação para desfazer a escolha.
   * @param nome
   */
  async #confirmarEsquecer(nome) {
    if ( !this.#actor.isOwner ) return;
    const ok = await this.#confirmarManga("Desfazer Escolha",
      `<p class="jj2t-md-titulo">Desfazer a escolha de <strong>${foundry.utils.escapeHTML(nome)}</strong>?</p>`
      + "<p class=\"jj2t-md-sub\">A especialização volta para o seu orçamento de escolhas.</p>");
    if ( !ok ) return;
    await esquecer(this.#actor, nome);
    ui.notifications.info(`Escolha desfeita: ${nome}`);
    if ( this.#selecionado === nome ) this.#selecionado = null;
    await this.render({ force: true });
  }

  static #onFechar() {
    this.close();
  }

  /**
   * Modal de confirmação no estilo mangá (Sim/Não).
   * @param titulo
   * @param html
   */
  async #confirmarManga(titulo, html) {
    return await foundry.applications.api.DialogV2.wait({
      classes: ["jj2t-dialog"],
      window: { title: titulo },
      content: html,
      buttons: [
        { action: "sim", label: "Sim", icon: "fa-solid fa-check", default: true },
        { action: "nao", label: "Não", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false,
      close: () => null
    }) === "sim";
  }

  /* ── Lifecycle ─────────────────────────────────────────────────────────── */

  async close(options = {}) {
    for ( const [alvo, ev, fn] of this.#listeners ) alvo.removeEventListener(ev, fn);
    this.#listeners = [];
    this.#montado = false;
    return super.close(options);
  }

  _onClose(options) {
    for ( const [alvo, ev, fn] of this.#listeners ) alvo.removeEventListener(ev, fn);
    this.#listeners = [];
    this.#montado = false;
    super._onClose(options);
  }
}
