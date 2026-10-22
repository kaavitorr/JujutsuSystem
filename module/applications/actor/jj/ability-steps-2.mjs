import Ruleset from "../../../systems/ruleset.mjs";

const queues = new WeakMap();
const editable = sheet => Ruleset.isV2() && sheet.isEditable && sheet.isEditMode && sheet.actor?.type === "character";

/** Serialize clicks and read the saved base again after each update, preserving effect bonuses. */
export async function stepPlayerAbility(sheet, target) {
  if (!editable(sheet)) return;
  const actor = sheet.actor, key = target.dataset.ability, step = Number(target.dataset.step);
  if (!["str", "dex", "con", "int", "wis", "cha"].includes(key) || ![-1, 1].includes(step)
    || !actor.system.abilities?.[key]) return;
  const pending = (queues.get(actor) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (!editable(sheet)) return;
    const field = actor.system.abilities[key];
    const current = Number(field._source?.value ?? actor.system._source?.abilities?.[key]?.value
      ?? actor._source?.system?.abilities?.[key]?.value ?? field.value);
    if (!Number.isInteger(current)) return;
    const value = current + step;
    if (value < 1 || value > 12) return;
    return actor.update({ [`system.abilities.${key}.value`]: value });
  });
  queues.set(actor, pending);
  try { return await pending; }
  finally { if (queues.get(actor) === pending) queues.delete(actor); }
}
