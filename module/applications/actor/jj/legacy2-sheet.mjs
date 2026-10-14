/** Presentation data for the 2.0 sheet. No Foundry globals or document mutations. */
import { WEAPON_GROUPS, weaponGroupRank } from "../../../systems/legacy2-proficiencies.mjs";
import { extraResourceCards } from "./legacy2-extra-resources.mjs";
import { baseEngagement, engagementValue } from "../../../systems/engagement.mjs";
import { prepareNpcClassificationActions } from "../../../systems/legacy2-npc-classification.mjs";import { resistanceCards } from "../../../systems/legacy2-resistances.mjs";
export { WEAPON_GROUPS, weaponGroupRank };
export const SKILL_GROUPS = [
  { label: "Exploração", icon: "movement", skills: [
    ["ath", "Atletismo", "str"], ["acr", "Coordenação", "dex"], ["prc", "Percepção", "wis"],
    ["ste", "Furtividade", "dex"], ["sur", "Sobrevivência", "wis"]
  ] },
  { label: "Conhecimento", icon: "int", skills: [
    ["arc", "Feitiçaria", "int"], ["rel", "Medicina", "wis"], ["inv", "Investigação", "int"],
    ["his", "História", "int"], ["ani", "Sobrenatural", "wis"]
  ] },
  { label: "Influência", icon: "cha", skills: [
    ["dec", "Enganação", "cha"], ["per", "Persuasão", "cha"], ["itm", "Intimidação", "cha"],
    ["prf", "Atuação", "cha"], ["luc", "Sorte", "cha"]
  ] }
];

export const LEGACY2_TABS = [
  ["details", "Resumo"], ["inventory", "Inventário"], ["feitico", "Feitiço"], ["spells", "Técnicas"], ["skills", "Perícias"],
  ["features", "Características"], ["effects", "Efeitos"], ["biography", "Personalização"]
];

export const LEGACY2_TAB_ICONS = {
  details: "summary", feitico: "str", spells: "energy", skills: "dice", features: "tree",
  inventory: "inventory", effects: "effects", biography: "personalization"
};

const bounded = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const rankOf = value => Math.floor(bounded(value, 0, 4));
const percent = (value, max) => max > 0 ? bounded(100 * value / max, 0, 100) : 0;

/** Actions climb the left side first, then the right; both sides remain open at top and bottom. */
function actionRingGeometry(index, max) {
  const leftCount = Math.ceil(max / 2), leftSide = index < leftCount;
  const count = leftSide ? leftCount : max - leftCount;
  const step = leftSide ? index : index - leftCount;
  const span = 130 / count, gap = Math.min(13, span * 0.42);
  const start = leftSide ? -155 + step * span + gap / 2 : 155 - (step + 1) * span + gap / 2;
  const end = leftSide ? -155 + (step + 1) * span - gap / 2 : 155 - step * span - gap / 2;
  const point = (angle, radius) => {
    const radians = angle * Math.PI / 180;
    return [50 + Math.sin(radians) * radius, 50 - Math.cos(radians) * radius]
      .map(value => Number(value.toFixed(3)));
  };
  const width = Math.min(7.5, gap * 0.6);
  const outer = Number((39.5 + width / 2).toFixed(3)), inner = Number((39.5 - width / 2).toFixed(3));
  const cut = Math.min(2.5, gap / 4);
  const outerStart = point(start - cut, outer), outerEnd = point(end - cut, outer);
  const innerEnd = point(end + cut, inner), innerStart = point(start + cut, inner);
  const path = `M${outerStart}A${outer},${outer} 0 0 1 ${outerEnd}L${innerEnd}A${inner},${inner} 0 0 0 ${innerStart}Z`;
  const hitStart = start - gap / 2 + 1, hitEnd = end + gap / 2 - 1;
  const points = [];
  const steps = Math.max(4, Math.ceil((hitEnd - hitStart) / 5));
  for (let n = 0; n <= steps; n++) points.push(point(hitStart + (hitEnd - hitStart) * n / steps, 46));
  for (let n = steps; n >= 0; n--) points.push(point(hitStart + (hitEnd - hitStart) * n / steps, 30));
  return { ringPath: path, ringWidth: Number(width.toFixed(3)),
    ringClip: `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(",")})` };
}

/**
 * Máximo de Pontos de Ação exibido no anel, para PJ e NPC. Fonte única: o
 * máximo PREPARADO do ator (system.legacy2.actions.max) — para NPC a
 * preparação o semeia a partir da classificação, e os efeitos das Condições
 * (ADD −4/−2/−1/+2, OVERRIDE 0) já estão aplicados nele. NÃO somar nem
 * subtrair nada por status aqui: os efeitos já fizeram — repetir é dupla
 * contagem e trava os Pontos de Ação em zero.
 * @param actor
 */
export function legacy2ActionMax(actor) {
  let max = Number(actor?.system?.legacy2?.actions?.max ?? 6);
  max = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 6;
  return max;
}

