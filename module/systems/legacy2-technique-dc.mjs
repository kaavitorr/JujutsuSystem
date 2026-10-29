/** The common 2.0 technique DC uses the prepared, whole principal attribute. */
export function techniqueDifficulty(actor, ruleset) {
  const ability = actor.type === "npc" ? ruleset.npcPrincipal(actor) : ruleset.atributoPrincipal(actor);
  const raw = Number(actor.system.abilities?.[ability]?.value);
  const attribute = Number.isFinite(raw) ? raw : 0;
  return { ability, attribute, value: 10 + attribute };
}
