import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.FixtureBasicRoll = class {};
globalThis.CONFIG = { Dice: { D20Die: class { formula = "1d20"; } } };
let source = await fs.readFile(new URL("../module/dice/d20-roll.mjs", import.meta.url), "utf8");
source = source.replace(/import D20RollConfigurationDialog[^;]+;/, "const D20RollConfigurationDialog = class {};")
  .replace(/import \{ areKeysPressed \}[^;]+;/, "const areKeysPressed = () => false;")
  .replace(/import BasicRoll[^;]+;/, "const BasicRoll = globalThis.FixtureBasicRoll;");
source = source.replace(/from "(\.\.[^"]+)"/g, (_, relative) => `from ${JSON.stringify(new URL(relative, new URL("../module/dice/d20-roll.mjs", import.meta.url)).href)}`);
const { default: D20Roll } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
CONFIG.Dice.D20Roll = D20Roll;
class CaptureRoll { constructor(formula, data, options) { Object.assign(this, { formula, data, options }); } }
test("initiative roll factory applies up to six counted advantages on one d20", () => {
  const process = { subject: { system: { abilities: { dex: { value: 5 } } } }, hookNames: ["initiativeDialog"],
    legacy2: { vantagens: 6, desvantagens: 1 }, rolls: [{ options: {} }] };
  const roll = D20Roll.fromConfig.call(CaptureRoll, { parts: ["@mod", "@ruleBonus"],
    data: { mod: 5, ruleBonus: 3 }, options: { advantageMode: 1 } }, process);
  assert.equal(roll.data.legacyAdv, 10);
  assert.equal(roll.options.advantageMode, 0);
  assert.equal(roll.formula, "1d20 + @mod + @ruleBonus + @legacyAdv");
});
test("native roll factory also clamps counters and uses one d20 when the prompt is skipped", () => {
  const process = { subject: { system: { abilities: { dex: { value: 5 } } } }, ability: "dex", rolls: [{ options: { advantageMode: 1 } }] };
  const roll = D20Roll.fromConfig.call(CaptureRoll, { parts: ["@mod"], data: { mod: 5 }, options: { advantageMode: 1 } }, process);
  assert.equal(roll.data.legacyAdv, 2);
  assert.equal(roll.options.advantageMode, 0);
  assert.equal(roll.formula, "1d20 + @mod + @legacyAdv");
  process.legacy2 = { vantagens: 18, desvantagens: 2 };
  const explicit = D20Roll.fromConfig.call(CaptureRoll, { parts: ["@mod", "@legacyAdv"], data: { mod: 5 }, options: {} }, process);
  assert.equal(explicit.data.legacyAdv, 8);
  assert.equal(explicit.options.jj2TestParts.filter(part => part === "@legacyAdv").length, 1);
});
