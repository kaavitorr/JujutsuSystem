import { HAND_SEALS_ID, HAND_SEALS_VERSION, HAND_SEALS_DESCRIPTION, isHandSeals, isSealPathAbility,
  handSealAbilities, handSealProgressUpdates } from "./legacy2-hand-seals.mjs";
import { updateEnergyShieldTree } from "./legacy2-energy-shield-tree.mjs";
import { updatePhysicalSpecializations, syncImportedPhysicalSpecializations } from "./legacy2-physical-specializations.mjs";
import { refreshCatalogRepairs } from "./catalog-repair-cache.mjs";

const NS = "jujutsu-system", PACK = "jujutsu-compendium.geral-2-0", MARKER = "handSealsRulesVersion";
const pending = new WeakMap();
const editionTwo = world => world.settings?.get(NS, "rulesetVersion") === "2.0";
const activeGM = world => world.user?.isGM && (!world.users?.activeGM || world.users.activeGM.id === world.user.id);
const eligibleActor = (actor, world) => editionTwo(world) && ["character", "npc"].includes(actor?.type) && actor.isOwner !== false;
const canSync = (actor, world, userId) => eligibleActor(actor, world)
  && (world.users?.activeGM ? world.users.activeGM.id === world.user?.id : world.user?.id === userId);
const needsDescription = item => isHandSeals(item) && Number(item.flags?.[NS]?.[MARKER] ?? 0) < HAND_SEALS_VERSION;
const descriptionPatch = () => ({ "system.description.value": HAND_SEALS_DESCRIPTION, [`flags.${NS}.${MARKER}`]: HAND_SEALS_VERSION });

function syncActor(actor, world, options = {}, localImport = false) {
  const previous = pending.get(actor) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    if (!(localImport ? eligibleActor(actor, world) && actor.isOwner : canSync(actor, world, world.user?.id))) return;
    const descriptions = Array.from(actor.items ?? []).filter(needsDescription).map(item => ({ _id: item.id ?? item._id, ...descriptionPatch() }));
    if (descriptions.length) await actor.updateEmbeddedDocuments("Item", descriptions, { handSealsSync: true });
    const updates = handSealProgressUpdates(actor, options);
    if (Object.keys(updates).length) await actor.update(updates, { handSealsSync: true });
  });
  pending.set(actor, task);
  return task.finally(() => { if (pending.get(actor) === task) pending.delete(actor); });
}

/** Foundry JSON imports suppress document hooks; only the importing owner repairs this actor. */
export async function syncImportedHandSeals(actor, world = game) {
  await syncActor(actor, world, {}, true);
  await syncImportedPhysicalSpecializations(actor, world);
  await refreshCatalogRepairs(world, { actors: [actor], ownerImport: true });
}

/** One ready-time pass, never called by sheet rendering or ordinary actor updates. */
export async function refreshHandSealRules(world = game) {
  if (!editionTwo(world) || !activeGM(world)) return;
  const pack = world.packs?.get(PACK), item = await pack?.getDocument(HAND_SEALS_ID);
  if (needsDescription(item)) {
    const locked = pack.locked;
    try { if (locked) await pack.configure({ locked: false }); await item.update(descriptionPatch()); }
    finally { if (locked) await pack.configure({ locked: true }); }
  }
  for (const item of world.items ?? []) if (needsDescription(item)) await item.update(descriptionPatch());
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) for (const token of scene.tokens ?? []) if (!token.actorLink && token.actor) actors.add(token.actor);
  for (const actor of actors) {
    if (!canSync(actor, world, world.user.id)) continue;
    await syncActor(actor, world);
  }
}

export function registerHandSealHooks(hooks = Hooks) {
  const report = error => { console.error("Jujutsu: não foi possível atualizar Selos de Mão.", error);
    ui.notifications.warn("Não foi possível atualizar Selos de Mão. Confira as permissões da ficha e recarregue o mundo."); };
  hooks.on("createActor", (actor, options, userId) => {
    if (canSync(actor, game, userId) && handSealAbilities(actor).hasBase) return syncActor(actor, game).catch(report);
  });
  hooks.on("createItem", (item, options, userId) => {
    const actor = item.parent;
    if (!isSealPathAbility(item) || !canSync(actor, game, userId)) return;
    const previousState = handSealAbilities(actor, { exclude: item });
    return syncActor(actor, game, { previousState, learnedBase: isHandSeals(item) && !previousState.hasBase }).catch(report);
  });
  hooks.on("deleteItem", (item, options, userId) => {
    if (isSealPathAbility(item) && canSync(item.parent, game, userId)) return syncActor(item.parent, game).catch(report);
  });
  hooks.on("updateItem", (item, changes, options, userId) => {
    if (options?.handSealsSync || !canSync(item.parent, game, userId)) return;
    const keys = Object.keys(changes ?? {}), relevant = keys.some(key => key === "name" || key === "system" || key.startsWith("system.identifier")
      || key === "flags" || key.startsWith(`flags.${NS}.especializacao`));
    if (relevant && (isSealPathAbility(item) || item.parent.flags?.[NS]?.handSealsProgress)) return syncActor(item.parent, game).catch(report);
  });
  hooks.once("dnd5e.ready", async () => {
    if (!editionTwo(game) || !activeGM(game)) return;
    try {
      // Existing repairs share this pack. Wait for their pending work before changing its lock.
      await updateEnergyShieldTree(); await updatePhysicalSpecializations();
      await refreshHandSealRules(game);
    } catch (error) { report(error); }
  });
}
