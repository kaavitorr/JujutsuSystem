import Ruleset, { MAX_VANTAGENS } from "../../systems/ruleset.mjs";
import { getScaleOptions } from "../actor/jj/jj-scale.mjs";

const GESTURES = [ ["arrow", "Flecha"], ["line", "Linha"], ["cone", "Cone"], ["fan", "Leque"], ["sphere", "Esfera"], ["emanation", "Emanação"] ];
const integer = (value, min = 0, max = Infinity) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : min;
};

export function hasLegacy2Activation(activity) {
  return Ruleset.isV2() && !!activity?.item?.actor && (activity.type === "attack" || activity.item.type === "spell"
    || ["damage", "save"].includes(activity.type) || !!activity.jjScale?.formula?.trim());
}

export function energyPayer(actor) {
  if (Ruleset.isRestringido(actor)) return actor;
  const summon = actor?.flags?.JujutsuLegacy?.summon ?? actor?.flags?.["jujutsu-system"]?.summon;
  if (summon?.origin && summon.consumeSummoner === true) {
    try { const doc = fromUuidSync(summon.origin); return doc?.actor ?? (doc?.system?.energy ? doc : doc?.parent?.system?.energy ? doc.parent : actor); }
    catch { /* The actor pays if the originating document no longer exists. */ }
  }
  return actor;
}

export function offensiveBurstLimit(actor) {
  if (Ruleset.isRestringido(actor)) return Ruleset.physicalImpulseLimit(actor);
  return Math.ceil(Math.max(1, Number(Ruleset.nivel(actor)) || 1) / 2);
}

/* ── Gestos e Selos de Mão (2.0 — Feitiço Inato) ──────────────────────────── */

export const GESTO_DEFS = {
  flecha:   { feat: "Gestos: Flecha e Linha",  label: "Flecha",   dado: 8, area: false,
              alcances: [15, 25, 35] },
  linha:    { feat: "Gestos: Flecha e Linha",  label: "Linha",    dado: 8, area: true,
              alcances: [15, 25, 35] },
  leque:    { feat: "Gestos: Cone e Leque",    label: "Leque",    dado: 6, area: true,
              alcances: [6, 12, 18] },
  cone:     { feat: "Gestos: Cone e Leque",    label: "Cone",     dado: 6, area: true,
              alcances: [10, 20, 30] },
  raio:     { feat: "Gestos: Raio e Emanação", label: "Raio",     dado: 6, area: true,
              alcances: [[15, 5], [25, 10], [35, 15]] },
  emanacao: { feat: "Gestos: Raio e Emanação", label: "Emanação", dado: 6, area: true,
              alcances: [5, 10, 15] }
};
const GESTO_FEATS = ["Gestos: Flecha e Linha", "Gestos: Cone e Leque", "Gestos: Raio e Emanação"];
const SELOS_CAMINHO = "Selos e Encantamentos";
const RIDER_CONDICAO = { flecha: 0, linha: 1, leque: 2, cone: 2, raio: 3, emanacao: 3 };

/** Ordem (1-3) pela manifestação da técnica: inata/m1 → 1, m2 → 2, m3 → 3. */
export function ordemDaTecnica(item) {
  const flags = item?.getFlag?.("jujutsu-system", "feitico") ?? {};
  const slot = flags.slot ?? flags.parent ?? null;
  if ( slot === "m2" ) return 2;
  if ( slot === "m3" ) return 3;
  return 1;
}

function temFeat(actor, nome) {
  return actor?.items?.some(i => i.type === "feat" && i.name === nome);
}

/** Gestos que o ator pode usar (tem o feat correspondente). */
export function gestosPossiveis(actor) {
  return Object.entries(GESTO_DEFS)
    .filter(([, def]) => temFeat(actor, def.feat))
    .map(([value, def]) => ({ value, label: def.label, dado: def.dado, area: def.area }));
}

/** Pool máximo de selos: 3 + 1 por habilidade adicional do caminho Selos e
 * Encantamentos, mais o bônus de efeitos (a penalidade variante "Perde 3
 * dos seus Selos" aplica −3 em flags.jujutsu-system.selosBonus). */
export function selosMax(actor) {
  const noCaminho = actor?.items?.filter(i => i.type === "feat"
    && i.getFlag?.("jujutsu-system", "especializacao")?.caminho === SELOS_CAMINHO).length;
  const bonus = Math.trunc(Number(actor?.flags?.["jujutsu-system"]?.selosBonus) || 0);
  return Math.max(0, 3 + Math.max(0, noCaminho - 1) + bonus);
}

export function selosAtuais(actor) {
  return Math.max(0, Math.floor(Number(actor?.getFlag?.("jujutsu-system", "selos") ?? 0)));
}

