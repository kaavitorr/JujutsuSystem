import { registerWorldActorIndex, worldActors } from "./world-actor-index.mjs";

const states = new WeakMap(), repairs = new Map(), registered = new WeakSet();
const activeGM = world => !!world.user?.isGM && world.users?.activeGM?.id === world.user.id;
const scoped = scope => scope?.items !== undefined || scope?.actors !== undefined;
const ownerOf = item => item?.actor ?? (item?.parent?.items ? item.parent : null);
const ownedItem = item => item?.isOwner === true || ownerOf(item)?.isOwner === true;
const packName = pack => typeof pack === "string" ? pack : pack?.collection ?? pack?.metadata?.id;
const stateFor = world => {
  let state = states.get(world);
  if (!state) states.set(world, state = { reads: new Map(), runs: new Map(), targets: null });
  return state;
};

/** Full-world repair belongs to the active GM; JSON import may repair only owned targets. */
export function canRunCatalogRepair(world, scope = {}) {
  if (activeGM(world)) return true;
  return scope.ownerImport === true && scoped(scope) && (Array.from(scope.actors ?? []).some(actor => actor?.isOwner === true)
    || Array.from(scope.items ?? []).some(ownedItem));
}

/** Share pending and successful reads without cloning the live source Documents. Failed reads are retryable. */
export function catalogRepairDocuments(world, id) {
  const state = stateFor(world), pack = world.packs?.get(id);
  const saved = state.reads.get(id);
  if (saved && saved.pack === pack) return saved.promise;
  const entry = { pack };
  entry.promise = Promise.resolve().then(() => pack?.getDocuments() ?? []).catch(error => {
    if (state.reads.get(id) === entry) state.reads.delete(id);
    throw error;
  });
  state.reads.set(id, entry);
  return entry.promise;
}

/** Register a repair for directed imports and catalog invalidation. Returns an unregister function. */
export function registerCatalogRepair(key, { packs, refresh }) {
  const repair = { packs: new Set(packs), refresh };
  repairs.set(key, repair);
  return () => { if (repairs.get(key) === repair) repairs.delete(key); };
}

function stamp(world, key) {
  return [world.items, world.actors, world.scenes, world.packs,
    ...Array.from(repairs.get(key)?.packs ?? [], id => world.packs?.get(id))];
}
const sameStamp = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Complete full-world passes once per catalog state and share concurrent invocations. */
export function runCatalogRepair(world, key, callback, scope = {}) {
  if (!canRunCatalogRepair(world, scope)) return Promise.resolve();
  if (scoped(scope)) return Promise.resolve().then(callback).catch(error => {
    stateFor(world).runs.delete(key);
    throw error;
  });
  const state = stateFor(world), current = stamp(world, key), saved = state.runs.get(key);
  if (saved && sameStamp(saved.stamp, current)) return saved.promise;
  const entry = { stamp: current };
  entry.promise = Promise.resolve().then(callback).catch(error => {
    if (state.runs.get(key) === entry) state.runs.delete(key);
    throw error;
  });
  state.runs.set(key, entry);
  return entry.promise;
}

/** Group live Item references by owner so batch writes retain the native document APIs. */
export function catalogRepairGroups(world, scope = {}) {
  const ownerImport = scope.ownerImport === true;
  if (scoped(scope)) {
    const groups = new Map(), seen = new Set();
    const add = (item, actor = ownerOf(item)) => {
      if (!item || seen.has(item) || ownerImport && !(actor ? actor.isOwner === true : ownedItem(item))) return;
      seen.add(item);
      if (!groups.has(actor)) groups.set(actor, []);
      groups.get(actor).push(item);
    };
    for (const item of scope.items ?? []) add(item);
    for (const actor of new Set(scope.actors ?? [])) {
      if (ownerImport && actor?.isOwner !== true) continue;
      for (const item of actor?.items ?? []) add(item, actor);
    }
    return groups;
  }
  const state = stateFor(world), refs = [world.items, world.actors, world.scenes];
  if (state.targets && sameStamp(state.targets.refs, refs)) return state.targets.groups;
  const groups = new Map([[null, Array.from(world.items ?? [])]]);
  for (const actor of worldActors(world)) groups.set(actor, Array.from(actor.items ?? []));
  state.targets = { refs, groups };
  return groups;
}

/** Items are document references, never serialized snapshots of editable data. */
export function catalogRepairItems(world, scope = {}) {
  return [...new Set(Array.from(catalogRepairGroups(world, scope).values()).flat())];
}

/** Invalidate dependent repair results; target-only changes need no new catalog read. */
export function invalidateCatalogRepairs(world, { pack, targetsOnly = false } = {}) {
  const state = stateFor(world), id = packName(pack);
  state.targets = null;
  if (targetsOnly) return;
  if (!id) { state.reads.clear(); state.runs.clear(); return; }
  state.reads.delete(id);
  for (const [key, repair] of repairs) if (repair.packs.has(id)) state.runs.delete(key);
}

/** Explicit scopes are used by the importFromJSON bridge, which does not emit Item creation hooks. */
export async function refreshCatalogRepairs(world, scope = {}) {
  if (!canRunCatalogRepair(world, scope)) return;
  if (scoped(scope)) invalidateCatalogRepairs(world, { targetsOnly: true });
  const packs = scope.packs ? new Set(scope.packs.map(packName)) : null;
  await Promise.all(Array.from(repairs.values()).filter(repair => !packs || [...repair.packs].some(id => packs.has(id)))
    .map(repair => repair.refresh(world, scope)));
}

