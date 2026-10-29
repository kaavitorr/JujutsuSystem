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
const docs = [item("Item.armor", "equipment", true), item("Item.bite", "weapon"), item("Item.claw", "weapon"), item("Item.taxArmor", "equipment", true)];
const resolve = async uuid => docs.find(doc => doc.uuid === uuid);
test("a manually owned copy of canonical profile equipment satisfies the grant without a duplicate",async()=>{
  const {actor,manual}=fixture();manual._stats={compendiumSource:docs[1].uuid};
  await rules.syncNpcProfileEquipment(actor,{resolve});
  assert.equal(actor.items.filter(i=>i.type==="weapon").length,1);assert(actor.items.includes(manual));
});
function fixture() {
  version = "2.0";
  const profile = { id: "profile", type: "archetype", system: { equipamentos: { armadura: docs[0].uuid, armas: [docs[1].uuid] } } };
  const manual = { id: "manual", type: "weapon", flags: {} };
  const actor = { type: "npc", isOwner: true, items: [profile, manual] };
  let nextId = 0;
  actor.createEmbeddedDocuments = async (_, data) => {
    const created = data.map(raw => ({ ...structuredClone(raw), id: `created${nextId++}` }));
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
test("taxonomy grants its armor; archetype armor takes precedence regardless of assignment order and removing it restores taxonomy", async () => {
  const { actor, profile, manual } = fixture();
  const taxonomy = { id: "taxonomy", type: "taxonomy", system: { equipamentos: { armadura: docs[3].uuid, armas: [] } } };
  actor.items.push(taxonomy);
  profile.system.equipamentos.armadura = null;
  await rules.syncNpcArchetypeEquipment(actor, { resolve });
  assert.equal(actor.items.filter(i => i.type === "equipment").length, 1);
  assert.equal(actor.items.find(i => i.type === "equipment").name, docs[3].name);
  profile.system.equipamentos.armadura = docs[0].uuid;
  actor.items.reverse();
  await rules.syncNpcArchetypeEquipment(actor, { resolve });
  assert.equal(actor.items.filter(i => i.type === "equipment").length, 1);
  assert.equal(actor.items.find(i => i.type === "equipment").name, docs[0].name);
  actor.items = actor.items.filter(i => i !== profile);
  await rules.syncNpcArchetypeEquipment(actor, { resolve });
  assert.equal(actor.items.find(i => i.type === "equipment").name, docs[3].name);
  assert(actor.items.includes(manual));
});
test("taxonomy equipment can be configured and its native create/update/delete hooks synchronize only the initiating user", async () => {
  const { actor, profile } = fixture(); profile.type = "taxonomy"; profile.parent = actor;
  const callbacks = {}; rules.registerNpcEquipmentHooks({ on(name, callback) { callbacks[name] = callback; } });
  globalThis.fromUuid = resolve;
  await callbacks.createItem(profile, {}, "gm"); assert.equal(actor.items.length, 4);
  profile.system.equipamentos.armadura = null;
  await callbacks.updateItem(profile, {}, {}, "gm"); assert.equal(actor.items.filter(i => i.type === "equipment").length, 0);
  actor.items = actor.items.filter(i => i !== profile);
  await callbacks.deleteItem(profile, {}, "gm"); assert.equal(actor.items.length, 1);
  const sheet = { isEditable: true, isEditMode: true, item: { type: "taxonomy", system: { _source: {} }, update: async data => data } };
  const change = await editor.configureNpcEquipment(sheet, null, docs[3]);
  assert.equal(change["system.equipamentos"].armadura, docs[3].uuid);
});
test("weapons from both profiles combine without duplicates and survive removal of the other granting profile", async () => {
  const { actor, profile, manual } = fixture();
  const taxonomy = { id: "taxonomy", type: "taxonomy", system: { equipamentos: { armadura: docs[3].uuid, armas: [docs[1].uuid, docs[2].uuid] } } };
  actor.items.push(taxonomy);
  await rules.syncNpcProfileEquipment(actor, { resolve });
  const granted = () => actor.items.filter(i => i !== manual && i.type === "weapon");
  assert.deepEqual(granted().map(i => i.name).sort(), [docs[1].name, docs[2].name].sort());
  const bite = granted().find(i => i.name === docs[1].name);
  actor.items = actor.items.filter(i => i !== profile);
  await rules.syncNpcProfileEquipment(actor, { resolve });
  assert.equal(granted().length, 2); assert(granted().includes(bite), "shared weapon keeps its existing editable copy");
  taxonomy.system.equipamentos.armas = [];
  await rules.syncNpcProfileEquipment(actor, { resolve });
  assert.equal(granted().length, 0); assert(actor.items.includes(manual));
});
