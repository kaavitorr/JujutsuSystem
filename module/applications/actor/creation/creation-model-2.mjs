import { avaliarNo, bloqueioDeEstilo } from "../../../systems/especializacoes-2.mjs";
import { WEAPON_GROUPS } from "../../../systems/legacy2-proficiencies.mjs";
import { SKILL_GROUPS } from "../jj/legacy2-sheet.mjs";
import { CUSTOMIZATION_SECTIONS, MAX_DEFEITOS } from "../jj/legacy2-customization.mjs";
import { ALTERNATIVE_SAVES, alternativeSavesEnabled } from "../../../systems/legacy2-alternative-saves.mjs";

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
export const CREATION_STEPS = [{ id: "origin", label: "Origem e Atributos", icon: "str" },
  { id: "style", label: "Estilo e Especializações", icon: "tree" },
  { id: "personalization", label: "Personalização", icon: "personalization" }];
export const CREATION_RANK_KEYS = { get saves() { return alternativeSavesEnabled() ? ALTERNATIVE_SAVES.map(save => save.key) : ABILITY_KEYS; }, armas: WEAPON_GROUPS.map(g => g.key),
  skills: SKILL_GROUPS.flatMap(g => g.skills.map(([key]) => key)) };
const zeros = keys => Object.fromEntries(keys.map(key => [key, 0]));
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
export const styleRules = style => style?.getFlag?.("jujutsu-system", "legacy2") ?? style?.flags?.["jujutsu-system"]?.legacy2 ?? {};
export const rankSpent = values => Object.values(values ?? {}).reduce((sum, value) => sum + integer(value), 0);

/** Penalidade variante com escolha na criação: Vida −2 ou Energia Base −4. */
export const PENALIDADE_VITAL_NOME = "Perde 2 Pontos de Vida ou 4 de Energia Base";
export const penalidadeVitalUuid = catalog =>
  catalog?.customization?.["jj-variant-penalties"]?.find(doc => doc.name === PENALIDADE_VITAL_NOME)?.uuid ?? null;

/* ── Caminhos de Estilo (Lutador / Estrategista) ────────────────────────────
 * Lutador (Guerrilheiro): "Punho Ardente" ou "Mestre das Armas".
 * Estrategista: "Médico de Campo" (+1 slot na 1ª habilidade de Energia
 * Reversa) ou "Mestre de Barreiras" (+3 slots em Técnicas de Barreira). */
export const CAMINHOS_ESTILO = {
  lutador: [
    { id: "punho-ardente", label: "Punho Ardente", icon: "str",
      desc: "Golpes desarmados brutais: Golpe Brutal, Interceptar, Mãos Letais e Corpo Forjado (+5 de resistência a dano físico)." },
    { id: "mestre-armas", label: "Mestre das Armas", icon: "weapons",
      desc: "Domina uma Ferramenta Amaldiçoada: Maestria (2 PP em um tipo), Imbuir Feitiço, Arma Favorita e Posições de Combate." }
  ],
  estrategista: [
    { id: "medico-campo", label: "Médico de Campo", icon: "heart",
      desc: "Desbloqueia a Energia Reversa e recebe 1 habilidade dela. Técnicas de dano de Feitiços custam 1 PA adicional; seu limite de Pontos de Energia Reversa dobra (30 → 60)." },
    { id: "mestre-barreiras", label: "Mestre de Barreiras", icon: "con",
      desc: "Recebe 3 habilidades de Especialização de Técnicas de Barreira; suas barreiras recebem 2 PV adicionais por PA gasto para criá-las." }
  ]
};

export function creationPathOptions(style) {
  const definidos = CAMINHOS_ESTILO[style?.system?.identifier ?? ""]
    ?? CAMINHOS_ESTILO[String(style?.name ?? "").toLowerCase()];
  return Array.isArray(styleRules(style).caminhos) ? styleRules(style).caminhos : definidos ?? [];
}

/** Maps a scope phrase ("Proeza Física") to the graph category ("proezas fisicas"). */
const escopoCategoria = escopo => {
  const chave = scopeKey(escopo);
  return chave === "proeza fisica" ? "proezas fisicas" : chave;
};

export function creationPrimaryOptions(style) {
  const flags = styleRules(style);
  return Array.isArray(flags.atributoPrincipal) ? flags.atributoPrincipal
    : flags.principalEscolhivel && flags.atributoPrincipal === "str" ? ["str", "dex"] : [flags.atributoPrincipal ?? "str"];
}

