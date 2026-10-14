/** Engagement shared by the 2.0 actor data, summary and flanking calculation. */
const NPC_BASE = Object.freeze({ tiny: 1, sm: 1, med: 1, lg: 2, huge: 3, garg: 4 });

export function baseEngagement(actor) {
  return actor.type === "npc" ? NPC_BASE[actor.system.traits?.size] ?? 1 : 2;
}

/** Resolve automatic NPC values before Active Effects, without changing stored overrides. */
export function prepareEngagement(system, type) {
  if ( system.legacy2 && system.legacy2.engagement == null ) {
    system.legacy2.engagement = baseEngagement({ system, type });
  }
}

/** Use prepared data so an effect changes both the displayed value and combat behavior. */
export function engagementValue(actor) {
  const value = Number(actor.system.legacy2?.engagement ?? baseEngagement(actor));
  const base = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : baseEngagement(actor);
  // Envolvente: arma equipada com a propriedade aumenta o Valor de Engajamento em +1.
  const envolvente = (actor.itemTypes?.weapon ?? []).some(w =>
    w.system?.equipped && (typeof w.system.properties?.has === "function"
      ? w.system.properties.has("env") : !!w.system.properties?.env));
  return base + (envolvente ? 1 : 0);
}
