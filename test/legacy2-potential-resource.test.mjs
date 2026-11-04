import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { registerPotentialPointsHooks } from "../module/systems/legacy2-potential-hooks.mjs";
import { potentialPool, syncPotentialPoints } from "../module/systems/legacy2-potential-points.mjs";

function set(object, path, value) { const keys = path.split("."), key = keys.pop(); let target = object;
  for (const part of keys) target = target[part] ??= {}; target[key] = structuredClone(value); }
function fixture(type = "character") {
  const events = new Map(), writes = [], actor = { type, isOwner: true, items: [],
    async updateEmbeddedDocuments(type, updates) { writes.push(updates); for (const patch of updates) {
      const item = actor.items.find(item => item.id === patch._id);
      for (const [key, value] of Object.entries(patch)) if (key !== "_id") set(item, key, value);
    } } };
  const feat = (name, id) => ({ id, type: "feat", name, parent: actor,
    system: { uses: { max: "5", spent: 3, recovery: [] } },
    flags: { "jujutsu-system": { especializacao: { categoria: "Proezas Físicas", caminho: "Corpo de Guerreiro" } } } });
  const base = feat("Explosão de Velocidade", "speed"); actor.items.push(base);
  globalThis.game = { settings: { get: () => "2.0" }, user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } };
  registerPotentialPointsHooks({ on: (key, callback) => events.set(key, callback) });
  return { actor, base, feat, events, writes };
}
test("learning and removing body abilities updates native capacity without recovering spent PP", async () => {
  const { actor, base, feat, events, writes } = fixture();
  await events.get("createActor")(actor, {}, "gm"); assert.equal(potentialPool(actor).current, 2);
  const extra = feat("Passo Esguio", "step"); actor.items.push(extra);
  await events.get("createItem")(extra, {}, "gm"); assert.equal(base.system.uses.max, "6"); assert.equal(potentialPool(actor).current, 3);
  actor.items.pop(); await events.get("deleteItem")(extra, {}, "gm"); assert.equal(base.system.uses.max, "5");
  actor.items.push(extra); await events.get("createItem")(extra, {}, "gm"); assert.equal(base.system.uses.spent, 3);
  const before = writes.length; await events.get("updateItem")(base, { "system.uses.spent": 4 }, {}, "gm");
  assert.equal(writes.length, before); assert.equal(events.has("updateActor"), false);
});
test("native encounter recovery refills PP but turn, round, combat end and rest periods preserve the balance", async () => {
  const { actor, base } = fixture("npc"); await syncPotentialPoints(actor);
  const source = readFileSync(new URL("../module/data/shared/uses-field.mjs", import.meta.url), "utf8");
  const body = source.match(/static async recoverUses\(periods, rollData=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const recover = new Function(`return async function(periods,rollData={}){${body}}`)();
  globalThis.foundry = { utils: { getType: value => Array.isArray(value) ? "Array" : "Map", isEmpty: object => !Object.keys(object).length } };
  const context = { uses: base.system.uses, parent: base };
  for (const period of ["turn", "turnEnd", "turnStart", "round", "sr", "lr"])
    assert.equal(await recover.call(context, new Map([[period, 1]])), false);
  assert.equal(potentialPool(actor).current, 2);
  const result = await recover.call(context, new Map([["encounter", 1]]));
  assert.deepEqual(result.updates, { spent: 0 });
  Object.assign(base.system.uses, result.updates); assert.equal(potentialPool(actor).current, 5);
});
test("imported legacy feats are repaired for the importing owner without resetting their uses", async () => {
  const { actor, base } = fixture(); game.user = { id: "owner", isGM: false };
  const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const method = source.match(/  async importFromJSON\(json\) \{[\s\S]*?\n  \}/)[0];
  const Imported = new Function("Base", "syncImportedHandSeals", "syncPotentialPoints", `return class extends Base {${method}}`)(
    class { async importFromJSON() { return this; } }, async () => {}, syncPotentialPoints);
  const imported = Object.assign(new Imported(), actor); await imported.importFromJSON("{}");
  assert.equal(base.system.uses.spent, 3); assert.equal(base.system.uses.max, "5");
  assert.deepEqual(base.system.uses.recovery, [{ period: "encounter", type: "recoverAll" }]);
});
