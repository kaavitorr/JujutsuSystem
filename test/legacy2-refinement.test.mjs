import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
const body = source.match(/static async #onRefineEnergy\(\) \{([\s\S]*?)\n  \}/)?.[1];

test("refining from the icon uses the existing dialog and processes its choice once", async () => {
  assert.ok(body, "a dedicated refinement action must exist");
  let dialogs = 0, refinements = 0;
  const actor = {};
  const choices = { amount: 2 };
  const dialog = { async configure(a) { assert.equal(a, actor); dialogs++; return choices; } };
  const energy = { async processTurnStartWithChoices(a, c) {
    assert.equal(a, actor); assert.equal(c, choices); refinements++;
  } };
  const handler = new Function("Ruleset", "EnergyGenerationDialog", "EnergySystem",
    `return async function() {${body}}`)({ isV2: () => true, isRestringido: () => false }, dialog, energy);
  await handler.call({ actor, isEditable: true, isEditMode: false });
  assert.equal(dialogs, 1);
  assert.equal(refinements, 1);
  await handler.call({ actor, isEditable: false });
  assert.equal(dialogs, 1);
  dialog.configure = async () => null;
  await handler.call({ actor, isEditable: true });
  assert.equal(refinements, 1);
});