const repairFields = ["name", "type", "img", "effects", "system.description", "system.identifier", "_stats.compendiumSource",
  "flags.core.sourceId", "flags.jujutsu-system.flawAutomation", "flags.jujutsu-system.cursedBenefitAutomation1",
  "flags.jujutsu-system.seresAmaldicoados1", "flags.jujutsu-system.encyclopedia", "flags.jujutsu-system.npcProfileFeature"];
function changePaths(changes, prefix = "") {
  return Object.entries(changes ?? {}).flatMap(([key, value]) => {
    const path = (prefix ? `${prefix}.${key}` : key).replace(/(^|\.)-=/g, "$1");
    return value && typeof value === "object" && Object.keys(value).length ? changePaths(value, path) : [path];
  });
}
const relevantPath = path => repairFields.some(field => path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`));
const relevantItemChange = changes => changePaths(changes).some(relevantPath);
const relevantEmbeddedChange = (changes, prefix) => changePaths(changes).some(path => {
  if (path === prefix) return true;
  if (!path.startsWith(`${prefix}.`)) return false;
  const itemPath = path.slice(prefix.length + 1).replace(/^[^.]+\.?/, "");
  return !itemPath || relevantPath(itemPath);
});
const relevantTokenChange = changes => changePaths(changes).some(path => ["actorId", "actorLink"].includes(path)
  || path === "delta.effects" || path.startsWith("delta.effects.")
  || path.startsWith("delta.flags.") && relevantPath(path.slice(6))) || relevantEmbeddedChange(changes, "delta.items");

/** Hook-triggered repairs run once on the active GM, or locally for an owner while no GM is connected. */
export function registerCatalogRepairHooks(hooks = Hooks) {
  if (registered.has(hooks)) return;
  registered.add(hooks);
  registerWorldActorIndex(hooks);
  const allowed = userId => activeGM(game) || !game.users?.activeGM && userId === game.user?.id;
  const run = (scope, userId) => {
    if (!allowed(userId)) return;
    return refreshCatalogRepairs(game, { ...scope, ownerImport: scoped(scope) }).catch(error => {
      console.error("Jujutsu: falha ao reparar os itens importados.", error);
    });
  };
  const changedPack = (pack, userId) => {
    const id = packName(pack);
    if (!id || ![...repairs.values()].some(repair => repair.packs.has(id))) return;
    invalidateCatalogRepairs(game, { pack: id });
    return run({ packs: [id] }, userId);
  };
  hooks.on("createItem", (item, options, userId) => {
    if (options?.jjCatalogRepair) return;
    if (item.pack) return changedPack(item.pack, userId);
    invalidateCatalogRepairs(game, { targetsOnly: true });
    return run({ items: [item] }, userId);
  });
  hooks.on("updateItem", (item, changes, options, userId) => {
    if (options?.jjCatalogRepair || !relevantItemChange(changes)) return;
    if (item.pack) return changedPack(item.pack, userId);
    return run({ items: [item] }, userId);
  });
  hooks.on("deleteItem", (item, options, userId) => {
    if (options?.jjCatalogRepair) return;
    if (item.pack) return changedPack(item.pack, userId);
    invalidateCatalogRepairs(game, { targetsOnly: true });
  });
  hooks.on("createActor", (actor, options, userId) => {
    if (options?.jjCatalogRepair) return;
    invalidateCatalogRepairs(game, { targetsOnly: true });
    return run({ actors: [actor] }, userId);
  });
  hooks.on("updateActor", (actor, changes, options, userId) => {
    if (options?.jjCatalogRepair || !relevantEmbeddedChange(changes, "items")) return;
    invalidateCatalogRepairs(game, { targetsOnly: true });
    return run({ actors: [actor] }, userId);
  });
  hooks.on("deleteActor", () => invalidateCatalogRepairs(game, { targetsOnly: true }));
  hooks.on("createToken", (token, _options, userId) => {
    invalidateCatalogRepairs(game, { targetsOnly: true });
    if (!token.actorLink && token.actor) return run({ actors: [token.actor] }, userId);
  });
  hooks.on("updateToken", (token, changes, _options, userId) => {
    if (!relevantTokenChange(changes)) return;
    invalidateCatalogRepairs(game, { targetsOnly: true });
    if (!token.actorLink && token.actor) return run({ actors: [token.actor] }, userId);
  });
  for (const event of ["deleteToken", "deleteScene"]) hooks.on(event, () => invalidateCatalogRepairs(game, { targetsOnly: true }));
  const sceneScope = (scene, userId) => {
    invalidateCatalogRepairs(game, { targetsOnly: true });
    return run({ actors: Array.from(scene.tokens ?? []).filter(token => !token.actorLink).map(token => token.actor).filter(Boolean) }, userId);
  };
  hooks.on("createScene", (scene, _options, userId) => sceneScope(scene, userId));
  hooks.on("updateScene", (scene, changes, _options, userId) => {
    if (Object.keys(changes ?? {}).some(key => key === "tokens" || key.startsWith("tokens."))) return sceneScope(scene, userId);
  });
  hooks.on("updateCompendium", (pack, changes, options, userId) => {
    if (options?.jjCatalogRepair) return;
    if (Object.keys(changes ?? {}).length && Object.keys(changes).every(key => ["locked", "ownership", "sort"].includes(key))) return;
    return changedPack(pack, userId);
  });
  for (const event of ["createCompendium", "deleteCompendium"]) hooks.on(event, (pack, _options, userId) => changedPack(pack, userId));
}
