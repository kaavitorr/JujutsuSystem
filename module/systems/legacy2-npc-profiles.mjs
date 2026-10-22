/** NPC profile rules are independent of Foundry document preparation. */
import { npcClassificationKey } from "./legacy2-npc-classification.mjs";
import { SKILL_GROUPS } from "./legacy2-skills.mjs";

export const NPC_ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
export const NPC_EQUAL_SCALE = Object.freeze(Object.fromEntries(NPC_ABILITIES.map(key => [key, 2])));
export const NPC_PROFILE_FIELDS = Object.freeze({ taxonomy: "taxonomia", archetype: "arquetipo" });
const creationQueues = new WeakMap();
export function canCreateNpcProfiles(actor, data) {
  return Object.keys(NPC_PROFILE_FIELDS).every(type =>
    Array.from(actor.items ?? []).filter(item => item.type === type).length + data.filter(item => item.type === type).length <= 1);
}
export async function serializeNpcProfileCreation(actor, create) {
  const previous = creationQueues.get(actor) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(create);
  creationQueues.set(actor, pending);
  try { return await pending; }
  finally { if (creationQueues.get(actor) === pending) creationQueues.delete(actor); }
}
export const npcNd = value => Number.isFinite(Number(value)) ? Math.max(1, Math.trunc(Number(value))) : 1;
export const validNpcScale = weights => NPC_ABILITIES.every(key => Number.isInteger(weights?.[key])
  && weights[key] >= 0 && weights[key] <= 12) && NPC_ABILITIES.reduce((sum, key) => sum + weights[key], 0) === 12;

/** Read an owned copy synchronously, including during actor derived-data preparation. */
export function npcProfile(actor, type, config = globalThis.CONFIG?.JUJUTSU ?? {}) {
  const field = NPC_PROFILE_FIELDS[type];
  if (!field) return null;
  const reference = actor?.system?.legacy2?.[field];
  const owned = Array.from(actor?.items ?? []).filter(item => item.type === type);
  const item = owned.find(item => item.id === reference) ?? owned[0];
  if (item) return { ...item.system, label: item.name, item, pesos: item.system.pesos };
  const definition = config[type === "taxonomy" ? "taxonomias" : "arquetipos"]?.[reference];
  return definition ? { ...definition, pesos: definition.pesos ?? NPC_EQUAL_SCALE, key: reference } : null;
}

const proficiencySteps = value => Number.isFinite(Number(value)) ? Math.min(4, Math.max(0, Math.trunc(Number(value)))) : 0;

export const npcProficiencyMode = () => globalThis.game?.settings?.get("jujutsu-system", "regraSalvaguarda") === true
  ? "alternative" : "original";

/** Canonical, validated choices shared by profile editors and NPCs. */
export function npcProficiencyDefinitions(combined = npcProficiencyMode() === "alternative") {
  const skills = SKILL_GROUPS.flatMap(group => group.skills.map(([key, label]) => ({
    id: `skills.${key}`, category: "skills", key, label, kind: "Perícia"
  })));
  const saves = combined ? [["fortitude", "Fortitude"], ["vontade", "Vontade"], ["reflexo", "Reflexo"]]
    : NPC_ABILITIES.map((key, index) => [key, ["Força", "Agilidade", "Constituição", "Intelecto", "Sabedoria", "Presença"][index]]);
  const category = combined ? "alternativeSaves" : "saves";
  return [...skills, ...saves.map(([key, label]) => ({ id: `${category}.${key}`, category, key, label, kind: "Salvaguarda" }))];
}

export function normalizeNpcProficiencyOrder(order, combined = npcProficiencyMode() === "alternative") {
  const valid = new Set(npcProficiencyDefinitions(combined).map(entry => entry.id));
  return [...new Set((Array.isArray(order) ? order : []).filter(id => valid.has(id)))];
}

/** Older direct grants provide suggestions only; no legacy points are added to growth. */
export function npcProfileProficiencyOrder(profile, combined = npcProficiencyMode() === "alternative") {
  const saved = profile?.proficiencyOrder?.[combined ? "alternative" : "original"];
  if (Array.isArray(saved)) return normalizeNpcProficiencyOrder(saved, combined);
  return npcProficiencyDefinitions(combined).map(entry => ({ ...entry,
    weight: proficiencySteps(profile?.proficiencias?.[entry.category]?.[entry.key])
  })).filter(entry => entry.weight > 0).sort((a, b) => b.weight - a.weight).map(entry => entry.id);
}