/** Read the authored initial specialization restriction, including styles with a named path. */
export function creationSpecializationScope(style) {
  const text = String(style?.system?.description?.value ?? "").replace(/<[^>]+>/g, " ")
    .replace(/&quot;|&#34;/g, '"').replace(/&nbsp;|&#160;/g, " ");
  return styleRules(style).espCategoria ?? /Habilidades de Especializaç[aã]o\s*:\s*Você recebe\s*\d+\s*habilidades?\s*de\s*["“]([^"”]+)["”]/i.exec(text)?.[1] ?? null;
}
const scopeKey = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function creationDraft(actor) {
  return { step: 0, name: actor?.name ?? "", img: actor?.img ?? "", tokenImg: actor?.prototypeToken?.texture?.src ?? "",
    species: null, style: null, primary: null, caminho: null, penalidadeVital: null, abilities: Object.fromEntries(ABILITY_KEYS.map(key => [key, 1])),
    specializations: [], proficiencies: Object.fromEntries(Object.entries(CREATION_RANK_KEYS).map(([key, keys]) => [key, zeros(keys)])),
    customization: Object.fromEntries(CUSTOMIZATION_SECTIONS.map(section => [section.id, []])),
    // uuid → nome das características escolhidas (automações do draft, ex.:
    // o bypass de requisitos do Receptáculo Destinado).
    customizacaoNomes: {},
    physical: Object.fromEntries(["height", "hair", "weight", "gender", "skin", "age"].map(key => [key, ""])) };
}

export const creationWeaponBonus = (style, caminho) =>
  scopeKey(style?.system?.identifier || style?.name) === "lutador" && caminho === "mestre-armas" ? 2 : 0;

export function creationCombinationError(style, species) {
  return scopeKey(style?.system?.identifier || style?.name) === "restringido"
    && scopeKey(species?.system?.identifier || species?.name) === "imaculado"
    ? "Imaculado não pode usar o Estilo Restringido, pois concede Canalização de Energia. Escolha outro Estilo ou Origem." : null;
}

export function creationBudgets(style, caminho = null, species = null) {
  const flags = styleRules(style), points = flags.proficiencias ?? {};
  return { attributes: 20, attributeMax: 6, specializations: creationSpecializationSlots(style, caminho, species).total,
    armas: integer(points.armas) + creationWeaponBonus(style, caminho), saves: integer(points.salvaguardas), skills: integer(points.pericias) };
}

/** Slots de especialização da criação, divididos em grupos restritos. */
export function creationSpecializationSlots(style, caminho = null, species = null) {
  const escopo = creationSpecializationScope(style);
  const grupos = [{ id: "base", quantidade: integer(styleRules(style).espIniciais),
    rotulo: escopo ?? "Especializações", categorias: escopo ? [escopoCategoria(escopo)] : null, nomes: null }];
  // Restringido: escolhe entre Proezas Físicas e Habilidades Especiais — a
  // restrição de caminhos bloqueados (bloqueioDeEstilo) filtra o resto.
  const chaveEstilo = String(style?.system?.identifier ?? style?.name ?? "").toLowerCase().trim();
  if ( chaveEstilo === "restringido" ) {
    grupos[0].categorias = [escopoCategoria("Proezas Físicas"), escopoCategoria("Habilidades Especiais")];
    grupos[0].rotulo = "Proezas Físicas ou Habilidades Especiais";
  }
  if (chaveEstilo === "especialista")
    grupos.push({ id: "manipulacao-feitico", quantidade: 1, rotulo: "Manipulação de Feitiço — Feitiço Inato",
      categorias: [escopoCategoria("Feitiço Inato")], nomes: null });
  if (style && scopeKey(species?.system?.identifier || species?.name) === "imaculado")
    grupos.push({ id: "origem-canalizacao", quantidade: 2, rotulo: "Imaculado — Canalização de Energia",
      categorias: [escopoCategoria("Canalização de Energia")], nomes: null });
  if (style?.system?.identifier === "estrategista" || String(style?.name ?? "").toLowerCase() === "estrategista") {
    if (caminho === "mestre-barreiras")
      grupos.push({ id: "barreiras", quantidade: 3, rotulo: "Técnicas de Barreira",
        categorias: [escopoCategoria("Técnicas de Barreira")], nomes: null });
    if (caminho === "medico-campo")
      grupos.push({ id: "energia-reversa", quantidade: 1, rotulo: "Energia Reversa",
        categorias: [escopoCategoria("Energia Reversa")], nomes: ["Energia Reversa"] });
  }
  // Sentinela (Forma Dominada): ganha "Domínio Simples" de graça — obrigatória na criação.
  if (style?.system?.identifier === "sentinela" || String(style?.name ?? "").toLowerCase() === "sentinela")
    grupos.push({ id: "dominio-simples", quantidade: 1, rotulo: "Domínio Simples",
      categorias: [escopoCategoria("Domínio e Anti-Domínio")], nomes: ["Domínio Simples"] });
  return { grupos, total: grupos.reduce((soma, grupo) => soma + grupo.quantidade, 0) };
}

/** Whether a node fits a slot group: exact names first, then category/path scope. */
function caberNoGrupo(grupo, node) {
  if (!grupo || !node) return false;
  if (Array.isArray(grupo.nomes)) return grupo.nomes.includes(node.nome);
  if (Array.isArray(grupo.categorias)) return grupo.categorias.includes(escopoCategoria(node.categoria))
    || grupo.categorias.includes(escopoCategoria(node.caminho));
  return true;
}

/** Assign each choice to exactly one slot, moving flexible choices when a restricted slot needs them. */
function cabemNosGrupos(grupos, names, catalog) {
  const active = grupos.filter(group => group.quantidade > 0);
  const assigned = new Map(active.map(group => [group.id, []]));
  function assign(node, visited = new Set()) {
    for (const group of active) {
      if (visited.has(group.id) || !caberNoGrupo(group, node)) continue;
      const next = new Set(visited);next.add(group.id);
      const choices = assigned.get(group.id);
      if (choices.length < group.quantidade) { choices.push(node);return true; }
      for (let index = 0; index < choices.length; index++) {
        if (assign(choices[index], next)) { choices[index] = node;return true; }
      }
    }
    return false;
  }
  return names.every(name => assign(catalog.graph?.porNome.get(name)));
}

export function chooseCreationStyle(draft, style) {
  if (draft.style === style.uuid) return;
  draft.style = style.uuid;
  draft.primary = creationPrimaryOptions(style)[0];
  draft.caminho = null;
  draft.specializations = [];
  draft.proficiencies = Object.fromEntries(Object.entries(CREATION_RANK_KEYS).map(([key, keys]) => [key, zeros(keys)]));
}

/** Pick the style path (Punho Ardente/Mestre das Armas, Médico de Campo/Mestre de Barreiras). */
export function chooseCreationPath(draft, caminho) {
  if (draft.caminho === caminho) return;
  draft.caminho = caminho;
  draft.specializations = [];
}

/* ── Origens agrupadas por tipo ─────────────────────────────────────────────
 * "Anomalia - X" agrupa sob Anomalia; "Linhagem - X" (os clãs) sob Clã;
 * origens sem prefixo (Feitiço Inato, Imaculado, Maldição) são tipo único. */
export function creationSpeciesGroups(species, matches = () => true) {
  const grupos = new Map();
  for (const doc of species) {
    if (!matches(doc)) continue;
    const m = /^(anomalia|linhagem)\s*-\s*(.+)$/i.exec(doc.name ?? "");
    const tipo = !m ? doc.name : m[1].toLowerCase() === "anomalia" ? "Anomalia" : "Clã";
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo).push({ uuid: doc.uuid, name: m ? m[2].trim() : doc.name, img: doc.img });
  }
  const ordem = ["Anomalia", "Clã"];
  const peso = tipo => {
    const indice = ordem.indexOf(tipo);
    return indice === -1 ? ordem.length : indice;
  };
  return [...grupos.entries()]
    .sort((a, b) => peso(a[0]) - peso(b[0]) || a[0].localeCompare(b[0], "pt-BR"))
    .map(([tipo, cards]) => ({ tipo, cards: cards.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }));
}

