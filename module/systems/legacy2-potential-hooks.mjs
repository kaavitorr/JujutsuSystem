import { isBodyPathAbility, syncPotentialPoints } from "./legacy2-potential-points.mjs";

/** Only item learning/editing events synchronize capacity; ordinary actor updates do no work. */
export function registerPotentialPointsHooks(hooks = Hooks) {
  const allowed = (actor, userId) => actor?.isOwner === true && (game.users?.activeGM
    ? game.users.activeGM.id === game.user?.id : game.user?.id === userId);
  const sync = actor => syncPotentialPoints(actor).catch(error => {
    console.error("Jujutsu: não foi possível configurar Pontos de Potencial.", error);
    ui.notifications.warn("Não foi possível configurar Pontos de Potencial. Recarregue o mundo para tentar novamente.");
  });
  hooks.on("createActor", (actor, options, userId) => { if (allowed(actor, userId)) return sync(actor); });
  for (const event of ["createItem", "deleteItem"]) hooks.on(event, (item, options, userId) => {
    if (isBodyPathAbility(item) && allowed(item.parent, userId)) return sync(item.parent);
  });
  hooks.on("updateItem", (item, changes, options, userId) => {
    if (options?.potentialPointsSync || !allowed(item.parent, userId)) return;
    const relevant = changes?.system?.identifier !== undefined || changes?.flags?.["jujutsu-system"]?.especializacao !== undefined
      || Object.keys(changes ?? {}).some(key => key === "name" || key.startsWith("system.identifier")
        || key.startsWith("flags.jujutsu-system.especializacao"));
    if (relevant) return sync(item.parent);
  });
}
