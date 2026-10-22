import { npcProficiencyDefinitions, npcProficiencyDistribution, npcProficiencyMode,
  npcProfileProficiencyOrder } from "../../../systems/legacy2-npc-profiles.mjs";

/** The same ordered-list editor is used for profile suggestions and the NPC's final order. */
export function proficiencyOrderContext(order, { profile = false, custom = false, grants, ...growth } = {}) {
  const definitions = npcProficiencyDefinitions(), selected = new Set(order);
  return { ...growth, profile, custom,
    entries: order.map((id, index) => {
      const entry = definitions.find(entry => entry.id === id);
      return { ...entry, n: index + 1, first: index === 0, last: index === order.length - 1,
        granted: grants?.[entry.category]?.[entry.key] ?? 0 };
    }),
    choices: definitions.filter(entry => !selected.has(entry.id)),
    canAdd: selected.size < definitions.length
  };
}

/** Persist only the active rule's order; manual ranks and the other save rule stay intact. */
export async function updateNpcProficiencyOrder(sheet, target) {
  if (!sheet.isEditable || !sheet.isEditMode) return;
  const profile = ["taxonomy", "archetype"].includes(sheet.item?.type), document = profile ? sheet.item : sheet.actor;
  if (!document || (!profile && (document.type !== "npc"
    || game.settings.get("jujutsu-system", "rulesetVersion") !== "2.0"))) return;
  const mode = npcProficiencyMode(), command = target.dataset.command;
  const order = profile ? npcProfileProficiencyOrder(document.system) : npcProficiencyDistribution(document).order;
  if (command === "reset") return document.update({
    [`system.${profile ? "" : "legacy2."}proficiencyOrder.${mode}`]: profile ? [] : null
  });
  if (command === "add") {
    const id = target.closest("[data-proficiency-editor]")?.querySelector("[data-proficiency-choice]")?.value;
    if (!npcProficiencyDefinitions().some(entry => entry.id === id) || order.includes(id)) return;
    order.push(id);
  } else {
    const index = order.indexOf(target.dataset.id);
    if (index < 0) return;
    if (command === "remove") order.splice(index, 1);
    else if (["up", "down"].includes(command)) {
      const next = index + (command === "up" ? -1 : 1);
      if (next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
    } else return;
  }
  return document.update({ [`system.${profile ? "" : "legacy2."}proficiencyOrder.${mode}`]: order });
}
