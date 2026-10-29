import { npcNd, npcProfile } from "./legacy2-npc-profiles.mjs";

const FLAG = "npcProfileFeature";
const queues = new WeakMap();

const DAMAGE_SCALE = [[1, "1d4"], [2, "1d6"], [4, "1d8"], [6, "1d10"], [8, "1d12"],
  [10, "2d8"], [12, "3d6"], [14, "2d10"], [16, "3d8"], [18, "3d10"], [20, "4d8"],
  [22, "3d12"], [26, "5d8"], [28, "4d12"], [30, "5d10"]];

/** Current values, rather than fixed numbers baked into a copied compendium feature. */
export function npcFeatureRollData(actor, principal) {
  const nd = npcNd(actor.system.legacy2?.nd);
  return { npcPrincipal: Number(actor.system.abilities?.[principal]?.value) || 0,
    npcDamageDice: DAMAGE_SCALE.findLast(([level]) => level <= nd)?.[1] ?? "1d4" };
}

/** Grant genuine feature Items at their acquisition ND, without touching manual features. */
export async function syncNpcProfileFeatures(actor, { resolve = globalThis.fromUuid } = {}) {
  if (actor?.type !== "npc" || !actor.isOwner || game.settings.get("jujutsu-system", "rulesetVersion") !== "2.0") return false;
  const pending = (queues.get(actor) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const nd = npcNd(actor.system.legacy2?.nd), wanted = new Set();
    for (const type of ["taxonomy", "archetype"]) {
      for (const entry of npcProfile(actor, type)?.habilidades ?? []) {
        if (entry.uuid && Number.isFinite(Number(entry.nd)) && Number(entry.nd) <= nd) wanted.add(entry.uuid);
      }
    }
    const retained = new Set(), remove = [], create = [];
    const items = Array.from(actor.items);
    // A manually acquired copy also satisfies the grant; it must never be removed on ND/profile changes.
    for (const item of items) {
      if (item.type !== "feat" || item.flags?.["jujutsu-system"]?.[FLAG]) continue;
      const source = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
      if (source) retained.add(source);
    }
    for (const item of items.filter(i => i.flags?.["jujutsu-system"]?.[FLAG])) {
      const uuid = item.flags["jujutsu-system"][FLAG].source;
      if (!wanted.has(uuid) || retained.has(uuid)) remove.push(item.id);
      else retained.add(uuid);
    }
    for (const uuid of wanted) {
      if (retained.has(uuid)) continue;
      let source;
      try { source = await resolve?.(uuid); } catch { /* Keep unrelated grants when a pack is unavailable. */ }
      if (source?.type !== "feat" || !(source.testUserPermission?.(game.user, "OBSERVER") ?? source.visible !== false)) {
        ui.notifications.warn("Uma característica da Taxonomia ou do Arquétipo está indisponível.");
        continue;
      }
      const data = source.toObject();
      delete data._id; delete data.folder; delete data.ownership;
      ((data.flags ??= {})["jujutsu-system"] ??= {})[FLAG] = { source: uuid };
      data._stats = { compendiumSource: source.pack ? source.uuid : null };
      create.push(data);
    }
    if (create.length) await actor.createEmbeddedDocuments("Item", create);
    if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
    return true;
  });
  queues.set(actor, pending);
  try { return await pending; }
  finally { if (queues.get(actor) === pending) queues.delete(actor); }
}

export function registerNpcFeatureHooks(hooks = Hooks) {
  const run = actor => syncNpcProfileFeatures(actor).catch(error => {
    console.error("Jujutsu: falha ao aplicar características dos perfis do NPC.", error);
    ui.notifications.error("Não foi possível aplicar as características da Taxonomia ou do Arquétipo.");
  });
  for (const event of ["createItem", "updateItem", "deleteItem"]) hooks.on(event, (item, ...args) => {
    if (["taxonomy", "archetype"].includes(item.type) && item.parent?.type === "npc" && args.at(-1) === game.user.id)
      return run(item.parent);
  });
  hooks.on("createActor", (actor, options, userId) => {
    if (userId === game.user.id && actor.type === "npc") return run(actor);
  });
  hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || actor.type !== "npc") return;
    if (Object.keys(changes).some(key => key.startsWith("system.legacy2")) || changes.system?.legacy2) return run(actor);
  });
  hooks.on("ready", async () => {
    // One GM handles pre-existing creatures; simultaneous clients must not create duplicate copies.
    if (game.users?.activeGM?.id !== game.user.id) return;
    for (const actor of game.actors) if (actor.type === "npc") await run(actor);
  });
}
