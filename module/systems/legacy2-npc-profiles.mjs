/** NPC profile rules are independent of Foundry document preparation. */
import { npcClassificationKey } from "./legacy2-npc-classification.mjs";

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
