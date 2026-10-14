/** Classification of existence defines NPC life and actions, independently of its profiles. */
export const NPC_CLASSIFICATIONS = Object.freeze({
  lacaio: Object.freeze({ label: "Lacaio", hpMultiplier: 0.5, actions: 4 }),
  normal: Object.freeze({ label: "Normal", hpMultiplier: 1, actions: 6 }),
  elite: Object.freeze({ label: "Elite", hpMultiplier: 1.5, actions: 8 }),
  chefe: Object.freeze({ label: "Chefe", hpMultiplier: 2, actions: 10 })
});
export function npcClassificationKey(value) {
  const key = value === "lacain" ? "lacaio" : value;
  return Object.hasOwn(NPC_CLASSIFICATIONS, key) ? key : "normal";
}
export const npcClassification = actor => NPC_CLASSIFICATIONS[npcClassificationKey(actor?.system?.legacy2?.categoria)];
const currentActions = (value, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Math.floor(Number(value)))) : max;

/** Derived maximum and bounds only: rendering never recovers spent actions. */
export function prepareNpcClassificationActions(system) {
  const rules = system.legacy2 ??= {}, classification = npcClassification({ system });
  const actions = rules.actions ??= { value: classification.actions };
  actions.max = classification.actions;
  actions.value = currentActions(actions.value, actions.max);
}

/** Change the round budget while retaining the number of actions already spent. */
export function npcClassificationActionUpdate(actor, changedRules) {
  if (!changedRules || !Object.hasOwn(changedRules, "categoria")) return null;
  const previous = npcClassification(actor).actions;
  const max = NPC_CLASSIFICATIONS[npcClassificationKey(changedRules.categoria)].actions;
  const spent = previous - currentActions(actor.system.legacy2?.actions?.value, previous);
  const value = Object.hasOwn(changedRules.actions ?? {}, "value") ? changedRules.actions.value : max - spent;
  return { max, value: currentActions(value, max) };
}
