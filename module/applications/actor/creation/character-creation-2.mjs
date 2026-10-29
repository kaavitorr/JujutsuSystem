import Ruleset from "../../../systems/ruleset.mjs";
import { CREATION_STEPS, ABILITY_KEYS, creationDraft, creationBudgets, styleRules, rankSpent,
  chooseCreationStyle, chooseCreationPath, creationPathOptions, creationSpecializationSlots, creationPrimaryOptions, creationSpecializationScope, allocateCreationRank, toggleCreationSpecialization, evaluateCreationSpecialization, creationSpeciesGroups, validateCreation, speciesAtributosAdicionais,
  PENALIDADE_VITAL_NOME, penalidadeVitalUuid, creationRankAllowed, creationWeaponBonus, creationCombinationError } from "./creation-model-2.mjs";
import { loadCreationCatalog, resolveCreationDocument } from "./creation-catalog-2.mjs";
import { commitCreation } from "./creation-completion-2.mjs";
import { CUSTOMIZATION_SECTIONS } from "../jj/legacy2-customization.mjs";
const limiteDaSecao = (category) => CUSTOMIZATION_SECTIONS.find(s => s.id === category)?.max ?? Infinity;
import { SKILL_GROUPS } from "../jj/legacy2-sheet.mjs";
import { WEAPON_GROUPS, CONVERSAO_DEFEITO, pontosDoItem } from "../../../systems/legacy2-proficiencies.mjs";
import { ALTERNATIVE_SAVES, alternativeSavesEnabled } from "../../../systems/legacy2-alternative-saves.mjs";
import { buildCreationTree } from "./creation-tree-2.mjs";
import { SkillTreeViewport } from "../jj/skill-tree-viewport-2.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const openApps = new Map(), drafts = new WeakMap();
const labels = { str: "Força", dex: "Agilidade", con: "Constituição", int: "Intelecto", wis: "Sabedoria", cha: "Presença" };
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Three-stage creation; every edit belongs to a draft until the native completion batch. */
export default class JujutsuCharacterCreation extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "jj2-character-creation", tag: "div", classes: ["dnd5e2", "jj2-character-creation", "theme-dark"],
    window: { frame: false, positioned: false },
    actions: {
      step: this.onStep, next: this.onNext, back: this.onBack, cancel: this.onCancel,
      species: this.onSpecies, style: this.onStyle, path: this.onPath, ability: this.onAbility, rank: this.onRank,
      specialization: this.onSpecialization, category: this.onCategory, focus: this.onFocus,
      selecionar: this.onFocus, categoria: this.onCategory, requisito: this.onRequirement,
      aprender: this.onSpecialization, esquecer: this.onSpecialization,
      ampliar: this.onZoomIn, reduzir: this.onZoomOut, ajustar: this.onMapFit, centralizar: this.onMapReset,
      customization: this.onCustomization, browseCustomization: this.onBrowseCustomization,
      penalidadeVital: this.onPenalidadeVital,
      profile: this.onProfile, token: this.onToken, copyPortrait: this.onCopyPortrait, finish: this.onFinish
    }
  };

  static PARTS = { main: { template: "systems/jujutsu-system/templates/actors/creation/creation-2.hbs",
    templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs", "systems/jujutsu-system/templates/actors/apps/skill-tree-2.hbs"],
    scrollable: [".jj2c-content", ".jj2c-list", ".jj2c-detail", ".jj2m-detail", ".jj2m-categories", ".jj2c-prof-list"] } };

  constructor(actor, options = {}) {
    super({ ...options, id: `jj2-character-creation-${actor.id}` });
    this.actor = actor;
    this.draft = structuredClone(drafts.get(actor) ?? creationDraft(actor));
    this.catalog = null; this.category = null; this.focus = null; this.search = ""; this.errors = []; this.busy = false;
    this.mapView = new SkillTreeViewport();
    for (const href of ["systems/jujutsu-system/less/jujutsu-skill-tree-2.css", "systems/jujutsu-system/less/character-creation-2.css"]) {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; document.head.append(link);
      }
    }
  }

  get style() { return this.catalog?.styles.find(doc => doc.uuid === this.draft.style); }

  captureInputs() {
    for (const field of this.element?.querySelectorAll("[data-creation-field]") ?? []) {
      const key = field.dataset.creationField;
      if (key.startsWith("abilities.")) this.draft.abilities[key.split(".")[1]] = Number(field.value);
      else if (key.startsWith("physical.")) this.draft.physical[key.split(".")[1]] = field.value;
      else this.draft[key] = field.value;
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.catalog ??= await loadCreationCatalog();
    const draft = this.draft, catalog = this.catalog, style = this.style;
    const species = catalog.species.find(doc => doc.uuid === draft.species);
    const budget = creationBudgets(style, draft.caminho, species);
    const slots = creationSpecializationSlots(style, draft.caminho, species);
    const text = normalize(this.search), matches = doc => !text || normalize(doc.name ?? doc.nome).includes(text);
    const categories = catalog.graph.categorias ?? [];
    this.category ??= categories[0]?.nome;
    const tree = buildCreationTree(draft, style, catalog, { category: this.category, focus: this.focus,
      search: this.search, busy: this.busy, ocultas: game.settings.get("jujutsu-system", "especializacoesOcultas") ?? {} });
    this.category = tree.categoria.nome;
    const selected = tree.selecionado;
    const renderDescription = async doc => doc ? foundry.applications.ux.TextEditor.implementation.enrichHTML(
      doc.descricao ?? doc.system?.description?.value ?? "", { secrets: this.actor.isOwner, relativeTo: this.actor,
        rollData: this.actor.getRollData?.() ?? {} }) : "";
    const [speciesHTML, detailHTML] = await Promise.all([renderDescription(species), renderDescription(selected ?? style)]);
    tree.selecionadoHtml = selected ? detailHTML : "";
    tree.styleDetail = style;tree.styleHTML = selected ? "" : detailHTML;
    this.tree = tree;
    const rankRows = (category, rows) => ({ category, label: { saves: "Salvaguardas", armas: "Tipos de Arma", skills: "Perícias" }[category],
      hint: category === "armas" && creationWeaponBonus(style, draft.caminho) ? "Maestria: os 2 pontos extras devem ficar no mesmo tipo de arma." : null,
      budget: budget[category], spent: rankSpent(draft.proficiencies[category]),
      remaining: budget[category] - rankSpent(draft.proficiencies[category]),
      rows: rows.map(([key, label, icon]) => { const rank = draft.proficiencies[category][key]; return { key, label, icon, rank,
        rankLabel: Ruleset.rankLabel(rank), dots: [0,1,2,3,4].map(value => ({ value, selected: value === rank,
          filled: value > 0 && value <= rank, disabled: this.busy || (value > 0 && !creationRankAllowed(style, category, key))
            || (value > rank && value - rank > budget[category] - rankSpent(draft.proficiencies[category])) })) }; }) });
    const orcamentoAtributos = 20 + speciesAtributosAdicionais(species);
    const errors = validateCreation(draft, catalog, draft.step);
    Object.assign(context, { rootId: this.id, draft, busy: this.busy, errors: this.errors, search: this.search,
      stepOrigin: draft.step === 0, stepStyle: draft.step === 1, stepPersonalization: draft.step === 2,
      steps: CREATION_STEPS.map((step, index) => ({ ...step, index, number: index + 1, active: draft.step === index, completed: draft.step > index })),
      canAdvance: !this.busy && !errors.length, canBack: !this.busy && draft.step > 0,
      speciesGroups: creationSpeciesGroups(catalog.species, matches)
        .map(grupo => ({ ...grupo, cards: grupo.cards.map(card => ({ ...card, selected: card.uuid === draft.species })) })),
      species, speciesHTML,
      abilities: ABILITY_KEYS.map(key => ({ key, label: labels[key], icon: key, abbreviation: {str:"FOR",dex:"AGI",con:"CON",int:"INT",wis:"SAB",cha:"PRE"}[key],
        value: draft.abilities[key], decreaseDisabled: this.busy || draft.abilities[key] <= 1,
        increaseDisabled: this.busy || draft.abilities[key] >= 6 || rankSpent(draft.abilities) >= orcamentoAtributos })),
      attributesSpent: rankSpent(draft.abilities), attributesRemaining: orcamentoAtributos - rankSpent(draft.abilities),
      orcamentoAtributos,
      styleCards: catalog.styles.map(doc => ({ uuid: doc.uuid, name: doc.name, img: doc.img, selected: doc.uuid === draft.style,
        unavailable: !!creationCombinationError(doc, species), unavailableReason: creationCombinationError(doc, species),
        ...styleRules(doc), points: creationBudgets(doc) })), style, budget,
      combinationError: creationCombinationError(style, species),
      specializationScope: creationSpecializationScope(style),
      pathOptions: creationPathOptions(style).map(caminho => ({ ...caminho, selected: caminho.id === draft.caminho })),
      slotHints: slots.grupos.map(grupo => `${grupo.quantidade} de ${grupo.rotulo}`),
      primaryOptions: creationPrimaryOptions(style)
        .map(key => ({ key, label: labels[key] ?? key, selected: key === draft.primary })),
      tree, specializationsSpent: draft.specializations.length, specializationsRemaining: budget.specializations - draft.specializations.length,
      selectedDetail: selected ?? style, detailHTML,
      proficiencyPanels: [rankRows("saves", alternativeSavesEnabled()
        ? ALTERNATIVE_SAVES.map(save => [save.key, save.label, save.icon]) : ABILITY_KEYS.map(key => [key, labels[key],key])),
        rankRows("armas", WEAPON_GROUPS.map(group => [group.key, group.label, "weapons"])),
        rankRows("skills", SKILL_GROUPS.flatMap(group => group.skills.map(([key,label,ability]) => [key,label,ability])))],
      physicalFields: [["height","Altura"],["hair","Cabelo"],["weight","Peso"],["gender","Gênero"],["skin","Pele"],["age","Idade"]].map(([key,label])=>({key,label,value:draft.physical[key]})),
      customizationSections: CUSTOMIZATION_SECTIONS.map(section => {
        const options = catalog.customization[section.id].map(doc => ({ uuid: doc.uuid,
          name: String(doc.name ?? "").replace(/\s*\(\d+\s*pontos?\)/i, "").trim(), img: doc.img,
          desc: String(doc.system?.description?.value ?? "").trim(),
          picked: draft.customization[section.id].includes(doc.uuid) }));
        // Defeitos vêm em 1/3/5 pontos: agrupa quando TODOS pontuam (flag do
        // importador ou sufixo "(N pontos)" no nome).
        const porNome = new Map(catalog.customization[section.id].map(doc => [doc.uuid, doc]));
        const grupos = new Map();
        const todosComPontos = options.length > 0 && options.every(item =>
          pontosDoItem(porNome.get(item.uuid)) > 0);
        const groups = todosComPontos
          ? [...options.reduce((mapa, item) => {
              const n = pontosDoItem(porNome.get(item.uuid));
              mapa.set(n, [...(mapa.get(n) ?? []), item]);
              return mapa;
            }, new Map()).entries()].sort((a, b) => a[0] - b[0])
            .map(([pontos, lista]) => ({ rotulo: `${pontos} ${pontos > 1 ? "Pontos" : "Ponto"}`,
              options: lista.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }))
          : [];
        // Defeitos convertidos em Proficiência: cada 2 Pontos de Defeito
        // = 1 Ponto de Proficiência na ficha (sobe arma/salvaguarda/perícia).
        const pontosSelecionados = section.id === "jj-flaws"
          ? draft.customization["jj-flaws"].reduce((total, uuid) =>
              total + pontosDoItem(porNome.get(uuid)), 0)
          : 0;
        // Penalidade de Vida/Energia: botões de escolha quando ela está marcada.
        const escolhaVital = section.id === "jj-variant-penalties" ? {
          ativa: draft.customization["jj-variant-penalties"].includes(penalidadeVitalUuid(catalog)),
          vida: draft.penalidadeVital === "vida", energia: draft.penalidadeVital === "energia" } : null;
        return { ...section,
          label: section.id === "jj-variant-penalties" ? "Desvantagens" : section.label,
          count: draft.customization[section.id].length, options, groups,
          ...(section.id === "jj-flaws" ? { notaDefeitos: pontosSelecionados > 0
            ? `Cada 2 Pontos de Defeito = 1 Ponto de Proficiência na ficha. Selecionados: ${pontosSelecionados} ponto(s) → +${Math.floor(pontosSelecionados / CONVERSAO_DEFEITO)} de Proficiência.`
            : "Cada 2 Pontos de Defeito = 1 Ponto de Proficiência na ficha (sobe arma, salvaguarda e perícia)." } : {}),
          ...(escolhaVital ? { escolhaVital } : {}) };
      })
    });
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!this._mounted) { this.element.style.zIndex = String(++ApplicationV2._maxZ); this._mounted = true; }
    this.element.querySelectorAll("[data-creation-field]").forEach(field => field.addEventListener("change", () => {
      if (this.busy) return; this.captureInputs();
      if (field.dataset.creationField.startsWith("abilities.") || ["primary", "name"].includes(field.dataset.creationField)) this.render();
    }));
    const search = this.element.querySelector("[data-creation-search]");
    search?.addEventListener("input", () => { this.search = search.value; clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(async () => {
        this.captureInputs();await this.render();
        const match = this.tree?.mapa.nos.find(node => node.searchMatch);
        if (this.draft.step === 1 && match) this.mapView.focus(match.nome);
      }, 180); });
    if (this.draft.step === 1) {
      this.mapView.mount(this.element, context.tree.mapa, this.category);
      if (this._focusMap) { this.mapView.focus(this._focusMap);this._focusMap = null; }
    } else this.mapView.destroy();
    this.element.querySelectorAll("[data-creation-drop]").forEach(zone => {
      zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-hover"));
      zone.addEventListener("drop", event => this.onDrop(event, zone));
    });
  }

  changeStep(index) {
    if (this.busy || !Number.isInteger(index) || index < 0 || index > 2) return;
    this.captureInputs();
    this.errors = index > this.draft.step ? validateCreation(this.draft, this.catalog, index - 1) : [];
    if (this.errors.length) { this.render(); return; }
    this.draft.step = index; this.search = ""; this.render();
  }
  static onStep(event,target) { this.changeStep(Number(target.dataset.step)); }
  static onNext() { this.changeStep(this.draft.step + 1); }
  static onBack() { this.changeStep(this.draft.step - 1); }
  static onCancel() { this.captureInputs(); return this.close(); }
  static onSpecies(event,target) { if(this.busy)return;this.captureInputs();this.draft.species=target.dataset.uuid;this.errors=[];this.render(); }
  static onStyle(event,target) {
    if(this.busy)return;this.captureInputs();const style=this.catalog.styles.find(doc=>doc.uuid===target.dataset.uuid);if(!style)return;
    const error=creationCombinationError(style,this.catalog.species?.find(doc=>doc.uuid===this.draft.species));
    if(error){this.errors=[{step:1,message:error}];this.render();return;}
    chooseCreationStyle(this.draft,style);this.errors=[];this.focus=null;
    const available=Array.from(this.catalog.graph.porNome.values()).find(node=>node.caminho&&evaluateCreationSpecialization(this.draft,style,node,this.draft.specializations,
      this.catalog.species?.find(doc=>doc.uuid===this.draft.species)).estado==="disponivel");
    if(available)this.category=available.categoria;this.render();
  }
  static onPath(event,target) {
    if(this.busy)return;this.captureInputs();chooseCreationPath(this.draft,target.dataset.caminho||null);this.errors=[];this.render();
  }
  static onAbility(event,target) { if(this.busy)return;this.captureInputs();const key=target.dataset.key;if(!ABILITY_KEYS.includes(key))return;
    const delta=Number(target.dataset.delta),value=this.draft.abilities[key]+delta;
    const teto=20+speciesAtributosAdicionais(this.catalog?.species?.find(doc=>doc.uuid===this.draft.species));
    if(![-1,1].includes(delta)||value<1||value>6||rankSpent(this.draft.abilities)+delta>teto)return;
    this.draft.abilities[key]=value;this.errors=[];this.render(); }
  static onRank(event,target) { if(this.busy)return;this.captureInputs();if(allocateCreationRank(this.draft,this.style,target.dataset.category,target.dataset.key,Number(target.dataset.rank))){this.errors=[];this.render();} }
  static onSpecialization(event,target) { if(this.busy)return;this.captureInputs();const node=this.catalog.graph.porNome.get(target.dataset.name ?? target.dataset.nome);
    if(toggleCreationSpecialization(this.draft,this.style,node,this.catalog)){this.errors=[];this.focus=node.nome;this.render();} }
  static onCategory(event,target) { if(this.busy)return;this.captureInputs();this.category=target.dataset.category ?? target.dataset.categoria;this.search="";this.focus=null;this.render(); }
  static onFocus(event,target) { if(this.busy)return;this.captureInputs();this.focus=target.dataset.name ?? target.dataset.nome ?? null;this.render(); }
  static onRequirement(event,target) {
    if(this.busy)return;
    const node=this.catalog.graph.porNome.get(target.dataset.nome);if(!node)return;
    this.captureInputs();this.category=node.categoria;this.focus=node.nome;this.search="";this._focusMap=node.nome;this.render();
  }
  static onZoomIn() { this.mapView.zoomAt(this.mapView.zoom * 1.2); }
  static onZoomOut() { this.mapView.zoomAt(this.mapView.zoom / 1.2); }
  static onMapFit() { this.mapView.fit(); }
  static onMapReset() { this.mapView.reset(); }
  static async onCustomization(event,target) { if(this.busy)return;this.captureInputs();const items=this.draft.customization[target.dataset.category];if(!items)return;
    const index=items.indexOf(target.dataset.uuid);
    if(index>=0){items.splice(index,1);
      delete this.draft.customizacaoNomes?.[target.dataset.uuid];
      // Ao retirar a penalidade de Vida/Energia, limpa a escolha do lado.
      if(target.dataset.category==="jj-variant-penalties"&&target.dataset.uuid===penalidadeVitalUuid(this.catalog))this.draft.penalidadeVital=null;
    } else {
      const doc=this.catalog.customization[target.dataset.category]?.find(item=>item.uuid===target.dataset.uuid);
      if(doc)await this.addCustomization(doc,target.dataset.category);
    }
    this.errors=[];this.render(); }

  /** Escolha do lado da penalidade variante Vida −2 / Energia Base −4. */
  static onPenalidadeVital(event, target) {
    if ( this.busy || !["vida", "energia"].includes(target.dataset.valor) ) return;
    this.draft.penalidadeVital = target.dataset.valor;
    this.errors = [];
    this.render();
  }

  async addCustomization(doc, category) {
    if(this.busy||doc?.type!=="feat"||!this.draft.customization[category])return;
    if(!this.catalog.customization[category].some(item=>item.uuid===doc.uuid))this.catalog.customization[category].push(doc);
    const items=this.draft.customization[category];
    if(!items.includes(doc.uuid)&&items.length<limiteDaSecao(category)){
      for(const [key,choices] of Object.entries(this.draft.customization)){
        const restantes=choices.filter(uuid=>uuid!==doc.uuid);
        if(restantes.length===choices.length)continue;
        delete this.draft.customizacaoNomes?.[doc.uuid];
        this.draft.customization[key]=restantes;
      }
      items.push(doc.uuid);
      // Nomes para automações do draft (ex.: bypass do Receptáculo Destinado).
      this.draft.customizacaoNomes[doc.uuid]=doc.name;
    }
    this.render();
  }
  static async onBrowseCustomization(event,target) {
    if(this.busy)return;this.captureInputs();
    const uuid=await game.dnd5e.applications.CompendiumBrowser.selectOne({filters:{locked:{types:new Set(["feat"])}}});
    if(uuid)await this.addCustomization(await resolveCreationDocument(uuid),target.dataset.category);
  }
  async onDrop(event,zone) { event.preventDefault();zone.classList.remove("drag-hover");if(this.busy)return;
    this.captureInputs();const data=foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if(data.type!=="Item"||!data.uuid)return;await this.addCustomization(await resolveCreationDocument(data.uuid),zone.dataset.creationDrop); }
  pickImage(field) { if(this.busy)return;this.captureInputs();const Picker=foundry.applications.apps.FilePicker.implementation;
    new Picker({type:"image",current:this.draft[field],callback:path=>{if(!this.busy){this.draft[field]=path;this.render();}}}).browse(); }
  static onProfile() { this.pickImage("img"); }
  static onToken() { this.pickImage("tokenImg"); }
  static onCopyPortrait() { if(this.busy)return;this.captureInputs();this.draft.tokenImg=this.draft.img;this.render(); }
  static async onFinish() {
    if(this.busy)return;this.captureInputs();this.errors=validateCreation(this.draft,this.catalog);
    if(this.errors.length){this.draft.step=this.errors[0].step;this.render();return;}
    clearTimeout(this._searchTimer);this.busy=true;
    try { await this.render();
      // The advancement choices use the native preview manager above this fullscreen creator.
      const creatorElement = this.element;
      if (creatorElement) creatorElement.style.visibility = "hidden";
      let result;
      try { result = await commitCreation(this.actor,structuredClone(this.draft),this.catalog,{resolve:resolveCreationDocument}); }
      finally { if (creatorElement) creatorElement.style.visibility = ""; }
      if (!result) { this.busy=false;await this.render();return; }
      this.busy=false;await this.close({completed:true});ui.notifications.info(`${this.actor.name}: criação concluída.`);this.actor.sheet?.render({force:true});
    } catch(error) { this.busy=false;this.errors=[{step:this.draft.step,message:error.message}];this.render(); }
  }
  async close(options={}) {
    if(this.busy&&!options.completed)return this;
    if(!options.completed)this.captureInputs();
    clearTimeout(this._searchTimer);
    this.mapView.destroy();
    if(options.completed)drafts.delete(this.actor);else drafts.set(this.actor,structuredClone(this.draft));
    await super.close(options);openApps.delete(this.actor.id);
    if(!options.completed)this.actor.sheet?.render({force:true});
    return this;
  }
  bringToFront() { if(this.element)this.element.style.zIndex=String(++ApplicationV2._maxZ);return this; }
}

export function openCharacterCreation(actor) {
  if(!Ruleset.isV2()||!actor?.isOwner||actor.type!=="character"||actor.getFlag("jujutsu-system","creation2")?.completed)return;
  if(actor.items?.size??actor.items?.length??0){ui.notifications.warn("A ficha já possui itens. A criação está disponível para personagens novos.");return;}
  const existing=openApps.get(actor.id);
  if(existing){existing.bringToFront();existing.element?.focus();return existing;}
  const app=new JujutsuCharacterCreation(actor);openApps.set(actor.id,app);
  actor.sheet?.close();
  app.render({force:true}).catch(async error=>{await app.close();ui.notifications.error(`Não foi possível abrir a criação: ${error.message}`);});
  return app;
}
