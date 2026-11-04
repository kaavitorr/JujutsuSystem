/** Index token documents, not synthetic Actor snapshots, so actor deltas remain live. */
const indexes = new WeakMap(), registered = new WeakSet();
export function invalidateWorldActorIndex(world = game) { indexes.delete(world); }
function index(world) {
  let saved = indexes.get(world);
  if (saved?.scenes === world.scenes) return saved;
  const tokens = [], byBase = new Map();
  for (const scene of world.scenes ?? []) for (const token of scene.tokens ?? []) {
    if (token.actorLink) continue;
    tokens.push(token);
    const key = token.actorId ?? token.baseActor?.id ?? token.baseActor;
    if (!key) continue;
    if (!byBase.has(key)) byBase.set(key, []);
    byBase.get(key).push(token);
  }
  saved = { scenes: world.scenes, tokens, byBase }; indexes.set(world, saved); return saved;
}
export function unlinkedActorsFor(actor, world = game) {
  return new Set((index(world).byBase.get(actor.id ?? actor) ?? []).map(token => token.actor).filter(Boolean));
}
export function worldActors(world = game) {
  return new Set([...(world.actors ?? []), ...index(world).tokens.map(token => token.actor)].filter(Boolean));
}
export function registerWorldActorIndex(hooks = Hooks) {
  if (registered.has(hooks)) return;
  registered.add(hooks);
  const invalidate = () => invalidateWorldActorIndex(game);
  for (const event of ["createScene", "deleteScene", "createToken", "deleteToken"]) hooks.on(event, invalidate);
  hooks.on("updateScene", (scene, changes) => {
    if (Object.keys(changes ?? {}).some(key => key === "tokens" || key.startsWith("tokens."))) invalidate();
  });
  hooks.on("updateToken", (token, changes) => {
    if (["actorId", "actorLink"].some(key => Object.hasOwn(changes ?? {}, key))) invalidate();
  });
}
