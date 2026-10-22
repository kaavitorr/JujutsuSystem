import { npcNd, npcProfile } from "./legacy2-npc-profiles.mjs";

export const NPC_MOVEMENT_TYPES = Object.freeze([
  ["walk", "Caminhada"], ["swim", "Natação"], ["fly", "Voo"], ["climb", "Escalada"], ["burrow", "Escavação"]
]);
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

/** Milestones occur at ND 2/4/6 for interval 2; ND 1 always retains the initial speed. */
export function npcMovementGrowth(definition, nd) {
  const interval = Math.max(1, Math.trunc(nonnegative(definition?.intervalo)) || 1);
  const steps = interval === 1 ? npcNd(nd) - 1 : Math.floor(npcNd(nd) / interval);
  return steps * nonnegative(definition?.ganho);
}

/** Seed movement before Active Effects and native conditions, never modifying saved speeds. */
export function prepareNpcProfileMovement(actor, convertLength) {
  const movement = actor.system.attributes.movement;
  delete movement.fromNpcProfile;
  const taxonomy = npcProfile(actor, "taxonomy")?.movimento;
  const archetype = npcProfile(actor, "archetype")?.movimento;
  if (!taxonomy && !archetype) return;
  const growth = npcMovementGrowth(archetype, actor.system.legacy2?.nd);
  const limit = archetype?.maximo == null ? Infinity : nonnegative(archetype.maximo);
  const units = movement.units ?? "m";
  for (const [type] of NPC_MOVEMENT_TYPES) {
    const configured = taxonomy?.[type];
    // Blank modes retain the creature's individual speed; zero explicitly disables the mode.
    const source = actor.system._source?.attributes?.movement?.speeds?.[type] ?? movement.speeds[type] ?? 0;
    if (configured == null && !growth && !Number.isFinite(limit)) continue;
    const base = configured == null ? nonnegative(convertLength(Number(source) || 0, units, "m")) : nonnegative(configured);
    const total = base > 0 ? Math.min(base + growth, limit) : 0;
    movement.speeds[type] = convertLength(total, "m", units);
    (movement.fromNpcProfile ??= {})[type] = movement.speeds[type];
  }
}