/**
 * Teto efetivo de Pontos de Ação (pips, corte imediato e restauração).
 * Espelha o anel; Paralisado reforça o zero para cobrir aplicações sem
 * changes. A redução das Condições de Ações vive EXCLUSIVAMENTE nos efeitos
 * (ADD no máximo preparado) — nunca subtrair por status aqui.
 * @param actor
 */
export function acoesTetoEfetivo(actor) {
  if ( actor?.statuses?.has?.("jj-paralisado") ) return 0;
  return legacy2ActionMax(actor);
}

/**
 * Resolve the actor's owned species even when an older sheet left a stale race reference.
 * @param actor
 */
export function legacy2Species(actor) {
  const races = actor.itemTypes?.race ?? Array.from(actor.items ?? []).filter(item => item.type === "race");
  const references = [actor.system.details?.race, actor._source?.system?.details?.race];
  for ( const reference of references ) {
    const key = typeof reference === "string" ? reference : reference?.id ?? reference?._id;
    if ( !key ) continue;
    const selected = races.find(item => item.id === key || item.uuid === key);
    if ( selected ) return selected;
  }
  return races.at(-1) ?? null;
}

/**
 * Validate and price the actual data change, including old weapon aliases being consolidated.
 * @param actor
 * @param category
 * @param key
 * @param rank
 * @param ruleset
 * @param abilities
 */
export function prepareRankUpdate(actor, category, key, rank, ruleset, abilities) {
  if ( !["skills", "saves", "armas"].includes(category) || !Number.isInteger(rank) || rank < 0 || rank > 4 ) return null;
  const keys = category === "skills" ? SKILL_GROUPS.flatMap(group => group.skills.map(([id]) => id))
    : category === "armas" ? WEAPON_GROUPS.map(group => group.key) : Object.keys(abilities);
  if ( !keys.includes(key) ) return null;
  const l2 = actor.system.legacy2 ?? {};
  const group = { ...l2[category], [key]: rank };
  const aliases = category === "armas" ? WEAPON_GROUPS.find(g => g.key === key).aliases : [];
  if ( rankOf(l2[category]?.[key]) === rank && !aliases.some(alias => alias in (l2[category] ?? {})) ) return null;
  const update = { [`system.legacy2.${category}`]: group };
  for ( const alias of aliases ) {
    delete group[alias];
    update[`system.legacy2.armas.-=${alias}`] = null;
  }
  const sum = values => Object.values(values ?? {}).reduce((total, value) => total + rankOf(value), 0);
  const spent = ["skills", "saves", "armas"].reduce((total, ctx) => total + sum(ctx === category ? group : l2[ctx]), 0);
  const previous = ["skills", "saves", "armas"].reduce((total, ctx) => total + sum(l2[ctx]), 0);
  // NPC ranks remain freely configurable, as with their former numeric rank fields.
  if ( actor.type !== "npc" && spent - previous > ruleset.trainingPointsAvailable(actor) ) return { insufficient: true };
  update["system.legacy2.pontos.gastos"] = spent;
  return { update };
}

/**
 * Build independent part contexts so sidebar and partial renders never depend on another part.
 * @param actor
 * @param config
 * @param ruleset
 */