/** PA extra de condição ao converter forma de Flecha (0 quando não aplica). */
export function riderCondicional(gesto) {
  return RIDER_CONDICAO[gesto] ?? 0;
}

/** Rótulo de alcance do gesto na ordem dada. */
export function alcanceLabel(gesto, ordem) {
  const def = GESTO_DEFS[gesto];
  if ( !def ) return null;
  const alcance = def.alcances[Math.min(def.alcances.length, Math.max(1, ordem)) - 1];
  return Array.isArray(alcance) ? `${alcance[0]} m de linha + raio de ${alcance[1]} m` : `${alcance} metros`;
}

function nativeGesture(activity) {
  const type = activity?.target?.template?.type;
  const aliases = { ray: "arrow", radius: "emanation", circle: "sphere" };
  return type ? aliases[type] ?? type : "arrow";
}

/** Opções de atributo do diálogo: na 2.0 todos são escolhíveis (o principal é o padrão). */
function abilityOptions(activity) {
  const opts = activity._getAbilityOptions?.() ?? [];
  if ( !Ruleset.isV2() ) return opts;
  return Object.entries(CONFIG.DND5E.abilities).map(([value, cfg]) => ({ value, label: cfg.label }));
}

export function activationChoices(activity, choices = {}) {
  const actor = activity.item.actor;
  const abilities = abilityOptions(activity);
  const npc = Ruleset.isV2() && actor.type === "npc";
  const principal = npc ? Ruleset.npcPrincipal(actor) : Ruleset.atributoPrincipal(actor);
  const configured = activity.attack?.ability || activity.ability || activity.spellcastingAbility;
  const fallback = npc && abilities.some(o => o.value === configured) ? configured
    : abilities.some(o => o.value === principal) ? principal
      : (configured ?? "int");
  const ability = abilities.length
    ? ((choices.ability && abilities.find(o => o.value === choices.ability)?.value) ?? fallback)
    : fallback;
  const select = (options, value) => options?.length ? (options.find(o => o.value === value)?.value ?? options[0].value) : undefined;
  const defaults = activity.getLegacy2AdvantageDefaults?.({ ability, attackMode: choices.attackMode }) ?? {};
  const canBurst = activity.type !== "heal" && !!activity.damage?.parts?.length;
  // Selos de Mão só se aplicam a técnicas — nunca em ataques comuns de arma.
  const ehTecnica = activity.item.type === "spell";
  // O select do dialog manda o gesto em legacy2.gesture; uso programático pode mandar legacy2.gesto.
  const gestoPossivel = gestosPossiveis(actor);
  const gestoEscolhido = [choices.gesto, choices.gesture]
    .find(v => gestoPossivel.some(g => g.value === v)) ?? null;
  const scale = getScaleOptions({ actor: energyPayer(activity.item.actor), activity });
  // Choices must survive spending the energy. Available PA is a form bound, not a rule cap.
  const scaleCap = scale.maxPA > 0 ? Math.max(0, Math.floor((scale.maxPA - scale.activationCost) / scale.cost)) : Infinity;
  // Recarga (lod): arma descarregada custa +1 Ponto de Ação nas ações;
  // marcando "Recarregar agora" o ataque sai carregado sem o custo extra.
  const temRecarga = activity.item?.type === "weapon" && Ruleset.temPropriedade(activity.item, "lod");
  const carregada = temRecarga ? (activity.item.getFlag?.("jujutsu-system", "carregada") !== false) : true;
  const recarregar = temRecarga && !carregada ? !!choices.recarregar : false;
  return {
    vantagens: integer(choices.vantagens ?? defaults.vantagens, 0, MAX_VANTAGENS),
    desvantagens: integer(choices.desvantagens ?? defaults.desvantagens, 0, MAX_VANTAGENS),
    pa: canBurst ? integer(choices.pa, 0, offensiveBurstLimit(activity.item.actor)) : 0,
    ...(Ruleset.isRestringido(actor) ? { physicalImpulse: true } : {}),
    bonus: Number.isFinite(Number(choices.bonus)) ? Math.trunc(Number(choices.bonus)) : 0,
    danoAdicional: String(choices.danoAdicional ?? "").trim().slice(0, 100),
    gesture: nativeGesture(activity), ability,
    // Gestos e Selos (2.0): gesto válido só com o feat correspondente
    gesto: gestoEscolhido,
    condicao: !!choices.condicao,
    manipulacao: !!choices.manipulacao && temFeat(actor, "Manipulação de Selos"),
    selos: ehTecnica ? integer(choices.selos, 0, temFeat(actor, "Selos Complexos") ? 2 : (temFeat(actor, "Selos de Mão") ? 1 : 0)) : 0,
    recarga: temRecarga ? { carregada, custoExtra: carregada ? 0 : 1 } : null,
    recarregar,
    attackMode: select(activity.item.system.attackModes, choices.attackMode),
    ammunition: select(activity.item.system.ammunitionOptions, choices.ammunition),
    ...(activity.item.system.masteryOptions?.length > 1 ? { mastery: select(activity.item.system.masteryOptions, choices.mastery) } : {}),
    ...(scale.available ? { scale: integer(choices.scale, 0, scaleCap) } : {})
  };
}

