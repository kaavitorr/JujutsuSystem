import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { EnergySystem } from "../module/systems/energy.mjs";

let version = "2.0", choice = { flatBonus: 0 }, dialogs = [];
globalThis.game = { settings: { get: () => version } };
globalThis.ui = { notifications: { info() {}, warn() {} } };
const source = readFileSync(new URL("../module/applications/actor/npc-sheet.mjs", import.meta.url), "utf8");
const start = source.indexOf("async function _npcGenerateEnergy(actor) {");
const body = source.slice(start, source.indexOf("// Explosão Defensiva do NPC", start));
const generate = new Function("Ruleset", "EnergySystem", "EnergyGenerationDialog", `${body};return _npcGenerateEnergy;`)(
  Ruleset, EnergySystem, { async configure(actor) { dialogs.push(actor); return choice; } });
const action = source.match(/jj2RefineEnergy: (function\(\) \{[^\n]+\}),/)[1];
const refine = new Function("Ruleset", "_npcGenerateEnergy", `return ${action};`)(Ruleset, generate);

function fixture({ total = 100, generated = 6 } = {}) {
  version = "2.0"; choice = { flatBonus: 0 }; dialogs = [];
  const writes = [];
  const actor = { type: "npc", name: "Criatura", flags: { "jujutsu-system": { refinamentoBonus: 5 } }, items: [],
    system: { details: { level: 99 }, legacy2: { nd: "7" }, energy: { generated, total, genMax: 300, genPerTurn: 1,
      intensiveTraining: { generatedEnergy: 2 } } },
    async update(data) {
      assert.ok(!Object.hasOwn(data, "system.energy.generation.turnMultiplier"), "NPC energy schema has no 1.0 generation multiplier");
      writes.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split('.'), key = keys.pop();
        keys.reduce((object, part) => object[part], this)[key] = value;
      }
    }
  };
  return { actor, writes, sheet: { actor, isEditable: true } };
}

test("the NPC refinement icon opens the player dialog and uses ND with training and trait bonuses", async () => {
  const { actor, sheet, writes } = fixture();
  await refine.call(sheet);
  assert.deepEqual(dialogs, [actor]);
  assert.equal(actor.system.energy.generated, 21); // ND 7 × 2 + 2 training + 5 trait.
  assert.equal(actor.system.energy.total, 85);
  assert.equal(writes.length, 1);
  await refine.call(sheet);
  assert.equal(writes.length, 1, "refining again cannot exceed the normal ceiling or spend another reserve");
});

test("canceling the NPC refinement dialog and opening a read-only sheet never transfer energy", async () => {
  const { actor, sheet, writes } = fixture(); choice = null;
  await refine.call(sheet); assert.equal(dialogs.length, 1);
  assert.deepEqual(writes, []); assert.equal(actor.system.energy.generated, 6); assert.equal(actor.system.energy.total, 100);
  await refine.call({ ...sheet, isEditable: false }); assert.equal(dialogs.length, 1);
});

test("NPC refinement allows the same explicit spell bonus as the player and respects the available reserve", async () => {
  const full = fixture(); choice = { flatBonus: 3 }; await refine.call(full.sheet);
  assert.equal(full.actor.system.energy.generated, 24); assert.equal(full.actor.system.energy.total, 82);
  const limited = fixture({ total: 4 }); await refine.call(limited.sheet);
  assert.equal(limited.actor.system.energy.generated, 10); assert.equal(limited.actor.system.energy.total, 0);
});

test("NPC turn confirmation doubles a fixed ND ceiling without 1.0 fields or compounding refinement", async () => {
  const { actor, writes } = fixture();
  await EnergySystem.processTurnStartWithChoices(actor, { flatBonus: 0 }, { reserves: 5 });
  assert.equal(actor.system.energy.generated, 42); assert.equal(actor.system.energy.total, 64);
  await EnergySystem.processTurnStartWithChoices(actor, { flatBonus: 0 }, { reserves: 6 });
  assert.equal(actor.system.energy.generated, 42); assert.equal(writes.length, 1);
});

test("1.0 NPCs keep their configured generation amount and do not open the 2.0 modal", async () => {
  const { actor } = fixture(); version = "1.0";
  await generate(actor);
  assert.equal(actor.system.energy.generated, 7); assert.equal(actor.system.energy.total, 99);
  assert.deepEqual(dialogs, []);
});

test("direct NPC generation uses the same ND ceiling without requiring player-only generation fields", async () => {
  const { actor, writes } = fixture();
  await EnergySystem.processTurnStart(actor);
  assert.equal(actor.system.energy.generated, 21); assert.equal(actor.system.energy.total, 85);
  assert.equal(writes.length, 1);
});
