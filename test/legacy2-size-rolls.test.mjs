import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLegacy2TestRoll, testRollChoices } from "../module/applications/dice/legacy2-test-roll.mjs";
import { sizePushTestContext, preventSizePushRoll } from "../module/systems/legacy2-size.mjs";

globalThis.game = { settings: { get: () => "2.0" }, user: { targets: new Set() } };
globalThis.CONFIG = { Dice: { D20Roll: { ADV_MODE: { NORMAL: 0, ADVANTAGE: 1, DISADVANTAGE: -1 } } } };
const actor = size => ({ type: "npc", name: "Criatura", system: { abilities: { str: { value: 4 } }, traits: { size } }, items: [], statuses: new Set() });
const processFor = (size, legacy2 = {}) => ({ subject: actor(size), ability: "str", hookNames: ["savingThrowDialog"], legacy2 });
const rollFor = () => ({ parts: ["@mod"], data: { mod: 4 }, options: {} });

test("push advantages are automatic only in a push-resistance test and share the general cap", () => {
  for (const [size, advantages] of [["lg", 2], ["huge", 4]]) {
    const process = processFor(size);
    assert.equal(testRollChoices(process, undefined, rollFor()).vantagens, 0);
    process.legacy2.resistPush = true;
    const roll = rollFor(); roll.options.advantageCount = 3;
    assert.equal(testRollChoices(process, undefined, roll).vantagens, Math.min(6, advantages + 3));
  }
});

test("toggling push resistance in the real roll builder adds and removes its automatic component once", () => {
  const process = processFor("huge"), roll = rollFor();
  applyLegacy2TestRoll(roll, process);
  const form = checked => new Map([["jj2Test.resistPush", checked], ["jj2Test.vantagens", process.legacy2.vantagens], ["jj2Test.desvantagens", 0]]);
  applyLegacy2TestRoll(roll, process, form(true));
  assert.equal(roll.data.legacyAdv, 4);
  applyLegacy2TestRoll(roll, process, form(true));
  assert.equal(roll.data.legacyAdv, 4);
  applyLegacy2TestRoll(roll, process, form(false));
  assert.equal(roll.data.legacyAdv, 0);
  assert.equal(process.legacy2.resistPush, false);
});

test("Imenso needs no push roll but retains normal rolls and situational advantages elsewhere", () => {
  const process = processFor("grg", { resistPush: true });
  assert.equal(sizePushTestContext(process).immune, true);
  assert.equal(preventSizePushRoll(process.subject, process), true);
  assert.equal(preventSizePushRoll(process.subject, { legacy2: { resistPush: false } }), false);
  assert.equal(preventSizePushRoll(actor("huge"), process), false);
  process.hookNames = ["initiativeDialog"];
  assert.equal(sizePushTestContext(process), null);
});
