import Ruleset from "../../../systems/ruleset.mjs";
import { CREATION_STEPS, ABILITY_KEYS, creationDraft, creationBudgets, styleRules, rankSpent,
  chooseCreationStyle, chooseCreationPath, creationPathOptions, creationSpecializationSlots, creationPrimaryOptions, creationSpecializationScope, allocateCreationRank, toggleCreationSpecialization, evaluateCreationSpecialization, creationPodeEscolher, creationSpeciesGroups, validateCreation, speciesAtributosAdicionais } from "./creation-model-2.mjs";
import { loadCreationCatalog, resolveCreationDocument } from "./creation-catalog-2.mjs";
import { commitCreation } from "./creation-completion-2.mjs";
import { CUSTOMIZATION_SECTIONS } from "../jj/legacy2-customization.mjs";
const limiteDaSecao = (category) => CUSTOMIZATION_SECTIONS.find(s => s.id === category)?.max ?? Infinity;
import { SKILL_GROUPS } from "../jj/legacy2-sheet.mjs";
import { WEAPON_GROUPS } from "../../../systems/legacy2-proficiencies.mjs";
import { ICONES_CATEGORIA } from "../jj/skill-tree-map-2.mjs";

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
      customization: this.onCustomization, browseCustomization: this.onBrowseCustomization,
      profile: this.onProfile, token: this.onToken, copyPortrait: this.onCopyPortrait, finish: this.onFinish
    }
  };

  static PARTS = { main: { template: "systems/jujutsu-system/templates/actors/creation/creation-2.hbs",
    templates: ["systems/jujutsu-system/templates/actors/parts/jj2-icon.hbs"],
    scrollable: [".jj2c-content", ".jj2c-list", ".jj2c-detail", ".jj2c-specializations", ".jj2c-prof-list"] } };

  constructor(actor, options = {}) {
    super({ ...options, id: `jj2-character-creation-${actor.id}` });
    this.actor = actor;
    this.draft = structuredClone(drafts.get(actor) ?? creationDraft(actor));
    this.catalog = null; this.category = null; this.focus = null; this.search = ""; this.errors = []; this.busy = false;
    const href = "systems/jujutsu-system/less/character-creation-2.css";
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; document.head.append(link);
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
    const draft = this.draft, catalog = this.catalog, style = this.style, budget = creationBudgets(style, draft.caminho);
    const slots = creationSpecializationSlots(style, draft.caminho);
    const text = normalize(this.search), matches = doc => !text || normalize(doc.name ?? doc.nome).includes(text);
    const species = catalog.species.find(doc => doc.uuid === draft.species);
    const categories = catalog.graph.categorias ?? [];
    this.category ??= categories[0]?.nome;
    const selected = this.focus ? catalog.graph.porNome.get(this.focus) : null;
    const nodes = Array.from(catalog.graph.porNome.values()).filter(node => node.categoria === this.category && node.caminho && matches(node))
      .map(node => {
        const evaluation = evaluateCreationSpecialization(draft, style, node);
        const picked = draft.specializations.includes(node.nome);
        return { ...node, picked, focused: node.nome === this.focus, blocked: evaluation.estado === "bloqueado",
          unavailable: !picked && (!style || !creationPodeEscolher(draft, style, node, catalog)),
          reason: [...evaluation.pendencias.map(p => p.texto), ...evaluation.informativos].join("; ") };
      });
    // Agrupa por caminho dentro da categoria: cada caminho vira uma coluna própria
    const grupos = new Map();
    for ( const node of nodes ) {
      const chave = node.caminho ?? "(sem caminho)";
      if ( !grupos.has(chave) ) grupos.set(chave, []);
      grupos.get(chave).push(node);
    }
    const specializationGroups = [...grupos.entries()].map(([caminho, grupo]) => ({ caminho, nodes: grupo }));
    const renderDescription = async doc => doc ? foundry.applications.ux.TextEditor.implementation.enrichHTML(
      doc.descricao ?? doc.system?.description?.value ?? "", { secrets: this.actor.isOwner, relativeTo: this.actor,
        rollData: this.actor.getRollData?.() ?? {} }) : "";
    const [speciesHTML, detailHTML] = await Promise.all([renderDescription(species), renderDescription(selected ?? style)]);
    const rankRows = (category, rows) => ({ category, label: { saves: "Salvaguardas", armas: "Tipos de Arma", skills: "Perícias" }[category],
      budget: budget[category], spent: rankSpent(draft.proficiencies[category]),
      remaining: budget[category] - rankSpent(draft.proficiencies[category]),
      rows: rows.map(([key, label, icon]) => { const rank = draft.proficiencies[category][key]; return { key, label, icon, rank,
        rankLabel: Ruleset.rankLabel(rank), dots: [0,1,2,3,4].map(value => ({ value, selected: value === rank,
          filled: value > 0 && value <= rank, disabled: this.busy || (value > rank && value - rank > budget[category] - rankSpent(draft.proficiencies[category])) })) }; }) });
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
        ...styleRules(doc), points: creationBudgets(doc) })), style, budget,
      specializationScope: creationSpecializationScope(style),
      pathOptions: creationPathOptions(style).map(caminho => ({ ...caminho, selected: caminho.id === draft.caminho })),
      slotHints: slots.grupos.map(grupo => `${grupo.quantidade} de ${grupo.rotulo}`),
      primaryOptions: creationPrimaryOptions(style)
        .map(key => ({ key, label: labels[key] ?? key, selected: key === draft.primary })),
      specializationCategories: categories.map(category => ({ name: category.nome, img: ICONES_CATEGORIA[category.nome], selected: category.nome === this.category })),
      nodes, specializationGroups, specializationsSpent: draft.specializations.length, specializationsRemaining: budget.specializations - draft.specializations.length,
      selectedDetail: selected ?? style, detailHTML,
      proficiencyPanels: [rankRows("saves", ABILITY_KEYS.map(key => [key, labels[key],key])),
        rankRows("armas", WEAPON_GROUPS.map(group => [group.key, group.label, "weapons"])),
        rankRows("skills", SKILL_GROUPS.flatMap(group => group.skills.map(([key,label,ability]) => [key,label,ability])))],
      physicalFields: [["height","Altura"],["hair","Cabelo"],["weight","Peso"],["gender","Gênero"],["skin","Pele"],["age","Idade"]].map(([key,label])=>({key,label,value:draft.physical[key]})),
      customizationSections: CUSTOMIZATION_SECTIONS.map(section => {
        const options = catalog.customization[section.id].map(doc => ({ uuid: doc.uuid,
          name: String(doc.name ?? "").replace(/\s*\(\d+\s*pontos?\)/i, "").trim(), img: doc.img,
          desc: String(doc.system?.description?.value ?? "").trim(),
          picked: draft.customization[section.id].includes(doc.uuid) }));
        // Defeitos vêm em 1/3/5 pontos: agrupa quando TODOS trazem "(N pontos)" no nome.
        const porNome = new Map(catalog.customization[section.id].map(doc => [doc.uuid, doc]));
        const grupos = new Map();
        const todosComPontos = options.length > 0 && options.every(item =>
          /\((\d+)\s*pontos?\)/i.test(porNome.get(item.uuid)?.name ?? ""));
        const groups = todosComPontos
          ? [...options.reduce((mapa, item) => {
              const n = Number(/\((\d+)\s*pontos?\)/i.exec(porNome.get(item.uuid).name)[1]);
              mapa.set(n, [...(mapa.get(n) ?? []), item]);
              return mapa;
            }, new Map()).entries()].sort((a, b) => a[0] - b[0])
            .map(([pontos, lista]) => ({ rotulo: `${pontos} ${pontos > 1 ? "Pontos" : "Ponto"}`,
              options: lista.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }))
          : [];
        return { ...section,
          label: section.id === "jj-variant-penalties" ? "Desvantagens" : section.label,
          count: draft.customization[section.id].length, options, groups };
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
      this._searchTimer = setTimeout(() => { this.captureInputs(); this.render(); }, 180); });
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
    chooseCreationStyle(this.draft,style);this.errors=[];this.focus=null;
    const available=Array.from(this.catalog.graph.porNome.values()).find(node=>node.caminho&&evaluateCreationSpecialization(this.draft,style,node).estado==="disponivel");
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
  static onSpecialization(event,target) { if(this.busy)return;this.captureInputs();const node=this.catalog.graph.porNome.get(target.dataset.name);
    if(toggleCreationSpecialization(this.draft,this.style,node,this.catalog)){this.errors=[];this.focus=node.nome;this.render();} }
  static onCategory(event,target) { if(this.busy)return;this.captureInputs();this.category=target.dataset.category;this.focus=null;this.render(); }
  static onFocus(event,target) { if(this.busy)return;this.captureInputs();this.focus=target.dataset.name;this.render(); }
  static async onCustomization(event,target) { if(this.busy)return;this.captureInputs();const items=this.draft.customization[target.dataset.category];if(!items)return;
    const index=items.indexOf(target.dataset.uuid);
    if(index>=0)items.splice(index,1);else {
      const doc=this.catalog.customization[target.dataset.category]?.find(item=>item.uuid===target.dataset.uuid);
      if(doc)await this.addCustomization(doc,target.dataset.category);
    }
    this.errors=[];this.render(); }

  async addCustomization(doc, category) {
    if(this.busy||doc?.type!=="feat"||!this.draft.customization[category])return;
    if(!this.catalog.customization[category].some(item=>item.uuid===doc.uuid))this.catalog.customization[category].push(doc);
    const items=this.draft.customization[category];
    if(!items.includes(doc.uuid)&&items.length<limiteDaSecao(category)){
      for(const [key,choices] of Object.entries(this.draft.customization))if(key!==category)this.draft.customization[key]=choices.filter(uuid=>uuid!==doc.uuid);
      items.push(doc.uuid);
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
    try { await this.render();await commitCreation(this.actor,structuredClone(this.draft),this.catalog,{resolve:resolveCreationDocument});
      this.busy=false;await this.close({completed:true});ui.notifications.info(`${this.actor.name}: criação concluída.`);this.actor.sheet?.render({force:true});
    } catch(error) { this.busy=false;this.errors=[{step:this.draft.step,message:error.message}];this.render(); }
  }
  async close(options={}) {
    if(this.busy&&!options.completed)return this;
    if(!options.completed)this.captureInputs();
    clearTimeout(this._searchTimer);
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
