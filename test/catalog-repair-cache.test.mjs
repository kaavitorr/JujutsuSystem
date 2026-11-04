import assert from "node:assert/strict";
import { test } from "node:test";
import { flawEffectPlan, refreshFlawEffects, registerFlawEffectHooks } from "../module/systems/defeitos-active-effects.mjs";
import { cleanupEncyclopediaDescriptions, registerEncyclopediaDescriptionHooks } from "../module/systems/legacy2-encyclopedia-descriptions.mjs";
import { refreshEncyclopediaIcons, registerCompendiumIconHooks } from "../module/systems/legacy2-compendium-icons.mjs";
import { refreshCursedBenefitEffects1 } from "../module/systems/seres-amaldicoados-1-hooks.mjs";
const cache = await import("../module/systems/catalog-repair-cache.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {}; throw error;
});
const NS = "jujutsu-system", GENERAL = "jujutsu-compendium.geral-2-0", OLD = "jujutsu-compendium.geral";
const ENCYCLOPEDIA = "jujutsu-compendium.arquetipos-e-taxonomias";
const placeholder = "systems/jujutsu-system/icons/svg/items/feature.svg";
const art = "icons/creatures/abilities/fangs-teeth-bite.webp";
const oldDescription = "<p><strong>ND 1</strong></p><p>Regra.</p>";

function fixture({ cursed = false } = {}) {
  const counts = { documents: 0, world: 0, actors: 0, scenes: 0, owned: 0, writes: 0 };
  const tracked = (items, key) => ({ [Symbol.iterator]() { counts[key]++; return items[Symbol.iterator](); } });
  const all = new Map();
  const apply = (item, updates) => {
    counts.writes++;
    for (const [path, value] of Object.entries(updates)) {
      if (path === "_id") continue;
      const keys = path.split("."), last = keys.pop();
      keys.reduce((target, key) => target[key] ??= {}, item)[last] = structuredClone(value);
    }
  };
  const document = data => {
    const item = { system: { description: { value: "<p>Regra.</p>" } }, effects: [], flags: {}, isOwner: true, ...data,
      id: data.id, _id: data.id,
      toObject() {
        return structuredClone(Object.fromEntries(["_id", "type", "name", "img", "system", "effects", "flags"].map(key => [key, this[key]])));
      },
      async update(updates) { apply(this, updates); }
    };
    all.set(item.id, item); return item;
  };
  const flaw = document({ id: "source-flaw", uuid: `Compendium.${GENERAL}.Item.source-flaw`, name: "Distraído (5 Pontos)", type: "feat", img: art });
  Object.assign(flaw, flawEffectPlan(flaw, "2.0"));
  const source = document({ id: "source-art", uuid: `Compendium.${ENCYCLOPEDIA}.Item.source-art`, name: "Mordida", type: "feat", img: art,
    flags: { [NS]: { encyclopedia: { edition: "2.0", key: "feature:bite" } } } });
  const makeCopy = (id, kind = "art") => document(kind === "flaw"
    ? { ...flaw.toObject(), id, _stats: { compendiumSource: flaw.uuid }, effects: [] }
    : { ...source.toObject(), id, img: placeholder, system: { description: { value: oldDescription } }, _stats: { compendiumSource: source.uuid } });
  const worldCopy = makeCopy("world"), ownedCopy = makeCopy("owned", "flaw"), tokenCopy = makeCopy("token");
  const worldItems = [worldCopy], ownedItems = [ownedCopy], tokenItems = [tokenCopy];
  const benefit = document({ id: "source-benefit", uuid: `Compendium.${OLD}.Item.source-benefit`, name: "Vida Adicional", type: "feat", img: art,
    system: { identifier: "vida-adicional", description: { value: "Regra oficial." } },
    flags: { [NS]: { seresAmaldicoados1: { ruleset: "1.0", kind: "benefit" } } } });
  const benefitCopy = document({ ...benefit.toObject(), id: "benefit-copy", _stats: { compendiumSource: benefit.uuid }, effects: [] });
  if (cursed) ownedItems.push(benefitCopy);
  const actor = { id: "actor", isOwner: true, items: tracked(ownedItems, "owned"), async updateEmbeddedDocuments(_type, updates) {
    for (const update of updates) apply(all.get(update._id), update);
  } };
  const tokenActor = { ...actor, id: "token-actor", items: tracked(tokenItems, "owned") };
  const packs = new Map([[GENERAL, [flaw]], [OLD, cursed ? [benefit] : []], [ENCYCLOPEDIA, [source]]].map(([collection, documents]) => [collection, {
    collection, locked: true, async getDocuments() { counts.documents++; return documents; }, async configure({ locked }) { this.locked = locked; }
  }]));
  const world = { user: { isGM: true, id: "gm" }, users: { activeGM: { id: "gm" } }, packs,
    items: tracked(worldItems, "world"), actors: tracked([actor], "actors"),
    scenes: tracked([{ tokens: [{ actorLink: false, actor: tokenActor }] }], "scenes") };
  globalThis.game = world;
  globalThis.CONFIG = { Item: { documentClass: { async updateDocuments(updates) {
    for (const update of updates) apply(all.get(update._id), update);
  } } } };
  globalThis.ui = { notifications: { error(message) { assert.fail(message); } } };
  return { world, counts, worldCopy, ownedCopy, tokenCopy, benefitCopy, flaw, source, makeCopy, worldItems, ownedItems, actor, apply };
}

