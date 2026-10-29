import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.game = { user: { id: "gm" }, settings: { get: () => "2.0" }, actors: [] };
globalThis.ui = { notifications: { warn() {}, error() {} } };
const rules = await import("../module/systems/legacy2-npc-features.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
function fixture() {
  const profile = { id: "profile", type: "archetype", system: { habilidades: [
    { uuid: "Item.natural", nd: 0 }, { uuid: "Item.level3", nd: 3 }
  ] } };
  const manual = { id: "manual", type: "feat", flags: {} };
  const actor = { type: "npc", isOwner: true, system: { legacy2: { nd: 1 } }, items: [profile, manual] };
  let sequence = 0;
  actor.createEmbeddedDocuments = async (_, data) => {
    const created = data.map(raw => ({ ...structuredClone(raw), id: `copy${sequence++}` }));
    actor.items.push(...created); return created;
  };
  actor.deleteEmbeddedDocuments = async (_, ids) => { actor.items = actor.items.filter(i => !ids.includes(i.id)); };
  const resolve = async uuid => ({ uuid, name: uuid, type: "feat", visible: true, pack: true,
    toObject: () => ({ _id: "source", name: uuid, type: "feat", folder: "folder", ownership: {},
      system: { activities: { use: { name: "Usar" } } }, effects: [{ name: "Efeito" }] }) });
  return { actor, profile, manual, resolve };
}
test("NPCs gain natural and level-gated characteristics once, keeping their effects and activities", async () => {
  assert.equal(typeof rules.syncNpcProfileFeatures, "function");
  const { actor, resolve } = fixture();
  await Promise.all([rules.syncNpcProfileFeatures(actor, { resolve }), rules.syncNpcProfileFeatures(actor, { resolve })]);
  assert.equal(actor.items.length, 3);
  const natural = actor.items.find(i => i.name === "Item.natural");
  assert.equal(natural.effects[0].name, "Efeito"); assert.equal(natural.system.activities.use.name, "Usar");
  assert.equal(natural._id, undefined); assert.equal(natural.folder, undefined);
  actor.system.legacy2.nd = 3;
  await rules.syncNpcProfileFeatures(actor, { resolve });
  assert.equal(actor.items.length, 4);
});
test("lowering ND or removing a profile removes only its managed grants; shared grants survive", async () => {
  assert.equal(typeof rules.syncNpcProfileFeatures, "function");
  const { actor, profile, manual, resolve } = fixture(); actor.system.legacy2.nd = 5;
  const taxonomy = { id: "taxonomy", type: "taxonomy", system: { habilidades: [{ uuid: "Item.natural", nd: 0 }] } };
  actor.items.push(taxonomy);
  await rules.syncNpcProfileFeatures(actor, { resolve });
  actor.system.legacy2.nd = 1; await rules.syncNpcProfileFeatures(actor, { resolve });
  assert(!actor.items.some(i => i.name === "Item.level3"));
  actor.items = actor.items.filter(i => i !== profile); await rules.syncNpcProfileFeatures(actor, { resolve });
  assert(actor.items.some(i => i.name === "Item.natural"));
  actor.items = actor.items.filter(i => i !== taxonomy); await rules.syncNpcProfileFeatures(actor, { resolve });
  assert.deepEqual(actor.items, [manual]);
});
test("inaccessible sources and manually acquired copies are preserved without duplicates", async () => {
  assert.equal(typeof rules.syncNpcProfileFeatures, "function");
  const { actor, manual, resolve } = fixture();
  manual._stats = { compendiumSource: "Item.natural" };
  await rules.syncNpcProfileFeatures(actor, { resolve }); assert.equal(actor.items.length, 2);
  delete manual._stats;
  await rules.syncNpcProfileFeatures(actor, { resolve });
  await rules.syncNpcProfileFeatures(actor, { resolve: async () => { throw Error("Unavailable"); } });
  assert.equal(actor.items.length, 3);
  assert.equal(await rules.syncNpcProfileFeatures({ ...actor, isOwner: false }, { resolve }), false);
});
test("hooks react to profile assignment and ND changes, only on the initiating client", async () => {
  assert.equal(typeof rules.registerNpcFeatureHooks, "function");
  const callbacks = {}; rules.registerNpcFeatureHooks({ on(name, fn) { callbacks[name] = fn; } });
  const { actor, profile, resolve } = fixture(); globalThis.fromUuid = resolve; profile.parent = actor;
  await callbacks.createItem(profile, {}, "gm"); assert.equal(actor.items.length, 3);
  actor.system.legacy2.nd = 3;
  await callbacks.updateActor(actor, { "system.legacy2.nd": 3 }, {}, "other"); assert.equal(actor.items.length, 3);
  await callbacks.updateActor(actor, { "system.legacy2.nd": 3 }, {}, "gm"); assert.equal(actor.items.length, 4);
});
test("encyclopedia rolls use the current full principal attribute and the ND damage scale", () => {
  assert.equal(typeof rules.npcFeatureRollData, "function");
  const { actor } = fixture(); actor.system.abilities = { dex: { value: 8 } };
  for (const [nd, expected] of [[1,"1d4"],[2,"1d6"],[9,"1d12"],[10,"2d8"],[20,"4d8"],[30,"5d10"]]) {
    actor.system.legacy2.nd = nd;
    assert.deepEqual(rules.npcFeatureRollData(actor, "dex"), { npcPrincipal: 8, npcDamageDice: expected });
  }
});