export function allocateCreationRank(draft, style, category, key, rank) {
  if (!CREATION_RANK_KEYS[category]?.includes(key) || !Number.isInteger(rank) || rank < 0 || rank > 4) return false;
  if (rank > 0 && !creationRankAllowed(style, category, key)) return false;
  const group = draft.proficiencies[category];
  if (rankSpent(group) - group[key] + rank > creationBudgets(style, draft.caminho)[category]) return false;
  group[key] = rank;
  return true;
}

export const creationRankAllowed = (style, category, key) =>
  !(scopeKey(style?.system?.identifier || style?.name) === "restringido" && category === "skills" && key === "arc");

export function shouldOpenCreation(actor, options = {}, userId, currentUserId, enabled) {
  return !!enabled && userId === currentUserId && actor?.type === "character" && actor.isOwner
    && !(actor.items?.size ?? actor.items?.length ?? 0) && !actor.getFlag?.("jujutsu-system", "creation2")?.completed
    && !actor._stats?.compendiumSource && !actor._stats?.duplicateSource
    && !options.fromCompendium && !options.keepId && !options.noHook;
}

/** A draft actor lets the existing specialization engine evaluate choices without creating documents. */
export function creationActor(draft, style, learned = draft.specializations) {
  const rules = styleRules(style);
  return { name: draft.name, type: "character", system: { details: { level: 1 }, abilities: Object.fromEntries(ABILITY_KEYS.map(key => [key, { value: draft.abilities[key] }])),
    legacy2: { ...draft.proficiencies,
      ...(alternativeSavesEnabled() ? { alternativeSaves: { ...draft.proficiencies.saves }, saves: {} } : {}),
      principalEscolhido: draft.primary } },
    itemTypes: { class: [{ name: style?.name, system: { identifier: style?.system?.identifier }, getFlag: () => rules }] }, items: [],
    flags: { "jujutsu-system": { modLendarioNomes: Object.values(draft.customizacaoNomes ?? {}) } },
    getFlag: (scope, key) => key === "especializacoes" ? learned : undefined };
}