test("opening repairs share three pack reads and one item enumeration, then clean repeats do no work", async () => {
  const { world, counts, ownedCopy, worldCopy, tokenCopy, benefitCopy } = fixture({ cursed: true });
  const run = () => Promise.all([refreshFlawEffects(world), refreshCursedBenefitEffects1(world), cleanupEncyclopediaDescriptions(world), refreshEncyclopediaIcons(world)]);
  await run();
  assert.equal(ownedCopy.effects.length, 1);
  assert.equal(benefitCopy.effects.length, 1);
  assert.equal(worldCopy.img, art);
  assert.equal(tokenCopy.system.description.value, "<p>Regra.</p>");
  assert.deepEqual(counts, { documents: 3, world: 1, actors: 1, scenes: 1, owned: 2, writes: 6 });
  Object.keys(counts).forEach(key => { counts[key] = 0; });
  await run();
  assert.deepEqual(counts, { documents: 0, world: 0, actors: 0, scenes: 0, owned: 0, writes: 0 });
});

test("concurrent pack readers share the pending request, a failed request retries and invalidation returns live replacements", async () => {
  assert.equal(typeof cache.catalogRepairDocuments, "function");
  const { world, source } = fixture();
  let release, reads = 0;
  world.packs.get(ENCYCLOPEDIA).getDocuments = () => { reads++; return new Promise(resolve => { release = resolve; }); };
  const first = cache.catalogRepairDocuments(world, ENCYCLOPEDIA), second = cache.catalogRepairDocuments(world, ENCYCLOPEDIA);
  await Promise.resolve();
  assert.equal(reads, 1);
  source.img = "icons/live.webp";
  release([source]);
  assert.equal((await first)[0], source);
  assert.equal((await second)[0].img, "icons/live.webp");
  cache.invalidateCatalogRepairs(world, { pack: ENCYCLOPEDIA });
  world.packs.get(ENCYCLOPEDIA).getDocuments = async () => { reads++; throw new Error("Retry read"); };
  await assert.rejects(cache.catalogRepairDocuments(world, ENCYCLOPEDIA), /Retry read/);
  const replacement = { ...source, img: "icons/replacement.webp" };
  world.packs.get(ENCYCLOPEDIA).getDocuments = async () => { reads++; return [replacement]; };
  assert.equal((await cache.catalogRepairDocuments(world, ENCYCLOPEDIA))[0], replacement);
  assert.equal(reads, 3);
});

test("failed repair writes can retry without repeating successful reads or losing the compendium lock", async () => {
  const { world, counts, source } = fixture();
  source.system.description.value = oldDescription;
  const original = CONFIG.Item.documentClass.updateDocuments;
  CONFIG.Item.documentClass.updateDocuments = async (updates, options) => {
    if (options?.pack) throw new Error("Retry write");
    return original(updates, options);
  };
  await assert.rejects(cleanupEncyclopediaDescriptions(world), /Retry write/);
  assert.equal(world.packs.get(ENCYCLOPEDIA).locked, true);
  CONFIG.Item.documentClass.updateDocuments = original;
  await cleanupEncyclopediaDescriptions(world);
  assert.equal(source.system.description.value, "<p>Regra.</p>");
  assert.equal(counts.documents, 1);
});

function hookRegistry() {
  const callbacks = new Map();
  return { callbacks, once(event, callback) { this.on(event, callback); }, on(event, callback) {
    if (!callbacks.has(event)) callbacks.set(event, []);
    callbacks.get(event).push(callback);
  }, async call(event, ...args) { for (const callback of callbacks.get(event) ?? []) await callback(...args); } };
}

test("later imports and relevant catalog edits repair their targets without rescanning clean world items", async () => {
  const env = fixture(), hooks = hookRegistry();
  registerFlawEffectHooks(hooks); registerEncyclopediaDescriptionHooks(hooks); registerCompendiumIconHooks(hooks);
  await hooks.call("dnd5e.ready");
  Object.keys(env.counts).forEach(key => { env.counts[key] = 0; });
  const imported = env.makeCopy("new", "flaw");
  env.ownedItems.push(imported);
  imported.parent = env.actor;
  await hooks.call("createItem", imported, {}, "gm");
  assert.equal(imported.effects.length, 1);
  assert.deepEqual(env.counts, { documents: 0, world: 0, actors: 0, scenes: 0, owned: 0, writes: 1 });
  await hooks.call("updateItem", imported, { sort: 10 }, {}, "gm");
  assert.equal(env.counts.writes, 1);
  env.source.pack = ENCYCLOPEDIA;
  env.source.img = "icons/revised.webp";
  const next = env.makeCopy("later");
  env.worldItems.push(next);
  await hooks.call("updateItem", env.source, { img: env.source.img }, {}, "gm");
  assert.equal(next.img, "icons/revised.webp");
  assert.equal(env.counts.documents, 1);
});