export function activationContext(activity, choices = {}) {
  const config = activationChoices(activity, choices), actor = activity.item.actor;
  const data = activity.getAttackData?.({ ...config, legacy2: config })?.data ?? {};
  const fixedAttack = activity.attack?.flat && !(Ruleset.isV2() && actor.type === "npc");
  const abilityValue = fixedAttack ? 0 : data.mod ?? actor.system.abilities?.[config.ability]?.value ?? 0;
  const skillValue = fixedAttack ? 0 : data.legacyRank ?? (activity.type === "attack" ? Ruleset.bonusArma(actor, activity.item) : 0);
  const nativeBonus = [data.toHit, data.bonus, data.weaponMagic, data.ammoMagic, data.ruleBonus].filter(v => v !== undefined && v !== null && v !== "");
  const bonusLabel = nativeBonus.length ? nativeBonus.join(" + ") : "0";
  const range = activity.range ?? activity.item.system.range;
  const showGestures = activity.item.type === "spell" && (!!activity.target?.template?.type
    || Number(range?.value) > 0 || activity.attack?.type?.value === "ranged");
  const burstLimit = offensiveBurstLimit(actor), burstMax = Math.min(burstLimit, integer(energyPayer(actor).system?.energy?.generated));

  // ── Gestos e Selos (2.0) ───────────────────────────────────────────────────
  const ordem = ordemDaTecnica(activity.item);
  const gestosPossuidos = gestosPossiveis(actor);
  const gestoDef = GESTO_DEFS[config.gesto] ?? null;
  const rider = gestoDef ? riderCondicional(config.gesto) : 0;
  const custoGestoPA = gestoDef ? ordem + (config.condicao ? rider : 0) : 0;
  let alcanceGesto = null;
  if ( gestoDef ) {
    const alcance = gestoDef.alcances[Math.min(gestoDef.alcances.length, ordem) - 1];
    alcanceGesto = Array.isArray(alcance)
      ? `centro a até ${alcance[0]} m · raio de ${alcance[1]} m`
      : `${alcance} metros`;
  }
  const selosInfo = {
    atuais: selosAtuais(actor), max: activity.item.type === "spell" ? selosMax(actor) : 0,
    porVez: temFeat(actor, "Selos Complexos") ? 2 : (temFeat(actor, "Selos de Mão") ? 1 : 0),
    complexo: temFeat(actor, "Selos Complexos"), manipulacao: temFeat(actor, "Manipulação de Selos")
  };
  const gestoPreview = gestoDef
    ? `${gestoDef.label} (ordem ${ordem}) · alcance: ${alcanceGesto} · dano d${gestoDef.dado}`
      + (gestoDef.area ? " · Salvaguarda de Agilidade (ou a original)" : " · ataque direto")
      + ` · custo: +1 Ação e +${custoGestoPA} PA`
      + (config.condicao ? " · inclui rider de condição" : "")
    : null;

  return { ...config, title: activity.item.name, subtitle: activity.name, image: activity.item.img ?? activity.img,
    scaleConfig: getScaleOptions({ actor: energyPayer(actor), activity }),
    isAttack: activity.type === "attack", canBurst: activity.type !== "heal" && !!activity.damage?.parts?.length,
    maxAdvantages: MAX_VANTAGENS, advantageBonus: data.legacyAdv ?? Ruleset.netAdvantageBonus(config.vantagens, config.desvantagens),
    flanking: data.legacyFlanqueamento?.graus ?? 0,
    burstLimit, burstMax, burstFormula: `${config.pa * (config.physicalImpulse ? 2 : 1)}d4`, availablePA: integer(energyPayer(actor).system?.energy?.generated),
    burstTitle: config.physicalImpulse ? "Impulso Físico" : "Explosão Ofensiva", burstUnit: config.physicalImpulse ? "PE" : "PA",
    abilityValue, abilityLabel: CONFIG.DND5E.abilities[config.ability]?.label ?? config.ability, skillValue,
    skillValueLabel: `${skillValue >= 0 ? "+" : "-"}${Math.abs(skillValue)}`, bonusLabel,
    showGestures, gestures: [...GESTURES, ...(!GESTURES.some(([value]) => value === config.gesture) ? [[config.gesture, "Formato nativo da técnica"]] : [])]
      .map(([value, label]) => ({ value, label, selected: value === config.gesture, disabled: value !== config.gesture })),
    abilityOptions: abilityOptions(activity), attackModeOptions: activity.item.system.attackModes ?? [],
    // Gestos e Selos (2.0)
    ordem, gestoPreview, selosInfo,
    gestureOptions: [
      { value: "", label: "Formato nativo da técnica", selected: !config.gesto },
      ...gestosPossuidos.map(g => ({ value: g.value, label: `${g.label} (d${g.dado})`, selected: g.value === config.gesto }))
    ],
    masteryOptions: activity.item.system.masteryOptions?.length > 1 ? activity.item.system.masteryOptions : [],
    ammunitionOptions: activity.item.system.ammunitionOptions ?? [] };
}

