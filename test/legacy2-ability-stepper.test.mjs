import assert from "node:assert/strict";
import { test } from "node:test";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
const controls = await import("../module/applications/actor/jj/ability-steps-2.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
function fixture(value = 6) {
  version = "2.0";
  const writes = [], base = { value };
  const actor = { type: "character", system: { abilities: { str: { value: value + 2, _source: base } } },
    async update(data) {
      await Promise.resolve();
      writes.push(data); base.value = data["system.abilities.str.value"];
      this.system.abilities.str.value = base.value + 2;
    } };
  return { sheet: { actor, isEditable: true, isEditMode: true }, base, writes };
}
const target = step => ({ dataset: { ability: "str", step: String(step) } });

test("attribute arrows change the saved base by one without baking in Active Effect bonuses", async () => {
  assert.equal(typeof controls.stepPlayerAbility, "function");
  const { sheet, writes, base } = fixture();
  await controls.stepPlayerAbility(sheet, target(1));
  await controls.stepPlayerAbility(sheet, target(-1));
  assert.deepEqual(writes, [{ "system.abilities.str.value": 7 }, { "system.abilities.str.value": 6 }]);
  assert.equal(base.value, 6); assert.equal(sheet.actor.system.abilities.str.value, 8);
});

test("rapid clicks remain sequential rather than dropping increments", async () => {
  assert.equal(typeof controls.stepPlayerAbility, "function");
  const { sheet, base } = fixture();
  await Promise.all([1, 1, 1, -1].map(step => controls.stepPlayerAbility(sheet, target(step))));
  assert.equal(base.value, 8);
});

test("arrows enforce one through twelve and reject invalid directions, keys and read-only or play mode", async () => {
  assert.equal(typeof controls.stepPlayerAbility, "function");
  const { sheet, base, writes } = fixture(1);
  await controls.stepPlayerAbility(sheet, target(-1));
  base.value = 12;
  await controls.stepPlayerAbility(sheet, target(1));
  for (const step of [0, 2, -2, "invalid", ""]) await controls.stepPlayerAbility(sheet, target(step));
  await controls.stepPlayerAbility(sheet, { dataset: { ability: "invalid", step: "1" } });
  for (const changes of [{ isEditable: false }, { isEditMode: false }, { actor: { ...sheet.actor, type: "npc" } }])
    await controls.stepPlayerAbility({ ...sheet, ...changes }, target(-1));
  version = "1.0";
  await controls.stepPlayerAbility(sheet, target(-1));
  assert.deepEqual(writes, []);
});