test("an owner JSON import repairs only that actor, preserves custom edits and cannot request a world or pack write", async () => {
  assert.equal(typeof cache.refreshCatalogRepairs, "function");
  const { world, actor, ownedItems, makeCopy, counts, ownedCopy } = fixture();
  world.user = { id: "player", isGM: false };
  const artCopy = makeCopy("owner-art"), edited = makeCopy("edited", "flaw"), artwork = makeCopy("manual-art");
  edited.system.description.value = "Regra do mestre.";
  artwork.img = "worlds/custom.webp";
  ownedItems.push(artCopy, edited, artwork);
  await cache.refreshCatalogRepairs(world, { actors: [actor], ownerImport: true });
  assert.equal(ownedCopy.effects.length, 1);
  assert.equal(edited.effects.length, 0);
  assert.equal(artCopy.img, art);
  assert.equal(artwork.img, "worlds/custom.webp");
  assert.equal(counts.world + counts.actors + counts.scenes, 0);
  actor.isOwner = false;
  const unauthorized = makeCopy("forbidden", "flaw"); ownedItems.push(unauthorized);
  await cache.refreshCatalogRepairs(world, { actors: [actor], ownerImport: true });
  await cache.refreshCatalogRepairs(world, { ownerImport: true });
  assert.equal(unauthorized.effects.length, 0);
});

test("resource, equipment and synthetic HP updates do not dispatch catalog repairs, while nested source edits do", async () => {
  const { world, worldCopy, actor } = fixture(), hooks = hookRegistry();
  registerFlawEffectHooks(hooks);
  let calls = 0;
  const unregister = cache.registerCatalogRepair("event-count-probe", { packs: [], refresh() { calls++; } });
  try {
    for (const changes of [{ "system.uses.spent": 1 }, { system: { uses: { spent: 1 } } },
      { "system.equipped": true }, { system: { quantity: 3 } }, { flags: { otherModule: { state: true } } }]) {
      await hooks.call("updateItem", worldCopy, changes, {}, "gm");
    }
    for (const changes of [{ delta: { system: { attributes: { hp: { value: 1 } } } } },
      { "delta.system.energy.total": 10 }, { delta: { items: [{ _id: "owned", system: { uses: { spent: 1 } } }] } }]) {
      await hooks.call("updateToken", { actorLink: false, actor }, changes, {}, "gm");
    }
    assert.equal(calls, 0);
    await hooks.call("updateItem", worldCopy, { system: { description: { value: "Nova descrição." } } }, {}, "gm");
    await hooks.call("updateItem", worldCopy, { "flags.core.sourceId": "Item.new" }, {}, "gm");
    await hooks.call("updateToken", { actorLink: false, actor }, { delta: { items: [{ _id: "owned", name: "Novo item" }] } }, {}, "gm");
    assert.equal(calls, 3);
  } finally { unregister(); }
});

test("repair-generated compendium notifications do not invalidate stable reads", async () => {
  const { world, counts } = fixture(), hooks = hookRegistry();
  registerEncyclopediaDescriptionHooks(hooks); registerCompendiumIconHooks(hooks);
  await hooks.call("dnd5e.ready");
  Object.keys(counts).forEach(key => { counts[key] = 0; });
  await hooks.call("updateCompendium", world.packs.get(ENCYCLOPEDIA), [{ _id: "source-art" }], { jjCatalogRepair: true }, "gm");
  await refreshEncyclopediaIcons(world);
  assert.deepEqual(counts, { documents: 0, world: 0, actors: 0, scenes: 0, owned: 0, writes: 0 });
});

test("creating unrelated equipment does not enumerate the source catalogs", async () => {
  const { counts, worldCopy } = fixture(), hooks = hookRegistry();
  registerFlawEffectHooks(hooks); registerCompendiumIconHooks(hooks);
  worldCopy.type = "weapon";
  await hooks.call("createItem", worldCopy, {}, "gm");
  assert.equal(counts.documents, 0);
});

test("a failed owner import can be retried by the full repair without reloading successful source reads", async () => {
  const { world, counts, actor, ownedItems, makeCopy } = fixture();
  await refreshFlawEffects(world);
  const imported = makeCopy("retry-import", "flaw"); ownedItems.push(imported);
  const update = imported.update;
  imported.update = async () => { throw new Error("Import repair failed"); };
  await assert.rejects(cache.refreshCatalogRepairs(world, { actors: [actor], ownerImport: true }), /Import repair failed/);
  imported.update = update;
  await refreshFlawEffects(world);
  assert.equal(imported.effects.length, 1);
  assert.equal(counts.documents, 2);
});
