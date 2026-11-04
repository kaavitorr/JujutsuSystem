import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { registerHandSealHooks, refreshHandSealRules } from "../module/systems/legacy2-hand-seal-hooks.mjs";
import * as sealHooks from "../module/systems/legacy2-hand-seal-hooks.mjs";
import { syncPotentialPoints } from "../module/systems/legacy2-potential-points.mjs";
import { HAND_SEALS_DESCRIPTION } from "../module/systems/legacy2-hand-seals.mjs";
import { registerCatalogRepair, catalogRepairGroups } from "../module/systems/catalog-repair-cache.mjs";

function set(object, path, value) { const parts = path.split("."), key = parts.pop(); let target = object;
  for (const part of parts) target = target[part] ??= {}; target[key] = structuredClone(value); }
function feat(name, parent) { return { id: name, type: "feat", name, parent,
  system: { identifier: name === "Selos de Mão" ? "selos-de-mao" : "" },
  flags: { "jujutsu-system": { especializacao: { caminho: "Selos e Encantamentos" } } } }; }
function fixture() {
  const events = new Map(), hooks = { on: (key, fn) => events.set(key, fn), once: (key, fn) => events.set(key, fn) };
  const world = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, settings: { get: () => "2.0" },
    actors: [], items: [], scenes: [], packs: new Map() };
  const writes = [], actor = { uuid: "Actor.a", documentName: "Actor", type: "character", isOwner: true,
    items: [], flags: {}, async update(updates) { writes.push(updates); for (const [key, value] of Object.entries(updates)) set(this, key, value); },
    async updateEmbeddedDocuments(type, updates) { for (const update of updates) { const item = this.items.find(item => item.id === update._id);
      for (const [key, value] of Object.entries(update)) if (key !== "_id") set(item, key, value); } } };
  globalThis.game = world; registerHandSealHooks(hooks); return { world, events, actor, writes };
}
test("creating the base feat and later path feats grants uses without reacting to unrelated actor updates", async () => {
  const { actor, events, writes } = fixture(), base = feat("Selos de Mão", actor); actor.items.push(base);
  await events.get("createItem")(base, {}, "gm"); assert.equal(actor.flags["jujutsu-system"].selos, 8);
  actor.flags["jujutsu-system"].selos = 2; const extra = feat("Selos Complexos", actor); actor.items.push(extra);
  await events.get("createItem")(extra, {}, "gm"); assert.equal(actor.flags["jujutsu-system"].selos, 3);
  const before = writes.length; await events.get("createItem")({ type: "weapon", parent: actor }, {}, "gm");
  assert.equal(writes.length, before); assert.equal(events.has("updateActor"), false);
});
test("an existing exhausted pool gains only the new base difference and stays exhausted after later syncs", async () => {
  const { world, actor, writes } = fixture(); actor.items.push(feat("Selos de Mão", actor)); actor.flags["jujutsu-system"] = { selos: 0 }; world.actors.push(actor);
  await refreshHandSealRules(world); assert.equal(actor.flags["jujutsu-system"].selos, 5);
  const before = writes.length; await refreshHandSealRules(world); assert.equal(writes.length, before);
});
test("description repair reads the one canonical document and restores the pack lock", async () => {
  const { world } = fixture(); const changes = [], item = feat("Selos de Mão"); item.system.description = { value: "3 usos antigos" };
  item.update = async updates => { changes.push(updates); for (const [key, value] of Object.entries(updates)) set(item, key, value); };
  const reads = [], pack = { locked: true, async configure({ locked }) { this.locked = locked; },
    async getDocument(id) { reads.push(id); return item; } }; world.packs.set("jujutsu-compendium.geral-2-0", pack);
  await refreshHandSealRules(world); assert.equal(item.system.description.value, HAND_SEALS_DESCRIPTION); assert.equal(pack.locked, true);
  await refreshHandSealRules(world); assert.equal(changes.length, 1); assert.equal(reads.length, 2);
});
test("only the active GM repairs existing actors and edition one remains unchanged", async () => {
  const { world, actor } = fixture(); actor.items.push(feat("Selos de Mão", actor)); world.actors.push(actor);
  world.user.id = "other"; await refreshHandSealRules(world); assert.deepEqual(actor.flags, {});
  world.user.id = "gm"; world.settings.get = () => "1.0"; await refreshHandSealRules(world); assert.deepEqual(actor.flags, {});
});
test("actors imported with embedded seal feats are initialized without waiting for rest or reload", async () => {
  const { actor, events } = fixture(); assert.equal(typeof events.get("createActor"), "function");
  actor.items.push(feat("Selos de Mão", actor)); await events.get("createActor")(actor, {}, "gm");
  assert.equal(actor.flags["jujutsu-system"].selos, 8); assert.equal(actor.items[0].system.description.value, HAND_SEALS_DESCRIPTION);
  const imported = { ...actor, uuid: "Actor.imported", flags: { "jujutsu-system": { selos: 1 } } };
  imported.items = [feat("Selos de Mão", imported)]; await events.get("createActor")(imported, {}, "gm");
  assert.equal(imported.flags["jujutsu-system"].selos, 6);
});
test("standard JSON imports repair seals after the native noHook update, including imports by an owner", async () => {
  const { actor, world } = fixture(); world.user = { id: "owner", isGM: false };
  const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const method = source.match(/  async importFromJSON\(json\) \{[\s\S]*?\n  \}/)?.[0];
  assert(method, "Actor5e must repair imports that bypass document hooks");
  const Base = class { async importFromJSON(json) {
    this.items = [feat("Selos de Mão", this)]; this.flags = JSON.parse(json).flags; return this;
  } };
  const Imported = new Function("Base", "syncImportedHandSeals", "syncPotentialPoints", `return class extends Base { ${method} }`)(Base, sealHooks.syncImportedHandSeals, syncPotentialPoints);
  const imported = Object.assign(new Imported(), actor);
  assert.equal(await imported.importFromJSON(JSON.stringify({ flags: { "jujutsu-system": { selos: 1 } } })), imported);
  assert.equal(imported.flags["jujutsu-system"].selos, 6);
  assert.equal(imported.items[0].system.description.value, HAND_SEALS_DESCRIPTION);
});

test("the JSON import repair also updates old physical copies for the importing owner", async () => {
  const { actor, world } = fixture(); world.user = { id: "owner", isGM: false };
  const item = { id: "old-physical", type: "feat", name: "Energia Atrasada", system: { description: { value: "Antigo" } },
    flags: { "jujutsu-system": { especializacao: { categoria: "Proezas Físicas", caminho: "Punho Divergente" } } } };
  actor.items.push(item);
  await sealHooks.syncImportedHandSeals(actor, world);
  assert.match(item.system.description.value, /até 6 Desvantagens/);
});

test("JSON owner imports invoke catalog repairs only for that actor without reading world collections", async () => {
  const { actor, world } = fixture(); world.user = { id: "owner", isGM: false };
  actor.items.push(feat("Selos de Mão", actor));
  for (const key of ["actors", "items", "scenes"]) Object.defineProperty(world, key, {
    get() { throw Error(`JSON import must not inspect world.${key}`); }
  });
  let received;
  const unregister = registerCatalogRepair("test-json-owner-bridge", { packs: [], refresh: (target, scope) => {
    assert.equal(target, world); received = scope;
    assert.deepEqual([...catalogRepairGroups(target, scope).keys()], [actor]);
  } });
  try {
    await sealHooks.syncImportedHandSeals(actor, world);
    assert.equal(received?.ownerImport, true);
    assert.deepEqual(received.actors, [actor]);
  } finally { unregister(); }
});
