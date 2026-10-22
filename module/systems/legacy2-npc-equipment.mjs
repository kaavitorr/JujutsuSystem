import { npcProfile } from "./legacy2-npc-profiles.mjs";

const FLAG = "npcArchetypeEquipment";
const queues = new WeakMap();
export const validNpcEquipment = (item, kind) => kind === "armadura"
  ? item?.type === "equipment" && item.system?.type?.value === "natural"
  : kind === "armas" && item?.type === "weapon";
export const canReadNpcEquipment = item => item.testUserPermission?.(globalThis.game?.user, "OBSERVER") ?? item.visible !== false;

/** Copies retain their native attacks/effects. Only gear granted by an archetype is managed. */
export async function syncNpcArchetypeEquipment(actor, { resolve = globalThis.fromUuid } = {}) {
  if (actor?.type !== "npc" || !actor.isOwner || game.settings.get("jujutsu-system", "rulesetVersion") !== "2.0") return false;
  const pending = (queues.get(actor) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const profile = npcProfile(actor, "archetype");
    const definition = profile?.equipamentos ?? {};
    const wanted = new Map([...(definition.armadura ? [[definition.armadura, "armadura"]] : []),
      ...(definition.armas ?? []).map(uuid => [uuid, "armas"])]);
    const granted = Array.from(actor.items).filter(item => item.flags?.["jujutsu-system"]?.[FLAG]);
    const create = [], remove = [], retained = new Set();
    for (const item of granted) {
      const source = item.flags["jujutsu-system"][FLAG].source;
      if (!wanted.has(source) || retained.has(source)) remove.push(item.id);
      else retained.add(source);
    }
    for (const [uuid, kind] of wanted) {
      if (retained.has(uuid)) continue;
      const source = await resolve?.(uuid).catch(() => null);
      if (!validNpcEquipment(source, kind) || !canReadNpcEquipment(source)) {
        ui.notifications.warn("Um equipamento do Arquétipo está indisponível ou não é do tipo esperado.");
        continue;
      }
      const data = source.toObject();
      delete data._id; delete data.folder; delete data.ownership;
      data.system.equipped = true;
      if ("container" in data.system) data.system.container = null;
      const flags = (data.flags ??= {})["jujutsu-system"] ??= {};
      flags[FLAG] = { source: uuid, profile: profile.item?.id };
      data._stats = { compendiumSource: source.pack ? source.uuid : null };
      create.push(data);
    }
    // Resolve first; a transient compendium failure must not discard a still-requested copy.
    if (create.length) await actor.createEmbeddedDocuments("Item", create);
    if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
    return true;
  });
  queues.set(actor, pending);
  try { return await pending; }
  finally { if (queues.get(actor) === pending) queues.delete(actor); }
}

export function registerNpcEquipmentHooks(hooks = Hooks) {
  const run = actor => syncNpcArchetypeEquipment(actor).catch(error => {
    console.error("Jujutsu: falha ao aplicar equipamentos do Arquétipo.", error);
    ui.notifications.error("Não foi possível aplicar os equipamentos do Arquétipo.");
  });
  for (const event of ["createItem", "updateItem", "deleteItem"]) hooks.on(event, (item, ...args) => {
    const userId = args.at(-1);
    if (item.type === "archetype" && item.parent?.type === "npc" && userId === game.user.id) return run(item.parent);
  });
  hooks.on("createActor", (actor, options, userId) => {
    if (userId === game.user.id && actor.type === "npc") return run(actor);
  });
}
