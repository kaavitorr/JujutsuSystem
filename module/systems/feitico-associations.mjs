const SCOPE = "jujutsu-system";

/** Change an unpersisted spell's association without discarding its requirements or other metadata. */
export function setFeiticoAssociation(data, { slot, parent } = {}) {
  const flags = (data.flags ??= {})[SCOPE] ??= {};
  const association = flags.feitico ??= {};
  delete association.slot;
  delete association.parent;
  if (slot !== undefined) association.slot = slot;
  if (parent !== undefined) association.parent = parent;
  return data;
}

function associationUpdate({ item, slot, parent, method }) {
  const update = { _id: item.id };
  for (const [key, value] of Object.entries({ slot, parent })) {
    const path = `flags.${SCOPE}.feitico`;
    if (value !== undefined) update[`${path}.${key}`] = value;
    else if (item.getFlag(SCOPE, `feitico.${key}`) !== undefined) update[`${path}.-=${key}`] = null;
  }
  if (method !== undefined) update["system.method"] = method;
  return update;
}

function matchesAssignment({ item, slot, parent, method }) {
  return item.getFlag(SCOPE, "feitico.slot") === slot
    && item.getFlag(SCOPE, "feitico.parent") === parent
    && (method === undefined || item.system.method === method);
}

/** Update actor spell associations together, restoring them if the operation is rejected or partially applied. */
export async function updateFeiticoAssociations(actor, assignments) {
  if (!assignments.length) return;
  const previous = assignments.map(({ item, method }) => ({
    item,
    slot: item.getFlag(SCOPE, "feitico.slot"),
    parent: item.getFlag(SCOPE, "feitico.parent"),
    ...(method !== undefined ? { method: item.system.method } : {})
  }));
  try {
    await actor.updateEmbeddedDocuments("Item", assignments.map(associationUpdate));
    // Foundry omits unchanged documents from the response; inspect persisted associations instead.
    if (!assignments.every(matchesAssignment)) throw new Error("A atribuição do Feitiço foi cancelada.");
  } catch (error) {
    try {
      await actor.updateEmbeddedDocuments("Item", previous.map(associationUpdate));
      if (!previous.every(matchesAssignment)) throw new Error("A restauração dos vínculos foi cancelada.");
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], "Não foi possível restaurar todos os vínculos do Feitiço.");
    }
    throw error;
  }
}