const isEnergy = target => ["energy.generated", "energy.total"].includes(target?.target);
export function withoutEnergyConsumption(activity, config) {
  const targets = activity.consumption?.targets ?? [];
  const consume = config.consume;
  if (!consume) return config;
  const indexes = consume === true || consume.resources === true ? targets.map((_, i) => i) : consume.resources;
  // 2.0 não tem espaços de magia: qualquer consumo de slot gravado é ignorado
  return { ...config, consume: { ...(consume === true ? { action: true, spellSlot: true } : consume),
    resources: Array.isArray(indexes) ? indexes.filter(i => !isEnergy(targets[i])) : indexes,
    spellSlot: false } };
}

/** Prepare all PA costs without writes, after the other native consumption has been validated. */
export function energyConsumptionPlan(activity, config) {
  const actor = activity.item.actor, payer = energyPayer(actor), targets = activity.consumption?.targets ?? [];
  const consume = config.consume;
  const indexes = consume === true || consume?.resources === true ? targets.map((_, i) => i) : consume?.resources ?? [];
  const hasEyes = actor.items?.some(i => i.name === "Seis Olhos" && i.type === "feat");
  const mode = actor.getFlag?.("jujutsu-system", "seisOlhosMode");
  const prof = actor.system.attributes?.prof ?? 2;
  const physicalImpulse = Ruleset.isRestringido(actor);
  const reduction = !physicalImpulse && hasEyes && mode ? (mode === "full" ? prof : Math.max(1, Math.floor(prof / 2))) : 0;
  const costs = { "energy.generated": 0, "energy.total": 0 };
  for (const index of indexes) {
    const target = targets[index];
    if (!isEnergy(target)) continue;
    const formula = String(target.value ?? 0);
    const roll = target.resolveCost?.({ config, evaluate: false });
    const cost = roll ? (roll.isDeterministic ? roll.evaluateSync().total : NaN)
      : (/^\d+(?:\.\d+)?$/.test(formula) ? Number(formula) : globalThis.CONFIG?.Dice?.BasicRoll?.replaceFormulaData(formula, activity.getRollData?.() ?? {}));
    const value = Number(cost);
    if (!Number.isFinite(value)) throw new Error("Não foi possível calcular o custo de PA da técnica.");
    costs[physicalImpulse ? "energy.generated" : target.target] += Math.max(0, Math.ceil(value) - reduction);
  }
  costs["energy.generated"] += activationChoices(activity, config.legacy2).pa;
  // Gestos (2.0): PA da ordem + rider de condição na energia refinada
  const escolhas = activationChoices(activity, config.legacy2);
  if ( escolhas.gesto ) costs["energy.generated"] += ordemDaTecnica(activity.item) + (escolhas.condicao ? riderCondicional(escolhas.gesto) : 0);
  const scale = getScaleOptions({ actor: payer, activity });
  if (scale.available) costs[`energy.${scale.pool}`] += (activationChoices(activity, config.legacy2).scale ?? 0) * scale.cost;
  const updates = {};
  for (const [pool, cost] of Object.entries(costs)) {
    if (!cost) continue;
    const available = Number(payer.system.energy?.[pool.split('.')[1]] ?? 0);
    if (cost > available) throw new Error(`${payer.name ?? "O personagem"} precisa de ${cost} ${physicalImpulse ? "PE" : `PA ${pool.endsWith("generated") ? "refinados" : "da reserva"}`} (${available} disponíveis).`);
    updates[`system.${pool}`] = available - cost;
  }
  return { payer, updates, burst: activationChoices(activity, config.legacy2).pa };
}

/** Buttons update their own input and use the native form change handler. */
export function stepActivationCounter(event, button) {
  const input = button.closest(".jj2-counter")?.querySelector("input");
  if (!input || input.disabled) return;
  input.value = integer(Number(input.value) + Number(button.dataset.step), Number(input.min) || 0, Number(input.max) || 0);
  input.dispatchEvent(new input.ownerDocument.defaultView.Event("change", { bubbles: true }));
}