/** A single budget, interleaving the profiles' suggestions and omitting repeated choices. */
export function npcProficiencyDistribution(actor, combined = npcProficiencyMode() === "alternative") {
  const grants = { skills: {}, saves: {}, alternativeSaves: {} };
  if (actor?.type !== "npc" || globalThis.game?.settings?.get("jujutsu-system", "rulesetVersion") !== "2.0")
    return { order: [], suggested: [], custom: false, budget: 0, allocated: 0, unspent: 0, grants };
  const profiles = ["taxonomy", "archetype"].map(type => npcProfileProficiencyOrder(npcProfile(actor, type), combined));
  const suggested = normalizeNpcProficiencyOrder(Array.from({ length: Math.max(...profiles.map(order => order.length)) },
    (_, index) => profiles.map(order => order[index])).flat(), combined);
  const saved = actor.system?.legacy2?.proficiencyOrder?.[combined ? "alternative" : "original"];
  const custom = Array.isArray(saved), order = custom ? normalizeNpcProficiencyOrder(saved, combined) : suggested;
  const budget = npcNd(actor.system?.legacy2?.nd) - 1;
  const allocated = Math.min(budget, order.length * 4);
  for (let point = 0; point < allocated; point++) {
    const [category, key] = order[point % order.length].split(".");
    grants[category][key] = (grants[category][key] ?? 0) + 1;
  }
  return { order, suggested, custom, budget, allocated, unspent: budget - allocated, grants };
}

/** Automatic ND growth remains separate from freely assigned individual ranks. */
export function npcProficiencyBonus(actor, category, key) {
  if (!["skills", "saves", "alternativeSaves"].includes(category)) return 0;
  return npcProficiencyDistribution(actor).grants[category]?.[key] ?? 0;
}

export function npcProficiencyRank(actor, category, key) {
  return Math.min(4, proficiencySteps(actor?.system?.legacy2?.[category]?.[key]) + npcProficiencyBonus(actor, category, key));
}

/** Highest averages allocate integer points proportionally without removing prior gains.
 * Only six attributes can grow, so runtime is bounded by their remaining capacity. */
function allocate(points, weights, values, gains, { initial = false } = {}) {
  let left = points;
  while (left > 0) {
    let eligible = NPC_ABILITIES.filter(key => values[key] < 12 && weights[key] > 0);
    // Initial points must total twenty, even if all weighted attributes reach twelve.
    const fallback = initial && !eligible.length;
    if (fallback) eligible = NPC_ABILITIES.filter(key => values[key] < 12);
    if (!eligible.length) break;
    let chosen = eligible[0], best = -Infinity;
    for (const key of eligible) {
      const score = initial ? (fallback ? -values[key] : (20 * weights[key] / 12) - values[key])
        : weights[key] / (2 * gains[key] + 1);
      if (score > best) { chosen = key; best = score; }
    }
    values[chosen]++; gains[chosen]++; left--;
  }
  return left;
}

/** Pontos de atributo extra por estado — Elite/Chefe ganham +2/+3 a cada 4
 * NDs ao subir de ND, independentes do arquétipo. */
const EXTRA_ESTADO = Object.freeze({ elite: 2, chefe: 3 });
export const extrasAtributosEstado = (categoria, nd = 1) =>
  (EXTRA_ESTADO[npcClassificationKey(categoria)] ?? 0) * Math.floor(npcNd(nd) / 4);

export function distributeNpcAttributes(taxonomy, archetype, nd = 1, categoria = null) {
  const weights = validNpcScale(taxonomy) ? taxonomy : NPC_EQUAL_SCALE;
  const initial = Object.fromEntries(NPC_ABILITIES.map(key => [key, 1]));
  allocate(14, weights, initial, { ...initial }, { initial: true });
  const values = { ...initial }, growth = Object.fromEntries(NPC_ABILITIES.map(key => [key, 0]));
  const ndFinal = npcNd(nd);
  const pontosEstado = extrasAtributosEstado(categoria, ndFinal);
  const growthPoints = (ndFinal - 1) + pontosEstado;
  const unspent = validNpcScale(archetype) ? allocate(growthPoints, archetype, values, growth) : growthPoints;
  return { initial, growth, values, growthPoints, budget: 20 + growthPoints, unspent, pontosEstado };
}

export function npcAttributeDistribution(actor, config) {
  const taxonomy = npcProfile(actor, "taxonomy", config);
  if (!taxonomy) return null;
  const archetype = npcProfile(actor, "archetype", config);
  return distributeNpcAttributes(taxonomy.pesos, archetype?.pesos, actor.system.legacy2?.nd,
    actor.system.legacy2?.categoria);
}