export function buildLegacy2Context(actor, config, ruleset) {
  const system = actor.system;
  const l2 = system.legacy2 ?? {};
  const abilityConfig = config.abilities;
  const style = ruleset.estilo(actor);
  const principalKey = ruleset.atributoPrincipal(actor);
  const principalKeys = Array.isArray(style?.atributoPrincipal)
    ? style.atributoPrincipal : style?.principalEscolhivel && style.atributoPrincipal === "str" ? ["str", "dex"]
      : style?.atributoPrincipal ? [style.atributoPrincipal] : [];
  const classItem = actor.itemTypes?.class?.find(item => !!item.getFlag("jujutsu-system", "legacy2"));
  const abilities = Object.entries(abilityConfig).map(([key, cfg]) => ({
    key, label: cfg.label, abbr: cfg.abbreviation,
    value: system.abilities[key]?._source?.value ?? system.abilities[key]?.value ?? 1,
    principal: key === principalKey
  }));
  const saves = abilities.map(ability => {
    const rank = rankOf(l2.saves?.[ability.key]);
    return { ...ability, rank, rankLabel: ruleset.rankLabel(rank),
      total: Number(system.abilities[ability.key]?.value ?? 1) + ruleset.rankBonus(rank) };
  });
  // Orçamento de atributos (2.0): 20 + 1 por nível a partir do 2º
  // + Atributos adicionais da Origem (flag viva no item race).
  // Soma acima do orçamento = algo errado na distribuição.
  const orcamentoAtributos = 20 + Math.max(0, ruleset.nivel(actor) - 1) + ruleset.atributosAdicionais(actor);
  const somaAtributos = abilities.reduce((total, ability) => total + (Number(ability.value) || 0), 0);
  const skillGroups = SKILL_GROUPS.map(group => ({
    label: group.label, icon: group.icon,
    skills: group.skills.map(([key, label, defaultAbility]) => {
      const ability = key === "inv" && ["wis", "int"].includes(system.skills?.[key]?.ability)
        ? system.skills[key].ability : defaultAbility;
      const rank = rankOf(l2.skills?.[key]);
      return { key, label, ability, abilityAbbr: abilityConfig[ability]?.abbreviation ?? ability,
        rank, rankLabel: ruleset.rankLabel(rank),
        total: Number(system.abilities[ability]?.value ?? 1) + ruleset.rankBonus(rank) };
    })
  }));
  const hpMax = Math.max(0, Number(system.attributes.hp.max) || 0);
  const woundsMax = 2 * hpMax;
  const woundsValue = bounded(l2.wounds?.value, 0, woundsMax);
  const actionsMax = legacy2ActionMax(actor);
  const actionsValue = bounded(l2.actions?.value ?? 6, 0, actionsMax);
  const isRestringido = ruleset.isRestringido?.(actor) ?? false;
  const refinement = isRestringido ? ruleset.staminaMax(actor) : Math.max(0, 2 * ruleset.nivel(actor));
  const energyAvailable = Math.max(0, Number(system.energy?.generated) || 0);
  const movement = system.attributes.movement ?? {};
  const movementValues = Object.entries(movement.speeds ?? {}).filter(([key]) => !config.movementTypes?.[key]?.hidden)
    .map(([, value]) => Math.max(0, Number(value) || 0));
  return {
    creationPending: actor.type === "character" && actor.isOwner && !(actor.items?.size ?? actor.items?.length ?? 0)
      && !actor.getFlag?.("jujutsu-system", "creation2")?.completed,
    engagement: engagementValue(actor),
    engagementBase: actor._source?.system?.legacy2?.engagement ?? baseEngagement(actor),
    species: legacy2Species(actor),
    extraResources: extraResourceCards(actor),
    resistances: resistanceCards(actor),
    intensiveTraining: {
      maxEnergy: Math.max(0, Number(system.energy?.intensiveTraining?.maxEnergy) || 0),
      generatedEnergy: Math.max(0, Number(system.energy?.intensiveTraining?.generatedEnergy) || 0),
      energyBonus: Math.max(0, Number(system.energy?.intensiveTraining?.maxEnergy) || 0) * (style?.energiaBase ?? 10)
    },
    abilities, saves, skillGroups, skills: skillGroups.flatMap(group => group.skills),
    armas: WEAPON_GROUPS.map(group => {
      const rank = weaponGroupRank(l2.armas, group.key);
      return { ...group, rank, rankLabel: ruleset.rankLabel(rank), bonus: ruleset.rankBonus(rank) };
    }),
    rankDots: Array.from({ length: 5 }, (_, rank) => ({ rank, label: ruleset.rankLabel(rank) })),
    estiloNome: classItem?.name ?? null, estiloItem: classItem ?? null, estiloInfo: style, principalKey,
    principalLabel: abilityConfig[principalKey]?.label ?? "—",
    escolhivel: principalKeys.length > 1,
    principais: principalKeys.map(value => ({ value, label: abilityConfig[value]?.label ?? value })),
    principalEscolhido: l2.principalEscolhido ?? principalKeys[0] ?? null,
    pontos: { total: ruleset.trainingPointsTotal(actor), available: ruleset.trainingPointsAvailable(actor),
      extra: Number(l2.pontos?.extra ?? 0) },
    pvEspecie: Number(l2.pvEspecie ?? 0),
    atributos: { soma: somaAtributos, orcamento: orcamentoAtributos,
      excesso: Math.max(0, somaAtributos - orcamentoAtributos), pct: percent(somaAtributos, orcamentoAtributos) },
    wounds: { value: woundsValue, max: woundsMax, pct: percent(woundsValue, woundsMax) },
    explosaoLimite: Math.ceil(ruleset.nivel(actor) / 2),
    impulsoLimite: isRestringido ? ruleset.physicalImpulseLimit(actor) : 0,
    impulsoDados: isRestringido ? 2 * ruleset.physicalImpulseLimit(actor) : 0,
    actions: { value: actionsValue, max: actionsMax, restoreLabel: `Restaurar ${actionsMax} Pontos de Ação`,
      pips: Array.from({ length: actionsMax }, (_, n) => ({
        n: n + 1, filled: n < actionsValue, value: n + 1 === actionsValue ? n : n + 1,
        ...actionRingGeometry(n, actionsMax)
      })) },
    hpPct: percent(system.attributes.hp.value, Number(system.attributes.hp.effectiveMax) || hpMax),
    energyPct: percent(system.energy?.total, Number(system.energy?.max) || 0),
    isRestringido, energyAvailable, refinement, refinementPct: percent(energyAvailable, refinement),
    movement: { value: Math.max(0, ...movementValues),
      unit: config.movementUnits?.[movement.units]?.abbreviation ?? movement.units ?? "m" }
  };
}
