import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
globalThis.game = { settings: { get: (scope, key) => key === "regraSalvaguarda" ? true : "2.0" } };
globalThis.CONFIG = { DND5E: { abilities: { con: { label: "Constituição" } } }, statusEffects: {
  "jj-atordoado": { id: "jj-atordoado", name: "Atordoado" }, poisoned: { id: "poisoned", name: "DND5E.Poisoned" }
} };
const api = await import("../module/systems/activity-conditions.mjs");
test("condition editor uses the game's Jujutsu conditions and the enabled save rule", () => {
  const context = api.activityConditionsContext({ type: "attack", conditions: [{ _id: "row", condition: "jj-atordoado", save: "cha" }] });
  assert.deepEqual(context.conditionOptions.map(option => option.value), ["jj-atordoado"]);
  assert.deepEqual(context.saveOptions.map(option => option.label), ["Fortitude", "Vontade", "Reflexo"]);
  assert.equal(context.rows[0].saveValue, "con");assert.equal(context.isAttack, true);
});
test("attack and save effect editors replace applied effects with the condition editor", () => {
  for (const type of ["attack", "save"]) {
    const template = readFileSync(new URL(`../templates/activity/${type}-effect.hbs`, import.meta.url), "utf8");
    assert.ok(template.includes("activity-conditions.hbs"));assert.ok(!template.includes("activity-effects.hbs"));
  }
});
