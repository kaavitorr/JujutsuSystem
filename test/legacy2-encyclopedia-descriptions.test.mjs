import assert from "node:assert/strict";
import { test } from "node:test";
const helpers = await import("../module/systems/legacy2-encyclopedia-descriptions.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {}; throw error;
});
const body = '<p>Ao acertar uma criatura, recebe duas vantagens. No ND 10, afeta dois alvos.</p>';
const original = '<p><strong>ND 1</strong></p>' + body + '<p><strong>Arquétipos:</strong> Agarrador, Constritor.</p>';
function feature(id = "feature") {
  return { id, _id: id, type: "feat", flags: { "jujutsu-system": { encyclopedia: { edition: "2.0" } } },
    system: { description: { value: original, chat: "" }, prerequisites: { level: 1 }, requirements: "ND 1",
      activities: { attack: { activation: { value: 2 } } } }, effects: [{ name: "Bônus", changes: [{ value: 1 }] }] };
}
test("only the generated ND heading and archetype list disappear; mechanical ND references remain", () => {
  assert.equal(typeof helpers.cleanEncyclopediaDescription, "function");
  assert.equal(helpers.cleanEncyclopediaDescription(original), body);
});
test("actions and reaction keywords survive when they share the old ND heading", () => {
  assert.equal(helpers.cleanEncyclopediaDescription('<p><strong>ND 6 · Ações: ⬢ · Reação</strong></p>'+body),
    '<p><strong>Ações: ⬢ · Reação</strong></p>'+body);
  assert.equal(helpers.cleanEncyclopediaDescription(body+'<p>Arquétipos também podem modificar este dano.</p>'),
    body+'<p>Arquétipos também podem modificar este dano.</p>');
});
test("updates are restricted to imported feature descriptions and preserve their configured progression", () => {
  const item = feature(), before = structuredClone(item);
  assert.deepEqual(helpers.encyclopediaDescriptionUpdates(item), { "system.description.value": body });
  assert.deepEqual(item, before);
  delete item.flags["jujutsu-system"].encyclopedia;
  assert.deepEqual(helpers.encyclopediaDescriptionUpdates(item), {});
  const archetype = feature(); archetype.type = "archetype";
  assert.deepEqual(helpers.encyclopediaDescriptionUpdates(archetype), {});
});
function environment() {
  const packItem = feature("pack"), worldItem = feature("world"), npcItem = feature("npc"), tokenItem = feature("token");
  const untouched = feature("custom"); untouched.flags = {};
  const packWrites = [], worldWrites = [], actorWrites = [], locks = [];
  function apply(items, updates) { for (const update of updates) {
    const item = items.find(entry => entry.id === update._id);
    for (const [key, value] of Object.entries(update)) if (key !== "_id") {
      const parts = key.split('.'), last = parts.pop(); parts.reduce((target, part) => target[part], item)[last] = value;
    }
  } }
  const npc = { uuid: "Actor.npc", items: [npcItem, untouched], async updateEmbeddedDocuments(type, updates) {
    assert.equal(type, "Item"); actorWrites.push(updates); apply(this.items, updates);
  } };
  const token = { uuid: "Scene.scene.Token.token.Actor.token", items: [tokenItem],
    updateEmbeddedDocuments: npc.updateEmbeddedDocuments };
  const pack = { collection: "jujutsu-compendium.arquetipos-e-taxonomias", locked: true,
    async configure(data) { locks.push(data.locked); this.locked = data.locked; }, async getDocuments() { return [packItem]; } };
  globalThis.CONFIG = { Item: { documentClass: { async updateDocuments(updates, options = {}) {
    if (options.pack) { assert.equal(options.pack, pack.collection); packWrites.push(updates); apply([packItem], updates); }
    else { worldWrites.push(updates); apply([worldItem], updates); }
  } } } };
  const game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, items: [worldItem], actors: [npc],
    scenes: [{ tokens: [{ actorLink: false, actor: token }, { actorLink: true, actor: npc }] }], packs: new Map([[pack.collection, pack]]) };
  return { game, pack, documents: [packItem, worldItem, npcItem, tokenItem], untouched, packWrites, worldWrites, actorWrites, locks };
}
test("persistent cleanup reaches the compendium, world items, actor copies and unlinked tokens without changing game rules", async () => {
  const env = environment(), before = env.documents.map(item => structuredClone(item));
  await helpers.cleanupEncyclopediaDescriptions(env.game);
  for (let index = 0; index < env.documents.length; index++) {
    before[index].system.description.value = body;
    assert.deepEqual(env.documents[index], before[index]);
  }
  assert.equal(env.untouched.system.description.value, original);
  assert.equal(env.packWrites.length, 1); assert.equal(env.worldWrites.length, 1); assert.equal(env.actorWrites.length, 2);
  assert.deepEqual(env.locks, [false, true]);
});
test("a second cleanup performs no writes or compendium unlocks", async () => {
  const env = environment(); await helpers.cleanupEncyclopediaDescriptions(env.game);
  await helpers.cleanupEncyclopediaDescriptions(env.game);
  assert.equal(env.packWrites.length, 1); assert.equal(env.worldWrites.length, 1); assert.equal(env.actorWrites.length, 2);
  assert.deepEqual(env.locks, [false, true]);
});
test("passive GMs and players cannot run a second cleanup", async () => {
  for (const user of [{ id: "other", isGM: true }, { id: "player", isGM: false }]) {
    const env = environment(); env.game.user = user;
    await helpers.cleanupEncyclopediaDescriptions(env.game);
    assert.deepEqual(env.packWrites, []); assert.deepEqual(env.worldWrites, []); assert.deepEqual(env.actorWrites, []);
    assert.deepEqual(env.locks, []);
  }
});
test("the compendium lock is restored if its description update fails", async () => {
  const env = environment();
  CONFIG.Item.documentClass.updateDocuments = async (_updates, options = {}) => { if (options.pack) throw new Error("Write failed"); };
  await assert.rejects(helpers.cleanupEncyclopediaDescriptions(env.game), /Write failed/);
  assert.equal(env.pack.locked, true); assert.deepEqual(env.locks, [false, true]);
});