export function evaluateCreationSpecialization(draft, style, node, learned = draft.specializations, species = null) {
  const slots = creationSpecializationSlots(style, draft.caminho, species);
  const bloqueio = bloqueioDeEstilo(style, node);
  if ( bloqueio )
    return { estado: "bloqueado", pendencias: [{ texto: bloqueio }], informativos: [] };
  if (!slots.grupos.some(grupo => grupo.quantidade > 0 && caberNoGrupo(grupo, node))) {
    const texto = slots.grupos.some(grupo => grupo.id === "energia-reversa")
      ? "Com o Médico de Campo, você recebe apenas a habilidade \"Energia Reversa\" da Energia Reversa na criação."
      : `Seu Estilo concede habilidades de ${slots.grupos.map(grupo => grupo.rotulo).join(" e ")}.`;
    return { estado: "bloqueado", pendencias: [{ texto }], informativos: [] };
  }
  return avaliarNo(creationActor(draft, style, learned), node);
}

/** Whether the node can be picked right now: scope, engine availability and free slots in its group. */
export function creationPodeEscolher(draft, style, node, catalog) {
  if (!node) return false;
  if (draft.specializations.includes(node.nome)) return true;
  const species = catalog.species?.find(doc => doc.uuid === draft.species);
  const slots = creationSpecializationSlots(style, draft.caminho, species);
  if (draft.specializations.length >= slots.total) return false;
  if (evaluateCreationSpecialization(draft, style, node, draft.specializations, species).estado !== "disponivel") return false;
  return cabemNosGrupos(slots.grupos, [...draft.specializations, node.nome], catalog);
}

export function toggleCreationSpecialization(draft, style, node, catalog) {
  if (!node) return false;
  const index = draft.specializations.indexOf(node.nome);
  if (index >= 0) {
    const remaining = draft.specializations.filter(name => name !== node.nome), valid = [];
    for (const name of remaining) {
      const candidate = catalog.graph.porNome.get(name);
      if (candidate && evaluateCreationSpecialization(draft, style, candidate, valid,
        catalog.species?.find(doc => doc.uuid === draft.species)).estado === "disponivel") valid.push(name);
    }
    draft.specializations = valid;
    return true;
  }
  if (!creationPodeEscolher(draft, style, node, catalog)) return false;
  draft.specializations.push(node.nome);
  return true;
}

/** Atributos adicionais concedidos por uma Origem (flag viva no item race). */
export function speciesAtributosAdicionais(species) {
  return Number(species?.getFlag?.("jujutsu-system", "atributosAdicionais")
    ?? species?.flags?.["jujutsu-system"]?.atributosAdicionais ?? 0) || 0;
}

