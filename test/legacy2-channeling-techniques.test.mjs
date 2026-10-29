import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.game = { user: { id: "gm", isGM: true }, settings: { get: () => "2.0" }, users: {} };
const { channelingTechniqueGrants, syncChannelingTechniques, registerChannelingTechniques } = await import("../module/systems/legacy2-channeling-techniques.mjs");
const feat = name => ({ name, type: "feat", system: {} });
test("the two channeling specializations grant three usable techniques, with the authored costs and formulas", () => {
  const items = channelingTechniqueGrants([feat("Canalização Amplificadora"), feat("Canalização de Combate")], 7);
  assert.deepEqual(items.map(item => item.name), ["Canalizar Energia", "Explosão de Energia", "Defesa Sólida"]);
  for (const item of items) {
    assert.equal(item.type, "spell");const activity = Object.values(item.system.activities)[0];
    assert.equal(activity.consumption.targets[0].value, "4");assert.equal(activity.consumption.targets[0].target, "energy.generated");
    assert.ok(activity.activation.value > 0);
    assert.match(activity._id, /^[a-zA-Z0-9]{16}$/);
  }
  const attack = Object.values(items[1].system.activities)[0], defense = Object.values(items[2].system.activities)[0];
  assert.equal(attack.type, "attack");assert.equal(attack.damage.parts[0].number, 4);assert.equal(attack.damage.parts[0].denomination, 8);
  assert.equal(attack.activation.value, 3);assert.equal(defense.activation.value, 2);assert.equal(defense.reduction.formula, "4d8");
  assert.equal(defense.jjScale.maxPA, 7);assert.equal(defense.jjScale.cost, 1);
});
test("low levels cannot scale beyond the base four dice; manual techniques are not duplicated", () => {
  const items = [feat("Canalização de Combate"), { type: "spell", name: "Explosão de Energia", system: {} }];
  const grants = channelingTechniqueGrants(items, 1);
  assert.equal(grants.length, 1);assert.equal(grants[0].name, "Defesa Sólida");
  assert.equal(Object.values(grants[0].system.activities)[0].jjScale.maxPA, 4);
});
test("existing player and NPC sheets are repaired idempotently; removing a specialization deletes only its managed techniques", async () => {
  for (const type of ["character", "npc"]) {
    const actor = { type, isOwner: true, items: [feat("Canalização de Combate")],
      system: { details: { level: 7 }, legacy2: { nd: "7" } },
      async createEmbeddedDocuments(kind, data) { this.items.push(...data.map((item, n) => ({ ...item, id: `id${n}` }))); },
      async deleteEmbeddedDocuments(kind, ids) { this.items = this.items.filter(item => !ids.includes(item.id)); },
      async updateEmbeddedDocuments() {} };
    await syncChannelingTechniques(actor);await syncChannelingTechniques(actor);
    assert.equal(actor.items.length, 3);
    actor.items.push({ id: "manual", name: "Defesa Sólida manual", type: "spell", system: {} });
    actor.items = actor.items.filter(item => item.type !== "feat");
    await syncChannelingTechniques(actor);
    assert.deepEqual(actor.items.map(item => item.id), ["manual"]);
  }
});
test("registration covers existing worlds, dropped specializations and level changes", () => {
  const events = [];registerChannelingTechniques({ on: (event, callback) => events.push(event), once: (event, callback) => events.push(event) });
  for (const event of ["dnd5e.ready", "createItem", "deleteItem", "updateItem", "updateActor"]) assert.ok(events.includes(event));
});
