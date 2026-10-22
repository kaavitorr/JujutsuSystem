import assert from "node:assert/strict";
import { test } from "node:test";
let version = "2.0";
globalThis.game = { user: { id: "gm" }, settings: { get: () => version } };
globalThis.ui = { notifications: { warn() {}, error() {} } };
const rules = await import("../module/systems/legacy2-npc-equipment.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
const editor = await import("../module/applications/item/npc-profile-equipment.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
function item(uuid, type, natural = false) {
  return { uuid, name: uuid, type, documentName: "Item", visible: true,
    system: { type: { value: natural ? "natural" : "simpleM" }, equipped: false },
    toObject() { return { _id: "source", name: this.name, type, folder: "folder", ownership: {}, system: structuredClone(this.system), effects: [{ name: "Bônus" }] }; } };
}
const docs = [item("Item.armor", "equipment", true), item("Item.bite", "weapon"), item("Item.claw", "weapon")];
const resolve = async uuid => docs.find(doc => doc.uuid === uuid);
function fixture() {
  version = "2.0";
  const profile = { id: "profile", type: "archetype", system: { equipamentos: { armadura: docs[0].uuid, armas: [docs[1].uuid] } } };
  const manual = { id: "manual", type: "weapon", flags: {} };
  const actor = { type: "npc", isOwner: true, items: [profile, manual] };
  actor.createEmbeddedDocuments = async (_, data) => {
    const created = data.map((raw, i) => ({ ...structuredClone(raw), id: `created${actor.items.length + i}` }));
    actor.items.push(...created); return created;
  };
  actor.deleteEmbeddedDocuments = async (_, ids) => { actor.items = actor.items.filter(item => !ids.includes(item.id)); };
  return { actor, profile, manual };
}
test("archetype equipment becomes genuine equipped owned Items with native effects and no duplicate copies", async () => {
  const { actor } = fixture();
  await Promise.all([rules.syncNpcArchetypeEquipment(actor, { resolve }), rules.syncNpcArchetypeEquipment(actor, { resolve })]);
  assert.equal(actor.items.length, 4);
  const armor = actor.items.find(i => i.type === "equipment");
  assert.equal(armor.system.equipped, true); assert.equal(armor.effects[0].name, "Bônus");
  assert.equal(armor.folder, undefined); assert.equal(armor.ownership, undefined); assert.equal(armor._id, undefined);
  assert.equal(docs[0].system.equipped, false);
});
test("changing/removing an archetype replaces only its granted equipment, preserving unrelated possessions", async () => {
  const { actor, profile, manual } = fixture(); await rules.syncNpcArchetypeEquipment(actor, { resolve });
  profile.system.equipamentos.armas = [docs[2].uuid]; await rules.syncNpcArchetypeEquipment(actor, { resolve });
  assert.equal(actor.items.length, 4); assert(actor.items.includes(manual));
  assert(!actor.items.some(i => i.name === docs[1].uuid)); assert(actor.items.some(i => i.name === docs[2].uuid));
  actor.items = actor.items.filter(i => i !== profile); await rules.syncNpcArchetypeEquipment(actor, { resolve });
  assert.deepEqual(actor.items, [manual]);
});
test("unavailable references retain existing granted gear and read-only/non-NPC/1.0 actors cannot synchronize", async () => {
  const { actor } = fixture(); await rules.syncNpcArchetypeEquipment(actor, { resolve });
  await rules.syncNpcArchetypeEquipment(actor, { resolve: async () => null }); assert.equal(actor.items.length, 4);
  for (const blocked of [{ ...actor, isOwner: false }, { ...actor, type: "character" }]) {
    blocked.createEmbeddedDocuments = () => assert.fail("unexpected write");
    assert.equal(await rules.syncNpcArchetypeEquipment(blocked, { resolve }), false);
  }
  version = "1.0"; assert.equal(await rules.syncNpcArchetypeEquipment(actor, { resolve }), false); version = "2.0";
});
test("equipment editor accepts natural armor and weapons, rejects other gear/duplicates and guards editing", async () => {
  const writes = [], sheet = { isEditable: true, isEditMode: true,
    item: { type: "archetype", system: { _source: { equipamentos: { armadura: null, armas: [] } } },
      async update(data) { writes.push(data); this.system._source.equipamentos = data["system.equipamentos"]; } } };
  await editor.configureNpcEquipment(sheet, null, docs[0]); await editor.configureNpcEquipment(sheet, null, docs[1]);
  await editor.configureNpcEquipment(sheet, null, docs[1]);
  assert.equal(writes.length, 2); assert.equal(writes[1]["system.equipamentos"].armadura, docs[0].uuid);
  await editor.configureNpcEquipment(sheet, null, item("Item.other", "equipment")); assert.equal(writes.length, 2);
  await editor.configureNpcEquipment({ ...sheet, isEditMode: false }, null, docs[2]); assert.equal(writes.length, 2);
  await editor.configureNpcEquipment(sheet, { dataset: { operation: "remove", kind: "armas", uuid: docs[1].uuid } });
  assert.deepEqual(sheet.item.system._source.equipamentos.armas, []);
});
test("runtime hooks synchronize only the initiating user's owned archetype and handle NPC creation", async () => {
  const callbacks = {}; rules.registerNpcEquipmentHooks({ on(name, callback) { callbacks[name] = callback; } });
  const { actor, profile } = fixture(); profile.parent = actor;
  globalThis.fromUuid = resolve;
  await callbacks.createItem(profile, {}, "other"); assert.equal(actor.items.length, 2);
  await callbacks.createItem(profile, {}, "gm"); assert.equal(actor.items.length, 4);
  actor.items = actor.items.filter(i => i === profile || i.id === "manual");
  await callbacks.createActor(actor, {}, "gm"); assert.equal(actor.items.length, 4);
});