export function validateCreation(draft, catalog, throughStep = 2) {
  const errors = [], fail = (step, message) => errors.push({ step, message });
  const species = catalog.species.find(doc => doc.uuid === draft.species);
  const style = catalog.styles.find(doc => doc.uuid === draft.style);
  if (!species) fail(0, "Escolha sua Origem de Poder.");
  const orcamentoAtributos = 20 + speciesAtributosAdicionais(species);
  if (ABILITY_KEYS.some(key => !Number.isInteger(draft.abilities[key]) || draft.abilities[key] < 1 || draft.abilities[key] > 6)
    || rankSpent(draft.abilities) !== orcamentoAtributos) fail(0, orcamentoAtributos === 20
      ? "Distribua 20 pontos de atributo, com valores de 1 a 6."
      : `Distribua ${orcamentoAtributos} pontos de atributo (20 + ${orcamentoAtributos - 20} da Origem), com valores de 1 a 6.`);
  if (throughStep >= 1) {
    if (!style) fail(1, "Escolha seu Estilo de Combate.");
    const combinationError = creationCombinationError(style, species);
    if (combinationError) fail(1, combinationError);
    const allowed = creationPrimaryOptions(style);
    if (style && !allowed.includes(draft.primary)) fail(1, "Escolha o atributo principal do Estilo.");
    const caminhos = creationPathOptions(style);
    if (style && caminhos.length && !caminhos.some(caminho => caminho.id === draft.caminho))
      fail(1, `Escolha o caminho do seu Estilo: ${caminhos.map(caminho => caminho.label).join(" ou ")}.`);
    const slots = creationSpecializationSlots(style, draft.caminho, species);
    if (draft.specializations.length !== slots.total || new Set(draft.specializations).size !== draft.specializations.length)
      fail(1, `Escolha ${slots.total} habilidades de Especialização.`);
    else if (!cabemNosGrupos(slots.grupos, draft.specializations, catalog))
      fail(1, `Distribua suas escolhas entre os grupos da criação: ${slots.grupos.map(grupo => `${grupo.quantidade} de ${grupo.rotulo}`).join(" e ")}.`);
    const learned = [];
    for (const name of draft.specializations) {
      const node = catalog.graph?.porNome.get(name);
      if (!node || evaluateCreationSpecialization(draft, style, node, learned, species).estado !== "disponivel") fail(1, `Confira os requisitos de ${name}.`);
      learned.push(name);
    }
  }
  if (throughStep >= 2) {
    if (!draft.name?.trim()) fail(2, "Defina o nome do personagem.");
    for (const [category, keys] of Object.entries(CREATION_RANK_KEYS)) {
      const group = draft.proficiencies[category];
      if (keys.some(key => !Number.isInteger(group?.[key]) || group[key] < 0 || group[key] > 4)
        || Object.keys(group ?? {}).some(key => !keys.includes(key)) || rankSpent(group) !== creationBudgets(style, draft.caminho, species)[category])
        fail(2, `Distribua os pontos de ${ { saves: "Salvaguardas", armas: "Armas", skills: "Perícias" }[category] } do seu Estilo.`);
      if (keys.some(key => group?.[key] > 0 && !creationRankAllowed(style, category, key)))
        fail(2, "O Restringido não pode distribuir pontos iniciais em Feitiçaria.");
    }
    if (creationWeaponBonus(style, draft.caminho) && !Object.values(draft.proficiencies.armas).some(rank => rank >= 2))
      fail(2, "Maestria: distribua os 2 pontos extras no mesmo tipo de arma.");
    const customSources = new Set();
    for (const section of CUSTOMIZATION_SECTIONS) {
      const selected = draft.customization[section.id] ?? [];
      if (section.id === "jj-flaws" && selected.length > MAX_DEFEITOS) fail(2, `Escolha no máximo ${MAX_DEFEITOS} Defeitos.`);
      if (new Set(selected).size !== selected.length || selected.some(uuid => !catalog.customization[section.id]?.some(doc => doc.uuid === uuid)))
        fail(2, `Confira as escolhas de ${section.label}.`);
      for (const uuid of selected) {
        if (customSources.has(uuid)) fail(2, "Escolha cada característica pessoal em apenas um grupo.");
        customSources.add(uuid);
      }
    }
    // A penalidade de Vida/Energia exige a escolha do lado que será perdido.
    const vitalSelecionada = draft.customization["jj-variant-penalties"]?.includes(penalidadeVitalUuid(catalog));
    if (vitalSelecionada && !["vida", "energia"].includes(draft.penalidadeVital))
      fail(2, "Escolha se a penalidade variante reduz Vida ou Energia Base.");
  }
  return errors;
}
